<template>
  <!-- Database + App storage: on a unified server MariaDB and the apps share
       one disk, so these read as two usage meters against the same total —
       each bar fills to that workload's footprint. OS overhead and free space
       are shared (neither workload), so they're the gray remainder, not a row.
       One card split by a divider that runs edge to edge (vertical on wide
       screens, horizontal when stacked); padding lives on each section so the
       divider is flush. -->
  <div class="mt-10 overflow-hidden rounded-xl border border-outline-gray-2 bg-surface-elevation-1">
    <div class="grid grid-cols-1 divide-y divide-outline-gray-2 xl:grid-cols-2 xl:divide-x xl:divide-y-0">
    <!-- Database storage: what MariaDB is doing with the disk. Binary logs are
         usually the surprise, so they get a purge affordance right here. -->
    <StorageBreakdownCard
      class="p-6 xl:pr-4"
      inset-right
      title="Database storage"
      icon="lucide-database"
      :used-gb="dbSegmentsTotal"
      :segments="dbSegments"
      :total-gb="disk.diskTotal"
    >
      <template #footer>
        <div class="mt-4 border-t border-outline-alpha-gray-1 pt-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <h3 class="text-p-sm font-medium text-ink-gray-7">{{ topDbTitle }}</h3>
              <Badge theme="gray" variant="subtle" size="sm" :label="String(sortedDbs.length)" />
            </div>
            <Button v-if="sortedDbs.length > 5" variant="ghost" size="sm" label="See all" @click="panelOpen = true" />
          </div>

          <EmptyState
            v-if="!siteDbs.length"
            class="mt-2 mr-2"
            icon="lucide-database"
            title="No databases yet"
            description="Databases appear here once a site on this server is live."
          />
          <div v-else class="mt-1 mr-2 divide-y divide-outline-alpha-gray-1">
            <component
              :is="db.system ? 'div' : 'button'"
              v-for="db in topDbs"
              :key="db.dbName"
              class="group flex w-full items-center justify-between gap-3 py-2 text-left"
              @click="!db.system && emit('drill', db.siteId)"
            >
              <span class="flex min-w-0 items-center gap-2">
                <span :class="db.system ? 'lucide-database' : 'lucide-globe'" class="size-3.5 shrink-0 text-ink-gray-4" />
                <span class="truncate text-sm" :class="db.system ? 'text-ink-gray-6' : 'text-ink-gray-8 group-hover:text-ink-gray-9'">{{ db.siteName }}</span>
                <Badge v-if="db.system" theme="gray" variant="subtle" size="sm" label="system" />
                <span v-else class="hidden truncate font-mono text-p-xs text-ink-gray-4 sm:block">{{ db.dbName }}</span>
                <span v-if="!db.system" class="lucide-chevron-right size-3.5 shrink-0 text-ink-gray-4 opacity-0 transition-opacity group-hover:opacity-100" />
              </span>
              <span class="shrink-0 tabular-nums text-sm text-ink-gray-7">{{ fmtMb(dbFileMb(db)) }}</span>
            </component>
          </div>
        </div>

        <!-- The reclaim story at server level: binlogs. -->
        <div v-if="buckets.binlog > 1" class="mt-3 mr-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-blue-1 px-3 py-2">
          <span class="text-p-sm text-ink-blue-8">Binary logs are using {{ fmtGb(buckets.binlog) }}. Purge them or reduce retention to free up space.</span>
          <span class="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" label="Docs" @click="toast.success('Opening binary log documentation…')" />
            <Button size="sm" variant="subtle" label="Purge binary logs" :loading="purging" @click="purgeOpen = true" />
          </span>
        </div>
      </template>
    </StorageBreakdownCard>

    <!-- App storage: the same disk grouped by what your team put on it. -->
    <StorageBreakdownCard
      class="p-6"
      title="App storage"
      icon="lucide-package"
      :used-gb="appSegmentsTotal"
      :segments="appSegments"
      :total-gb="disk.diskTotal"
    />
    </div>
  </div>

  <!-- Server-wide diagnostics. One MariaDB serves every site, so processes and
       locks only make sense here; per-database work lives in the site view.
       A flat stacked list, not cards — these are read-outs, not top-level sections. -->
  <div class="mt-16">
    <h2 class="text-base font-medium text-ink-gray-9">Diagnostics</h2>
    <div class="mt-4">
  <Disclosure flat title="Database processes" :subtitle="edgeBroken ? 'Unavailable' : `${filteredProcesses.length} connection${filteredProcesses.length === 1 ? '' : 's'}`" :default-open="notableProcesses">
    <template v-if="!edgeBroken && siteDbs.length > 1" #actions>
      <Dropdown :options="siteFilterOptions" placement="bottom-end">
        <Button variant="outline" size="sm" icon-right="lucide-chevron-down" :label="siteFilterLabel" />
      </Dropdown>
    </template>
    <ErrorState
      v-if="edgeBroken"
      icon="lucide-database-zap"
      title="Couldn't reach the database server"
      description="The process list didn't load. This usually passes in a few seconds."
    >
      <Button size="sm" variant="subtle" label="Retry" @click="toast.error('Still can\'t reach the database server')" />
    </ErrorState>
    <template v-else>
      <p v-if="!filteredProcesses.length" class="text-p-sm text-ink-gray-5">No active connections{{ siteFilter ? ' for this site' : '' }}.</p>
      <div v-else>
        <div class="flex items-center gap-3 border-b border-outline-gray-2 pb-2 text-xs font-medium uppercase tracking-wide text-ink-gray-5">
          <span class="w-12 shrink-0">ID</span>
          <span class="w-24 shrink-0">Command</span>
          <span class="hidden w-36 shrink-0 md:block">Site</span>
          <span class="min-w-0 flex-1">Query</span>
          <span class="w-12 shrink-0 text-right">Time</span>
          <span class="w-14 shrink-0" />
        </div>
        <div class="divide-y divide-outline-alpha-gray-1">
          <div v-for="p in visibleProcesses" :key="p.id" class="flex items-center gap-3 py-2 text-sm">
            <span class="w-12 shrink-0 tabular-nums text-ink-gray-5">{{ p.id }}</span>
            <span class="w-24 shrink-0 truncate text-ink-gray-6">{{ p.command }}<span v-if="p.state" class="text-ink-gray-4"> · {{ p.state }}</span></span>
            <span class="hidden w-36 shrink-0 items-center gap-1.5 truncate text-ink-gray-5 md:flex">
              <span v-if="siteNameOf(p.siteId)" class="lucide-globe size-3.5 shrink-0 text-ink-gray-4" />
              <span class="truncate">{{ siteNameOf(p.siteId) || 'system' }}</span>
            </span>
            <span class="min-w-0 flex-1 truncate font-mono text-ink-gray-7">{{ p.info || '—' }}</span>
            <span class="w-12 shrink-0 text-right tabular-nums" :class="isSlow(p) ? 'text-ink-amber-7' : 'text-ink-gray-5'">{{ p.time }}</span>
            <span class="w-14 shrink-0 text-right">
              <Button size="sm" variant="ghost" theme="red" label="Kill" @click="askKill(p)" />
            </span>
          </div>
        </div>
        <button
          v-if="otherCount"
          class="mt-2 flex items-center gap-1 text-p-sm text-ink-gray-5 hover:text-ink-gray-7"
          @click="showAllOther = !showAllOther"
        >
          <span class="lucide-chevron-down size-3.5 shrink-0 transition-transform" :class="showAllOther ? 'rotate-180' : ''" />
          {{ showAllOther ? 'Show fewer' : `Show ${otherCount} other connection${otherCount === 1 ? '' : 's'}` }}
        </button>
      </div>
    </template>
  </Disclosure>

  <Disclosure flat title="Database locks" :subtitle="data.locks.length ? `${data.locks.length} blocked` : 'None'">
    <p v-if="!data.locks.length" class="text-p-sm text-ink-gray-5">No transactions are waiting on a lock.</p>
    <div v-else class="space-y-2">
      <div v-for="(l, i) in data.locks" :key="i" class="rounded-lg border border-outline-amber-1 bg-surface-amber-1 p-3 text-xs text-ink-amber-8">
        <div>
          Connection <span class="font-medium tabular-nums">{{ l.waitingId }}</span> waited {{ l.waitedFor }} on
          <span class="font-medium tabular-nums">{{ l.blockingId }}</span><template v-if="siteNameOf(l.siteId)"> · <span class="lucide-globe inline-block size-3 shrink-0 -translate-y-px align-middle" />&nbsp;{{ siteNameOf(l.siteId) }}</template>.
        </div>
        <code class="mt-1.5 block truncate font-mono text-ink-amber-7">{{ l.waitingQuery }}</code>
      </div>
    </div>
  </Disclosure>

  <Disclosure flat title="Slow queries" :subtitle="`${allSlowQueries.length} slow across ${siteDbs.length} database${siteDbs.length === 1 ? '' : 's'} · last 24h`">
    <p v-if="!allSlowQueries.length" class="text-p-sm text-ink-gray-5">No slow queries in the last 24 hours.</p>
    <div v-else class="space-y-3">
      <div v-for="(q, i) in allSlowQueries" :key="i" class="rounded-lg border border-outline-gray-2 p-3">
        <div class="flex items-start justify-between gap-3">
          <code class="block min-w-0 truncate font-mono text-xs text-ink-gray-8">{{ q.digest }}</code>
          <button class="flex shrink-0 items-center gap-1 text-p-xs text-ink-gray-5 underline-offset-2 hover:underline" @click="emit('drill', q.siteId)">
            <span class="lucide-globe size-3.5 shrink-0 text-ink-gray-4" />
            {{ q.siteName }} →
          </button>
        </div>
        <div class="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-gray-5">
          <span><span class="tabular-nums text-ink-gray-7">{{ q.avgMs }}</span> ms avg</span>
          <span><span class="tabular-nums text-ink-gray-7">{{ q.calls.toLocaleString() }}</span> calls</span>
          <span><span class="tabular-nums text-ink-gray-7">{{ q.rowsAvg.toLocaleString() }}</span> rows avg</span>
          <span><span class="tabular-nums text-ink-gray-7">{{ Math.round(q.totalSec / 60).toLocaleString() }}</span> min total</span>
        </div>
      </div>
    </div>
  </Disclosure>
    </div>
  </div>

  <AllDatabasesPanel v-model:open="panelOpen" :databases="sortedDbs" @drill="openSite" />

  <ConfirmDialog
    v-model:open="purgeOpen"
    title="Purge binary logs?"
    :message="`Binary logs older than the retention window are deleted, freeing about ${fmtGb(purgeableGb)}. Recent logs are kept so replication and point-in-time recovery keep working.`"
    confirm-label="Purge"
    @confirm="purge"
  />
  <ConfirmDialog
    v-model:open="killOpen"
    theme="red"
    :title="`Kill connection ${pendingKill?.id}?`"
    message="Whatever this connection is running gets rolled back. Killing the wrong one can interrupt a live save or a migration."
    confirm-label="Kill"
    @confirm="kill"
  />
</template>

<script setup>
import { computed, ref } from 'vue'
import { Badge, Button, Dropdown, toast } from 'frappe-ui'
import Disclosure from '../Disclosure.vue'
import ConfirmDialog from '../ConfirmDialog.vue'
import EmptyState from '../EmptyState.vue'
import ErrorState from '../ErrorState.vue'
import StorageBreakdownCard from './StorageBreakdownCard.vue'
import AllDatabasesPanel from './AllDatabasesPanel.vue'
import { getServerDbData, getSiteDbData, dbFileMb } from '../../data/dbAnalyzer'
import { fmtGb, fmtMb } from './format'
import { useCloudStore } from '../../stores/cloud'

const props = defineProps({
  server: { type: Object, required: true },
  liveSites: { type: Array, required: true },
})
const emit = defineEmits(['drill'])

const store = useCloudStore()

const disk = computed(() => store.healthOf(props.server))
const data = getServerDbData(props.server, props.liveSites, disk.value)
const buckets = data.buckets
const siteDbs = computed(() => props.liveSites.map(getSiteDbData))

// — Two workloads on one disk. Each card lists only its own footprint; the
// shared OS overhead and free space stay unlabeled (the bar's gray remainder),
// so no card claims disk the other workload — or nobody — is using.
const dbSegments = computed(() => {
  const dbCount = siteDbs.value.length + data.systemDbs.length // sites + mysql, sys, performance_schema
  return [
    { label: 'MariaDB binary log', gb: buckets.binlog, color: 'var(--ink-orange-5)' },
    { label: `${dbCount} databases (including mysql, sys, perf_schema)`, gb: buckets.databases, color: 'var(--ink-purple-5)' },
    { label: 'MariaDB core', gb: buckets.mariadbCore, color: 'var(--ink-cyan-5)' },
    { label: 'MariaDB owned system files', gb: buckets.systemFiles, color: 'var(--ink-red-5)' },
    { label: 'MariaDB error log', gb: buckets.errorLog, color: 'var(--ink-amber-5)' },
    { label: 'MariaDB slow log', gb: buckets.slowLog, color: 'var(--ink-teal-5)' },
    { label: 'MariaDB binlog indexes', gb: buckets.binlogIndexes, color: 'var(--ink-blue-5)' },
  ]
})
const dbSegmentsTotal = computed(() => dbSegments.value.reduce((a, s) => a + s.gb, 0))

const appSegments = computed(() => [
  { label: 'Apps', gb: buckets.apps, color: 'var(--ink-blue-5)', children: data.appChildren },
  { label: 'Site files', gb: buckets.siteFiles, color: 'var(--ink-violet-5)', children: data.siteChildren },
  { label: 'Logs', gb: buckets.logs, color: 'var(--ink-amber-5)' },
])
const appSegmentsTotal = computed(() => appSegments.value.reduce((a, s) => a + s.gb, 0))

// — Databases list. Sites plus the system schemas MariaDB keeps for itself,
// largest first. Beyond five, "See all" opens the full master–detail panel
// rather than growing the card.
const panelOpen = ref(false)
const allDbs = computed(() => [...siteDbs.value, ...data.systemDbs])
const sortedDbs = computed(() => [...allDbs.value].sort((a, b) => dbFileMb(b) - dbFileMb(a)))
const topDbs = computed(() => sortedDbs.value.slice(0, 5))
const topDbTitle = computed(() =>
  sortedDbs.value.length > 5 ? 'Usage of top 5 databases' : 'Usage per database'
)
const openSite = (siteId) => emit('drill', siteId)

// — Purge binary logs. Keeps a retention floor; the freed space flows into
// the store so ServerHealth and Central agree afterwards.
const purgeOpen = ref(false)
const purging = ref(false)
const purgeableGb = computed(() => Math.max(Math.round((buckets.binlog * 0.85) * 10) / 10, 0))
function purge() {
  purging.value = true
  setTimeout(() => {
    purging.value = false
    if (store.edgeMode) {
      toast.error("Couldn't purge binary logs — the database server didn't respond.")
      return
    }
    const freed = purgeableGb.value
    buckets.binlog = Math.round((buckets.binlog - freed) * 10) / 10
    store.reclaimServerDisk(props.server.id, freed)
    toast.success(`Purged ${fmtGb(freed)} of binary logs`)
  }, 1200)
}

// — Processes: filterable by site, killable with confirm.
const edgeBroken = computed(() => store.edgeMode)
const siteFilter = ref(null)
const siteFilterLabel = computed(() => siteNameOf(siteFilter.value) || 'All sites')
const siteFilterOptions = computed(() => [
  { label: 'All sites', onClick: () => (siteFilter.value = null) },
  ...props.liveSites.map((s) => ({ label: s.name, onClick: () => (siteFilter.value = s.id) })),
])
// Running queries lead, slowest first; idle Sleep connections sink to the
// bottom — the way a DBA actually reads a processlist.
const secs = (t) => parseFloat(t) || 0
const filteredProcesses = computed(() => {
  const list = siteFilter.value ? data.processes.filter((p) => p.siteId === siteFilter.value) : data.processes
  return [...list].sort((a, b) => {
    const aActive = a.command === 'Query'
    const bActive = b.command === 'Query'
    if (aActive !== bActive) return aActive ? -1 : 1
    return secs(b.time) - secs(a.time)
  })
})

// What's worth triaging: a long-running query, or a connection tangled in a
// lock. A 0.02s query is as much noise as an idle Sleep — duration is the
// signal, not command. Fast queries and idle connections fold away together.
const lockedIds = computed(() => {
  const s = new Set()
  data.locks.forEach((l) => { s.add(l.waitingId); s.add(l.blockingId) })
  return s
})
const isNotable = (p) => isSlow(p) || lockedIds.value.has(p.id)
const notableProcs = computed(() => filteredProcesses.value.filter(isNotable))
const otherProcs = computed(() => filteredProcesses.value.filter((p) => !isNotable(p)))
const showAllOther = ref(false)
// Healthy server (nothing notable): expanding just shows the lot, no toggle.
// Otherwise lead with the notable rows and fold the rest behind a toggle.
const visibleProcesses = computed(() => {
  if (!notableProcs.value.length) return filteredProcesses.value
  return showAllOther.value ? [...notableProcs.value, ...otherProcs.value] : notableProcs.value
})
const otherCount = computed(() => (notableProcs.value.length ? otherProcs.value.length : 0))
// A running query is slow past ~5s; idle Sleep connections don't count however
// long they've sat.
const isSlow = (p) => p.command === 'Query' && /^\d+s$/.test(p.time) && parseInt(p.time) >= 5
const siteNameOf = (id) => props.liveSites.find((s) => s.id === id)?.name || null

// Open the process list on load only when it's worth a look — a long-running
// query, a blocked lock, or an outage. Otherwise it stays folded like the rest.
const notableProcesses = computed(
  () => edgeBroken.value || data.locks.length > 0 || data.processes.some((p) => isSlow(p))
)

const killOpen = ref(false)
const pendingKill = ref(null)
function askKill(p) {
  pendingKill.value = p
  killOpen.value = true
}
function kill() {
  if (store.edgeMode) {
    toast.error(`Couldn't kill connection ${pendingKill.value.id} — try again.`)
    return
  }
  const id = pendingKill.value.id
  const i = data.processes.findIndex((p) => p.id === id)
  if (i !== -1) data.processes.splice(i, 1)
  // A killed connection can't hold or wait on locks anymore.
  data.locks = data.locks.filter((l) => l.waitingId !== id && l.blockingId !== id)
  toast.success(`Killed connection ${id}`)
}

// — Slow queries across every database, worst offenders first.
const allSlowQueries = computed(() =>
  siteDbs.value
    .flatMap((db) => db.slowQueries.map((q) => ({ ...q, siteId: db.siteId, siteName: db.siteName })))
    .sort((a, b) => b.totalSec - a.totalSec)
)
</script>

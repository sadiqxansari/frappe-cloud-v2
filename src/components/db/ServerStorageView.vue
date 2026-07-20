<template>
  <!-- Database + App storage: on a unified server MariaDB and the apps share
       one disk, so these read as two usage meters against the same total —
       each bar fills to that workload's footprint. OS overhead and free space
       are shared (neither workload), so they're the gray remainder, not a row.
       One card split by a divider that runs edge to edge (vertical on wide
       screens, horizontal when stacked); padding lives on each section so the
       divider is flush. -->
  <div class="overflow-hidden rounded-xl border border-outline-gray-2 bg-surface-elevation-1">
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

  <AllDatabasesPanel v-model:open="panelOpen" :databases="sortedDbs" @drill="(id) => emit('drill', id)" />

  <ConfirmDialog
    v-model:open="purgeOpen"
    title="Purge binary logs?"
    :message="`Binary logs older than the retention window are deleted, freeing about ${fmtGb(purgeableGb)}. The most recent log is kept so replication and point-in-time recovery keep working.`"
    confirm-label="Purge"
    @confirm="purge"
  />
</template>

<script setup>
import { computed, ref } from 'vue'
import { Badge, Button, toast } from 'frappe-ui'
import ConfirmDialog from '../ConfirmDialog.vue'
import EmptyState from '../EmptyState.vue'
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

// — Purge binary logs. Keeps the newest file (retention floor); the freed
// space flows into the store so ServerHealth and Central agree afterwards.
// Operates on the shared binlog file list so the DB analyzer accordion agrees.
const purgeOpen = ref(false)
const purging = ref(false)
const round1 = (v) => Math.round(v * 10) / 10
const removableBinlogs = computed(() => data.binlogs.slice(0, -1))
const purgeableGb = computed(() => round1(removableBinlogs.value.reduce((a, f) => a + f.sizeMb, 0) / 1024))
function purge() {
  purging.value = true
  setTimeout(() => {
    purging.value = false
    if (store.edgeMode) {
      toast.error("Couldn't purge binary logs — the database server didn't respond.")
      return
    }
    const freed = purgeableGb.value
    data.binlogs.splice(0, removableBinlogs.value.length)
    buckets.binlog = round1(Math.max(buckets.binlog - freed, 0))
    store.reclaimServerDisk(props.server.id, freed)
    toast.success(`Purged ${fmtGb(freed)} of binary logs`)
  }, 1200)
}
</script>

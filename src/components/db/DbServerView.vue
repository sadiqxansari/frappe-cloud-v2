<template>
  <!-- Server-wide diagnostics. One MariaDB serves every site, so processes,
       locks and binary logs live here; per-database work lives in the site view.
       A flat stacked list, not cards — these are read-outs, not top-level
       sections. The site filter is applied by the page header. -->
  <div>
    <p class="mb-2 text-p-base font-medium text-ink-gray-6">Live</p>
    <Disclosure first icon="lucide-activity" title="Database processes" :subtitle="edgeBroken ? 'Unavailable' : ''" :open="openKey === 'processes'" @update:open="(v) => emit('update:openKey', v ? 'processes' : null)">
      <ErrorState
        v-if="edgeBroken"
        icon="lucide-database-zap"
        title="Couldn't reach the database server"
        description="The process list didn't load. This usually passes in a few seconds."
      >
        <Button size="sm" variant="subtle" label="Retry" @click="toast.error('Still can\'t reach the database server')" />
      </ErrorState>
      <PaginatedListView
        v-else
        :columns="processColumns"
        :rows="processRows"
        :options="processOptions"
        row-key="id"
        :page-length="10"
        :page-length-options="[10, 20, 50]"
      >
        <template #cell="{ column, row }">
          <span v-if="column.key === 'id'" class="tabular-nums text-ink-gray-5">{{ row.id }}</span>
          <span v-else-if="column.key === 'command'" class="truncate text-ink-gray-6" :title="row._p.state ? `${row.command} · ${row._p.state}` : row.command">{{ row.command }}<span v-if="row._p.state" class="text-ink-gray-4"> · {{ row._p.state }}</span></span>
          <span v-else-if="column.key === 'user'" class="truncate font-mono text-ink-gray-5">{{ row._p.user }}</span>
          <button v-else-if="column.key === 'site' && siteNameOf(row._p.siteId)" class="group flex w-full min-w-0 items-center gap-1.5 text-left text-ink-gray-5 transition-colors hover-hover:text-ink-gray-8" @click.stop="emit('drill', row._p.siteId)">
            <span class="lucide-globe size-3.5 shrink-0 text-ink-gray-4 transition-colors group-hover-hover:text-ink-gray-6" />
            <span class="min-w-0 flex-1 truncate">{{ siteNameOf(row._p.siteId) }}</span>
          </button>
          <span v-else-if="column.key === 'site'" class="truncate text-ink-gray-5">system</span>
          <span v-else-if="column.key === 'query'" class="truncate font-mono text-ink-gray-7" :title="row._p.info || ''">{{ row._p.info || '—' }}</span>
          <span v-else-if="column.key === 'time'" class="tabular-nums" :class="isSlow(row._p) ? 'text-ink-amber-7' : 'text-ink-gray-5'">{{ row._p.time }}</span>
          <Button v-else-if="column.key === 'actions'" size="sm" variant="ghost" theme="red" label="Kill" @click.stop="askKill(row._p)" />
        </template>
      </PaginatedListView>
    </Disclosure>

    <Disclosure icon="lucide-lock" title="Database locks" :open="openKey === 'locks'" @update:open="(v) => emit('update:openKey', v ? 'locks' : null)">
      <PaginatedListView
        :columns="lockColumns"
        :rows="lockRows"
        :options="lockOptions"
        row-key="id"
      >
        <template #cell="{ column, row }">
          <span v-if="column.key === 'waiting'" class="tabular-nums text-ink-amber-8">{{ row.waiting }}</span>
          <span v-else-if="column.key === 'blocking'" class="tabular-nums text-ink-gray-7">{{ row.blocking }}</span>
          <span v-else-if="column.key === 'waited'" class="tabular-nums text-ink-gray-6">{{ row.waited }}</span>
          <span v-else-if="column.key === 'site'" class="flex min-w-0 items-center gap-1.5 truncate text-ink-gray-5">
            <span v-if="siteNameOf(row._l.siteId)" class="lucide-globe size-3.5 shrink-0 text-ink-gray-4" />
            <span class="truncate">{{ siteNameOf(row._l.siteId) || 'system' }}</span>
          </span>
          <span v-else-if="column.key === 'query'" class="truncate font-mono text-ink-amber-7" :title="row._l.waitingQuery">{{ row._l.waitingQuery }}</span>
        </template>
      </PaginatedListView>
    </Disclosure>

    <p class="mb-2 mt-10 text-p-base font-medium text-ink-gray-6">History and maintenance</p>
    <Disclosure icon="lucide-timer" title="Slow queries" :subtitle="filteredSlow.length ? `Across ${slowDbCount} database${slowDbCount === 1 ? '' : 's'}` : ''" :open="openKey === 'slow'" @update:open="(v) => emit('update:openKey', v ? 'slow' : null)">
      <PaginatedListView
        :columns="slowColumns"
        :rows="slowRows"
        :options="slowOptions"
        row-key="id"
      >
        <template #cell="{ column, row }">
          <span v-if="column.key === 'query'" class="truncate font-mono text-ink-gray-8" :title="row._q.digest">{{ row._q.digest }}</span>
          <button v-else-if="column.key === 'site'" class="group flex w-full min-w-0 items-center gap-1.5 text-ink-gray-6 transition-colors hover-hover:text-ink-gray-8" @click.stop="emit('drill', row._q.siteId)">
            <span class="lucide-globe size-3.5 shrink-0 text-ink-gray-4 transition-colors group-hover-hover:text-ink-gray-6" />
            <span class="min-w-0 flex-1 truncate text-left">{{ row._q.siteName }}</span>
          </button>
          <span v-else-if="column.key === 'avg'" class="tabular-nums text-ink-gray-7">{{ row._q.avgMs }} ms</span>
          <span v-else-if="column.key === 'calls'" class="tabular-nums text-ink-gray-6">{{ row._q.calls.toLocaleString() }}</span>
          <span v-else-if="column.key === 'rows'" class="tabular-nums text-ink-gray-6">{{ row._q.rowsAvg.toLocaleString() }}</span>
          <span v-else-if="column.key === 'total'" class="tabular-nums text-ink-gray-6">{{ Math.round(row._q.totalSec / 60).toLocaleString() }} min</span>
        </template>
      </PaginatedListView>
    </Disclosure>

    <Disclosure icon="lucide-scroll-text" title="Database binary logs" :subtitle="data.binlogs.length ? `${data.binlogs.length} file${data.binlogs.length === 1 ? '' : 's'}` : ''" :open="openKey === 'binlogs'" @update:open="(v) => emit('update:openKey', v ? 'binlogs' : null)">
      <PaginatedListView
        :columns="binlogColumns"
        :rows="binlogRows"
        :options="binlogOptions"
        row-key="name"
      >
        <template #cell="{ column, row }">
          <span v-if="column.key === 'name'" class="truncate font-mono text-ink-gray-8">{{ row.name }}</span>
          <span v-else-if="column.key === 'date'" class="text-ink-gray-6">{{ row.date }}</span>
          <span v-else-if="column.key === 'size'" class="tabular-nums text-ink-gray-7">{{ fmtMb(row._f.sizeMb) }}</span>
          <Button v-else-if="column.key === 'actions'" size="sm" variant="ghost" theme="red" icon="lucide-trash-2" tooltip="Remove" aria-label="Remove" @click.stop="askRemove([row.name])" />
        </template>
        <!-- Bulk removal now lives in ListView's own selection banner (triggered
             by the header/row checkboxes) instead of a separate button we had
             to show/hide ourselves. -->
        <template #selectionActions="{ selections, unselectAll }">
          <Button size="sm" variant="ghost" theme="red" icon="lucide-trash-2" :tooltip="`Remove ${selections.size}`" :aria-label="`Remove ${selections.size}`" @click="askRemove([...selections], unselectAll)" />
        </template>
      </PaginatedListView>
    </Disclosure>
  </div>

  <ConfirmDialog
    v-model:open="killOpen"
    theme="red"
    :title="`Kill connection ${pendingKill?.id}?`"
    message="Whatever this connection is running gets rolled back. Killing the wrong one can interrupt a live save or a migration."
    confirm-label="Kill"
    @confirm="kill"
  />
  <ConfirmDialog
    v-model:open="removeOpen"
    :title="pendingRemove.length > 1 ? `Remove ${pendingRemove.length} binary logs?` : 'Remove this binary log?'"
    :message="`This frees about ${fmtGb(pendingRemoveGb)}. Removing a log that replication or point-in-time recovery still needs can't be undone.`"
    confirm-label="Remove"
    @confirm="removeBinlogs"
  />
</template>

<script setup>
import { computed, ref } from 'vue'
import { Button, toast } from 'frappe-ui'
import Disclosure from '../Disclosure.vue'
import PaginatedListView from './PaginatedListView.vue'
import ConfirmDialog from '../ConfirmDialog.vue'
import ErrorState from '../ErrorState.vue'
import { getServerDbData, getSiteDbData } from '../../data/dbAnalyzer'
import { fmtGb, fmtMb } from './format'
import { useCloudStore } from '../../stores/cloud'

const props = defineProps({
  server: { type: Object, required: true },
  liveSites: { type: Array, required: true },
  // Site id to scope processes / locks / slow queries by, or null for all.
  siteFilter: { type: String, default: null },
  // Which accordion is open — owned by the page so the header's vitals strip
  // (which sits outside this component) can drive and reflect it too.
  openKey: { type: String, default: null },
})
const emit = defineEmits(['drill', 'update:openKey'])
const openKey = computed(() => props.openKey)

const store = useCloudStore()
const disk = computed(() => store.healthOf(props.server))
const data = getServerDbData(props.server, props.liveSites, disk.value)
const buckets = data.buckets
const siteDbs = computed(() => props.liveSites.map(getSiteDbData))
const siteNameOf = (id) => props.liveSites.find((s) => s.id === id)?.name || null
const round1 = (v) => Math.round(v * 10) / 10

// ListView options — resizable columns, base row height, and ListView's own
// empty state per table. `scoped` tweaks the copy when a site filter is active.
const baseOptions = { selectable: false, showTooltip: false, resizeColumn: true, rowHeight: 44 }
const scoped = (thing) => (props.siteFilter ? `${thing} for this site` : thing)
const processOptions = computed(() => ({ ...baseOptions, emptyState: { title: scoped('No active connections') } }))
const lockOptions = computed(() => ({ ...baseOptions, emptyState: { title: scoped('No transactions are waiting on a lock') } }))
const slowOptions = computed(() => ({ ...baseOptions, emptyState: { title: scoped('No slow queries in the last 24 hours') } }))
const binlogOptions = { ...baseOptions, selectable: true, emptyState: { title: 'No binary logs on disk' } }

// — Processes: filtered by site (from the header), notable first, paginated.
const edgeBroken = computed(() => store.edgeMode)
const secs = (t) => parseFloat(t) || 0
const isSlow = (p) => p.command === 'Query' && /^\d+s$/.test(p.time) && parseInt(p.time) >= 5
const filteredProcesses = computed(() => {
  const list = props.siteFilter ? data.processes.filter((p) => p.siteId === props.siteFilter) : data.processes
  return [...list].sort((a, b) => {
    const aActive = a.command === 'Query'
    const bActive = b.command === 'Query'
    if (aActive !== bActive) return aActive ? -1 : 1
    return secs(b.time) - secs(a.time)
  })
})
// Fixed widths, not fr — frappe-ui's grid tracks don't shrink below a cell's
// min-content, so a long query string on an fr track blows the table wide.
// Fixed tracks + truncate clip cleanly; the wrapper scrolls if space is tight.
const processColumns = [
  { label: 'ID', key: 'id', width: '3.5rem' },
  { label: 'Command', key: 'command', width: '7rem' },
  { label: 'User', key: 'user', width: '4.5rem' },
  { label: 'Site', key: 'site', width: '8rem' },
  { label: 'Query', key: 'query', width: '14rem' },
  { label: 'Time', key: 'time', width: '5rem', align: 'right' },
  { label: '', key: 'actions', width: '4.5rem', align: 'right' },
]
const processRows = computed(() =>
  filteredProcesses.value.map((p) => ({ id: p.id, command: p.command, _p: p }))
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

// — Locks, filtered by site.
const filteredLocks = computed(() =>
  props.siteFilter ? data.locks.filter((l) => l.siteId === props.siteFilter) : data.locks
)
const lockColumns = [
  { label: 'Waiting', key: 'waiting', width: '6rem' },
  { label: 'Blocking', key: 'blocking', width: '6rem' },
  { label: 'Waited', key: 'waited', width: '5rem' },
  { label: 'Site', key: 'site', width: '11rem' },
  { label: 'Query', key: 'query', width: '20rem' },
]
const lockRows = computed(() =>
  filteredLocks.value.map((l, i) => ({ id: i, waiting: l.waitingId, blocking: l.blockingId, waited: l.waitedFor, _l: l }))
)

// — Slow queries across every database (or one, when filtered), worst first.
const allSlowQueries = computed(() =>
  siteDbs.value
    .flatMap((db) => db.slowQueries.map((q) => ({ ...q, siteId: db.siteId, siteName: db.siteName })))
    .sort((a, b) => b.totalSec - a.totalSec)
)
const filteredSlow = computed(() =>
  props.siteFilter ? allSlowQueries.value.filter((q) => q.siteId === props.siteFilter) : allSlowQueries.value
)
const slowDbCount = computed(() => (props.siteFilter ? 1 : siteDbs.value.length))
const slowColumns = [
  { label: 'Query', key: 'query', width: '16rem' },
  { label: 'Site', key: 'site', width: '12rem' },
  { label: 'Avg', key: 'avg', width: '5rem', align: 'right' },
  { label: 'Calls', key: 'calls', width: '5rem', align: 'right' },
  { label: 'Rows', key: 'rows', width: '5rem', align: 'right' },
  { label: 'Total', key: 'total', width: '5rem', align: 'right' },
]
const slowRows = computed(() => filteredSlow.value.map((q, i) => ({ id: i, _q: q })))

// — Binary logs: list files, remove one/selected/all. Freed space flows to the
// store (and shrinks the binlog bucket) so the Server storage page agrees.
// File has no fixed width, so it takes the 1fr default and stretches to fill
// the row — the only way to push the actions column flush to the right edge.
const binlogColumns = [
  { label: 'File', key: 'name' },
  { label: 'Date', key: 'date', width: '12rem' },
  { label: 'Size', key: 'size', width: '8rem', align: 'right' },
  { label: '', key: 'actions', width: '6rem', align: 'right' },
]
const binlogRows = computed(() => data.binlogs.map((f) => ({ name: f.name, date: f.date, _f: f })))

const removeOpen = ref(false)
const pendingRemove = ref([])
// Set when removal comes from the selection banner, so a confirmed bulk
// remove also clears the checkboxes it was raised from.
const pendingUnselectAll = ref(null)
const pendingRemoveGb = computed(() =>
  round1(data.binlogs.filter((f) => pendingRemove.value.includes(f.name)).reduce((a, f) => a + f.sizeMb, 0) / 1024)
)
function askRemove(names, unselectAll = null) {
  pendingRemove.value = names
  pendingUnselectAll.value = unselectAll
  removeOpen.value = true
}
function removeBinlogs() {
  if (store.edgeMode) {
    toast.error("Couldn't remove binary logs — the database server didn't respond.")
    return
  }
  const names = new Set(pendingRemove.value)
  const freed = pendingRemoveGb.value
  data.binlogs = data.binlogs.filter((f) => !names.has(f.name))
  buckets.binlog = round1(Math.max(buckets.binlog - freed, 0))
  store.reclaimServerDisk(props.server.id, freed)
  pendingUnselectAll.value?.()
  pendingUnselectAll.value = null
  toast.success(`Removed ${names.size} binary log${names.size === 1 ? '' : 's'}, freed ${fmtGb(freed)}`)
}
</script>

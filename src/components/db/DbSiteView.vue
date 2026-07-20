<template>
  <!-- Size read-out. On disk is the headline — same size as the rest, set apart
       by weight and the darkest ink rather than by scale. Claimable sits with its
       remedy, the Optimize button, at the end of the same line. -->
  <section class="mb-12">
    <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
      <div class="flex items-baseline gap-1.5">
        <span class="text-base text-ink-gray-5">On disk</span>
        <span class="text-base font-semibold tabular-nums text-ink-gray-9">{{ fmtMb(dbFileMb(db)) }}</span>
      </div>
      <div class="flex items-baseline gap-1.5">
        <span class="text-base text-ink-gray-5">Data</span>
        <span class="text-base font-medium tabular-nums text-ink-gray-8">{{ fmtMb(db.size.dataMb) }}</span>
      </div>
      <div class="flex items-baseline gap-1.5">
        <span class="text-base text-ink-gray-5">Indexes</span>
        <span class="text-base font-medium tabular-nums text-ink-gray-8">{{ fmtMb(db.size.indexMb) }}</span>
      </div>
      <div v-if="db.size.claimableMb > 0" class="flex items-center gap-3">
        <div class="flex items-baseline gap-1.5">
          <span class="text-base text-ink-gray-5">Claimable</span>
          <span class="text-base font-medium tabular-nums text-ink-amber-7">{{ fmtMb(db.size.claimableMb) }}</span>
        </div>
        <Button size="sm" variant="outline" label="Optimize tables" :loading="optimizing" @click="askOptimize" />
      </div>
    </div>
  </section>

  <Disclosure first title="Largest tables" :subtitle="`${db.tables.length} tables`" icon="lucide-table-2" :open="openKey === 'tables'" @update:open="(v) => (openKey = v ? 'tables' : null)">
    <PaginatedListView
      :columns="tableColumns"
      :rows="tableRows"
      :options="tableOptions"
      row-key="name"
    >
      <template #cell="{ column, row }">
        <span v-if="column.key === 'name'" class="truncate font-mono text-ink-gray-8" :title="row.name">{{ row.name }}</span>
        <span v-else-if="column.key === 'rows'" class="tabular-nums text-ink-gray-6">{{ row._t.rows.toLocaleString() }}</span>
        <span v-else-if="column.key === 'data'" class="tabular-nums text-ink-gray-7">{{ fmtMb(row._t.dataMb) }}</span>
        <span v-else-if="column.key === 'index'" class="tabular-nums text-ink-gray-7">{{ fmtMb(row._t.indexMb) }}</span>
        <span v-else-if="column.key === 'claimable'" class="tabular-nums" :class="row._t.claimableMb ? 'text-ink-amber-7' : 'text-ink-gray-4'">{{ fmtMb(row._t.claimableMb) }}</span>
      </template>
    </PaginatedListView>
  </Disclosure>

  <Disclosure title="SQL query analysis" :subtitle="queryDisclosureSubtitle" icon="lucide-timer" :open="openKey === 'queries'" @update:open="(v) => (openKey = v ? 'queries' : null)">
    <TabButtons type="underline" v-model="queryTab" :options="queryTabOptions" class="mb-4">
      <template #suffix="{ button }">
        <Badge
          v-if="queryTabCount(button.modelValue) != null"
          :label="queryTabCount(button.modelValue)"
          variant="subtle"
          theme="gray"
          size="sm"
        />
      </template>
    </TabButtons>

    <template v-if="queryTab === 'slow'">
      <PaginatedListView
        :columns="slowColumns"
        :rows="slowRows"
        :options="slowOptions"
        row-key="id"
      >
        <template #cell="{ column, row }">
          <span v-if="column.key === 'query'" class="truncate font-mono text-ink-gray-8" :title="row._q.digest">{{ row._q.digest }}</span>
          <span v-else-if="column.key === 'avg'" class="tabular-nums text-ink-gray-7">{{ row._q.avgMs }} ms</span>
          <span v-else-if="column.key === 'calls'" class="tabular-nums text-ink-gray-6">{{ row._q.calls.toLocaleString() }}</span>
          <span v-else-if="column.key === 'rows'" class="tabular-nums text-ink-gray-6">{{ row._q.rowsAvg.toLocaleString() }}</span>
          <span v-else-if="column.key === 'total'" class="tabular-nums text-ink-gray-6">{{ Math.round(row._q.totalSec / 60).toLocaleString() }} min</span>
        </template>
      </PaginatedListView>
    </template>

    <ErrorState
      v-else-if="!db.perfSchemaEnabled"
      icon="lucide-database-zap"
      title="Performance Schema is not enabled"
      description="Reach out to support to enable it on this database server."
    />

    <template v-else-if="queryTab === 'time'">
      <PaginatedListView
        :columns="timeConsumingColumns"
        :rows="timeConsumingRows"
        :options="baseOptions"
        row-key="id"
      >
        <template #cell="{ column, row }">
          <span v-if="column.key === 'query'" class="truncate font-mono text-ink-gray-8" :title="row._q.digest">{{ row._q.digest }}</span>
          <span v-else-if="column.key === 'avg'" class="tabular-nums text-ink-gray-7">{{ row._q.avgMs }} ms</span>
          <span v-else-if="column.key === 'calls'" class="tabular-nums text-ink-gray-6">{{ row._q.calls.toLocaleString() }}</span>
          <span v-else-if="column.key === 'total'" class="tabular-nums text-ink-gray-6">{{ Math.round(row._q.totalSec / 60).toLocaleString() }} min</span>
        </template>
      </PaginatedListView>
    </template>

    <template v-else>
      <PaginatedListView
        :columns="fullScanColumns"
        :rows="fullScanRows"
        :options="baseOptions"
        row-key="id"
      >
        <template #cell="{ column, row }">
          <span v-if="column.key === 'query'" class="truncate font-mono text-ink-gray-8" :title="row._q.digest">{{ row._q.digest }}</span>
          <span v-else-if="column.key === 'table'" class="truncate font-mono text-ink-gray-6">{{ row._q.table }}</span>
          <span v-else-if="column.key === 'rowsExamined'" class="tabular-nums text-ink-amber-7">{{ row._q.rowsExamined.toLocaleString() }}</span>
          <span v-else-if="column.key === 'calls'" class="tabular-nums text-ink-gray-6">{{ row._q.calls.toLocaleString() }}</span>
        </template>
      </PaginatedListView>
    </template>
  </Disclosure>

  <Disclosure title="Index analysis" :subtitle="indexDisclosureSubtitle" icon="lucide-list-tree" :open="openKey === 'index'" @update:open="(v) => (openKey = v ? 'index' : null)">
    <ErrorState
      v-if="!db.perfSchemaEnabled"
      icon="lucide-database-zap"
      title="Performance Schema is not enabled"
      description="Reach out to support to enable it on this database server."
    />

    <template v-else>
      <TabButtons type="underline" v-model="indexTab" :options="indexTabOptions" class="mb-4">
        <template #suffix="{ button }">
          <Badge
            v-if="indexTabCount(button.modelValue) != null"
            :label="indexTabCount(button.modelValue)"
            variant="subtle"
            theme="gray"
            size="sm"
          />
        </template>
      </TabButtons>

      <template v-if="indexTab === 'suggested'">
        <PaginatedListView
          :columns="suggestedColumns"
          :rows="suggestedRows"
          :options="suggestedOptions"
          row-key="id"
        >
          <template #cell="{ column, row }">
            <span v-if="column.key === 'index'" class="truncate font-mono text-ink-gray-8" :title="`${row._ix.table} (${row._ix.columns.join(', ')})`">{{ row._ix.table }} ({{ row._ix.columns.join(', ') }})</span>
            <span v-else-if="column.key === 'reason'" class="truncate text-ink-gray-6" :title="row._ix.reason">{{ row._ix.reason }}</span>
            <span v-else-if="column.key === 'gain'" class="tabular-nums text-ink-green-7">~{{ row._ix.estGainPct }}%</span>
            <Button v-else-if="column.key === 'actions'" size="sm" variant="subtle" label="Create" @click.stop="createIndex(row._ix)" />
          </template>
        </PaginatedListView>
      </template>

      <template v-else-if="indexTab === 'redundant'">
        <PaginatedListView
          :columns="redundantColumns"
          :rows="redundantRows"
          :options="redundantOptions"
          row-key="name"
        >
          <template #cell="{ column, row }">
            <span v-if="column.key === 'name'" class="truncate font-mono text-ink-gray-8">{{ row._ix.table }} · {{ row._ix.index }}</span>
            <span v-else-if="column.key === 'redundantWith'" class="truncate font-mono text-ink-gray-6">{{ row._ix.redundantWith }}</span>
            <span v-else-if="column.key === 'size'" class="tabular-nums text-ink-gray-7">{{ fmtMb(row._ix.sizeMb) }}</span>
            <Button v-else-if="column.key === 'actions'" size="sm" variant="ghost" theme="red" label="Drop" @click.stop="askDrop('redundant', row._ix)" />
          </template>
        </PaginatedListView>
      </template>

      <template v-else>
        <PaginatedListView
          :columns="unusedColumns"
          :rows="unusedRows"
          :options="unusedOptions"
          row-key="name"
        >
          <template #cell="{ column, row }">
            <span v-if="column.key === 'name'" class="truncate font-mono text-ink-gray-8" :title="`${row._ix.table} · ${row._ix.name}`">{{ row._ix.table }} · {{ row._ix.name }}</span>
            <span v-else-if="column.key === 'lastUsed'" class="text-ink-gray-6">Unused since {{ row._ix.lastUsed }}</span>
            <span v-else-if="column.key === 'size'" class="tabular-nums text-ink-gray-7">{{ fmtMb(row._ix.sizeMb) }}</span>
            <Button v-else-if="column.key === 'actions'" size="sm" variant="ghost" theme="red" label="Drop" @click.stop="askDrop('unused', row._ix)" />
          </template>
        </PaginatedListView>
      </template>
    </template>
  </Disclosure>

  <!-- Confirms before destructive action, matching the server view's Kill and
       Remove-binlog dialogs. -->
  <ConfirmDialog
    v-model:open="dropOpen"
    theme="red"
    :title="`Drop ${pendingDrop?.label}?`"
    message="The index is removed immediately. Any query that relied on it falls back to a full table scan until it's rebuilt."
    confirm-label="Drop"
    @confirm="confirmDrop"
  />

  <!-- Optimizing only reclaims space (no data loss), so it stays a neutral
       confirm — unlike the red drop-index dialog above. -->
  <ConfirmDialog
    v-model:open="optimizeOpen"
    :title="`Optimize ${db.tables.length} tables?`"
    :message="`This rebuilds the tables to reclaim about ${fmtMb(db.size.claimableMb)}. Each table is locked while it runs, so queries against it wait until it finishes.`"
    confirm-label="Optimize"
    @confirm="optimize"
  />
</template>

<script setup>
import { computed, ref } from 'vue'
import { Badge, Button, TabButtons, toast } from 'frappe-ui'
import Disclosure from '../Disclosure.vue'
import ErrorState from '../ErrorState.vue'
import ConfirmDialog from '../ConfirmDialog.vue'
import PaginatedListView from './PaginatedListView.vue'
import { getSiteDbData, dbFileMb } from '../../data/dbAnalyzer'
import { fmtMb } from './format'
import { useCloudStore } from '../../stores/cloud'

const props = defineProps({
  site: { type: Object, required: true },
})

const store = useCloudStore()
const db = getSiteDbData(props.site)

// Optimize rebuilds every table to reclaim the fragmented space; it lives with
// the site view because the reclaimable number and its button sit together in
// the size strip above. Edge mode can't reach the DB server, so it just errors.
const optimizeOpen = ref(false)
const optimizing = ref(false)
function askOptimize() {
  optimizeOpen.value = true
}
function optimize() {
  optimizing.value = true
  setTimeout(() => {
    optimizing.value = false
    if (store.edgeMode) {
      toast.error("Couldn't optimize tables — the database server didn't respond.")
      return
    }
    const reclaimed = db.size.claimableMb
    db.size.claimableMb = 0
    db.tables.forEach((t) => (t.claimableMb = 0))
    toast.success(`Reclaimed ${fmtMb(reclaimed)} across ${db.tables.length} tables`)
  }, 1200)
}

// Exclusive accordion: one panel open at a time, opening the most actionable one
// first — slow queries or index suggestions if present, else the table list.
function mostNotable() {
  if (db.slowQueries.length) return 'queries'
  if (db.perfSchemaEnabled && (db.suggestedIndexes.length || db.redundantIndexes.length || db.unusedIndexes.length)) return 'index'
  return 'tables'
}
const openKey = ref(mostNotable())

// ListView options — resizable columns, base row height, and ListView's own
// empty state, matching the server view's pattern so an empty index tab reads
// the same way as an empty processes/locks table, not a one-off <p>.
const baseOptions = { selectable: false, showTooltip: false, resizeColumn: true, rowHeight: 44 }
const tableOptions = { ...baseOptions, emptyState: { title: 'No tables in this database' } }
const slowOptions = { ...baseOptions, emptyState: { title: 'No slow queries in the last 24 hours' } }
const suggestedOptions = { ...baseOptions, emptyState: { title: 'No missing indexes found' } }
const redundantOptions = { ...baseOptions, emptyState: { title: 'No redundant indexes found' } }
const unusedOptions = { ...baseOptions, emptyState: { title: 'No unused indexes found' } }

// SQL query analysis: three tabs. Slow queries come from the slow query log
// (always available); time-consuming and full-scan queries read from
// performance_schema, so they're blocked by the same flag as index analysis.
const queryTab = ref('slow')
const queryTabOptions = [
  { label: 'Slow queries', value: 'slow' },
  { label: 'Time consuming queries', value: 'time' },
  { label: 'Full table scan queries', value: 'scan' },
]
// Counts ride on the tab as a badge (via TabButtons' #suffix slot), not just in
// the collapsed subtitle — once open, the tabs are the control. Perf-schema tabs
// return null when the flag is off (a 0 badge would read as "none found" rather
// than "unavailable").
function queryTabCount(value) {
  if (value === 'slow') return db.slowQueries.length
  if (!db.perfSchemaEnabled) return null
  if (value === 'time') return db.timeConsumingQueries.length
  if (value === 'scan') return db.fullTableScanQueries.length
  return null
}
// Stable across tabs — a collapsed accordion should summarise the whole
// section, not whichever tab happened to be open. When perf schema is off the
// only real data is the slow query log, so that's all we claim.
const queryDisclosureSubtitle = computed(() => {
  if (!db.perfSchemaEnabled) return `${db.slowQueries.length} slow · last 24h`
  return `${db.slowQueries.length} slow · ${db.timeConsumingQueries.length} time-consuming · ${db.fullTableScanQueries.length} full-scan`
})

const indexTab = ref('suggested')
const indexTabOptions = [
  { label: 'Suggested', value: 'suggested' },
  { label: 'Redundant', value: 'redundant' },
  { label: 'Unused', value: 'unused' },
]
// Index tabs only render behind the perf-schema check, so counts are always real.
function indexTabCount(value) {
  if (value === 'suggested') return db.suggestedIndexes.length
  if (value === 'redundant') return db.redundantIndexes.length
  if (value === 'unused') return db.unusedIndexes.length
  return null
}
const indexDisclosureSubtitle = computed(() => {
  if (!db.perfSchemaEnabled) return 'Unavailable'
  return `${db.suggestedIndexes.length} suggested · ${db.redundantIndexes.length} redundant · ${db.unusedIndexes.length} unused`
})

// Fixed widths, not fr — frappe-ui's grid tracks don't shrink below a cell's
// min-content, so long text on an fr track blows the table wide. Fixed tracks
// + truncate clip cleanly; the wrapper scrolls if space is tight.
const tableColumns = [
  { label: 'Table', key: 'name', width: '18rem' },
  { label: 'Rows', key: 'rows', width: '8rem', align: 'right' },
  { label: 'Data', key: 'data', width: '7rem', align: 'right' },
  { label: 'Index', key: 'index', width: '7rem', align: 'right' },
  { label: 'Claimable', key: 'claimable', width: '8rem', align: 'right' },
]
const tableRows = computed(() => db.tables.map((t) => ({ name: t.name, _t: t })))

// — Slow queries.
const slowColumns = [
  { label: 'Query', key: 'query', width: '20rem' },
  { label: 'Avg', key: 'avg', width: '6rem', align: 'right' },
  { label: 'Calls', key: 'calls', width: '6rem', align: 'right' },
  { label: 'Rows', key: 'rows', width: '6rem', align: 'right' },
  { label: 'Total', key: 'total', width: '6rem', align: 'right' },
]
const slowRows = computed(() => db.slowQueries.map((q, i) => ({ id: i, _q: q })))

// Widths per query tab sum to the same 44rem so the table doesn't resize when
// switching tabs — the flexible Query column absorbs the difference.
const timeConsumingColumns = [
  { label: 'Query', key: 'query', width: '26rem' },
  { label: 'Avg', key: 'avg', width: '6rem', align: 'right' },
  { label: 'Calls', key: 'calls', width: '6rem', align: 'right' },
  { label: 'Total', key: 'total', width: '6rem', align: 'right' },
]
const timeConsumingRows = computed(() => db.timeConsumingQueries.map((q, i) => ({ id: i, _q: q })))

const fullScanColumns = [
  { label: 'Query', key: 'query', width: '20rem' },
  { label: 'Table', key: 'table', width: '10rem' },
  { label: 'Rows examined', key: 'rowsExamined', width: '8rem', align: 'right' },
  { label: 'Calls', key: 'calls', width: '6rem', align: 'right' },
]
const fullScanRows = computed(() => db.fullTableScanQueries.map((q, i) => ({ id: i, _q: q })))

// — Index analysis: three tables, suggested/redundant/unused.
const suggestedColumns = [
  { label: 'Index', key: 'index', width: '16rem' },
  { label: 'Reason', key: 'reason', width: '16rem' },
  { label: 'Est. gain', key: 'gain', width: '6rem', align: 'right' },
  { label: '', key: 'actions', width: '6rem', align: 'right' },
]
const suggestedRows = computed(() => db.suggestedIndexes.map((ix, i) => ({ id: i, _ix: ix })))
// Index tabs also share a 44rem total (matching suggestedColumns) so the table
// footprint holds steady across Suggested / Redundant / Unused.
const redundantColumns = [
  { label: 'Index', key: 'name', width: '16rem' },
  { label: 'Redundant with', key: 'redundantWith', width: '15rem' },
  { label: 'Size', key: 'size', width: '7rem', align: 'right' },
  { label: '', key: 'actions', width: '6rem', align: 'right' },
]
const redundantRows = computed(() => db.redundantIndexes.map((ix) => ({ name: `${ix.table}·${ix.index}`, _ix: ix })))
const unusedColumns = [
  { label: 'Index', key: 'name', width: '20rem' },
  { label: 'Last used', key: 'lastUsed', width: '11rem' },
  { label: 'Size', key: 'size', width: '7rem', align: 'right' },
  { label: '', key: 'actions', width: '6rem', align: 'right' },
]
const unusedRows = computed(() => db.unusedIndexes.map((ix) => ({ name: ix.name, _ix: ix })))

function createIndex(ix) {
  toast.success(`Creating index on ${ix.table} (${ix.columns.join(', ')})…`)
  db.suggestedIndexes = db.suggestedIndexes.filter((s) => s !== ix)
}

// Both drop paths go through one confirm dialog; pendingDrop.kind picks the
// mutator once confirmed. The label reads the same as the row it was raised on.
const dropOpen = ref(false)
const pendingDrop = ref(null)
function askDrop(kind, ix) {
  const label = kind === 'redundant' ? `${ix.table} · ${ix.index}` : `${ix.table} · ${ix.name}`
  pendingDrop.value = { kind, ix, label }
  dropOpen.value = true
}
function confirmDrop() {
  const { kind, ix } = pendingDrop.value
  if (kind === 'redundant') dropRedundantIndex(ix)
  else dropIndex(ix)
}

function dropIndex(ix) {
  toast.success(`Dropping ${ix.name}…`)
  db.unusedIndexes = db.unusedIndexes.filter((u) => u.name !== ix.name)
}

function dropRedundantIndex(ix) {
  toast.success(`Dropping ${ix.index}…`)
  db.redundantIndexes = db.redundantIndexes.filter((r) => r !== ix)
}
</script>

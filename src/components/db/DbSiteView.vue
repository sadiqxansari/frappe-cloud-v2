<template>
  <!-- Size breakup — compact stats, no bar; at site level the actionable
       number is Claimable, not the shape of the file. -->
  <section class="rounded-xl border border-outline-gray-2 bg-surface-elevation-1 p-4">
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-semibold text-ink-gray-8">Database size</h2>
      <span class="font-mono text-p-xs text-ink-gray-4">{{ db.dbName }}</span>
    </div>

    <div class="mt-3 flex flex-wrap gap-x-10 gap-y-2">
      <div v-for="s in sizeStats" :key="s.label">
        <div class="text-p-xs text-ink-gray-5">{{ s.label }}</div>
        <div class="mt-0.5 text-lg font-semibold tabular-nums" :class="s.tone || 'text-ink-gray-9'">{{ s.value }}</div>
      </div>
    </div>

    <div v-if="db.size.claimableMb > 0" class="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-blue-1 px-3 py-2">
      <span class="text-p-sm text-ink-blue-8">{{ fmtMb(db.size.claimableMb) }} can be reclaimed by optimizing tables.</span>
      <Button size="sm" variant="subtle" label="Optimize tables" :loading="optimizing" @click="optimize" />
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

  <Disclosure title="Slow queries" :subtitle="`${db.slowQueries.length} slow · last 24h`" icon="lucide-timer" :open="openKey === 'slow'" @update:open="(v) => (openKey = v ? 'slow' : null)">
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
  </Disclosure>

  <Disclosure title="Index analysis" :subtitle="`${db.suggestedIndexes.length} suggested · ${db.unusedIndexes.length} unused`" icon="lucide-list-tree" :open="openKey === 'index'" @update:open="(v) => (openKey = v ? 'index' : null)">
    <p v-if="!db.suggestedIndexes.length && !db.unusedIndexes.length" class="text-p-sm text-ink-gray-5">
      Nothing to change — no missing or unused indexes found.
    </p>
    <div v-else class="space-y-4">
      <div v-if="db.suggestedIndexes.length">
        <h3 class="mb-1.5 text-p-xs font-medium uppercase tracking-wide text-ink-gray-5">Suggested</h3>
        <PaginatedListView
          :columns="suggestedColumns"
          :rows="suggestedRows"
          :options="baseOptions"
          row-key="id"
        >
          <template #cell="{ column, row }">
            <span v-if="column.key === 'index'" class="truncate font-mono text-ink-gray-8" :title="`${row._ix.table} (${row._ix.columns.join(', ')})`">{{ row._ix.table }} ({{ row._ix.columns.join(', ') }})</span>
            <span v-else-if="column.key === 'reason'" class="truncate text-ink-gray-6" :title="row._ix.reason">{{ row._ix.reason }}</span>
            <span v-else-if="column.key === 'gain'" class="tabular-nums text-ink-green-7">~{{ row._ix.estGainPct }}%</span>
            <Button v-else-if="column.key === 'actions'" size="sm" variant="subtle" label="Create" @click.stop="createIndex(row._ix)" />
          </template>
        </PaginatedListView>
      </div>

      <div v-if="db.unusedIndexes.length">
        <h3 class="mb-1.5 text-p-xs font-medium uppercase tracking-wide text-ink-gray-5">Unused</h3>
        <PaginatedListView
          :columns="unusedColumns"
          :rows="unusedRows"
          :options="baseOptions"
          row-key="name"
        >
          <template #cell="{ column, row }">
            <span v-if="column.key === 'name'" class="truncate font-mono text-ink-gray-8" :title="`${row._ix.table} · ${row._ix.name}`">{{ row._ix.table }} · {{ row._ix.name }}</span>
            <span v-else-if="column.key === 'lastUsed'" class="text-ink-gray-6">Unused since {{ row._ix.lastUsed }}</span>
            <span v-else-if="column.key === 'size'" class="tabular-nums text-ink-gray-7">{{ fmtMb(row._ix.sizeMb) }}</span>
            <Button v-else-if="column.key === 'actions'" size="sm" variant="ghost" label="Drop" @click.stop="dropIndex(row._ix)" />
          </template>
        </PaginatedListView>
      </div>
    </div>
  </Disclosure>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Button, toast } from 'frappe-ui'
import Disclosure from '../Disclosure.vue'
import PaginatedListView from './PaginatedListView.vue'
import { getSiteDbData, dbFileMb } from '../../data/dbAnalyzer'
import { fmtMb } from './format'
import { useCloudStore } from '../../stores/cloud'

const props = defineProps({
  site: { type: Object, required: true },
})

const store = useCloudStore()
const db = getSiteDbData(props.site)

// Exclusive accordion: one panel open at a time, opening the most actionable one
// first — slow queries or index suggestions if present, else the table list.
function mostNotable() {
  if (db.slowQueries.length) return 'slow'
  if (db.suggestedIndexes.length || db.unusedIndexes.length) return 'index'
  return 'tables'
}
const openKey = ref(mostNotable())

// ListView options — resizable columns, base row height, and ListView's own
// empty state. Suggested/unused tables only render when non-empty, so they use
// the base set without an empty state.
const baseOptions = { selectable: false, showTooltip: false, resizeColumn: true, rowHeight: 44 }
const tableOptions = { ...baseOptions, emptyState: { title: 'No tables in this database' } }
const slowOptions = { ...baseOptions, emptyState: { title: 'No slow queries in the last 24 hours' } }

const sizeStats = computed(() => [
  { label: 'On disk', value: fmtMb(dbFileMb(db)) },
  { label: 'Data', value: fmtMb(db.size.dataMb) },
  { label: 'Indexes', value: fmtMb(db.size.indexMb) },
  { label: 'Claimable', value: fmtMb(db.size.claimableMb), tone: db.size.claimableMb ? 'text-ink-amber-7' : 'text-ink-gray-9' },
])

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
  { label: 'Query', key: 'query', width: '28rem' },
  { label: 'Avg', key: 'avg', width: '6rem', align: 'right' },
  { label: 'Calls', key: 'calls', width: '6rem', align: 'right' },
  { label: 'Rows', key: 'rows', width: '6rem', align: 'right' },
  { label: 'Total', key: 'total', width: '6rem', align: 'right' },
]
const slowRows = computed(() => db.slowQueries.map((q, i) => ({ id: i, _q: q })))

// — Index analysis: two tables, suggested and unused.
const suggestedColumns = [
  { label: 'Index', key: 'index', width: '18rem' },
  { label: 'Reason', key: 'reason', width: '22rem' },
  { label: 'Est. gain', key: 'gain', width: '6rem', align: 'right' },
  { label: '', key: 'actions', width: '6rem', align: 'right' },
]
const suggestedRows = computed(() => db.suggestedIndexes.map((ix, i) => ({ id: i, _ix: ix })))
const unusedColumns = [
  { label: 'Index', key: 'name', width: '22rem' },
  { label: 'Last used', key: 'lastUsed', width: '12rem' },
  { label: 'Size', key: 'size', width: '7rem', align: 'right' },
  { label: '', key: 'actions', width: '5rem', align: 'right' },
]
const unusedRows = computed(() => db.unusedIndexes.map((ix) => ({ name: ix.name, _ix: ix })))

const optimizing = ref(false)
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

function createIndex(ix) {
  toast.success(`Creating index on ${ix.table} (${ix.columns.join(', ')})…`)
  db.suggestedIndexes = db.suggestedIndexes.filter((s) => s !== ix)
}

function dropIndex(ix) {
  toast.success(`Dropping ${ix.name}…`)
  db.unusedIndexes = db.unusedIndexes.filter((u) => u.name !== ix.name)
}
</script>

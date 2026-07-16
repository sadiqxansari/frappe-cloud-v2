<template>
  <!-- Size breakup — compact stats, no bar; at site level the actionable
       number is Claimable, not the shape of the file. -->
  <section class="mt-5 rounded-xl border border-outline-gray-2 bg-surface-elevation-1 p-4">
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

  <Disclosure title="Largest tables" :subtitle="`${db.tables.length} tables`" icon="lucide-table-2" defaultOpen>
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead class="border-b border-outline-gray-2 text-xs uppercase tracking-wide text-ink-gray-5">
          <tr>
            <th class="pb-2 pr-3 font-medium">Table</th>
            <th class="pb-2 pr-3 text-right font-medium">Rows</th>
            <th class="pb-2 pr-3 text-right font-medium">Data</th>
            <th class="pb-2 pr-3 text-right font-medium">Index</th>
            <th class="pb-2 text-right font-medium">Claimable</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-outline-alpha-gray-1">
          <tr v-for="t in db.tables" :key="t.name">
            <td class="py-2 pr-3 font-mono text-ink-gray-8">{{ t.name }}</td>
            <td class="py-2 pr-3 text-right tabular-nums text-ink-gray-6">{{ t.rows.toLocaleString() }}</td>
            <td class="py-2 pr-3 text-right tabular-nums text-ink-gray-7">{{ fmtMb(t.dataMb) }}</td>
            <td class="py-2 pr-3 text-right tabular-nums text-ink-gray-7">{{ fmtMb(t.indexMb) }}</td>
            <td class="py-2 text-right tabular-nums" :class="t.claimableMb ? 'text-ink-amber-7' : 'text-ink-gray-4'">{{ fmtMb(t.claimableMb) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </Disclosure>

  <Disclosure title="Slow queries" :subtitle="`${db.slowQueries.length} slow · last 24h`" icon="lucide-timer">
    <p v-if="!db.slowQueries.length" class="text-p-sm text-ink-gray-5">No slow queries in the last 24 hours.</p>
    <div v-else class="space-y-3">
      <div v-for="(q, i) in db.slowQueries" :key="i" class="rounded-lg border border-outline-gray-2 p-3">
        <code class="block truncate font-mono text-xs text-ink-gray-8">{{ q.digest }}</code>
        <div class="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-gray-5">
          <span><span class="tabular-nums text-ink-gray-7">{{ q.avgMs }}</span> ms avg</span>
          <span><span class="tabular-nums text-ink-gray-7">{{ q.calls.toLocaleString() }}</span> calls</span>
          <span><span class="tabular-nums text-ink-gray-7">{{ q.rowsAvg.toLocaleString() }}</span> rows avg</span>
          <span><span class="tabular-nums text-ink-gray-7">{{ Math.round(q.totalSec / 60).toLocaleString() }}</span> min total</span>
        </div>
      </div>
    </div>
  </Disclosure>

  <Disclosure title="Index analysis" :subtitle="`${db.suggestedIndexes.length} suggested · ${db.unusedIndexes.length} unused`" icon="lucide-list-tree">
    <p v-if="!db.suggestedIndexes.length && !db.unusedIndexes.length" class="text-p-sm text-ink-gray-5">
      Nothing to change — no missing or unused indexes found.
    </p>
    <div v-else class="space-y-2">
      <div v-for="(ix, i) in db.suggestedIndexes" :key="`s${i}`" class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-outline-gray-2 p-3">
        <div class="min-w-0">
          <div class="font-mono text-xs text-ink-gray-8">{{ ix.table }} ({{ ix.columns.join(', ') }})</div>
          <div class="mt-0.5 text-xs text-ink-gray-5">{{ ix.reason }} · ~{{ ix.estGainPct }}% faster</div>
        </div>
        <Button size="sm" variant="subtle" label="Create index" @click="createIndex(ix)" />
      </div>
      <div v-for="ix in db.unusedIndexes" :key="ix.name" class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-outline-gray-2 p-3">
        <div class="min-w-0">
          <div class="font-mono text-xs text-ink-gray-8">{{ ix.table }} · {{ ix.name }}</div>
          <div class="mt-0.5 text-xs text-ink-gray-5">Unused since {{ ix.lastUsed }} · {{ fmtMb(ix.sizeMb) }}</div>
        </div>
        <Button size="sm" variant="ghost" label="Drop" @click="dropIndex(ix)" />
      </div>
    </div>
  </Disclosure>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Button, toast } from 'frappe-ui'
import Disclosure from '../Disclosure.vue'
import { getSiteDbData, dbFileMb } from '../../data/dbAnalyzer'
import { fmtMb } from './format'
import { useCloudStore } from '../../stores/cloud'

const props = defineProps({
  site: { type: Object, required: true },
})

const store = useCloudStore()
const db = getSiteDbData(props.site)

const sizeStats = computed(() => [
  { label: 'On disk', value: fmtMb(dbFileMb(db)) },
  { label: 'Data', value: fmtMb(db.size.dataMb) },
  { label: 'Indexes', value: fmtMb(db.size.indexMb) },
  { label: 'Claimable', value: fmtMb(db.size.claimableMb), tone: db.size.claimableMb ? 'text-ink-amber-7' : 'text-ink-gray-9' },
])

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

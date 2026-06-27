<template>
  <ServerShell v-if="server" :server="server" :crumbs="crumbs" roomy>
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold text-ink-gray-9">DB analyzer</h1>
        <p class="mt-1 text-p-base text-ink-gray-5">Storage, slow queries, indexes and live connections for one site's database.</p>
      </div>
      <!-- Per-site: a database belongs to a site, so you pick which one. -->
      <div class="flex items-center gap-2">
        <Dropdown :options="siteOptions" placement="bottom-end">
          <Button variant="outline" size="sm" icon-right="lucide-chevron-down">
            <span class="inline-flex items-center gap-1.5">
              <span class="lucide-globe size-4 shrink-0 text-ink-gray-5" />
              <span class="max-w-40 truncate">{{ activeSite?.name || 'Select site' }}</span>
            </span>
          </Button>
        </Dropdown>
        <Button variant="ghost" size="sm" icon="lucide-rotate-cw" aria-label="Refresh" @click="toast.success('Refreshed')" />
      </div>
    </div>

    <template v-if="activeSite">
      <!-- Storage breakup. The bar is the database file (data + index + the
           claimable space deleted/updated rows leave behind); free disk sits
           below as host context. Claimable is the actionable part. -->
      <section class="mt-5 rounded-xl border border-outline-gray-2 bg-surface-elevation-1 p-4">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold text-ink-gray-8">Storage</h2>
          <span class="text-p-xs text-ink-gray-5">{{ mb(fileMb) }} on disk</span>
        </div>

        <div class="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-surface-gray-2">
          <div class="h-full" :style="{ width: pct(size.dataMb) + '%', background: 'var(--ink-blue-5)' }" />
          <div class="h-full" :style="{ width: pct(size.indexMb) + '%', background: 'var(--ink-green-5)' }" />
          <div class="h-full" :style="{ width: pct(size.claimableMb) + '%', background: 'var(--ink-amber-5)' }" />
        </div>

        <div class="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
          <div class="flex items-center justify-between border-b border-outline-alpha-gray-1 py-1.5 text-sm">
            <span class="flex items-center gap-2 text-ink-gray-7"><span class="size-2 rounded-full" style="background: var(--ink-blue-5)" /> Data</span>
            <span class="tabular-nums text-ink-gray-8">{{ mb(size.dataMb) }}</span>
          </div>
          <div class="flex items-center justify-between border-b border-outline-alpha-gray-1 py-1.5 text-sm">
            <span class="flex items-center gap-2 text-ink-gray-7"><span class="size-2 rounded-full" style="background: var(--ink-green-5)" /> Indexes</span>
            <span class="tabular-nums text-ink-gray-8">{{ mb(size.indexMb) }}</span>
          </div>
          <div class="flex items-center justify-between border-b border-outline-alpha-gray-1 py-1.5 text-sm">
            <span class="flex items-center gap-2 text-ink-gray-7"><span class="size-2 rounded-full" style="background: var(--ink-amber-5)" /> Claimable</span>
            <span class="tabular-nums text-ink-gray-8">{{ mb(size.claimableMb) }}</span>
          </div>
          <div class="flex items-center justify-between border-b border-outline-alpha-gray-1 py-1.5 text-sm">
            <span class="flex items-center gap-2 text-ink-gray-7"><span class="size-2 rounded-full bg-surface-gray-4" /> Free on host</span>
            <span class="tabular-nums text-ink-gray-5">{{ size.freeGb }} GB</span>
          </div>
        </div>

        <!-- Reclaim story: only worth showing while there's space to reclaim. -->
        <div v-if="size.claimableMb > 0" class="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-blue-1 px-3 py-2">
          <span class="text-p-sm text-ink-blue-8">{{ mb(size.claimableMb) }} can be reclaimed by optimizing tables.</span>
          <Button size="sm" variant="subtle" label="Optimize tables" :loading="optimizing" @click="optimize" />
        </div>
      </section>

      <!-- Diagnostics — the drill-downs a developer reaches for, collapsed by
           default so the page opens calm. -->
      <Disclosure title="Largest tables" :subtitle="`${DB.tables.length} tables`" icon="lucide-table-2">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="text-xs uppercase tracking-wide text-ink-gray-5">
              <tr>
                <th class="py-1.5 pr-3 font-medium">Table</th>
                <th class="py-1.5 pr-3 text-right font-medium">Rows</th>
                <th class="py-1.5 pr-3 text-right font-medium">Data</th>
                <th class="py-1.5 pr-3 text-right font-medium">Index</th>
                <th class="py-1.5 text-right font-medium">Claimable</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-outline-alpha-gray-1">
              <tr v-for="t in DB.tables" :key="t.name">
                <td class="py-2 pr-3 font-mono text-xs text-ink-gray-8">{{ t.name }}</td>
                <td class="py-2 pr-3 text-right tabular-nums text-ink-gray-6">{{ t.rows.toLocaleString() }}</td>
                <td class="py-2 pr-3 text-right tabular-nums text-ink-gray-7">{{ mb(t.dataMb) }}</td>
                <td class="py-2 pr-3 text-right tabular-nums text-ink-gray-7">{{ mb(t.indexMb) }}</td>
                <td class="py-2 text-right tabular-nums" :class="t.claimableMb ? 'text-ink-amber-7' : 'text-ink-gray-4'">{{ mb(t.claimableMb) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Disclosure>

      <Disclosure title="Slow queries" :subtitle="`${DB.slowQueries.length} concerning · last 24h`" icon="lucide-timer">
        <div class="space-y-3">
          <div v-for="(q, i) in DB.slowQueries" :key="i" class="rounded-lg border border-outline-gray-2 p-3">
            <code class="block truncate font-mono text-xs text-ink-gray-8">{{ q.digest }}</code>
            <div class="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-gray-5">
              <span><span class="text-ink-gray-7 tabular-nums">{{ q.avgMs }}</span> ms avg</span>
              <span><span class="text-ink-gray-7 tabular-nums">{{ q.calls.toLocaleString() }}</span> calls</span>
              <span><span class="text-ink-gray-7 tabular-nums">{{ q.rowsAvg.toLocaleString() }}</span> rows avg</span>
              <span><span class="text-ink-gray-7 tabular-nums">{{ Math.round(q.totalSec / 60).toLocaleString() }}</span> min total</span>
            </div>
          </div>
        </div>
      </Disclosure>

      <Disclosure title="Index analysis" :subtitle="`${DB.suggestedIndexes.length} suggested · ${DB.unusedIndexes.length} unused`" icon="lucide-list-tree">
        <div class="space-y-2">
          <div v-for="(ix, i) in DB.suggestedIndexes" :key="`s${i}`" class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-outline-gray-2 p-3">
            <div class="min-w-0">
              <div class="font-mono text-xs text-ink-gray-8">{{ ix.table }} ({{ ix.columns.join(', ') }})</div>
              <div class="mt-0.5 text-xs text-ink-gray-5">{{ ix.reason }} · ~{{ ix.estGainPct }}% faster</div>
            </div>
            <Button size="sm" variant="subtle" label="Create index" @click="toast.success(`Creating index on ${ix.table}…`)" />
          </div>
          <div v-for="(ix, i) in DB.unusedIndexes" :key="`u${i}`" class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-outline-gray-2 p-3">
            <div class="min-w-0">
              <div class="font-mono text-xs text-ink-gray-8">{{ ix.table }} · {{ ix.name }}</div>
              <div class="mt-0.5 text-xs text-ink-gray-5">Unused ({{ ix.lastUsed }}) · {{ mb(ix.sizeMb) }} of dead weight</div>
            </div>
            <Button size="sm" variant="ghost" label="Drop" @click="toast.success(`Dropping ${ix.name}…`)" />
          </div>
        </div>
      </Disclosure>

      <Disclosure title="Lock waits" :subtitle="DB.locks.length ? `${DB.locks.length} blocked` : 'None'" icon="lucide-lock">
        <p v-if="!DB.locks.length" class="text-p-sm text-ink-gray-5">No transactions are waiting on a lock.</p>
        <div v-else class="space-y-2">
          <div v-for="(l, i) in DB.locks" :key="i" class="rounded-lg border border-outline-amber-1 bg-surface-amber-1 p-3 text-xs text-ink-amber-8">
            <div>Connection <span class="tabular-nums font-medium">{{ l.waitingId }}</span> waited {{ l.waitedFor }} on <span class="tabular-nums font-medium">{{ l.blockingId }}</span>.</div>
            <code class="mt-1.5 block truncate font-mono text-ink-amber-7">{{ l.waitingQuery }}</code>
          </div>
        </div>
      </Disclosure>

      <Disclosure title="Running connections" :subtitle="`${processes.length} active`" icon="lucide-activity" defaultOpen>
        <div class="divide-y divide-outline-alpha-gray-1">
          <div v-for="p in processes" :key="p.id" class="flex items-center gap-3 py-2 text-sm">
            <span class="w-12 shrink-0 tabular-nums text-ink-gray-5">{{ p.id }}</span>
            <span class="w-20 shrink-0 truncate text-xs text-ink-gray-6">{{ p.command }}<span v-if="p.state" class="text-ink-gray-4"> · {{ p.state }}</span></span>
            <span class="min-w-0 flex-1 truncate font-mono text-xs text-ink-gray-7">{{ p.info || '—' }}</span>
            <span class="shrink-0 tabular-nums" :class="slow(p.time) ? 'text-ink-amber-7' : 'text-ink-gray-5'">{{ p.time }}</span>
            <Button size="sm" variant="ghost" label="Kill" @click="askKill(p)" />
          </div>
        </div>
      </Disclosure>
    </template>

    <ConfirmDialog
      v-model:open="killOpen"
      theme="red"
      :title="`Kill connection ${pendingKill?.id}?`"
      message="Whatever this connection is running gets rolled back. Killing the wrong one can interrupt a live save or a migration."
      confirm-label="Kill"
      @confirm="kill"
    />
  </ServerShell>
</template>

<script setup>
import { computed, reactive, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button, Dropdown, toast } from 'frappe-ui'
import ServerShell from '../../components/ServerShell.vue'
import ConfirmDialog from '../../components/ConfirmDialog.vue'
import Disclosure from '../../components/Disclosure.vue'
import { DB_ANALYZER } from '../../data/system'
import { useCloudStore } from '../../stores/cloud'

const store = useCloudStore()
const route = useRoute()
const router = useRouter()

const server = computed(() => store.findServer(route.params.serverId) || store.server)
watchEffect(() => {
  if (!server.value) router.replace('/')
})
const crumbs = computed(() => [{ label: 'Dev tools', route: `/manage/${server.value.id}/developer/logs` }, { label: 'DB analyzer' }])

const DB = DB_ANALYZER

// Which site's database we're analysing. Defaults to the first live one.
const liveSites = computed(() => (server.value?.sites || []).filter((s) => s.status === 'live'))
const activeId = ref(route.query.site || liveSites.value[0]?.id || null)
const activeSite = computed(() => liveSites.value.find((s) => s.id === activeId.value) || null)
const siteOptions = computed(() => liveSites.value.map((s) => ({ label: s.name, onClick: () => (activeId.value = s.id) })))
watchEffect(() => {
  if (!activeId.value && liveSites.value.length) activeId.value = liveSites.value[0].id
})

// — Storage: a local copy so "Optimize tables" can reclaim space in the bar.
const size = reactive({ ...DB.size })
const fileMb = computed(() => size.dataMb + size.indexMb + size.claimableMb)
const pct = (v) => (fileMb.value ? (v / fileMb.value) * 100 : 0)
const mb = (v) => (v >= 1024 ? `${(v / 1024).toFixed(1)} GB` : `${v} MB`)

const optimizing = ref(false)
function optimize() {
  optimizing.value = true
  const reclaimed = size.claimableMb
  setTimeout(() => {
    optimizing.value = false
    size.claimableMb = 0
    DB.tables.forEach((t) => (t.claimableMb = 0))
    toast.success(`Reclaimed ${mb(reclaimed)} across ${DB.tables.length} tables`)
  }, 1200)
}

// — Running connections: a local list so Kill removes them. Long (>5s) ones are
// the ones actually worth killing, so we flag them.
const processes = reactive(DB.processes.map((p) => ({ ...p })))
const slow = (t) => /^\d+s$/.test(t) && parseInt(t) >= 5
const killOpen = ref(false)
const pendingKill = ref(null)
function askKill(p) {
  pendingKill.value = p
  killOpen.value = true
}
function kill() {
  const i = processes.findIndex((p) => p.id === pendingKill.value.id)
  if (i !== -1) processes.splice(i, 1)
  toast.success(`Killed connection ${pendingKill.value.id}`)
}
</script>

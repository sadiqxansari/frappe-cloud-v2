<template>
  <ServerShell v-if="server" :server="server" :crumbs="crumbs" roomy>
    <h1 class="text-xl font-semibold text-ink-gray-9">Database</h1>
    <p class="mt-1 text-base text-ink-gray-5">Run read-only queries against a replica of {{ server.name }}.</p>

    <div class="mt-5 grid gap-4 sm:grid-cols-3">
      <div v-for="s in dbTiles" :key="s.label" class="rounded-xl border border-outline-gray-2 bg-surface-white p-4">
        <div class="text-sm text-ink-gray-5">{{ s.label }}</div>
        <div class="mt-1 text-lg font-semibold tabular-nums text-ink-gray-9">{{ s.value }}</div>
      </div>
    </div>

    <!-- Query editor -->
    <div class="mt-5 rounded-xl border border-outline-gray-2 bg-surface-white p-4">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-semibold text-ink-gray-8">SQL playground</h2>
        <span class="text-xs text-ink-gray-5">Read-only · against a replica</span>
      </div>
      <textarea
        v-model="query"
        rows="3"
        spellcheck="false"
        class="mt-2 w-full rounded-lg border border-outline-gray-2 bg-surface-gray-7 p-3 font-mono text-xs leading-5 text-ink-white focus:outline-none focus:ring-2 focus:ring-outline-gray-4"
      />
      <div class="mt-2 flex items-center justify-end gap-2">
        <Button variant="subtle" size="sm" label="Export results" :disabled="!result" icon-left="lucide-download" @click="exportCsv" />
        <Button variant="solid" size="sm" label="Run query" :disabled="!query.trim()" @click="run" />
      </div>

      <div v-if="result" class="mt-3 overflow-x-auto rounded-lg border border-outline-gray-2">
        <table class="w-full text-left text-sm">
          <thead class="bg-surface-gray-2 text-xs uppercase tracking-wide text-ink-gray-5">
            <tr>
              <th v-for="c in result.columns" :key="c" class="px-3 py-2 font-medium">{{ c }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-outline-gray-1">
            <tr v-for="(row, i) in result.rows" :key="i">
              <td v-for="(cell, j) in row" :key="j" class="px-3 py-2 tabular-nums text-ink-gray-8">{{ cell }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="result" class="mt-2 text-xs text-ink-gray-5">{{ result.rows.length }} rows · {{ result.ms }} ms</p>
    </div>

    <!-- Active connections -->
    <div class="mt-5 rounded-xl border border-outline-gray-2 bg-surface-white p-4">
      <h2 class="text-sm font-semibold text-ink-gray-8">Active connections</h2>
      <div class="mt-2 divide-y divide-outline-gray-1">
        <div v-for="q in DB_STATS.processList" :key="q.id" class="flex items-center gap-3 py-2 text-sm">
          <span class="w-12 shrink-0 tabular-nums text-ink-gray-5">{{ q.id }}</span>
          <span class="min-w-0 flex-1 truncate font-mono text-xs text-ink-gray-7">{{ q.query }}</span>
          <span class="shrink-0 tabular-nums text-ink-gray-5">{{ q.time }}</span>
          <Button variant="ghost" size="sm" label="Kill" @click="kill(q)" />
        </div>
      </div>
    </div>
  </ServerShell>
</template>

<script setup>
import { computed, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button, toast } from 'frappe-ui'
import ServerShell from '../../components/ServerShell.vue'
import { DB_STATS } from '../../data/system'
import { useCloudStore } from '../../stores/cloud'

const store = useCloudStore()
const route = useRoute()
const router = useRouter()

const server = computed(() => store.findServer(route.params.serverId) || store.server)
watchEffect(() => {
  if (!server.value) router.replace('/')
})
const crumbs = computed(() => [{ label: 'Dev tools', route: `/manage/${server.value.id}/developer/logs` }, { label: 'Database' }])

const dbTiles = [
  { label: 'Total size', value: DB_STATS.size },
  { label: 'Tables', value: String(DB_STATS.tables) },
  { label: 'Connections', value: String(DB_STATS.connections) },
]

const query = ref('SELECT name, creation FROM `tabUser` ORDER BY creation DESC LIMIT 5;')
const result = ref(null)

function run() {
  // Mock result — believable rows for the prototype.
  result.value = {
    columns: ['name', 'creation'],
    rows: [
      ['Administrator', '2026-05-20 09:14'],
      ['rahul@mycompany.in', '2026-05-22 11:02'],
      ['sara@mycompany.in', '2026-05-25 16:48'],
      ['guest', '2026-05-26 08:30'],
      ['support@mycompany.in', '2026-06-01 10:05'],
    ],
    ms: 12,
  }
  toast.success('Query ran in 12 ms')
}
function exportCsv() {
  toast.success('Exporting results as CSV…')
}
function kill(q) {
  toast.success(`Killed connection ${q.id}`)
}
</script>

<template>
  <ServerShell v-if="server" :server="server" :crumbs="crumbs" roomy>
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold text-ink-gray-9">SQL playground</h1>
        <p class="mt-1 text-p-base text-ink-gray-5">Run queries against {{ activeSite?.name || 'a site' }}'s database.</p>
      </div>
      <div class="flex items-center gap-2">
        <!-- Mode is the safety control: read-only runs against a replica and can't
             touch your data; read-write hits the live database. -->
        <Dropdown :options="modeOptions" placement="bottom-end">
          <Button variant="outline" size="sm" icon-right="lucide-chevron-down">
            <span class="inline-flex items-center gap-1.5">
              <span class="size-2 shrink-0 rounded-full" :class="readOnly ? 'bg-surface-green-3' : 'bg-surface-red-3'" />
              {{ readOnly ? 'Read-only' : 'Read-write' }}
            </span>
          </Button>
        </Dropdown>
        <Dropdown :options="siteOptions" placement="bottom-end">
          <Button variant="outline" size="sm" icon-right="lucide-chevron-down">
            <span class="inline-flex items-center gap-1.5">
              <span class="lucide-globe size-4 shrink-0 text-ink-gray-5" />
              <span class="max-w-40 truncate">{{ activeSite?.name || 'Select site' }}</span>
            </span>
          </Button>
        </Dropdown>
      </div>
    </div>

    <!-- Read-write is a footgun; say so plainly while it's on. -->
    <div v-if="!readOnly" class="mt-4 flex items-center gap-2 rounded-lg border border-outline-red-1 bg-surface-red-1 px-3 py-2 text-sm text-ink-red-8">
      <span class="lucide-triangle-alert size-4 shrink-0" />
      Read-write runs against the live database — an UPDATE or DELETE here is real and immediate.
    </div>

    <div class="mt-4 rounded-xl border border-outline-gray-2 bg-surface-elevation-1 p-4">
      <textarea
        v-model="query"
        rows="6"
        spellcheck="false"
        placeholder="SELECT name, creation FROM `tabUser` ORDER BY creation DESC LIMIT 10;"
        class="w-full rounded-lg border border-outline-gray-2 bg-surface-gray-10 p-3 font-mono text-p-xs text-ink-base focus:outline-none focus:ring-2 focus:ring-outline-gray-4"
        @keydown.meta.enter="run"
        @keydown.ctrl.enter="run"
      />
      <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <Button size="sm" variant="ghost" icon-left="lucide-table-2" label="Browse tables" @click="tablesOpen = true" />
          <span class="text-p-xs text-ink-gray-4">⌘↵ to run</span>
        </div>
        <div class="flex items-center gap-2">
          <Button variant="subtle" size="sm" label="Export CSV" :disabled="!result || !result.rows.length" icon-left="lucide-download" @click="toast.success('Exporting results as CSV…')" />
          <Button variant="solid" size="sm" label="Run query" :disabled="!query.trim()" @click="run" />
        </div>
      </div>

      <!-- Query failed -->
      <div v-if="queryError" class="mt-3 rounded-lg border border-outline-red-1 bg-surface-red-1 p-3">
        <div class="flex items-center gap-1.5 text-sm font-medium text-ink-red-8">
          <span class="lucide-circle-x size-4 shrink-0" /> Query failed
        </div>
        <pre class="mt-1.5 whitespace-pre-wrap font-mono text-xs text-ink-red-8">{{ queryError }}</pre>
      </div>

      <!-- Result -->
      <template v-else-if="result">
        <div v-if="result.rows.length" class="mt-3 overflow-x-auto rounded-lg border border-outline-gray-2">
          <table class="w-full text-left text-sm">
            <thead class="bg-surface-gray-2 text-xs uppercase tracking-wide text-ink-gray-5">
              <tr>
                <th v-for="c in result.columns" :key="c" class="px-3 py-2 font-medium">{{ c }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-outline-alpha-gray-1">
              <tr v-for="(row, i) in result.rows" :key="i">
                <td v-for="(cell, j) in row" :key="j" class="px-3 py-2 tabular-nums text-ink-gray-8">{{ cell }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="mt-3 rounded-lg border border-dashed border-outline-gray-2 p-6 text-center text-sm text-ink-gray-5">
          No rows returned — the query ran fine but matched nothing.
        </div>
        <p class="mt-2 text-p-xs text-ink-gray-5">{{ result.rows.length }} rows · {{ result.ms }} ms</p>
      </template>
    </div>

    <!-- Schema browser — click a table or column to drop it into the editor. -->
    <Dialog v-model:open="tablesOpen" size="sm">
      <template #title><span class="text-xl font-semibold text-ink-gray-9">Tables</span></template>
      <div class="space-y-1">
        <div v-for="t in DB_TABLES" :key="t.name" class="rounded-lg border border-outline-gray-2">
          <button class="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-surface-gray-1" @click="expanded === t.name ? (expanded = '') : (expanded = t.name)">
            <span class="font-mono text-xs text-ink-gray-8">{{ t.name }}</span>
            <span class="flex items-center gap-2">
              <button class="text-p-xs text-ink-gray-5 underline-offset-2 hover:underline" @click.stop="insert(t.name)">Insert</button>
              <span class="lucide-chevron-down size-3.5 text-ink-gray-4 transition-transform" :class="expanded === t.name ? 'rotate-180' : ''" />
            </span>
          </button>
          <div v-if="expanded === t.name" class="flex flex-wrap gap-1.5 border-t border-outline-alpha-gray-1 p-2">
            <button v-for="c in t.columns" :key="c" class="rounded border border-outline-gray-2 px-1.5 py-0.5 font-mono text-xs text-ink-gray-6 hover:bg-surface-gray-2" @click="insert(c)">{{ c }}</button>
          </div>
        </div>
      </div>
    </Dialog>
  </ServerShell>
</template>

<script setup>
import { computed, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button, Dialog, Dropdown, toast } from 'frappe-ui'
import ServerShell from '../../components/ServerShell.vue'
import { DB_TABLES } from '../../data/system'
import { useCloudStore } from '../../stores/cloud'

const store = useCloudStore()
const route = useRoute()
const router = useRouter()

const server = computed(() => store.findServer(route.params.serverId) || store.server)
watchEffect(() => {
  if (!server.value) router.replace('/')
})
const crumbs = computed(() => [{ label: 'Dev tools', route: `/manage/${server.value.id}/developer/logs` }, { label: 'SQL playground' }])

// Per-site, like the analyzer — a query needs a database to run against.
const liveSites = computed(() => (server.value?.sites || []).filter((s) => s.status === 'live'))
const activeId = ref(route.query.site || liveSites.value[0]?.id || null)
const activeSite = computed(() => liveSites.value.find((s) => s.id === activeId.value) || null)
const siteOptions = computed(() => liveSites.value.map((s) => ({ label: s.name, onClick: () => (activeId.value = s.id) })))
watchEffect(() => {
  if (!activeId.value && liveSites.value.length) activeId.value = liveSites.value[0].id
})

const readOnly = ref(true)
const modeOptions = [
  { label: 'Read-only (against a replica)', onClick: () => (readOnly.value = true) },
  { label: 'Read-write (live database)', onClick: () => (readOnly.value = false) },
]

const query = ref('SELECT name, creation FROM `tabUser` ORDER BY creation DESC LIMIT 5;')
const result = ref(null)
const queryError = ref('')

const SAMPLE_ROWS = [
  ['Administrator', '2026-05-20 09:14'],
  ['rahul@mycompany.in', '2026-05-22 11:02'],
  ['sara@mycompany.in', '2026-05-25 16:48'],
  ['guest', '2026-05-26 08:30'],
  ['support@mycompany.in', '2026-06-01 10:05'],
]

function run() {
  result.value = null
  queryError.value = ''
  const q = query.value.trim()
  if (!q) return

  if (store.edgeMode) {
    queryError.value = `ERROR 1064 (42000): You have an error in your SQL syntax;\ncheck the manual near '${q.slice(0, 24)}…' at line 1`
    return
  }
  // Read-only mode rejects anything that writes.
  if (readOnly.value && !/^\s*select/i.test(q)) {
    queryError.value = 'ERROR 1290 (HY000): Read-only mode runs against a replica — only SELECT is allowed. Switch to read-write to modify data.'
    return
  }
  const empty = /\blimit\s+0\b|\bwhere\s+1\s*=\s*0\b/i.test(q)
  const write = !/^\s*select/i.test(q)
  if (write) {
    result.value = null
    toast.success('Query OK · 1 row affected')
    return
  }
  result.value = { columns: ['name', 'creation'], rows: empty ? [] : SAMPLE_ROWS, ms: 12 }
  toast.success('Query ran in 12 ms')
}

// — Schema browser.
const tablesOpen = ref(false)
const expanded = ref('')
function insert(text) {
  const needsSpace = query.value && !/\s$/.test(query.value)
  query.value += (needsSpace ? ' ' : '') + text
}
</script>

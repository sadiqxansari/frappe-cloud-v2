<template>
  <ServerShell v-if="server" :server="server" :crumbs="crumbs" wide>
    <!-- Breadcrumb ("Dev tools / SQL playground") and the site selector both
         live in the shell's top bar — the site picker rides the actions slot. -->
    <template #actions>
      <Dropdown :options="siteOptions" placement="bottom-end">
        <Button variant="outline" size="sm" icon-right="lucide-chevron-down">
          <span class="max-w-44 truncate">{{ activeSite?.name || 'Select site' }}</span>
        </Button>
      </Dropdown>
    </template>

    <!-- Full-width workspace, no centred max-width. -->
    <div class="px-6 py-6">
    <!-- Read-write is a footgun; say so plainly while it's on. -->
    <Alert
      v-if="mode === 'read-write'"
      theme="yellow"
      title="Read/Write runs against the live database — an UPDATE or DELETE here is real and immediate."
      class="mb-4"
    />

    <!-- Editor. Starts empty with a sample query as placeholder; a result only
         appears once something is executed (e.g. Preview data on a table). -->
    <CodeEditor
      v-model="query"
      language="sql"
      variant="outline"
      placeholder="SELECT name, creation FROM `tabUser` ORDER BY creation DESC LIMIT 5;"
      class="[&_.cm-content]:min-h-[16rem]"
      style="--cm-max-height: 24rem"
      spellcheck="false"
      @keydown.meta.enter="run"
      @keydown.ctrl.enter="run"
    />

    <!-- Toolbar: mode + schema on the left, execute on the right. -->
    <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <TabButtons v-model="mode" :options="modeOptions" />
        <Button variant="outline" size="sm" icon-left="lucide-table" @click="tablesOpen = true">
          Tables <span class="ml-1 text-ink-gray-4">{{ DB_TABLE_COUNT }}</span>
        </Button>
      </div>
      <Button variant="solid" icon-left="lucide-play" label="Execute" :disabled="!query.trim()" @click="run" />
    </div>

    <!-- Query failed -->
    <div v-if="queryError" class="mt-4 rounded-lg border border-outline-red-1 bg-surface-red-1 p-3">
      <div class="flex items-center gap-1.5 text-sm font-medium text-ink-red-8">
        <span class="lucide-circle-x size-4 shrink-0" /> Query failed
      </div>
      <pre class="mt-1.5 whitespace-pre-wrap font-mono text-xs text-ink-red-8">{{ queryError }}</pre>
    </div>

    <!-- Result -->
    <template v-else-if="result">
      <div v-if="result.rows.length" class="mt-4 overflow-x-auto rounded-lg border border-outline-gray-2">
        <table class="w-full text-left text-sm">
          <thead class="border-b border-outline-gray-2 text-xs font-medium uppercase tracking-wide text-ink-gray-5">
            <tr>
              <th class="w-10 px-3 py-2.5 font-medium">#</th>
              <th v-for="c in result.columns" :key="c" class="whitespace-nowrap px-3 py-2.5 font-medium">{{ c }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-outline-alpha-gray-1">
            <tr v-for="(row, i) in pagedRows" :key="i" class="hover:bg-surface-gray-1">
              <td class="px-3 py-2.5 tabular-nums text-ink-gray-4">{{ pageStart + i }}</td>
              <td v-for="(cell, j) in row" :key="j" class="whitespace-nowrap px-3 py-2.5 tabular-nums text-ink-gray-8">{{ cell }}</td>
            </tr>
          </tbody>
        </table>

        <!-- Footer: export left, pagination right. -->
        <div class="flex flex-wrap items-center justify-between gap-3 border-t border-outline-gray-2 px-3 py-2.5">
          <button class="inline-flex items-center gap-1.5 text-sm text-ink-gray-7 hover:text-ink-gray-9" @click="toast.success('Downloading results as CSV…')">
            <span class="lucide-download size-4 shrink-0" />
            Download as CSV
          </button>
          <div class="flex items-center gap-4 text-sm text-ink-gray-6">
            <div class="flex items-center gap-2">
              <span>Per Page</span>
              <Select v-model="perPage" :options="perPageOptions" size="sm" />
            </div>
            <span class="tabular-nums">{{ pageStart }}–{{ pageEnd }} of {{ result.rows.length }} rows</span>
            <div class="flex items-center gap-1">
              <Button variant="ghost" size="sm" icon-left="lucide-arrow-left" label="Prev" :disabled="page <= 1" @click="page--" />
              <Button variant="ghost" size="sm" icon-right="lucide-arrow-right" label="Next" :disabled="page >= pageCount" @click="page++" />
            </div>
          </div>
        </div>
      </div>
      <div v-else class="mt-4 rounded-lg border border-dashed border-outline-gray-2 p-6 text-center text-sm text-ink-gray-5">
        No rows returned — the query ran fine but matched nothing.
      </div>

      <!-- The exact SQL that ran, on demand. -->
      <div class="mt-4">
        <button class="inline-flex items-center gap-1.5 text-sm text-ink-gray-6 hover:text-ink-gray-8" @click="sqlShown = !sqlShown">
          <span class="lucide-chevron-right size-4 shrink-0 transition-transform" :class="sqlShown ? 'rotate-90' : ''" />
          View SQL Query
        </button>
        <div v-if="sqlShown" class="mt-2 rounded-lg border border-outline-gray-2 bg-surface-gray-1 px-3 py-2.5 font-mono text-xs text-ink-gray-8">
          {{ result.sql }}
        </div>
      </div>
    </template>
    </div>

    <!-- Schema browser: table list on the left, columns on the right. -->
    <Dialog v-model:open="tablesOpen" size="4xl">
      <template #body>
        <div class="p-6">
          <div class="flex items-center justify-between">
            <h3 class="text-xl font-semibold text-ink-gray-9">Tables</h3>
            <Button variant="ghost" icon="lucide-x" aria-label="Close" @click="tablesOpen = false" />
          </div>

          <FormControl
            v-model="tableSearch"
            type="text"
            class="mt-4"
            placeholder="Search tables"
            :prefix="true"
          >
            <template #prefix>
              <span class="lucide-search size-4 text-ink-gray-4" />
            </template>
          </FormControl>

          <div class="mt-4 flex h-[26rem] gap-4">
            <!-- Left: table list -->
            <div class="w-64 shrink-0 overflow-y-auto border-r border-outline-gray-2 pr-1">
              <button
                v-for="t in filteredTables"
                :key="t.name"
                class="block w-full truncate rounded-md px-3 py-2 text-left font-mono text-sm"
                :class="selected === t.name ? 'bg-surface-gray-3 text-ink-gray-9' : 'text-ink-gray-7 hover:bg-surface-gray-2'"
                :title="t.name"
                @click="selected = t.name"
              >
                {{ t.name }}
              </button>
              <p v-if="!filteredTables.length" class="px-3 py-6 text-center text-sm text-ink-gray-4">No tables match.</p>
            </div>

            <!-- Right: columns of the selected table -->
            <div class="min-w-0 flex-1 overflow-y-auto">
              <template v-if="selectedTable">
                <div class="flex items-center justify-between gap-3">
                  <div class="min-w-0 truncate">
                    <span class="font-mono text-base text-ink-gray-9">{{ selectedTable.name }}</span>
                    <span class="ml-1.5 text-sm text-ink-gray-5">({{ selectedTable.columns.length }} columns)</span>
                  </div>
                  <Button variant="outline" size="sm" icon-left="lucide-eye" label="Preview data" @click="previewData(selectedTable.name)" />
                </div>
                <div class="mt-4 overflow-hidden rounded-lg border border-outline-gray-2">
                  <table class="w-full text-left text-sm">
                    <thead class="border-b border-outline-gray-2 text-xs font-medium uppercase tracking-wide text-ink-gray-5">
                      <tr>
                        <th class="px-3 py-2.5 font-medium">Column</th>
                        <th class="px-3 py-2.5 font-medium">Type</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-outline-alpha-gray-1">
                      <tr v-for="c in selectedTable.columns" :key="c.name">
                        <td class="px-3 py-2.5 font-mono text-ink-gray-8">{{ c.name }}</td>
                        <td class="px-3 py-2.5 font-mono text-ink-gray-6">{{ c.type }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </template>
              <div v-else class="flex h-full items-center justify-center text-sm text-ink-gray-4">
                Select a table to view its columns.
              </div>
            </div>
          </div>
        </div>
      </template>
    </Dialog>
  </ServerShell>
</template>

<script setup>
import { computed, ref, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button, Dialog, Dropdown, FormControl, Select, TabButtons, toast } from 'frappe-ui'
import { CodeEditor } from 'frappe-ui/code-editor'
import Alert from '../../components/Alert.vue'
import ServerShell from '../../components/ServerShell.vue'
import { DB_TABLES, DB_TABLE_COUNT } from '../../data/system'
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

// Mode is the safety control: read-only runs against a replica and can't touch
// your data; read/write hits the live database.
const mode = ref('read-only')
const modeOptions = [
  { label: 'Read-only', value: 'read-only' },
  { label: 'Read/Write', value: 'read-write' },
]

// Empty by default — the editor shows the sample query as a placeholder and no
// result renders until the user runs something (typically Preview data).
const query = ref('')
const result = ref(null)
const queryError = ref('')
const sqlShown = ref(false)

// — Result mocking. Parse the target table out of the FROM clause and hand back
// a plausible result set for it. Sequence tables share one canonical row.
function tableFromQuery(q) {
  const m = q.match(/\bfrom\s+`?([^\s`;]+)`?/i)
  return m ? m[1] : null
}

const SEQ_ROW = [1, 1, 9223372036854775807, 1, 1, 0, 0, 0]

const SAMPLE_ROWS = {
  tabUser: [
    ['Administrator', 'admin@mycompany.in', 1, '2026-05-20 09:14:22', '2026-06-30 18:02:10'],
    ['rahul@mycompany.in', 'rahul@mycompany.in', 1, '2026-05-22 11:02:41', '2026-06-28 09:15:00'],
    ['sara@mycompany.in', 'sara@mycompany.in', 1, '2026-05-25 16:48:03', '2026-06-29 14:22:37'],
    ['guest', 'guest@example.com', 0, '2026-05-26 08:30:00', '2026-05-26 08:30:00'],
    ['support@mycompany.in', 'support@mycompany.in', 1, '2026-06-01 10:05:19', '2026-07-02 11:48:52'],
  ],
}

function mockCell(type, i) {
  if (/int|decimal|float|double/i.test(type)) return i + 1
  if (/datetime/i.test(type)) return '2026-06-15 12:00:00'
  if (/date/i.test(type)) return '2026-06-15'
  return `value_${i + 1}`
}

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
  if (mode.value === 'read-only' && !/^\s*select/i.test(q)) {
    queryError.value = 'ERROR 1290 (HY000): Read-only mode allows SELECT only. Switch to Read/Write to modify data.'
    return
  }
  const write = !/^\s*select/i.test(q)
  if (write) {
    result.value = null
    toast.success('Query OK · 1 row affected')
    return
  }

  const tableName = tableFromQuery(q)
  const table = DB_TABLES.find((t) => t.name === tableName)
  const empty = /\blimit\s+0\b|\bwhere\s+1\s*=\s*0\b/i.test(q)
  let columns, rows
  if (table) {
    columns = table.columns.map((c) => c.name)
    if (/_id_seq$/.test(table.name)) {
      rows = [SEQ_ROW]
    } else if (SAMPLE_ROWS[table.name]) {
      rows = SAMPLE_ROWS[table.name]
    } else {
      rows = Array.from({ length: 3 }, (_, r) => table.columns.map((c, ci) => mockCell(c.type, r + ci)))
    }
  } else {
    columns = ['name', 'creation']
    rows = SAMPLE_ROWS.tabUser.map((r) => [r[0], r[3]])
  }

  page.value = 1
  result.value = { columns, rows: empty ? [] : rows, sql: q }
  toast.success('Query ran in 12 ms')
}

// — Pagination over the result set.
const perPageOptions = ['10', '20', '50', '100']
const perPage = ref('10')
const page = ref(1)
const pageCount = computed(() => (result.value ? Math.max(1, Math.ceil(result.value.rows.length / Number(perPage.value))) : 1))
const pageStart = computed(() => (result.value?.rows.length ? (page.value - 1) * Number(perPage.value) + 1 : 0))
const pageEnd = computed(() => (result.value ? Math.min(page.value * Number(perPage.value), result.value.rows.length) : 0))
const pagedRows = computed(() => (result.value ? result.value.rows.slice((page.value - 1) * Number(perPage.value), page.value * Number(perPage.value)) : []))
watch(perPage, () => (page.value = 1))

// — Schema browser.
const tablesOpen = ref(false)
const tableSearch = ref('')
const selected = ref('')
const filteredTables = computed(() => {
  const q = tableSearch.value.trim().toLowerCase()
  return q ? DB_TABLES.filter((t) => t.name.toLowerCase().includes(q)) : DB_TABLES
})
const selectedTable = computed(() => DB_TABLES.find((t) => t.name === selected.value) || null)

function previewData(name) {
  query.value = `SELECT * FROM \`${name}\` LIMIT 100;`
  tablesOpen.value = false
  run()
}
</script>

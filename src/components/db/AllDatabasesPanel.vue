<template>
  <Teleport to="body">
    <Transition name="db-panel">
      <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/30" @click="close" />

        <!-- Master–detail: searchable list on the left, docked detail on the
             right — the same shape as Central's Invoices. -->
        <div class="relative flex h-[80vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-outline-gray-2 bg-surface-elevation-1 shadow-2xl">
          <!-- List -->
          <div class="flex w-80 shrink-0 flex-col border-r border-outline-gray-2">
            <div class="border-b border-outline-gray-2 p-4">
              <div class="flex items-center justify-between gap-2">
                <h2 class="text-base font-semibold text-ink-gray-9">All databases</h2>
                <span class="shrink-0 text-p-xs text-ink-gray-5">{{ databases.length }} total</span>
              </div>
              <FormControl v-model="query" type="text" size="sm" class="mt-3" placeholder="Search databases…">
                <template #prefix><span class="lucide-search size-4 text-ink-gray-4" /></template>
              </FormControl>
            </div>
            <div class="flex-1 overflow-y-auto p-2">
              <button
                v-for="db in filtered"
                :key="db.dbName"
                class="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors"
                :class="selected?.dbName === db.dbName ? 'bg-surface-gray-2' : 'hover:bg-surface-gray-1'"
                @click="selected = db"
              >
                <span class="flex min-w-0 items-center gap-2">
                  <span :class="db.system ? 'lucide-database' : 'lucide-globe'" class="size-3.5 shrink-0 text-ink-gray-4" />
                  <span class="truncate" :class="db.system ? 'text-ink-gray-6' : 'text-ink-gray-8'">{{ db.siteName }}</span>
                  <Badge v-if="db.system" theme="gray" variant="subtle" size="sm" label="system" />
                </span>
                <span class="shrink-0 tabular-nums text-ink-gray-6">{{ fmtMb(dbFileMb(db)) }}</span>
              </button>
              <p v-if="!filtered.length" class="px-3 py-8 text-center text-p-sm text-ink-gray-4">
                No databases match your search.
              </p>
            </div>
          </div>

          <!-- Detail -->
          <div v-if="selected" class="flex min-w-0 flex-1 flex-col">
            <div class="flex items-start justify-between gap-3 border-b border-outline-gray-2 p-4">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span :class="selected.system ? 'lucide-database' : 'lucide-globe'" class="size-4 shrink-0 text-ink-gray-5" />
                  <span class="truncate text-base font-semibold text-ink-gray-9">{{ selected.siteName }}</span>
                </div>
                <div class="mt-0.5 truncate text-p-xs" :class="selected.system ? 'text-ink-gray-5' : 'font-mono text-ink-gray-4'">
                  {{ selected.system ? 'System schema · managed by MariaDB' : selected.dbName }}
                </div>
              </div>
              <button class="grid size-7 shrink-0 place-items-center rounded text-ink-gray-5 hover:bg-surface-gray-2" aria-label="Close" @click="close">
                <span class="lucide-x size-4" />
              </button>
            </div>

            <div class="flex-1 space-y-4 overflow-y-auto p-4">
              <dl class="grid grid-cols-2 gap-x-6 gap-y-3">
                <div v-for="s in stats" :key="s.label">
                  <dt class="text-p-xs text-ink-gray-5">{{ s.label }}</dt>
                  <dd class="mt-0.5 text-lg font-semibold tabular-nums" :class="s.tone || 'text-ink-gray-9'">{{ s.value }}</dd>
                </div>
              </dl>

              <div v-if="!selected.system" class="overflow-hidden rounded-lg border border-outline-gray-2">
                <div class="flex items-center justify-between gap-3 border-b border-outline-alpha-gray-1 bg-surface-gray-1 px-3 py-2 text-xs font-medium text-ink-gray-5">
                  <span>Largest tables</span><span>Data</span>
                </div>
                <div v-for="t in topTables" :key="t.name" class="flex items-center justify-between gap-3 border-b border-outline-alpha-gray-1 px-3 py-2 text-sm last:border-b-0">
                  <span class="truncate font-mono text-ink-gray-7">{{ t.name }}</span>
                  <span class="shrink-0 tabular-nums text-ink-gray-8">{{ fmtMb(t.dataMb) }}</span>
                </div>
              </div>
              <p v-else class="rounded-lg bg-surface-gray-1 p-3 text-p-sm text-ink-gray-5">
                A schema MariaDB maintains itself — grants, plugins and internal bookkeeping. Its tables aren't yours to manage, and it can't be opened as a site.
              </p>
            </div>

            <div v-if="!selected.system" class="border-t border-outline-gray-2 p-4">
              <Button variant="subtle" class="w-full" label="Open full analysis" icon-right="lucide-arrow-right" @click="openSite" />
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { Badge, Button, FormControl } from 'frappe-ui'
import { dbFileMb } from '../../data/dbAnalyzer'
import { fmtMb } from './format'

// A "see all" workspace for the server's databases: browse the full list,
// preview any one's size/tables, then jump into its full site analysis.
const props = defineProps({
  open: { type: Boolean, default: false },
  databases: { type: Array, required: true }, // sorted desc by size
})
const emit = defineEmits(['update:open', 'drill'])

const query = ref('')
const selected = ref(null)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.databases
  return props.databases.filter(
    (db) => db.siteName.toLowerCase().includes(q) || db.dbName.toLowerCase().includes(q)
  )
})

const stats = computed(() => {
  const db = selected.value
  if (!db) return []
  if (db.system) return [{ label: 'On disk', value: fmtMb(dbFileMb(db)) }]
  return [
    { label: 'On disk', value: fmtMb(dbFileMb(db)) },
    { label: 'Data', value: fmtMb(db.size.dataMb) },
    { label: 'Indexes', value: fmtMb(db.size.indexMb) },
    { label: 'Claimable', value: fmtMb(db.size.claimableMb), tone: db.size.claimableMb ? 'text-ink-amber-7' : 'text-ink-gray-9' },
  ]
})
const topTables = computed(() => (selected.value?.tables || []).slice(0, 5))

function close() {
  emit('update:open', false)
}
function openSite() {
  emit('drill', selected.value.siteId)
  close()
}

// Open fresh: largest database selected, search cleared. Escape closes.
function onKey(e) {
  if (e.key === 'Escape') close()
}
watch(
  () => props.open,
  (o) => {
    if (o) {
      query.value = ''
      selected.value = props.databases[0] || null
      window.addEventListener('keydown', onKey)
    } else {
      window.removeEventListener('keydown', onKey)
    }
  }
)
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
.db-panel-enter-active,
.db-panel-leave-active {
  transition: opacity 0.15s ease;
}
.db-panel-enter-from,
.db-panel-leave-to {
  opacity: 0;
}
</style>

<template>
  <ServerShell v-if="server" :server="server" :crumbs="crumbs" roomy>
    <h1 class="text-xl font-semibold text-ink-gray-9">Logs</h1>
    <p class="mt-1 text-p-base text-ink-gray-5">Output from {{ server.name }}'s services. Pick a file to tail.</p>

    <div class="mt-5 flex h-[68vh] gap-4">
      <!-- File list — bordered cards, most-recently-written first, with their
           own search. Matches the Frappe Cloud log browser. -->
      <div class="flex w-64 shrink-0 flex-col">
        <FormControl v-model="fileSearch" type="text" placeholder="Search log files" autocomplete="off" class="[&_input]:w-full" />
        <div class="mt-2 flex-1 space-y-2 overflow-y-auto px-0.5 pb-1">
          <button
            v-for="f in visibleFiles"
            :key="f.file"
            class="flex w-full flex-col gap-1 rounded-lg border p-3 text-left transition-colors"
            :class="f.file === openFile ? 'border-outline-gray-5 bg-surface-gray-2' : 'border-outline-gray-2 hover:bg-surface-gray-1'"
            @click="selectFile(f.file)"
          >
            <span class="flex items-start gap-1.5">
              <span class="min-w-0 flex-1 break-words text-sm text-ink-gray-8">{{ f.file }}</span>
              <span v-if="f.kind === 'error' && f.lines" class="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--ink-red-7)]" />
            </span>
            <span class="flex items-center justify-between text-xs text-ink-gray-5">
              <span class="tabular-nums">{{ f.size }}</span>
              <span>{{ ago(f.modifiedMinsAgo) }}</span>
            </span>
          </button>
          <p v-if="!visibleFiles.length" class="px-1 py-2 text-p-sm text-ink-gray-5">No files match.</p>
        </div>
      </div>

      <!-- Viewer -->
      <div class="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-outline-gray-2 bg-surface-elevation-1">
        <div class="flex flex-wrap items-center gap-2 border-b border-outline-alpha-gray-1 p-3">
          <FormControl v-model="search" class="min-w-0 flex-1 [&_input]:w-full" type="text" placeholder="Search this log…" autocomplete="off" />
          <div class="w-36 shrink-0"><FormControl v-model="lineCount" type="select" :options="lineOptions" /></div>
          <Button variant="subtle" size="sm" label="Refresh" @click="refresh" />
          <Button :variant="tailing ? 'solid' : 'subtle'" size="sm" :label="tailing ? 'Live' : 'Live tail'" @click="toggleTail" />
          <Dropdown :options="serviceOptions" placement="bottom-end">
            <Button variant="ghost" size="sm" label="Restart" icon-left="lucide-rotate-cw" />
          </Dropdown>
          <button class="ml-auto flex items-center gap-1.5 text-sm text-ink-gray-6 hover:text-ink-gray-8" @click="download">
            <span class="lucide-download size-4" /> Download
          </button>
        </div>

        <!-- Filename strip — Frappe Cloud's "Description" header. -->
        <div class="flex items-center justify-between border-b border-outline-alpha-gray-1 bg-surface-gray-2 px-4 py-1.5">
          <span class="font-mono text-xs text-ink-gray-6">{{ openFile }}</span>
          <span v-if="tailing" class="flex items-center gap-1.5 text-xs text-ink-green-7">
            <span class="size-1.5 animate-pulse rounded-full bg-[var(--ink-green-7)]" /> Live
          </span>
        </div>

        <p v-if="placeholder" class="flex-1 overflow-auto p-4 font-mono text-p-xs text-ink-gray-5">{{ placeholder }}</p>
        <div v-else class="flex-1 overflow-auto">
          <div
            v-for="(l, i) in shownLines"
            :key="i"
            class="whitespace-pre-wrap break-all border-b border-outline-alpha-gray-1 px-4 py-1.5 font-mono text-p-xs hover:bg-surface-gray-1"
            :class="levelClass(l)"
          >{{ l }}</div>
        </div>

        <div class="flex items-center gap-2 border-t border-outline-alpha-gray-1 px-4 py-1.5 text-xs text-ink-gray-5">
          <span>{{ shownLines.length }} lines<span v-if="truncated" class="text-ink-gray-4"> · showing the last {{ limit }} of {{ filteredLines.length }}</span></span>
        </div>
      </div>
    </div>

    <ConfirmDialog
      v-model:open="restartOpen"
      :title="`Restart ${pendingRestart?.name}?`"
      message="In-flight requests on this service are dropped and retried. Takes a few seconds."
      confirm-label="Restart"
      @confirm="doRestart"
    />
  </ServerShell>
</template>

<script setup>
import { computed, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button, Dropdown, FormControl, toast } from 'frappe-ui'
import ServerShell from '../../components/ServerShell.vue'
import ConfirmDialog from '../../components/ConfirmDialog.vue'
import { LOG_FILES, logLines } from '../../data/system'
import { useCloudStore } from '../../stores/cloud'

const store = useCloudStore()
const route = useRoute()
const router = useRouter()

const server = computed(() => store.findServer(route.params.serverId) || store.server)
watchEffect(() => {
  if (!server.value) router.replace('/')
})
const crumbs = computed(() => [{ label: 'Dev tools', route: `/manage/${server.value.id}/developer/logs` }, { label: 'Logs' }])

// File list: searchable, freshest first (the live ones float to the top).
const fileSearch = ref('')
const visibleFiles = computed(() => {
  const q = fileSearch.value.trim().toLowerCase()
  return LOG_FILES.filter((f) => !q || f.file.toLowerCase().includes(q))
    .slice()
    .sort((a, b) => a.modifiedMinsAgo - b.modifiedMinsAgo)
})
function ago(mins) {
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const h = Math.floor(mins / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const openFile = ref(LOG_FILES.find((f) => f.lines > 0)?.file || LOG_FILES[0].file)
const search = ref('')
const tailing = ref(false)
const lineCount = ref('200')
const lineOptions = [
  { label: 'Last 200 lines', value: '200' },
  { label: 'Last 500 lines', value: '500' },
  { label: 'Last 1000 lines', value: '1000' },
]

function selectFile(file) {
  openFile.value = file
  search.value = ''
}

const rawLines = computed(() => logLines(openFile.value))
const filteredLines = computed(() => {
  const q = search.value.trim().toLowerCase()
  return q ? rawLines.value.filter((l) => l.toLowerCase().includes(q)) : rawLines.value
})
const limit = computed(() => Number(lineCount.value))
// A big file is tailed: we only render the last N lines.
const shownLines = computed(() => filteredLines.value.slice(-limit.value))
const truncated = computed(() => filteredLines.value.length > limit.value)

// Colour by level so the eye lands on errors first (tuned for the light pane).
function levelClass(l) {
  if (/\[ERROR\]|\bERROR\b|Traceback|Exception/i.test(l)) return 'text-ink-red-6'
  if (/\[WARN(ING)?\]|\bWARN\b/i.test(l)) return 'text-ink-amber-7'
  return 'text-ink-gray-7'
}

// Distinguish an empty file from a search that matched nothing.
const placeholder = computed(() => {
  if (!rawLines.value.length) return 'This log file is empty — nothing has been written yet.'
  if (!filteredLines.value.length) return 'No lines match your search.'
  return ''
})

function refresh() {
  toast.success('Refreshed')
}
function toggleTail() {
  tailing.value = !tailing.value
}
function download() {
  toast('In the real thing, this downloads the log file')
}

// Restarting a service drops in-flight work, so confirm first.
const restartOpen = ref(false)
const pendingRestart = ref(null)
const serviceOptions = computed(() =>
  server.value.processes.map((p) => ({
    label: `Restart ${p.name}`,
    icon: 'lucide-rotate-cw',
    onClick: () => {
      pendingRestart.value = p
      restartOpen.value = true
    },
  })),
)
function doRestart() {
  store.restartProcess(server.value.id, pendingRestart.value.name)
  toast.success(`Restarting ${pendingRestart.value.name} — a few seconds`)
}
</script>

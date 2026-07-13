<template>
  <ServerShell v-if="server" :server="server" :crumbs="crumbs" wide>
    <div class="flex h-full flex-col px-4 py-6 sm:px-6">
    <div class="shrink-0">
      <h1 class="text-xl font-semibold text-ink-gray-9">Logs</h1>
      <p class="mt-1 text-p-base text-ink-gray-5">Output from {{ server.name }}'s services.</p>
    </div>

    <div class="mt-5 flex min-h-0 flex-1 gap-4">
      <!-- File list — a single bordered card: search on top, unbordered rows
           below, freshest first. Matches frappe/pilot's log browser. -->
      <div class="flex w-64 shrink-0 flex-col overflow-hidden rounded-lg border border-outline-gray-2">
        <div class="shrink-0 border-b border-outline-gray-2 px-2 py-2">
          <FormControl v-model="fileSearch" type="text" placeholder="Search log files" autocomplete="off" class="[&_input]:w-full" />
        </div>
        <div class="flex-1 overflow-y-auto p-2">
          <p v-if="!visibleFiles.length" class="p-2 text-sm text-ink-gray-4">No log files found.</p>
          <button
            v-for="f in visibleFiles"
            :key="f.file"
            class="w-full rounded-lg px-3 py-2.5 text-left transition-colors"
            :class="f.file === openFile ? 'bg-surface-gray-2' : 'hover:bg-surface-gray-1'"
            @click="selectFile(f.file)"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="truncate text-sm font-medium text-ink-gray-8">{{ f.file }}</span>
              <span v-if="f.kind === 'error' && f.lines" class="size-1.5 shrink-0 rounded-full bg-red-500" />
            </div>
            <div class="mt-0.5 flex items-center justify-between text-xs text-ink-gray-4">
              <span class="tabular-nums">{{ f.size }}</span>
              <span>{{ ago(f.modifiedMinsAgo) }}</span>
            </div>
          </button>
        </div>
      </div>

      <!-- Viewer -->
      <div class="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-outline-gray-2">
        <!-- Toolbar -->
        <div class="flex flex-wrap items-center gap-2 border-b border-outline-gray-2 px-2 py-2">
          <div class="w-32 shrink-0">
            <FormControl v-model="lineCount" type="select" :disabled="tailing" :options="lineOptions" />
          </div>
          <FormControl
            v-model="search"
            class="w-44 min-w-0 [&_input]:w-full"
            type="text"
            placeholder="Search this log…"
            autocomplete="off"
            @keydown.enter.exact.prevent="gotoMatch(1)"
            @keydown.enter.shift.prevent="gotoMatch(-1)"
          />
          <div v-if="search.trim()" class="flex items-center gap-1 text-xs text-ink-gray-5">
            <span class="tabular-nums">{{ matchTotal ? activeMatch + 1 : 0 }}/{{ matchTotal }}</span>
            <Button variant="subtle" :disabled="!matchTotal" @click="gotoMatch(-1)">
              <span class="lucide-chevron-up size-4" />
            </Button>
            <Button variant="subtle" :disabled="!matchTotal" @click="gotoMatch(1)">
              <span class="lucide-chevron-down size-4" />
            </Button>
          </div>

          <div class="ml-auto flex items-center gap-2">
            <Button variant="subtle" icon-left="lucide-refresh-cw" label="Refresh" @click="refresh" />
            <Button v-if="!tailing" variant="subtle" icon-left="lucide-radio" label="Live tail" @click="startLive" />
            <Button v-else variant="subtle" theme="red" icon-left="lucide-radio" label="Stop" @click="stopLive" />
            <Button variant="subtle" tooltip="Download" @click="download">
              <span class="lucide-download size-4" />
            </Button>
          </div>
        </div>

        <!-- Terminal -->
        <div ref="viewer" class="flex-1 overflow-auto bg-surface-gray-3 font-mono text-p-xs text-ink-gray-8">
          <p v-if="!visibleLines.length" class="px-4 py-2.5 text-ink-gray-4">{{ emptyText }}</p>
          <div
            v-for="(l, i) in visibleLines"
            :key="i"
            class="whitespace-pre-wrap break-all border-b border-outline-gray-2 px-4 py-1.5 last:border-0"
            v-html="l || '&nbsp;'"
          />
          <span v-if="tailing" class="inline-block animate-pulse px-4 py-1">█</span>
        </div>

        <div
          v-if="rawLines.length"
          class="shrink-0 border-t border-outline-gray-2 px-4 py-2 text-xs text-ink-gray-4"
        >
          Showing the last {{ limit }} of {{ totalLineCount }}
          <template v-if="search.trim()"> · {{ matchTotal }} match{{ matchTotal !== 1 ? 'es' : '' }}</template>
        </div>
      </div>
    </div>
    </div>
  </ServerShell>
</template>

<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button, FormControl, toast } from 'frappe-ui'
import ServerShell from '../../components/ServerShell.vue'
import { LOG_FILES, logLines } from '../../data/system'
import { useCloudStore } from '../../stores/cloud'

const store = useCloudStore()
const route = useRoute()
const router = useRouter()

const server = computed(() => store.findServer(route.params.serverId) || store.server)
if (!server.value) router.replace('/')
const crumbs = computed(() => [{ label: 'Insights' }, { label: 'Logs' }])

// ── File list: searchable, freshest first ────────────────────────────────
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

// ── Viewer ────────────────────────────────────────────────────────────────
const openFile = ref(visibleFiles.value.find((f) => f.lines > 0)?.file || LOG_FILES[0].file)
const search = ref('')
const tailing = ref(false)
const lineCount = ref(200)
const lineOptions = [
  { label: '100 lines', value: 100 },
  { label: '200 lines', value: 200 },
  { label: '500 lines', value: 500 },
  { label: '1000 lines', value: 1000 },
]
const limit = computed(() => Number(lineCount.value))

const viewer = ref(null)
const rawLines = ref([])
const activeMatch = ref(0)
const matchTotal = ref(0)
let lastTerm = ''

const openMeta = computed(() => LOG_FILES.find((f) => f.file === openFile.value))
const totalLineCount = computed(() => openMeta.value?.lines ?? rawLines.value.length)
const emptyText = computed(() => 'Log file is empty.')

function selectFile(file) {
  if (file === openFile.value) return
  stopLive()
  openFile.value = file
  search.value = ''
  loadContent()
}

function loadContent() {
  rawLines.value = logLines(openFile.value).slice(-limit.value)
  if (!search.value.trim()) scrollToBottom()
}
loadContent()
watch(limit, loadContent)

function refresh() {
  if (tailing.value) return
  loadContent()
}

// ── Search: highlight in place + jump between matches (like the real app) ──
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const searchPattern = computed(() => {
  const term = search.value.trim()
  return term ? new RegExp(escapeRegExp(escapeHtml(term)), 'gi') : null
})

const visibleLines = computed(() => {
  const pattern = searchPattern.value
  return rawLines.value.map((line) => {
    const html = escapeHtml(line)
    if (!pattern) return html
    return html.replace(
      pattern,
      (m) => `<mark data-mi style="background:#f9e2af;color:#1e1e2e;border-radius:2px;padding:0 1px;">${m}</mark>`,
    )
  })
})

watch(visibleLines, () => nextTick(syncMatches))

function matchEls() {
  return viewer.value ? [...viewer.value.querySelectorAll('mark[data-mi]')] : []
}
function syncMatches() {
  if (!search.value.trim()) {
    matchTotal.value = 0
    activeMatch.value = -1
    return
  }
  const marks = matchEls()
  matchTotal.value = marks.length
  const term = search.value.trim()
  if (term !== lastTerm) {
    lastTerm = term
    activeMatch.value = marks.length ? 0 : -1
    paintMatches(true)
  } else {
    if (activeMatch.value >= marks.length) activeMatch.value = marks.length - 1
    paintMatches(false)
  }
}
function gotoMatch(delta) {
  const marks = matchEls()
  if (!marks.length) return
  activeMatch.value = (activeMatch.value + delta + marks.length) % marks.length
  paintMatches(true)
}
function paintMatches(scroll) {
  matchEls().forEach((el, index) => {
    const active = index === activeMatch.value
    el.style.background = active ? '#fab387' : '#f9e2af'
    el.style.boxShadow = active ? '0 0 0 2px #fab387' : 'none'
    if (active && scroll) el.scrollIntoView({ block: 'center' })
  })
}

function scrollToBottom() {
  nextTick(() => {
    if (viewer.value) viewer.value.scrollTop = viewer.value.scrollHeight
  })
}

// ── Live tail: clears the buffer, then streams synthetic lines in ─────────
let liveTimer = null
const LIVE_SAMPLES = [
  'Handling signal: term',
  'Worker exiting (pid: {pid})',
  'Shutting down: Master',
  'Starting gunicorn 23.0.0',
  'Listening at: http://127.0.0.1:8000 ({pid})',
  'Using worker: gthread',
  'Booting worker with pid: {pid}',
]
function makeLiveLine() {
  const now = new Date()
  const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${now.toTimeString().slice(0, 8)} +0000`
  const pid = 3900000 + Math.floor(Math.random() * 100000)
  const msg = LIVE_SAMPLES[Math.floor(Math.random() * LIVE_SAMPLES.length)].replace('{pid}', pid)
  return `[${ts}] [${pid}] [INFO] ${msg}`
}
function startLive() {
  tailing.value = true
  rawLines.value = []
  liveTimer = setInterval(() => {
    rawLines.value.push(makeLiveLine())
    if (rawLines.value.length > 2000) rawLines.value.shift()
    if (!search.value.trim()) scrollToBottom()
  }, 900)
}
function stopLive() {
  if (!tailing.value) return
  tailing.value = false
  clearInterval(liveTimer)
  liveTimer = null
  loadContent()
}

function download() {
  toast('In the real thing, this downloads the log file')
}

onUnmounted(() => clearInterval(liveTimer))
</script>

<template>
  <ServerShell v-if="server" :server="server" :crumbs="crumbs" roomy>
    <h1 class="text-xl font-semibold text-ink-gray-9">Logs</h1>
    <p class="mt-1 text-base text-ink-gray-5">Output from {{ server.name }}'s services. Pick a file to tail.</p>

    <div class="mt-5 flex h-[68vh] overflow-hidden rounded-xl border border-outline-gray-2 bg-surface-white">
      <!-- File list -->
      <div class="w-56 shrink-0 overflow-y-auto border-r border-outline-gray-2">
        <button
          v-for="f in LOG_FILES"
          :key="f.file"
          class="flex w-full flex-col items-start gap-0.5 border-b border-outline-gray-1 px-3 py-2.5 text-left transition-colors"
          :class="f.file === openFile ? 'bg-surface-gray-2' : 'hover:bg-surface-gray-1'"
          @click="selectFile(f.file)"
        >
          <span class="flex w-full items-center gap-1.5">
            <span class="min-w-0 flex-1 truncate text-sm text-ink-gray-8">{{ f.file }}</span>
            <span v-if="f.kind === 'error' && f.lines" class="size-1.5 shrink-0 rounded-full bg-[var(--ink-red-3)]" />
          </span>
          <span class="text-xs tabular-nums text-ink-gray-5">{{ f.size }}</span>
        </button>
      </div>

      <!-- Viewer -->
      <div class="flex min-w-0 flex-1 flex-col">
        <div class="flex flex-wrap items-center gap-2 border-b border-outline-gray-1 p-3">
          <FormControl v-model="search" class="min-w-0 flex-1 [&_input]:w-full" type="text" placeholder="Search…" autocomplete="off" />
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

        <pre class="flex-1 overflow-auto bg-surface-gray-7 p-4 font-mono text-xs leading-5 text-ink-white">{{ shownLines.join('\n') || 'Nothing matches.' }}</pre>

        <div class="flex items-center gap-2 border-t border-outline-gray-1 px-3 py-1.5 text-xs text-ink-gray-5">
          <span v-if="tailing" class="flex items-center gap-1.5 text-ink-green-3">
            <span class="size-1.5 animate-pulse rounded-full bg-[var(--ink-green-3)]" /> Live
          </span>
          <span>{{ shownLines.length }} lines</span>
        </div>
      </div>
    </div>
  </ServerShell>
</template>

<script setup>
import { computed, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button, Dropdown, FormControl, toast } from 'frappe-ui'
import ServerShell from '../../components/ServerShell.vue'
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

const shownLines = computed(() => {
  const lines = logLines(openFile.value)
  const q = search.value.trim().toLowerCase()
  return q ? lines.filter((l) => l.toLowerCase().includes(q)) : lines
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

const serviceOptions = computed(() =>
  server.value.processes.map((p) => ({
    label: `Restart ${p.name}`,
    icon: 'lucide-rotate-cw',
    onClick: () => {
      store.restartProcess(server.value.id, p.name)
      toast.success(`Restarting ${p.name} — a few seconds`)
    },
  })),
)
</script>

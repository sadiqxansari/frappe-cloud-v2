<template>
  <ServerShell v-if="server" :server="server" :crumbs="crumbs" roomy>
    <div v-if="job">
      <!-- Header -->
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-center gap-3">
          <Button variant="ghost" icon="lucide-arrow-left" @click="back" />
          <h1 class="text-xl font-semibold text-ink-gray-9">{{ job.name }}</h1>
          <Badge :theme="theme(job.status)" variant="subtle" :label="label(job.status)" size="lg" />
        </div>
        <Button variant="subtle" icon="lucide-rotate-cw" @click="refresh" />
      </div>

      <!-- Summary -->
      <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div class="text-xs text-ink-gray-5">Site</div>
          <div class="mt-1 truncate text-sm text-ink-gray-8">{{ job.site || 'Server-level' }}</div>
        </div>
        <div>
          <div class="text-xs text-ink-gray-5">Started</div>
          <div class="mt-1 text-sm text-ink-gray-8">{{ startedLabel }}</div>
        </div>
        <div>
          <div class="text-xs text-ink-gray-5">Finished</div>
          <div class="mt-1 text-sm text-ink-gray-8">{{ finishedLabel }}</div>
        </div>
        <div>
          <div class="text-xs text-ink-gray-5">Duration</div>
          <div class="mt-1 text-sm text-ink-gray-8">{{ job.duration || '—' }}</div>
        </div>
      </div>

      <!-- Steps -->
      <div class="mt-6 space-y-3">
        <div
          v-for="(step, i) in job.steps"
          :key="i"
          class="overflow-hidden rounded-lg border border-outline-gray-2 bg-surface-elevation-1"
        >
          <button
            class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-gray-1"
            :disabled="!step.log"
            @click="toggle(i)"
          >
            <span class="grid size-6 shrink-0 place-items-center rounded-full" :class="tile(step.status)">
              <span class="size-3.5" :class="[icon(step.status), step.status === 'running' ? 'animate-spin' : '']" />
            </span>
            <span class="min-w-0 flex-1 truncate text-sm text-ink-gray-8">{{ step.name }}</span>
            <span class="shrink-0 font-mono text-xs text-ink-gray-5">{{ step.duration || '—' }}</span>
            <span
              v-if="step.log"
              class="lucide-chevron-down size-4 shrink-0 text-ink-gray-4 transition-transform"
              :class="isOpen(i) ? 'rotate-180' : ''"
            />
          </button>

          <div v-if="step.log && isOpen(i)" class="border-t border-outline-alpha-gray-1 bg-surface-gray-1 px-4 py-3">
            <pre class="overflow-x-auto whitespace-pre font-mono text-xs leading-relaxed text-ink-gray-7">{{ step.log }}</pre>
          </div>
        </div>
      </div>
    </div>
  </ServerShell>
</template>

<script setup>
import { computed, reactive, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Badge, Button, toast } from 'frappe-ui'
import ServerShell from '../../components/ServerShell.vue'
import { useCloudStore } from '../../stores/cloud'
import { fmtDateTime } from '../../utils/format'

const store = useCloudStore()
const route = useRoute()
const router = useRouter()

const server = computed(() => store.findServer(route.params.serverId) || store.server)
const job = computed(() => store.findJob(route.params.taskId))

const tasksPath = computed(() => `/manage/${server.value?.id}/developer/tasks`)
watchEffect(() => {
  if (!server.value) router.replace('/')
  else if (!job.value) router.replace(tasksPath.value)
})

const crumbs = computed(() => [
  { label: 'Insights' },
  { label: 'Tasks', route: tasksPath.value },
  { label: route.params.taskId },
])

// Started/finished derived from the run's relative age + measured duration.
const startedTs = computed(() => Date.now() - (job.value?.startedMinsAgo ?? 0) * 60000)
const startedLabel = computed(() => fmtDateTime(startedTs.value))
const finishedLabel = computed(() => {
  if (!job.value) return '—'
  if (job.value.status === 'running' || !job.value.duration) return 'In progress'
  return fmtDateTime(startedTs.value + durationSecs(job.value.duration) * 1000)
})

function durationSecs(str) {
  if (!str) return 0
  let total = 0
  const m = str.match(/(\d+)\s*m/)
  if (m) total += Number(m[1]) * 60
  const s = str.match(/([\d.]+)\s*s/)
  if (s) total += parseFloat(s[1])
  return total
}

// Expanded step logs — the failed or running step opens by default.
const open = reactive({})
function isOpen(i) {
  const step = job.value?.steps[i]
  return open[i] ?? (step?.status === 'failed' || step?.status === 'running')
}
function toggle(i) {
  if (!job.value?.steps[i]?.log) return
  open[i] = !isOpen(i)
}

function back() {
  router.push(tasksPath.value)
}
function refresh() {
  toast.success('Refreshed')
}

function icon(status) {
  return (
    {
      success: 'lucide-check',
      running: 'lucide-loader-circle',
      failed: 'lucide-x',
      pending: 'lucide-circle',
    }[status] || 'lucide-circle'
  )
}
function theme(status) {
  return { success: 'green', running: 'orange', failed: 'red', pending: 'gray' }[status] || 'gray'
}
function label(status) {
  return { success: 'Success', running: 'Running', failed: 'Failed', pending: 'Pending' }[status] || status
}
function tile(status) {
  return (
    {
      success: 'bg-surface-green-2 text-ink-green-6',
      running: 'bg-surface-amber-2 text-ink-amber-8',
      failed: 'bg-surface-red-2 text-ink-red-8',
      pending: 'bg-surface-gray-2 text-ink-gray-5',
    }[status] || 'bg-surface-gray-2 text-ink-gray-5'
  )
}
</script>

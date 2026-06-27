<template>
  <ServerShell v-if="server" :server="server" :crumbs="crumbs" roomy>
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold text-ink-gray-9">Tasks</h1>
        <p class="mt-1 text-p-base text-ink-gray-5">Background jobs {{ server.name }} has run — backups, deploys, migrations and more.</p>
      </div>
      <Button variant="subtle" size="sm" label="Refresh" icon-left="lucide-rotate-cw" @click="refresh" />
    </div>

    <!-- Status filter -->
    <div class="mt-5 flex flex-wrap items-center gap-2">
      <Button
        v-for="f in filters"
        :key="f.value"
        :variant="filter === f.value ? 'solid' : 'subtle'"
        size="sm"
        :label="f.label"
        @click="filter = f.value"
      />
    </div>

    <div v-if="shownJobs.length" class="mt-4 divide-y divide-outline-alpha-gray-1 overflow-hidden rounded-xl border border-outline-gray-2 bg-surface-elevation-1">
      <div v-for="job in shownJobs" :key="job.id">
        <button class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-gray-1" @click="toggle(job.id)">
          <span class="grid size-7 shrink-0 place-items-center rounded-full" :class="tile(job.status)">
            <span class="size-4" :class="[icon(job.status), job.status === 'running' ? 'animate-spin' : '']" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="flex items-center gap-2">
              <span class="truncate text-sm font-medium text-ink-gray-9">{{ job.name }}</span>
              <Badge :theme="theme(job.status)" variant="subtle" :label="label(job.status)" />
            </span>
            <span class="mt-0.5 block truncate text-xs text-ink-gray-5">
              {{ job.site || 'Server-level' }} · {{ relTime(job.startedMinsAgo) }}<span v-if="job.duration"> · took {{ job.duration }}</span>
            </span>
          </span>
          <span class="font-mono text-xs text-ink-gray-4">{{ job.id }}</span>
          <span class="lucide-chevron-down size-4 shrink-0 text-ink-gray-4 transition-transform" :class="isOpen(job) ? 'rotate-180' : ''" />
        </button>

        <!-- Steps -->
        <div v-if="isOpen(job)" class="border-t border-outline-alpha-gray-1 bg-surface-gray-1 px-4 py-2">
          <div v-for="(step, i) in job.steps" :key="i" class="flex items-center gap-2.5 py-1.5">
            <span class="size-3.5 shrink-0" :class="[icon(step.status), stepColor(step.status), step.status === 'running' ? 'animate-spin' : '']" />
            <span class="min-w-0 flex-1 truncate text-sm text-ink-gray-7">{{ step.name }}</span>
            <span class="shrink-0 font-mono text-xs text-ink-gray-5">{{ step.duration || '—' }}</span>
          </div>
        </div>
      </div>
    </div>

    <EmptyState
      v-else
      class="mt-4"
      icon="lucide-list-checks"
      title="No tasks to show"
      :description="filter === 'all' ? 'Background jobs will appear here as they run.' : 'No jobs match this filter.'"
    />
  </ServerShell>
</template>

<script setup>
import { computed, reactive, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Badge, Button, toast } from 'frappe-ui'
import EmptyState from '../../components/EmptyState.vue'
import ServerShell from '../../components/ServerShell.vue'
import { useCloudStore } from '../../stores/cloud'

const store = useCloudStore()
const route = useRoute()
const router = useRouter()

const server = computed(() => store.findServer(route.params.serverId) || store.server)
watchEffect(() => {
  if (!server.value) router.replace('/')
})
const crumbs = computed(() => [{ label: 'Dev tools', route: `/manage/${server.value.id}/developer/logs` }, { label: 'Tasks' }])

const filters = [
  { label: 'All', value: 'all' },
  { label: 'Running', value: 'running' },
  { label: 'Failed', value: 'failed' },
  { label: 'Succeeded', value: 'success' },
]
const filter = ref('all')
const shownJobs = computed(() =>
  filter.value === 'all' ? store.jobs : store.jobs.filter((j) => j.status === filter.value),
)

// Expanded rows — failed/running jobs start open (including freshly logged ones)
// so the interesting detail is visible without a click.
const open = reactive({})
function isOpen(job) {
  return open[job.id] ?? (job.status === 'failed' || job.status === 'running')
}
function toggle(id) {
  const job = store.jobs.find((j) => j.id === id)
  open[id] = !isOpen(job)
}

function relTime(mins) {
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const h = Math.floor(mins / 60)
  if (h < 24) return `${h} hr ago`
  return `${Math.floor(h / 24)} d ago`
}

// Status → visuals. Shared by job rows and their steps.
function icon(status) {
  return {
    success: 'lucide-check',
    running: 'lucide-loader-circle',
    failed: 'lucide-x',
    pending: 'lucide-circle',
  }[status] || 'lucide-circle'
}
function theme(status) {
  return { success: 'green', running: 'orange', failed: 'red', pending: 'gray' }[status] || 'gray'
}
function label(status) {
  return { success: 'Success', running: 'Running', failed: 'Failed', pending: 'Pending' }[status] || status
}
function tile(status) {
  return {
    success: 'bg-surface-green-2 text-ink-green-6',
    running: 'bg-surface-amber-2 text-ink-amber-8',
    failed: 'bg-surface-red-2 text-ink-red-8',
    pending: 'bg-surface-gray-2 text-ink-gray-5',
  }[status] || 'bg-surface-gray-2 text-ink-gray-5'
}
function stepColor(status) {
  return {
    success: 'text-ink-green-6',
    running: 'text-ink-amber-8',
    failed: 'text-ink-red-8',
    pending: 'text-ink-gray-4',
  }[status] || 'text-ink-gray-4'
}

function refresh() {
  toast.success('Refreshed')
}
</script>

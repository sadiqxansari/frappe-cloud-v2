<template>
  <ServerShell v-if="server" :server="server" :crumbs="crumbs" roomy>
    <div>
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold text-ink-gray-9">Tasks</h1>
          <p class="mt-1 text-p-base text-ink-gray-5">Background jobs — backups, deploys, migrations and more.</p>
        </div>
        <Button variant="subtle" size="sm" label="Refresh" icon-left="lucide-rotate-cw" @click="refresh" />
      </div>

      <!-- Status filter -->
      <TabButtons v-model="filter" class="mt-5" :options="filters" />

      <div v-if="shownJobs.length" class="mt-4 divide-y divide-outline-alpha-gray-1">
        <button
          v-for="job in shownJobs"
          :key="job.id"
          class="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-surface-gray-2"
          @click="openJob(job)"
        >
          <span class="grid size-8 shrink-0 place-items-center rounded-full" :class="tile(job.status)">
            <span class="size-4" :class="[icon(job.status), job.status === 'running' ? 'animate-spin' : '']" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium text-ink-gray-9">{{ job.name }}</span>
            <span class="mt-0.5 block truncate text-p-sm text-ink-gray-5">
              {{ job.site || 'Server-level' }} · {{ relTime(job.startedMinsAgo) }}<span v-if="job.duration"> · took {{ job.duration }}</span>
            </span>
          </span>
          <span class="lucide-chevron-right size-4 shrink-0 text-ink-gray-4" />
        </button>
      </div>

      <EmptyState
        v-else
        class="mt-4"
        icon="lucide-list-checks"
        title="No tasks to show"
        :description="filter === 'all' ? 'Background jobs will appear here as they run.' : 'No jobs match this filter.'"
      />
    </div>
  </ServerShell>
</template>

<script setup>
import { computed, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button, TabButtons, toast } from 'frappe-ui'
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
const crumbs = computed(() => [{ label: 'Insights' }, { label: 'Tasks' }])

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

function openJob(job) {
  router.push(`/manage/${server.value.id}/developer/tasks/${job.id}`)
}

function relTime(mins) {
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const h = Math.floor(mins / 60)
  if (h < 24) return `${h} hr ago`
  return `${Math.floor(h / 24)} d ago`
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

function refresh() {
  toast.success('Refreshed')
}
</script>

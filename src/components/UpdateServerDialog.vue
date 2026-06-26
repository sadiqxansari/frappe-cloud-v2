<template>
  <!-- Choose which app updates to run across the server's sites — now or on a
       schedule, with an option to skip failing patches (issue #42). -->
  <Dialog v-model:open="open" size="lg">
    <template #title><span class="text-xl font-semibold text-ink-gray-9">Updates</span></template>

    <!-- Already scheduled — surface it, with a way to cancel. -->
    <div v-if="scheduled" class="mb-4 flex items-start justify-between gap-3 rounded-lg border border-outline-gray-2 bg-surface-gray-1 p-3">
      <div class="min-w-0">
        <div class="text-p-sm font-medium text-ink-gray-8">Scheduled for {{ fmt(scheduled.at) }}</div>
        <p class="mt-0.5 text-p-xs text-ink-gray-5">App updates{{ scheduled.skipFailing ? ' · skips failing patches' : '' }}.</p>
      </div>
      <Button variant="ghost" size="sm" label="Cancel" @click="cancelSchedule" />
    </div>

    <template v-if="appUpdates.length">
      <div class="flex items-center justify-between gap-3">
        <p class="text-p-sm text-ink-gray-5">We back up first — sites blip briefly.</p>
        <button class="shrink-0 text-p-sm font-medium text-ink-gray-6 hover:text-ink-gray-8" @click="allSelected ? clear() : selectAll()">
          {{ allSelected ? 'Clear' : 'Select all' }}
        </button>
      </div>

      <div class="mt-3 max-h-60 space-y-2 overflow-y-auto">
        <button
          v-for="u in appUpdates"
          :key="u.key"
          class="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors"
          :class="selected.has(u.key) ? 'border-outline-gray-3 bg-surface-gray-1' : 'border-outline-gray-2 hover:bg-surface-gray-1'"
          @click="toggle(u.key)"
        >
          <AppIcon :app-key="u.appKey" size="md" />
          <div class="min-w-0 flex-1">
            <div class="text-p-sm font-medium text-ink-gray-9">{{ u.name }}<span v-if="multiSite" class="font-normal text-ink-gray-5"> · {{ u.site }}</span></div>
            <div class="text-p-xs text-ink-gray-5"><span class="font-mono">{{ u.from }}</span> <span class="lucide-arrow-right inline-block size-3 align-middle" /> <span class="font-mono text-ink-green-6">{{ u.to }}</span></div>
          </div>
          <Checkbox :model-value="selected.has(u.key)" tabindex="-1" class="pointer-events-none shrink-0" />
        </button>
      </div>

      <div class="mt-4 flex flex-col items-start gap-2.5">
        <Checkbox v-model="later" label="Schedule for later" />
        <input
          v-if="later"
          v-model="scheduleAt"
          type="datetime-local"
          :min="nowLocal"
          class="ml-6 rounded-md border border-outline-gray-2 bg-surface-elevation-1 px-2.5 py-1.5 text-p-sm text-ink-gray-8 focus:outline-none focus:ring-2 focus:ring-outline-gray-3"
        />
        <Checkbox v-model="skipFailing" label="Skip failing patches if any" />
      </div>
    </template>

    <p v-else-if="!scheduled" class="flex items-center gap-2 py-2 text-p-sm text-ink-gray-5">
      <span class="lucide-check size-4 text-ink-green-6" /> Everything's up to date.
    </p>

    <template #actions>
      <div class="flex justify-end gap-2">
        <Button label="Cancel" @click="open = false" />
        <Button
          v-if="appUpdates.length"
          variant="solid"
          :label="actionLabel"
          :disabled="!selected.size || (later && !scheduleAt)"
          @click="apply"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { Button, Checkbox, Dialog, toast } from 'frappe-ui'
import AppIcon from './AppIcon.vue'
import { useCloudStore } from '../stores/cloud'

const props = defineProps({
  server: { type: Object, default: null },
})
const open = defineModel('open', { type: Boolean, default: false })

const store = useCloudStore()

const multiSite = computed(() => (props.server?.sites.length || 0) > 1)
const appUpdates = computed(() => {
  const out = []
  for (const s of props.server?.sites || []) {
    for (const app of s.apps) {
      const to = store.appUpdate(app)
      if (to) out.push({ key: `${s.id}:${app.key}`, siteId: s.id, appKey: app.key, name: app.name, site: s.subdomain, from: app.version, to })
    }
  }
  return out
})
const scheduled = computed(() => props.server?.scheduledUpdate || null)

const selected = reactive(new Set())
const later = ref(false)
const scheduleAt = ref('')
const skipFailing = ref(false)

const allSelected = computed(() => appUpdates.value.length > 0 && selected.size === appUpdates.value.length)
const actionLabel = computed(() => (later.value ? 'Schedule update' : allSelected.value ? 'Update all' : `Update ${selected.size}`))

// datetime-local wants a 'YYYY-MM-DDTHH:mm' min — the local clock, a few minutes out.
const nowLocal = computed(() => {
  const d = new Date(Date.now() + 5 * 60 * 1000)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
})

function selectAll() {
  appUpdates.value.forEach((u) => selected.add(u.key))
}
function clear() {
  selected.clear()
}
function toggle(key) {
  if (selected.has(key)) selected.delete(key)
  else selected.add(key)
}

watch(open, (isOpen) => {
  if (!isOpen) return
  later.value = false
  scheduleAt.value = scheduled.value?.at || ''
  skipFailing.value = scheduled.value?.skipFailing || false
  selected.clear()
  selectAll() // default: everything selected
})

function fmt(at) {
  try {
    return new Date(at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return at
  }
}

function refs() {
  return appUpdates.value.filter((u) => selected.has(u.key)).map((u) => ({ siteId: u.siteId, appKey: u.appKey }))
}

function apply() {
  if (!props.server || !selected.size) return
  if (later.value) {
    if (!scheduleAt.value) return
    store.scheduleServerUpdate(props.server.id, { at: scheduleAt.value, skipFailing: skipFailing.value })
    toast.success(`Updates scheduled for ${fmt(scheduleAt.value)}`)
    open.value = false
    return
  }
  const p = store.updateApps(props.server.id, refs(), { skipFailing: skipFailing.value })
  open.value = false
  if (p)
    toast.promise(p, {
      loading: `Updating ${props.server.name}…`,
      success: 'Apps updated',
      error: 'Update failed',
    })
}

function cancelSchedule() {
  store.cancelScheduledUpdate(props.server.id)
  toast.success('Scheduled update cancelled')
}
</script>

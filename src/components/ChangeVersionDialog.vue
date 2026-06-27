<template>
  <Dialog v-model:open="open" size="lg">
    <template #title><span class="text-xl font-semibold text-ink-gray-9">Change Frappe version</span></template>

    <p class="text-p-sm text-ink-gray-5">
      {{ server?.name }} runs {{ currentLabel }}. Pick a version to move it — and all its sites — to. You can go up or down.
    </p>

    <div class="mt-3 space-y-2.5">
      <button
        v-for="v in VERSIONS"
        :key="v.id"
        class="w-full rounded-lg border p-3.5 text-left transition-colors"
        :class="v.id === selectedId ? 'border-outline-gray-4 ring-1 ring-outline-gray-4' : 'border-outline-gray-2 hover:bg-surface-gray-1'"
        @click="selectedId = v.id"
      >
        <div class="flex items-center gap-2">
          <span class="font-medium text-ink-gray-9">{{ v.label }}</span>
          <Badge v-if="v.id === server?.version" theme="gray" variant="outline" label="Current" />
          <Badge v-else-if="directionFor(v.id) === 'down'" theme="orange" variant="subtle" label="Downgrade" />
        </div>
        <p class="mt-0.5 text-p-sm text-ink-gray-5">{{ v.note }}</p>
      </button>
    </div>

    <!-- Impact preview -->
    <div v-if="willChange" class="mt-4 space-y-3">
      <Alert v-if="incompatible.length" theme="yellow" :dismissible="false" title="Some apps may not be ready">
        <template #description>
          {{ incompatibleNames }} {{ incompatible.length === 1 ? "doesn't list" : "don't list" }}
          {{ selected.label }} as supported yet. You can still continue — just test before relying on it.
        </template>
      </Alert>
      <div class="rounded-lg border border-outline-gray-2 bg-surface-gray-1 p-3 text-sm text-ink-gray-6">
        <div class="font-medium text-ink-gray-8">
          {{ siteCount }} site{{ siteCount === 1 ? '' : 's' }} will be migrated
        </div>
        <p class="mt-0.5">A backup is taken first. Each is briefly unavailable while it migrates — addresses don't change.</p>
      </div>
    </div>

    <template #actions>
      <div class="flex justify-end gap-2">
        <Button label="Cancel" @click="open = false" />
        <Button
          variant="solid"
          :label="willChange ? `Change to ${selected.label}` : 'Change version'"
          :disabled="!willChange"
          @click="change"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Badge, Button, Dialog, toast } from 'frappe-ui'
import Alert from './Alert.vue'
import { VERSIONS, appByKey, versionById } from '../data/catalog'
import { useCloudStore } from '../stores/cloud'

const props = defineProps({
  server: { type: Object, default: null },
})
const open = defineModel('open', { type: Boolean, default: false })

const store = useCloudStore()
const selectedId = ref(null)

watch(open, (isOpen) => {
  if (isOpen) selectedId.value = props.server?.version
})

const currentLabel = computed(() => versionById(props.server?.version).label)
const selected = computed(() => VERSIONS.find((v) => v.id === selectedId.value) || null)
const willChange = computed(() => !!selected.value && selectedId.value !== props.server?.version)
const siteCount = computed(() => props.server?.sites.length || 0)

// Rank versions so we can label a target as an upgrade or a downgrade.
function rank(id) {
  if (id === 'nightly') return Infinity
  const n = parseInt(String(id).replace(/\D/g, ''), 10)
  return Number.isNaN(n) ? 0 : n
}
function directionFor(id) {
  return rank(id) < rank(props.server?.version) ? 'down' : 'up'
}

// Apps on this server whose compat list doesn't include the target version.
const incompatible = computed(() => {
  if (!willChange.value || !props.server) return []
  const target = selectedId.value
  const seen = {}
  for (const site of props.server.sites) {
    for (const app of site.apps) {
      const meta = appByKey(app.key)
      if (meta?.compat && !meta.compat.includes(target) && !seen[app.key]) {
        seen[app.key] = { key: app.key, name: app.name }
      }
    }
  }
  return Object.values(seen)
})
const incompatibleNames = computed(() => incompatible.value.map((a) => a.name).join(', '))

function change() {
  const to = selected.value.label
  const p = store.changeServerVersion(props.server.id, selectedId.value)
  open.value = false
  if (p) toast.success(`Changing ${props.server.name} to ${to} — sites migrate in a moment`)
}
</script>

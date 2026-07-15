<template>
  <Dialog v-model:open="open" title="New site" size="lg">
    <div class="space-y-5">
      <div>
        <FormControl v-model="label" type="text" label="Site name" placeholder="e.g. My Shop" />
        <p class="mt-1.5 text-p-sm text-ink-gray-5">
          Web address: <span class="font-medium text-ink-gray-7">{{ subdomain }}</span>
        </p>
      </div>

      <div>
        <div class="flex items-center justify-between gap-2">
          <span class="text-sm font-medium text-ink-gray-8">Choose apps</span>
          <span class="text-xs text-ink-gray-5">{{ selected.length }} selected</span>
        </div>

        <!-- p-1 keeps the selected card's ring from being clipped by the scroll container -->
        <div class="mt-2 grid max-h-72 gap-2 overflow-y-auto p-1 sm:grid-cols-2">
          <button
            v-for="app in APP_CATALOG"
            :key="app.key"
            type="button"
            :disabled="!isCompatible(app)"
            class="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors"
            :class="cardClass(app)"
            :title="isCompatible(app) ? undefined : `Needs ${neededLabel(app)}`"
            @click="toggle(app.key)"
          >
            <AppIcon :app-key="app.key" size="md" />
            <span class="min-w-0 flex-1 truncate text-sm font-medium text-ink-gray-9">{{ app.name }}</span>
            <Checkbox :model-value="selected.includes(app.key)" tabindex="-1" class="pointer-events-none shrink-0" />
          </button>
        </div>
      </div>

      <p class="flex items-start gap-1.5 text-p-sm text-ink-gray-5">
        <span class="lucide-info mt-0.5 size-3.5 shrink-0" />
        Runs on {{ server?.name || 'your server' }}<template v-if="planName"> ({{ planName }})</template> — no extra cost; sites share its compute and storage.
      </p>
    </div>

    <template #actions>
      <div class="flex justify-end gap-2">
        <Button label="Cancel" @click="open = false" />
        <Button variant="solid" label="Create site" :disabled="!label.trim() || !selected.length" @click="create" />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Button, Checkbox, Dialog, FormControl, toast } from 'frappe-ui'
import AppIcon from './AppIcon.vue'
import { APP_CATALOG, versionById } from '../data/catalog'
import { useCloudStore } from '../stores/cloud'
import { slugify } from '../utils/format'

const props = defineProps({
  server: { type: Object, default: null },
})

const open = defineModel('open', { type: Boolean, default: false })

const store = useCloudStore()
const router = useRouter()
const label = ref('')
const selected = ref(['erpnext'])

const subdomain = computed(() => `${slugify(label.value) || 'yoursite'}.frappe.cloud`)
const planName = computed(() => (props.server ? store.planOf(props.server)?.name : null))

// A site inherits its server's Frappe version, so only apps that support that
// version can be picked here — same gate as the Marketplace.
function isCompatible(app) {
  return !props.server?.version || app.compat.includes(props.server.version)
}
function neededLabel(app) {
  return versionById(app.compat[0]).label
}

function cardClass(app) {
  if (!isCompatible(app)) return 'cursor-not-allowed border-outline-gray-2 opacity-50'
  if (selected.value.includes(app.key)) return 'border-outline-gray-4 bg-surface-gray-1 ring-1 ring-outline-gray-4'
  return 'border-outline-gray-2 hover:bg-surface-gray-1'
}

function toggle(key) {
  const i = selected.value.indexOf(key)
  if (i === -1) selected.value.push(key)
  else selected.value.splice(i, 1)
}

watch(open, (isOpen) => {
  if (isOpen) {
    label.value = ''
    // Default to a compatible starter app.
    selected.value = isCompatible({ key: 'erpnext', compat: ['v15', 'v16'] }) ? ['erpnext'] : []
  }
})

function create() {
  const site = store.createSite(props.server.id, label.value.trim(), selected.value)
  open.value = false
  toast.success(`Setting up ${site.name}…`)
  // Land on the site so they can watch the deploy progress if they want. (#35)
  router.push(`/manage/${props.server.id}/sites/${site.id}`)
}
</script>

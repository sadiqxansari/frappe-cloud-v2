<template>
  <Dialog v-model:open="open" size="md">
    <template #title>
      <span class="text-xl font-semibold text-ink-gray-9">New site</span>
    </template>

    <div class="space-y-4">
      <div>
        <FormControl v-model="label" type="text" label="Site name" placeholder="e.g. My Shop" />
        <p class="mt-1.5 text-sm text-ink-gray-5">
          Web address: <span class="font-medium text-ink-gray-7">{{ subdomain }}</span>
        </p>
      </div>
      <FormControl v-model="appKey" type="select" label="What will it run?" :options="appOptions" />
      <p class="flex items-center gap-1.5 text-sm text-ink-gray-5">
        <span class="lucide-info size-3.5 shrink-0" />
        It runs on {{ server?.name || 'your server' }} — sites don't cost extra.
      </p>
    </div>

    <template #actions>
      <div class="flex justify-end gap-2">
        <Button label="Cancel" @click="open = false" />
        <Button variant="solid" label="Create site" :disabled="!label.trim()" @click="create" />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Button, Dialog, FormControl, toast } from 'frappe-ui'
import { APP_CATALOG } from '../data/catalog'
import { useCloudStore } from '../stores/cloud'
import { slugify } from '../utils/format'

const props = defineProps({
  server: { type: Object, default: null },
})

const open = defineModel('open', { type: Boolean, default: false })

const store = useCloudStore()
const label = ref('')
const appKey = ref('erpnext')

const subdomain = computed(() => `${slugify(label.value) || 'yoursite'}.frappe.cloud`)

watch(open, (isOpen) => {
  if (isOpen) {
    label.value = ''
    appKey.value = 'erpnext'
  }
})

const appOptions = APP_CATALOG.map((a) => ({ label: a.name, value: a.key }))

function create() {
  store.createSite(props.server.id, label.value.trim(), appKey.value)
  open.value = false
  toast.success(`Setting up ${label.value.trim()} — it'll be live in a moment`)
}
</script>

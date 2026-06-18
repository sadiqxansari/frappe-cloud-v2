<template>
  <Dialog v-model:open="open" size="sm">
    <template #title>
      <span class="text-base font-semibold text-ink-gray-9">Migration scheduled</span>
    </template>

    <div v-if="server?.migration">
      <p class="text-sm text-ink-gray-6">
        {{ server.name }} is scheduled to migrate on
        <span class="font-medium text-ink-gray-9">{{ formattedDate }}</span>.
      </p>

      <!-- From → To -->
      <div class="mt-4 flex items-center gap-3 rounded-xl border border-outline-gray-2 p-3">
        <div class="min-w-0 flex-1">
          <div class="text-xs text-ink-gray-5">From</div>
          <div class="truncate text-sm font-medium text-ink-gray-9">{{ fromRegion?.name }}</div>
          <div class="text-xs text-ink-gray-5">{{ fromProvider?.short }}</div>
        </div>
        <span class="lucide-arrow-right size-4 shrink-0 text-ink-gray-4" />
        <div class="min-w-0 flex-1">
          <div class="text-xs text-ink-gray-5">To</div>
          <div class="truncate text-sm font-medium text-ink-gray-9">{{ toRegion?.name }}</div>
          <div class="text-xs text-ink-gray-5">{{ toProvider?.short }}</div>
        </div>
      </div>

      <p class="mt-3 text-xs text-ink-gray-4">
        You can cancel the scheduled migration at any time before it starts.
      </p>
    </div>

    <template #actions>
      <div class="flex justify-end gap-2">
        <Button label="Cancel migration" theme="red" variant="subtle" @click="cancelMigration" />
        <Button label="Close" variant="solid" @click="open = false" />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { computed } from 'vue'
import { Button, Dialog, toast } from 'frappe-ui'
import { providerById, regionById } from '../data/catalog'
import { useCloudStore } from '../stores/cloud'

const props = defineProps({
  server: { type: Object, default: null },
})

const open = defineModel('open', { type: Boolean, default: false })

const store = useCloudStore()

const fromRegion = computed(() => props.server?.migration ? regionById(props.server.migration.fromRegionId) : null)
const toRegion = computed(() => props.server?.migration ? regionById(props.server.migration.toRegionId) : null)
const fromProvider = computed(() => fromRegion.value ? providerById(fromRegion.value.providerId) : null)
const toProvider = computed(() => toRegion.value ? providerById(toRegion.value.providerId) : null)

const formattedDate = computed(() => {
  const s = props.server?.migration?.scheduledAt
  if (!s) return '—'
  return new Date(s).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
})

function cancelMigration() {
  if (!props.server) return
  store.cancelMigration(props.server.id)
  open.value = false
  toast.success('Scheduled migration cancelled')
}
</script>

<template>
  <Dialog v-model:open="open" size="lg">
    <template #title><span class="text-xl font-semibold text-ink-gray-9">Update Frappe</span></template>

    <p class="text-p-sm text-ink-gray-5">
      A newer patch is available for {{ server?.name }} on its current version. This stays on {{ versionLabel }} — it just applies the latest fixes.
    </p>

    <!-- Current → target build -->
    <div class="mt-4 flex items-center gap-3 rounded-lg border border-outline-gray-2 bg-surface-gray-1 p-3.5">
      <div class="min-w-0 flex-1">
        <div class="text-xs text-ink-gray-5">Installed</div>
        <div class="truncate font-medium tabular-nums text-ink-gray-8">{{ currentBuild }}</div>
      </div>
      <span class="lucide-arrow-right size-4 shrink-0 text-ink-gray-4" />
      <div class="min-w-0 flex-1 text-right">
        <div class="text-xs text-ink-gray-5">Latest</div>
        <div class="truncate font-medium tabular-nums text-ink-green-6">{{ latestBuild }}</div>
      </div>
    </div>

    <div class="mt-3 rounded-lg border border-outline-gray-2 bg-surface-gray-1 p-3 text-sm text-ink-gray-6">
      <div class="font-medium text-ink-gray-8">
        {{ siteCount }} site{{ siteCount === 1 ? '' : 's' }} on this server
      </div>
      <p class="mt-0.5">A backup is taken first. Each is briefly unavailable while it updates — addresses don't change.</p>
    </div>

    <template #actions>
      <div class="flex justify-end gap-2">
        <Button label="Cancel" @click="open = false" />
        <Button variant="solid" :label="`Update to ${latestBuild}`" :disabled="!hasUpdate" @click="apply" />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { computed } from 'vue'
import { Button, Dialog, toast } from 'frappe-ui'
import { latestBuildFor, versionById } from '../data/catalog'
import { useCloudStore } from '../stores/cloud'

const props = defineProps({
  server: { type: Object, default: null },
})
const open = defineModel('open', { type: Boolean, default: false })

const store = useCloudStore()

const versionLabel = computed(() => versionById(props.server?.version)?.label || '—')
const currentBuild = computed(() => props.server?.build || '—')
const latestBuild = computed(() => latestBuildFor(props.server?.version))
const siteCount = computed(() => props.server?.sites.length || 0)
const hasUpdate = computed(() => !!props.server && currentBuild.value !== latestBuild.value)

function apply() {
  const p = store.updateServer(props.server.id)
  open.value = false
  if (p) toast.promise(p, {
    loading: `Updating ${props.server.name}…`,
    success: `${props.server.name} updated to ${latestBuild.value}`,
    error: 'Update failed',
  })
}
</script>

<template>
  <button
    class="flex w-full items-center gap-3 rounded-lg border border-outline-gray-2 bg-surface-elevation-1 p-4 text-left transition-colors hover:bg-surface-gray-1"
    @click="$emit('open', site)"
  >
    <SiteIcon size="md" />
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <span class="truncate font-semibold text-ink-gray-9">{{ site.name }}</span>
        <Badge v-if="site.status === 'creating'" theme="orange" variant="subtle" label="Setting up…" />
        <Badge v-else-if="site.status === 'restoring'" theme="blue" variant="subtle" label="Restoring…" />
        <Badge v-else-if="site.status === 'moving'" theme="blue" variant="subtle" label="Moving…" />
        <Badge v-else-if="site.status === 'suspended'" theme="red" variant="subtle" label="Paused" />
      </div>
      <div class="truncate text-sm text-ink-gray-5">
        {{ site.apps.length }} {{ site.apps.length === 1 ? 'app' : 'apps' }}
        <template v-if="lastBackup"> · backed up {{ timeAgo(lastBackup.at) }}</template>
      </div>
    </div>
    <span class="lucide-chevron-right size-4 shrink-0 text-ink-gray-4" />
  </button>
</template>

<script setup>
import { computed } from 'vue'
import { Badge } from 'frappe-ui'
import SiteIcon from './SiteIcon.vue'
import { useCloudStore } from '../stores/cloud'
import { timeAgo } from '../utils/format'

const props = defineProps({
  site: { type: Object, required: true },
})

defineEmits(['open'])

const store = useCloudStore()
const lastBackup = computed(() => store.lastBackupOf(props.site))
</script>

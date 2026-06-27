<template>
  <div v-if="shown.length" class="divide-y divide-outline-alpha-gray-1">
    <div v-for="e in shown" :key="e.id" class="py-1">
      <component
        :is="e.detail ? 'button' : 'div'"
        class="flex w-full items-center gap-3 py-2 text-left"
        @click="e.detail && toggle(e.id)"
      >
        <span class="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-gray-2">
          <span class="size-3.5 text-ink-gray-6" :class="icons[e.tag] || 'lucide-circle-dot'" />
        </span>
        <span class="min-w-0 flex-1 text-sm" :class="e.status === 'failed' ? 'text-ink-red-8' : 'text-ink-gray-8'">
          {{ e.title }}
        </span>
        <Badge v-if="e.status === 'running'" theme="orange" variant="subtle" label="In progress" />
        <Badge v-else-if="e.status === 'failed'" theme="red" variant="subtle" label="Failed" />
        <span class="shrink-0 text-sm tabular-nums text-ink-gray-5">{{ timeAgo(e.at) }}</span>
        <span
          v-if="e.detail"
          class="lucide-chevron-down size-3.5 shrink-0 text-ink-gray-4 transition-transform"
          :class="openId === e.id && 'rotate-180'"
        />
      </component>
      <p v-if="e.detail && openId === e.id" class="mb-2 ml-10 rounded-lg bg-surface-gray-1 px-3 py-2 text-p-sm text-ink-gray-6">
        {{ e.detail }}
      </p>
    </div>
  </div>
  <p v-else class="py-2 text-p-sm text-ink-gray-5">Nothing yet — things you do here will show up as plain history.</p>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Badge } from 'frappe-ui'
import { timeAgo } from '../utils/format'

const props = defineProps({
  items: { type: Array, required: true },
  limit: { type: Number, default: 0 },
})

const icons = {
  backup: 'lucide-archive',
  site: 'lucide-globe',
  app: 'lucide-package',
  server: 'lucide-server',
  domain: 'lucide-link',
  config: 'lucide-settings-2',
  billing: 'lucide-credit-card',
  process: 'lucide-terminal',
}

const openId = ref(null)
const shown = computed(() => (props.limit ? props.items.slice(0, props.limit) : props.items))

function toggle(id) {
  openId.value = openId.value === id ? null : id
}
</script>

<template>
  <Dialog v-model:open="open" size="sm">
    <template #title>
      <span class="text-xl font-semibold text-ink-gray-9">Plan history</span>
    </template>

    <div v-if="server.planHistory.length" class="max-h-96 space-y-3 overflow-y-auto">
      <div v-for="h in server.planHistory" :key="h.id" class="flex items-start gap-3">
        <span
          class="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full"
          :class="h.direction === 'upgrade' ? 'bg-surface-green-2 text-ink-green-3' : 'bg-surface-amber-2 text-ink-amber-3'"
        >
          <span class="size-3.5" :class="h.direction === 'upgrade' ? 'lucide-arrow-up' : 'lucide-arrow-down'" />
        </span>
        <div class="min-w-0 flex-1">
          <div class="text-sm text-ink-gray-8">{{ h.from }} → {{ h.to }}</div>
          <div class="text-xs text-ink-gray-5"><span class="capitalize">{{ h.direction }}</span> · {{ h.date }}</div>
        </div>
      </div>
    </div>
    <p v-else class="text-sm text-ink-gray-5">No plan changes yet.</p>
  </Dialog>
</template>

<script setup>
import { Dialog } from 'frappe-ui'

defineProps({
  server: { type: Object, required: true },
})

const open = defineModel('open', { type: Boolean, default: false })
</script>

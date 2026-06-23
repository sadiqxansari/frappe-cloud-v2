<template>
  <div
    class="rounded-xl border px-6 py-10 text-center"
    :class="tone === 'red' ? 'border-outline-red-1 bg-surface-red-1' : 'border-outline-gray-2 bg-surface-gray-1'"
  >
    <span
      class="mx-auto mb-3 grid size-9 place-items-center rounded-full"
      :class="tone === 'red' ? 'bg-surface-red-2 text-ink-red-8' : 'bg-surface-gray-3 text-ink-gray-6'"
    >
      <span :class="icon" class="size-4.5" />
    </span>
    <p class="text-p-base font-medium" :class="tone === 'red' ? 'text-ink-red-8' : 'text-ink-gray-8'">{{ title }}</p>
    <p v-if="description" class="mx-auto mt-1 max-w-sm text-p-sm text-ink-gray-6">{{ description }}</p>
    <div v-if="$slots.default" class="mt-4 flex justify-center gap-2">
      <slot />
    </div>
  </div>
</template>

<script setup>
// Shown when something has gone wrong: failed load, failed action, broken
// resource. The slot carries the recovery action (usually a Retry button).
defineProps({
  icon: { type: String, default: 'lucide-triangle-alert' },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  tone: { type: String, default: 'gray' }, // 'gray' | 'red'
})
</script>

<template>
  <div class="rounded-xl border border-dashed border-outline-gray-2 px-6 py-10 text-center">
    <span v-if="icon" class="mx-auto mb-3 grid size-9 place-items-center rounded-full bg-surface-gray-2 text-ink-gray-5">
      <span :class="icon" class="size-4.5" />
    </span>
    <p class="text-p-base font-medium text-ink-gray-7">{{ title }}</p>
    <p v-if="description" class="mx-auto mt-1 max-w-sm text-p-sm text-ink-gray-5">{{ description }}</p>
    <div v-if="$slots.default" class="mt-4 flex justify-center">
      <slot />
    </div>
  </div>
</template>

<script setup>
// A calm, consistent empty state: optional icon, a title, supporting copy,
// and a slot for a primary CTA. Replaces the ad-hoc inline "No … yet" blocks.
defineProps({
  icon: { type: String, default: '' },
  title: { type: String, required: true },
  description: { type: String, default: '' },
})
</script>

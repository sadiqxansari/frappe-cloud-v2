<template>
  <section class="mt-4 overflow-hidden rounded-xl border border-outline-gray-2 bg-surface-elevation-1">
    <button class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-gray-1" @click="open = !open">
      <span v-if="icon" :class="icon" class="size-4 shrink-0 text-ink-gray-5" />
      <span class="min-w-0 flex-1">
        <span class="block text-sm font-semibold text-ink-gray-8">{{ title }}</span>
        <span v-if="subtitle" class="block truncate text-p-xs text-ink-gray-5">{{ subtitle }}</span>
      </span>
      <span class="lucide-chevron-down size-4 shrink-0 text-ink-gray-5 transition-transform" :class="open ? 'rotate-180' : ''" />
    </button>
    <div v-if="open" class="border-t border-outline-alpha-gray-1 p-4">
      <slot />
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue'

// A plain expandable card — header with an icon/title/subtitle, body in the slot.
const props = defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  icon: { type: String, default: '' },
  defaultOpen: { type: Boolean, default: false },
})
const open = ref(props.defaultOpen)
</script>

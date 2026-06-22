<template>
  <div class="border-b border-outline-gray-2">
    <button
      class="flex w-full items-center gap-2.5 px-5 py-4 text-left transition-colors hover:bg-surface-gray-1"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span v-if="icon" class="size-4 shrink-0 text-ink-gray-5" :class="icon" />
      <span class="flex-1 text-xs font-medium uppercase tracking-wide text-ink-gray-5">{{ title }}</span>
      <span class="lucide-chevron-down size-4 shrink-0 text-ink-gray-5 transition-transform" :class="open && 'rotate-180'" />
    </button>
    <div v-show="open" class="px-5 pb-5 pt-1">
      <slot />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  title: { type: String, required: true },
  icon: { type: String, default: '' },
  defaultOpen: { type: Boolean, default: false },
})
const open = ref(props.defaultOpen)
</script>

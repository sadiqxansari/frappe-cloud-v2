<template>
  <!-- `flat` drops the card chrome for a stacked list row divided by a bottom border. -->
  <section
    :class="flat
      ? 'border-b border-outline-alpha-gray-1'
      : 'mt-4 overflow-hidden rounded-xl border border-outline-gray-2 bg-surface-elevation-1'"
  >
    <!-- Header row: a flex-1 toggle for icon/title, an optional actions slot, then the chevron.
         Actions sit outside the toggle so their own controls (dropdowns) don't collapse the row. -->
    <div
      class="flex w-full items-center gap-3"
      :class="flat ? 'py-5' : 'px-4 py-3'"
    >
      <button
        class="flex min-w-0 flex-1 items-center gap-3 text-left transition-colors"
        :class="flat ? 'hover:opacity-80' : ''"
        @click="open = !open"
      >
        <span v-if="icon" :class="icon" class="size-4 shrink-0 text-ink-gray-5" />
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-semibold text-ink-gray-8">{{ title }}</span>
          <span v-if="subtitle" class="block truncate text-p-xs text-ink-gray-5">{{ subtitle }}</span>
        </span>
      </button>
      <slot name="actions" />
      <button class="shrink-0" aria-label="Toggle" @click="open = !open">
        <span class="lucide-chevron-down size-4 text-ink-gray-5 transition-transform" :class="open ? 'rotate-180' : ''" />
      </button>
    </div>
    <div v-if="open" :class="flat ? 'pb-4' : 'border-t border-outline-alpha-gray-1 p-4'">
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
  flat: { type: Boolean, default: false },
})
const open = ref(props.defaultOpen)
</script>

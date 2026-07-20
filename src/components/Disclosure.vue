<template>
  <!-- `flat` drops the card chrome for a stacked list row divided by a bottom border. -->
  <section
    ref="sectionEl"
    :class="flat
      ? 'border-b border-outline-alpha-gray-1'
      : 'mt-4 overflow-hidden rounded-lg border border-outline-gray-2 bg-surface-base'"
  >
    <!-- Header row: a flex-1 toggle for icon/title, an optional actions slot, then the chevron.
         Actions sit outside the toggle so their own controls (dropdowns) don't collapse the row. -->
    <div
      class="flex w-full items-center gap-3"
      :class="flat ? 'py-5' : 'px-4 py-4'"
    >
      <button
        class="flex min-w-0 flex-1 items-center gap-3 text-left transition-colors"
        :class="flat ? 'hover:opacity-80' : ''"
        @click="toggle"
      >
        <span v-if="icon" class="grid size-7 shrink-0 place-items-center rounded-md bg-surface-gray-1">
          <span :class="icon" class="size-4 text-ink-gray-5" />
        </span>
        <span class="flex min-w-0 flex-1 items-baseline gap-2">
          <span class="shrink-0 text-base font-medium text-ink-gray-7">{{ title }}</span>
          <span v-if="subtitle" class="truncate text-p-sm text-ink-gray-5">{{ subtitle }}</span>
        </span>
      </button>
      <slot name="actions" />
      <button class="shrink-0" aria-label="Toggle" @click="toggle">
        <span class="lucide-chevron-down size-4 text-ink-gray-5 transition-transform" :class="isOpen ? 'rotate-180' : ''" />
      </button>
    </div>
    <div v-if="isOpen" :class="flat ? 'pb-4' : 'p-4'">
      <slot />
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'

// A plain expandable card — header with an icon/title/subtitle, body in the slot.
// Uncontrolled by default (owns its own open state). Pass `open` (+ listen to
// `update:open`) to let a parent drive it — how the DB analyzer builds an
// exclusive, one-open-at-a-time accordion group. `open` is typeless so an absent
// binding stays null (Vue would coerce a missing Boolean prop to false).
const props = defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  icon: { type: String, default: '' },
  defaultOpen: { type: Boolean, default: false },
  flat: { type: Boolean, default: false },
  open: { default: null },
  first: { type: Boolean, default: false },
})
const emit = defineEmits(['update:open'])

const internalOpen = ref(props.defaultOpen)
const isControlled = computed(() => props.open !== null)
const isOpen = computed(() => (isControlled.value ? props.open : internalOpen.value))
function toggle() {
  if (isControlled.value) emit('update:open', !isOpen.value)
  else internalOpen.value = !internalOpen.value
}

// Bring the opened panel into view — expanding pushes everything below it down,
// so the accordion the user just clicked can end up scrolled off-screen. The
// first accordion sits right under the page header, so scrollIntoView's
// block:'start' would scroll it flush with the viewport top and clip the
// header above it — scroll the page container to the very top instead.
const sectionEl = ref(null)
watch(isOpen, (open) => {
  if (!open) return
  nextTick(() => {
    if (props.first) sectionEl.value?.closest('.fc-scroll')?.scrollTo({ top: 0, behavior: 'smooth' })
    else sectionEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
})
</script>

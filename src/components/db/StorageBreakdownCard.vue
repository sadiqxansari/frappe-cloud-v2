<template>
  <section class="flex h-full flex-col">
    <div class="flex items-start justify-between gap-3" :class="{ 'mr-2': insetRight }">
      <div class="flex items-center gap-2">
        <span v-if="icon" :class="icon" class="size-4 shrink-0 text-ink-gray-6" />
        <h2 class="text-base font-medium text-ink-gray-9">{{ title }}</h2>
      </div>
      <div v-if="usedGb != null" class="text-right text-p-sm">
        <span class="font-medium tabular-nums text-ink-gray-8">{{ fmtGb(usedGb) }}</span>
        <span class="ml-1 text-ink-gray-5">of {{ fmtGb(totalGb) }} used</span>
      </div>
    </div>

    <SegmentedBar class="mt-4" :class="{ 'mr-2': insetRight }" :segments="segments" :total-gb="totalGb" />

    <div class="mt-5 flex flex-col gap-3.5" :class="{ 'mr-2': insetRight }">
      <div v-for="s in visibleRows" :key="s.label">
        <!-- Expandable rows carry a per-item split (apps, sites). -->
        <component
          :is="s.children?.length ? 'button' : 'div'"
          class="flex w-full items-center justify-between gap-3 text-sm"
          :class="s.children?.length ? 'text-left hover:text-ink-gray-9' : ''"
          @click="s.children?.length && toggle(s.label)"
        >
          <span class="flex min-w-0 items-center gap-2 text-ink-gray-7">
            <span class="size-2 shrink-0 rounded-full" :style="{ background: s.color || 'var(--surface-gray-4)' }" />
            <span class="truncate">{{ s.label }}</span>
            <span
              v-if="s.children?.length"
              class="lucide-chevron-down size-3.5 shrink-0 text-ink-gray-4 transition-transform"
              :class="expanded.has(s.label) ? 'rotate-180' : ''"
            />
          </span>
          <span class="shrink-0 tabular-nums" :class="s.color ? 'text-ink-gray-8' : 'text-ink-gray-5'">{{ fmtGb(s.gb) }}</span>
        </component>

        <div v-if="s.children?.length && expanded.has(s.label)" class="mt-2 ml-4 space-y-1.5 border-l border-outline-gray-2 pl-3">
          <div v-for="c in s.children" :key="c.label">
            <!-- A child (a site) can itself split into file types. -->
            <component
              :is="c.children?.length ? 'button' : 'div'"
              class="flex w-full items-center justify-between gap-3 text-p-sm"
              :class="c.children?.length ? 'text-left hover:text-ink-gray-8' : ''"
              @click="c.children?.length && toggle(`${s.label}/${c.label}`)"
            >
              <span class="flex min-w-0 items-center gap-2 text-ink-gray-6">
                <AppIcon v-if="c.appKey" :app-key="c.appKey" size="sm" class="!size-4 !rounded-sm" />
                <span v-else-if="c.icon" :class="c.icon" class="size-3.5 shrink-0 text-ink-gray-4" />
                <span class="min-w-0">
                  <span class="block truncate">{{ c.label }}</span>
                  <span v-if="c.sub" class="block text-p-xs text-ink-gray-4">{{ c.sub }}</span>
                </span>
                <span
                  v-if="c.children?.length"
                  class="lucide-chevron-down size-3 shrink-0 text-ink-gray-4 transition-transform"
                  :class="expanded.has(`${s.label}/${c.label}`) ? 'rotate-180' : ''"
                />
              </span>
              <span class="shrink-0 tabular-nums text-ink-gray-6">{{ fmtGb(c.gb) }}</span>
            </component>

            <div v-if="c.children?.length && expanded.has(`${s.label}/${c.label}`)" class="mt-1.5 ml-4 space-y-1 border-l border-outline-gray-2 pl-3">
              <div v-for="g in c.children" :key="g.label" class="flex items-center justify-between gap-3 text-p-xs">
                <span class="truncate text-ink-gray-5">{{ g.label }}</span>
                <span class="shrink-0 tabular-nums text-ink-gray-5">{{ fmtGb(g.gb) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Rows too small to matter are folded away by default. -->
      <button
        v-if="minorRows.length"
        class="flex items-center gap-1 self-start text-p-sm text-ink-gray-5 hover:text-ink-gray-7"
        @click="showMinor = !showMinor"
      >
        <span class="lucide-chevron-down size-3.5 shrink-0 transition-transform" :class="showMinor ? 'rotate-180' : ''" />
        {{ showMinor ? 'Show less' : `Show ${minorRows.length} more` }}
      </button>
    </div>

    <slot name="footer" />
  </section>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import SegmentedBar from './SegmentedBar.vue'
import AppIcon from '../AppIcon.vue'
import { fmtGb } from './format'

// A storage breakdown: segmented bar + legend list. Legend rows with
// `children` expand to a per-item split; colorless rows (Free) stay quiet.
const props = defineProps({
  title: { type: String, required: true },
  usedGb: { type: Number, default: null },
  icon: { type: String, default: '' },
  segments: { type: Array, required: true }, // [{ label, gb, color, children?: [{ label, gb, sub? }] }]
  totalGb: { type: Number, required: true },
  // Colored rows below this (GB) are folded under "Show more".
  minorThresholdGb: { type: Number, default: 0.05 },
  // Add an 8px right margin to each element (header, bar, legend).
  insetRight: { type: Boolean, default: false },
})

// Free space (colorless) is pinned last; tiny colored rows fold away so the
// legend leads with what actually eats the disk.
const free = computed(() => props.segments.filter((s) => !s.color))
const majorRows = computed(() => props.segments.filter((s) => s.color && s.gb >= props.minorThresholdGb))
const minorRows = computed(() => props.segments.filter((s) => s.color && s.gb < props.minorThresholdGb))

const showMinor = ref(false)
const visibleRows = computed(() => [
  ...majorRows.value,
  ...(showMinor.value ? minorRows.value : []),
  ...free.value,
])

const expanded = reactive(new Set())
function toggle(label) {
  expanded.has(label) ? expanded.delete(label) : expanded.add(label)
}
</script>

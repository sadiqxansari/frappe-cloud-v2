<template>
  <div class="relative overflow-hidden rounded-2xl border border-outline-gray-3" :class="heightClass">
    <WorldMap
      :pins="pins"
      :connections="connections"
      :pin-scale="2.4"
      dark
      fit
      :fit-padding="80"
      class="h-full w-full"
    />

    <!-- From — top left -->
    <div class="wm-card absolute left-3 top-3 z-10 w-52 rounded-lg border border-outline-gray-2 bg-surface-elevation-1/85 p-2.5 shadow-sm backdrop-blur-md" :class="{ 'is-in': shown }" style="transition-delay: 0ms">
      <div class="text-xs text-ink-gray-5">From</div>
      <div class="mt-1 flex items-center gap-2">
        <ProviderIcon :provider="fromProvider" :size="22" class="rounded" />
        <div class="min-w-0">
          <div class="truncate text-sm font-medium text-ink-gray-9">{{ fromRegion.name }}</div>
          <div class="truncate text-xs text-ink-gray-5">{{ fromProvider.short }}<template v-if="fromPlan"> · {{ fromPlan }}</template></div>
        </div>
      </div>
    </div>

    <!-- To — top right -->
    <div class="wm-card absolute right-3 top-3 z-10 w-52 rounded-lg border border-outline-gray-2 bg-surface-elevation-1/85 p-2.5 shadow-sm backdrop-blur-md" :class="{ 'is-in': shown }" style="transition-delay: 70ms">
      <div class="text-xs text-ink-gray-5">To</div>
      <div class="mt-1 flex items-center gap-2">
        <ProviderIcon :provider="toProvider" :size="22" class="rounded" />
        <div class="min-w-0">
          <div class="truncate text-sm font-medium text-ink-gray-9">{{ toRegion.name }}</div>
          <div class="truncate text-xs text-ink-gray-5">{{ toProvider.short }}<template v-if="toPlan"> · {{ toPlan }}</template></div>
        </div>
      </div>
    </div>

    <!-- New cost — bottom right -->
    <div v-if="cost" class="wm-card absolute bottom-3 right-3 z-10 rounded-lg border border-outline-gray-2 bg-surface-elevation-1/85 px-3 py-1.5 text-right shadow-sm backdrop-blur-md" :class="{ 'is-in': shown }" style="transition-delay: 140ms">
      <div class="text-[10px] uppercase tracking-wide text-ink-gray-5">New cost</div>
      <div class="text-sm font-bold tabular-nums text-ink-gray-9">{{ cost }}<span class="text-xs font-normal text-ink-gray-5">/mo</span></div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import WorldMap from './WorldMap.vue'
import ProviderIcon from './ProviderIcon.vue'

const props = defineProps({
  fromRegion: { type: Object, required: true },
  toRegion: { type: Object, required: true },
  fromProvider: { type: Object, required: true },
  toProvider: { type: Object, required: true },
  fromPlan: { type: String, default: '' },
  toPlan: { type: String, default: '' },
  // Optional cost pill (already formatted, e.g. "₹3,900").
  cost: { type: String, default: '' },
  // Connection fill 0–1 (progress view sets this; review leaves it 0).
  progress: { type: Number, default: 0 },
  heightClass: { type: String, default: 'h-80' },
})

const shown = ref(false)

// from = neutral base dot, to = green destination dot (with a soft pulse).
const pins = computed(() => [
  { id: 'from', lat: props.fromRegion.lat, lng: props.fromRegion.lng, status: null },
  { id: 'to', lat: props.toRegion.lat, lng: props.toRegion.lng, status: 'active', selected: true, pulse: true },
])

const connections = computed(() => {
  if (props.fromRegion.id === props.toRegion.id) return []
  return [{ fromId: 'from', toId: 'to', progress: props.progress, lineColor: 'var(--ink-green-7)' }]
})

onMounted(() => nextTick(() => (shown.value = true)))
</script>

<style scoped>
.wm-card {
  opacity: 0;
  transform: translateY(6px);
  transition:
    opacity 0.24s cubic-bezier(0.23, 1, 0.32, 1),
    transform 0.24s cubic-bezier(0.23, 1, 0.32, 1);
}
.wm-card.is-in {
  opacity: 1;
  transform: translateY(0);
}
@media (prefers-reduced-motion: reduce) {
  .wm-card {
    transform: none;
    transition: opacity 0.2s ease;
  }
  .wm-card.is-in {
    transform: none;
  }
}
</style>

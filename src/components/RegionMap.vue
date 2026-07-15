<template>
  <div class="relative aspect-[2/1] w-full overflow-hidden rounded-2xl border border-outline-gray-1 bg-surface-white">
    <img :src="mapUrl" alt="" class="absolute max-w-none" :style="imageStyle" />
    <div class="absolute" :style="{ left: `${DOT.x}%`, top: `${DOT.y}%` }">
      <span
        v-if="!ready"
        class="region-ping absolute block size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gray-900"
      />
      <span
        class="absolute block size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gray-900 ring-4 ring-gray-900/10"
      />
      <div
        class="absolute bottom-5 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-xs font-medium text-ink-gray-7 shadow-md"
      >
        {{ label }}
      </div>
    </div>
  </div>
</template>

<script setup>
// A calm close-up of where the server lives: the dotted world map zoomed in on
// the region, a pinging dot while provisioning that settles still when ready.
// Ported from Central's onboarding RegionMap (dot kept dark, sized up a notch).
import { computed } from 'vue'
import mapUrl from '../assets/dotted-map.svg'

const props = defineProps({
  // A resolved region from data/catalog's regionById (needs id, lat, lng).
  region: { type: Object, required: true },
  label: { type: String, default: '' },
  ready: { type: Boolean, default: false },
})

const ZOOM = 3.8
const MAP_ASPECT = 238 / 120 // dotted-map.svg viewBox
const CARD_ASPECT = 2
// The dot rests slightly below card center so the label pill has headroom.
const DOT = { x: 50, y: 56 }

// The dotted map is roughly a Mercator crop (lat 78°N..60°S); this projects
// lat/lng onto it as fractions of the SVG canvas. Verified against the dot
// grid for every catalog region — a few coastal cities get hand nudges below.
const LAT_TOP = mercY(78)
const LAT_BOTTOM = mercY(-60)

function mercY(lat) {
  return Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 180 / 2))
}

function project(lat, lng) {
  return {
    x: (lng * (238 / 360) + 124.62) / 238,
    y: (LAT_TOP - mercY(lat)) / (LAT_TOP - LAT_BOTTOM),
  }
}

// Eye-calibrated corrections where the formula drifts off the dotted coastline.
// Mumbai uses Central's exact calibration so the flagship flow matches theirs.
const OVERRIDES = {
  'aws-mumbai': { x: 0.726, y: 0.515 },
  'frappe-navimumbai': { x: 0.728, y: 0.516 },
  'aws-virginia': { x: 0.286, y: 0.425 },
  'do-nyc': { x: 0.294, y: 0.408 },
  'do-blr': { x: 0.744, y: 0.558 },
  'aws-jakarta': { x: 0.828, y: 0.662 },
}

const spot = computed(() => OVERRIDES[props.region.id] || project(props.region.lat, props.region.lng))

const imageStyle = computed(() => {
  const width = ZOOM * 100
  const height = (width / MAP_ASPECT) * CARD_ASPECT
  return {
    width: `${width}%`,
    left: `${DOT.x - spot.value.x * width}%`,
    top: `${DOT.y - spot.value.y * height}%`,
  }
})
</script>

<style scoped>
.region-ping {
  animation: region-ping 2.4s cubic-bezier(0.23, 1, 0.32, 1) infinite;
}

@keyframes region-ping {
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0.3;
  }
  75%,
  100% {
    transform: translate(-50%, -50%) scale(3);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .region-ping {
    animation: none;
    opacity: 0;
  }
}
</style>

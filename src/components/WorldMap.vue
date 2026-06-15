<template>
  <div class="relative h-full w-full overflow-hidden">
    <svg viewBox="0 0 879 443" preserveAspectRatio="xMidYMid meet" class="h-full w-full">
      <!-- Dots + pins share one zoomable group so pins always track the dots.
           The dotted asset is embedded as an <image>. -->
      <g :style="zoomStyle">
        <image :href="dottedMap" x="0" y="0" width="879" height="443" preserveAspectRatio="none" />

        <!-- Each pin counter-scales by 1/s so its on-screen size stays constant
             at any zoom. The counter-scale rides the same 0.55s transition as the
             zoom group, so size holds steady through the animation too. -->
        <g
          v-for="p in projected"
          :key="p.id"
          class="wm-pin"
          :style="p.posStyle"
          @click="selectable && $emit('select', p.id)"
          @mouseenter="selectable && $emit('hover', p.id)"
          @mouseleave="selectable && $emit('hover', null)"
        >
          <g class="wm-hot" :style="{ transform: `scale(${p.hot ? 1.35 : 1})` }">
            <circle
              cx="0"
              cy="0"
              :r="p.glowR"
              :fill="p.glowColor"
              class="wm-glow"
              :class="{ 'wm-pulse': p.broken }"
              :style="p.broken ? null : { opacity: p.glow ? 0.18 : 0 }"
            />
            <circle
              cx="0"
              cy="0"
              :r="p.r"
              :fill="p.color"
              stroke="var(--surface-white)"
              stroke-width="1.5"
              vector-effect="non-scaling-stroke"
              class="wm-dot"
            />
          </g>
        </g>
      </g>
    </svg>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import dottedMap from '../assets/dotted-map.svg'
import { PROVIDERS, REGIONS, regionsOf } from '../data/catalog'

const props = defineProps({
  // { id, lat, lng, status, selected? }
  pins: { type: Array, default: () => [] },
  highlight: { type: [String, null], default: null },
  selectable: { type: Boolean, default: false },
  // 'world' | providerId | regionId — drives the zoom framing.
  focus: { type: String, default: 'world' },
  // Frame the map to fit all current pins (overrides focus when pins exist).
  fit: { type: Boolean, default: false },
  // Manual zoom multiplier on top of the focus framing (magnifier buttons).
  scale: { type: Number, default: 1 },
  // Multiplies the base pin size (e.g. small locator maps want bigger dots).
  pinScale: { type: Number, default: 1 },
})
defineEmits(['select', 'hover'])

// The asset is a 2:1 equirectangular dotted map (viewBox 879×443), calibrated
// against its dot bounding box: full longitude, Greenland-to-Patagonia latitude.
const W = 879
const H = 443
const LAT_TOP = 83
const LAT_BOTTOM = -56

function project(lat, lng) {
  return {
    x: ((lng + 180) / 360) * W,
    y: ((LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM)) * H,
  }
}

// Fit a set of points into an aspect-correct box with padding.
function frame(points, pad) {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  let x = Math.min(...xs) - pad
  let y = Math.min(...ys) - pad
  let w = Math.max(...xs) - Math.min(...xs) + pad * 2
  let h = Math.max(...ys) - Math.min(...ys) + pad * 2
  const aspect = W / H
  if (w / h < aspect) {
    const nw = h * aspect
    x -= (nw - w) / 2
    w = nw
  } else {
    const nh = w / aspect
    y -= (nh - h) / 2
    h = nh
  }
  return { x, y, w, h }
}

const baseBox = computed(() => {
  // Fit-to-pins takes priority: frame every pin currently on the map.
  if (props.fit && props.pins.length) {
    return frame(props.pins.map((p) => project(p.lat, p.lng)), 80)
  }
  const f = props.focus
  if (f && PROVIDERS.some((p) => p.id === f)) {
    const pts = regionsOf(f).map((r) => project(r.lat, r.lng))
    if (pts.length) return frame(pts, 60)
  }
  const region = REGIONS.find((r) => r.id === f)
  if (region) return frame([project(region.lat, region.lng)], 75)
  return { x: 0, y: 0, w: W, h: H }
})

// Manual zoom shrinks the focus box around its centre.
const box = computed(() => {
  const b = baseBox.value
  if (props.scale > 1) {
    const cx = b.x + b.w / 2
    const cy = b.y + b.h / 2
    const w = b.w / props.scale
    const h = b.h / props.scale
    return { x: cx - w / 2, y: cy - h / 2, w, h }
  }
  return b
})

const s = computed(() => Math.min(W / box.value.w, H / box.value.h))

const zoomStyle = computed(() => {
  const b = box.value
  const scale = s.value
  const tx = (W - b.w * scale) / 2 - b.x * scale
  const ty = (H - b.h * scale) / 2 - b.y * scale
  return {
    transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
    transformOrigin: '0 0',
    transition: 'transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)',
  }
})

const BLACK = '#171717'
const RED = 'var(--ink-red-3)'
const GREEN = 'var(--ink-green-3)'
const AMBER = 'var(--ink-amber-3)'

const projected = computed(() => {
  const inv = 1 / s.value
  const ps = props.pinScale
  return props.pins.map((p) => {
    const { x, y } = project(p.lat, p.lng)
    const broken = p.status === 'broken'
    const isHover = p.id === props.highlight
    const hot = isHover || !!p.selected
    // No status (e.g. the region picker) renders neutral black; servers carry a status.
    const status = broken
      ? RED
      : p.status === 'provisioning' || p.status === 'suspended'
        ? AMBER
        : p.status
          ? GREEN
          : BLACK
    const color = isHover ? BLACK : status
    return {
      id: p.id,
      broken,
      hot,
      color,
      glowColor: color,
      glow: broken || hot,
      r: 5 * ps,
      glowR: 11 * ps,
      posStyle: {
        transform: `translate(${x}px, ${y}px) scale(${inv})`,
        transformOrigin: '0 0',
        cursor: props.selectable ? 'pointer' : 'default',
      },
    }
  })
})
</script>

<style scoped>
/* Position + counter-scale animate with the zoom group. */
.wm-pin {
  transition: transform 0.55s cubic-bezier(0.4, 0, 0.2, 1);
}
/* Hover/selected emphasis — its own quick, smooth grow. */
.wm-hot {
  transform-origin: 0 0;
  transition: transform 0.18s ease-out;
}
.wm-dot {
  transition: fill 0.2s ease;
}
.wm-glow {
  transition: opacity 0.25s ease, fill 0.2s ease;
}
.wm-pulse {
  animation: wm-pulse 1.8s ease-in-out infinite;
}
@keyframes wm-pulse {
  0%,
  100% {
    opacity: 0.32;
  }
  50% {
    opacity: 0.1;
  }
}
</style>

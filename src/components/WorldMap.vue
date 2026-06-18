<template>
  <div class="relative h-full w-full overflow-hidden">
    <svg viewBox="0 0 879 443" preserveAspectRatio="xMidYMid meet" class="h-full w-full">
      <!-- Dots + pins share one zoomable group so pins always track the dots.
           The dotted asset is embedded as an <image>. -->
      <g :style="zoomStyle">
        <image :href="dark ? darkMap : lightMap" x="0" y="0" width="879" height="443" preserveAspectRatio="none" />

        <!-- Connection lines between pins: dotted base + animated progress overlay. -->
        <g v-for="(c, i) in projectedConnections" :key="i">
          <line
            :x1="c.x1" :y1="c.y1" :x2="c.x2" :y2="c.y2"
            stroke="var(--ink-gray-6)" stroke-width="1.5"
            stroke-dasharray="6 5" opacity="0.9"
            vector-effect="non-scaling-stroke"
          />
          <line
            :x1="c.x1" :y1="c.y1" :x2="c.x2" :y2="c.y2"
            :stroke="c.lineColor"
            stroke-width="2.5"
            :stroke-dasharray="`${c.filled} ${c.len}`"
            vector-effect="non-scaling-stroke"
            class="wm-progress-line"
          />
        </g>

        <!-- Each pin counter-scales by 1/s so its on-screen size stays constant
             at any zoom. The counter-scale rides the same 0.55s transition as the
             zoom group, so size holds steady through the animation too. -->
        <g
          v-for="p in projected"
          :key="p.id"
          class="wm-pin"
          :style="p.posStyle"
          @click="selectable && $emit('select', p.id)"
          @mouseenter="$emit('hover', p.id)"
          @mouseleave="$emit('hover', null)"
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
              stroke="none"
              stroke-width="1.5"
              vector-effect="non-scaling-stroke"
              class="wm-dot"
            />
          </g>
          <!-- Optional label pill rendered in counter-scaled pin space. Sized to
               sit close to the dot rather than dominate it (see review F6). -->
          <g v-if="p.label" :transform="`translate(${p.r + 3}, ${-(p.r + 6)})`">
            <rect
              x="0" y="-11"
              :width="p.label.length * 9 + 8"
              height="14"
              rx="2"
              fill="var(--ink-gray-8)"
              opacity="0.85"
            />
            <text
              x="4.5" y="0"
              font-size="15"
              font-weight="600"
              font-family="sans-serif"
              fill="white"
            >{{ p.label }}</text>
          </g>
        </g>
      </g>
    </svg>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import lightMap from '../assets/world-map.svg'
import darkMap from '../assets/world-map-dark.png'
import { PROVIDERS, REGIONS, regionsOf } from '../data/catalog'

const props = defineProps({
  // { id, lat, lng, status, selected?, label? }
  pins: { type: Array, default: () => [] },
  highlight: { type: [String, null], default: null },
  selectable: { type: Boolean, default: false },
  // 'world' | providerId | regionId — drives the zoom framing.
  focus: { type: String, default: 'world' },
  // Frame the map to fit all current pins (overrides focus when pins exist).
  fit: { type: Boolean, default: false },
  // Padding (in SVG units) used when fit=true. Larger = more zoomed out.
  fitPadding: { type: Number, default: 80 },
  // Use the dark PNG instead of the light SVG (migration views).
  dark: { type: Boolean, default: false },
  // Manual zoom multiplier on top of the focus framing (magnifier buttons).
  scale: { type: Number, default: 1 },
  // Multiplies the base pin size.
  pinScale: { type: Number, default: 1 },
  // { fromId, toId, progress: 0–1, lineColor?: string }
  connections: { type: Array, default: () => [] },
})
defineEmits(['select', 'hover'])

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
  if (props.fit && props.pins.length) {
    return frame(props.pins.map((p) => project(p.lat, p.lng)), props.fitPadding)
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
const BLACK_ON_DARK = '#171717'
const RED = 'var(--ink-red-3)'
const GREEN = 'var(--ink-green-3)'
const AMBER = 'var(--ink-amber-3)'
const DEFAULT_LINE_COLOR = 'var(--ink-blue-3)'

const projectedConnections = computed(() => {
  return props.connections.map((c) => {
    const fromPin = props.pins.find((p) => p.id === c.fromId)
    const toPin = props.pins.find((p) => p.id === c.toId)
    if (!fromPin || !toPin) return null
    const a = project(fromPin.lat, fromPin.lng)
    const b = project(toPin.lat, toPin.lng)
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    const filled = Math.max(0, Math.min(1, c.progress ?? 0)) * len
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y, len, filled, lineColor: c.lineColor || DEFAULT_LINE_COLOR }
  }).filter(Boolean)
})

const projected = computed(() => {
  const inv = 1 / s.value
  const ps = props.pinScale
  return props.pins.map((p) => {
    const { x, y } = project(p.lat, p.lng)
    const broken = p.status === 'broken'
    const isHover = p.id === props.highlight
    const hot = isHover || !!p.selected
    const nullColor = props.dark ? BLACK_ON_DARK : BLACK
    const status = broken
      ? RED
      : p.status === 'provisioning' || p.status === 'suspended'
        ? AMBER
        : p.status
          ? GREEN
          : nullColor
    const color = status
    return {
      id: p.id,
      broken,
      hot,
      color,
      glowColor: color,
      glow: broken || hot,
      r: 5 * ps,
      glowR: 11 * ps,
      label: p.label || null,
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
.wm-pin {
  transition: transform 0.55s cubic-bezier(0.4, 0, 0.2, 1);
}
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
.wm-progress-line {
  transition: stroke-dasharray 0.4s ease;
}
</style>

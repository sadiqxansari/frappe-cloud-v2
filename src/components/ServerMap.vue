<template>
  <div
    ref="el"
    class="relative isolate h-full w-full select-none overflow-hidden bg-surface-base"
    :class="[ready && 'sm-anim', (dragging || wheeling || focusing) && 'sm-drag', dragging ? 'cursor-grabbing' : zoom > 1 ? 'cursor-grab' : '']"
    :style="zoom > 1 ? { touchAction: 'none' } : null"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
    @dblclick="onDblClick"
    @wheel="onWheel"
  >
    <!-- Dotted world. One transformed layer; nodes ride the same transition
         curve below so they track the dots through zooms. -->
    <div class="sm-pos absolute left-0 top-0 origin-top-left" :style="mapStyle">
      <WorldDots class="block text-ink-gray-2" :style="{ width: `${W}px`, height: `${H}px` }" />
    </div>

    <!-- Nodes: servers, clusters (2+ at one spot), and + spots for empty
         regions. Positioned in screen space; recluster as the zoom changes. -->
    <TransitionGroup name="smn">
      <div
        v-for="n in nodes"
        :key="n.key"
        class="sm-pos absolute left-0 top-0"
        :style="posStyle(n)"
      >
        <div class="sm-center">
          <!-- Single server: provider logo + status dot -->
          <button
            v-if="n.type === 'server'"
            class="group relative block rounded-full outline-none"
            :aria-label="`${n.pin.name} — ${n.pin.card.badge.label}`"
            @click="clickNode(n)"
            @mouseenter="enterNode(n)"
            @mouseleave="leaveNode"
          >
            <span
              v-if="n.pin.status === 'broken'"
              class="sm-pulse absolute -inset-1.5 rounded-full"
              style="background: var(--ink-red-7)"
            />
            <span
              class="relative block rounded-full transition-transform duration-150 ease-out group-active:scale-95"
              :class="isHot(n) && 'scale-110'"
            >
              <ProviderAvatar :provider="n.pin.provider" :size="36" />
              <!-- The badge art is inset ~2px inside its box, so the stack
                   separator ring hugs the visible disc, not the box edge. -->
              <span
                v-if="n.stacked"
                class="pointer-events-none absolute inset-[2px] rounded-full ring-2 ring-[var(--surface-base)]"
              />
            </span>
            <span
              class="absolute bottom-0 right-0 size-3 rounded-full border-2 border-[var(--surface-base)]"
              :style="{ background: statusVar(n.pin.status) }"
            />
          </button>

          <!-- Cluster: count in a dark disc, dominant provider as a badge -->
          <button
            v-else-if="n.type === 'cluster'"
            class="group relative block rounded-full outline-none"
            :aria-label="`${n.members.length} servers in ${n.title}`"
            @click="clickNode(n)"
            @mouseenter="enterNode(n)"
            @mouseleave="leaveNode"
          >
            <span
              class="absolute -inset-2 rounded-full transition-colors"
              :class="n.broken ? 'sm-pulse bg-surface-red-4' : 'bg-surface-gray-3 opacity-60'"
            />
            <span
              class="relative grid size-11 place-items-center rounded-full text-base font-semibold shadow-md transition-transform duration-150 ease-out group-active:scale-95"
              :class="isHot(n) && 'scale-105'"
              style="background: var(--ink-gray-9); color: var(--surface-base)"
            >
              {{ n.members.length }}
            </span>
            <span class="absolute -bottom-1 -right-1 block rounded-full">
              <ProviderAvatar :provider="n.provider" :size="20" />
            </span>
          </button>

          <!-- Empty region: quiet + affordance -->
          <button
            v-else
            class="grid size-7 place-items-center rounded-full border border-outline-gray-2 bg-surface-elevation-1 text-ink-gray-6 shadow-sm transition-[transform,box-shadow] duration-150 ease-out hover:shadow-md active:scale-95"
            :class="isHot(n) ? 'scale-110 shadow-md' : ''"
            :aria-label="`New server in ${n.title}`"
            @click="clickNode(n)"
            @mouseenter="enterNode(n)"
            @mouseleave="leaveNode"
          >
            <span class="lucide-plus size-3.5" />
          </button>
        </div>
      </div>
    </TransitionGroup>

    <!-- Hover card -->
    <Transition name="smc">
      <div
        v-if="card"
        :key="card.node.key"
        data-map-card
        class="absolute z-40 rounded-lg border border-outline-gray-1 bg-surface-elevation-1 shadow-xl"
        :class="card.node.type === 'cluster' ? 'p-2' : 'p-4'"
        :style="card.style"
        @mouseenter="cancelHide"
        @mouseleave="leaveNode"
        @click.capture="cardLocked = true"
      >
        <!-- Server details -->
        <template v-if="card.node.type === 'server'">
          <div class="flex items-start gap-2">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="truncate text-base font-semibold text-ink-gray-9">{{ card.node.pin.name }}</span>
                <Badge :theme="card.node.pin.card.badge.theme" variant="subtle" size="sm" :label="card.node.pin.card.badge.label" />
              </div>
              <div class="mt-0.5 truncate text-sm text-ink-gray-5">{{ card.node.pin.card.specs }}</div>
            </div>
            <div class="-mr-1.5 -mt-1" @click.stop>
              <ServerActions :server="card.node.pin.server" central />
            </div>
          </div>
          <div class="mt-3 flex items-baseline justify-between text-sm">
            <span class="font-medium text-ink-gray-8">Plan</span>
            <span class="font-semibold text-ink-gray-9">{{ card.node.pin.card.price }}<span class="font-normal text-ink-gray-5">/mo</span></span>
          </div>
          <div v-for="m in card.node.pin.card.metrics" :key="m.label" class="mt-3">
            <div class="flex items-baseline justify-between gap-3 text-sm">
              <span class="font-medium text-ink-gray-8">{{ m.label }}</span>
              <span class="truncate text-ink-gray-5">{{ m.value }}</span>
            </div>
            <div class="mt-1.5 h-0.5 overflow-hidden rounded-full bg-surface-gray-3">
              <div
                class="h-full rounded-full transition-[width] duration-300 ease-out"
                :style="{ width: `${Math.max(m.pct, 2)}%`, background: m.pct > 85 ? 'var(--ink-red-7)' : 'var(--ink-gray-9)' }"
              />
            </div>
          </div>
        </template>

        <!-- Cluster: the servers at this spot -->
        <template v-else-if="card.node.type === 'cluster'">
          <div class="px-1.5 pb-1 pt-0.5 text-xs font-medium text-ink-gray-5">
            {{ card.node.members.length }} servers · {{ card.node.title }}
          </div>
          <button
            v-for="m in card.node.members"
            :key="m.id"
            class="group flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-surface-gray-2"
            @click="emit('open', m.id)"
          >
            <span class="relative shrink-0">
              <ProviderAvatar :provider="m.provider" :size="28" />
              <span class="absolute -bottom-px -right-px size-2.5 rounded-full border-2 border-[var(--surface-elevation-1)]" :style="{ background: statusVar(m.status) }" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-medium text-ink-gray-8">{{ m.name }}</span>
              <span class="block truncate text-xs text-ink-gray-5">{{ m.card.specs }}</span>
            </span>
            <span class="lucide-arrow-up-right size-3.5 shrink-0 text-ink-gray-5 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        </template>

        <!-- Empty region: providers available here + a direct path to create -->
        <template v-else>
          <div class="text-base font-semibold text-ink-gray-9">No servers in this region</div>
          <div class="mt-0.5 text-sm text-ink-gray-5">{{ card.node.title }}</div>
          <div class="mt-3 flex items-center gap-2">
            <span class="text-sm text-ink-gray-6">Providers available</span>
            <button
              v-for="t in card.node.targets"
              :key="t.provider.id"
              class="block shrink-0 rounded-full transition-transform duration-150 ease-out hover:scale-110 active:scale-95"
              :title="`New ${t.provider.short} server`"
              @click="emit('new-server', { providerId: t.provider.id, regionId: t.regionId })"
            >
              <ProviderAvatar :provider="t.provider" :size="20" />
            </button>
          </div>
          <Button
            class="mt-3"
            variant="subtle"
            size="sm"
            label="New server"
            icon-left="lucide-plus"
            @click="emit('new-server', { providerId: card.node.targets[0].provider.id, regionId: card.node.targets[0].regionId })"
          />
        </template>
      </div>
    </Transition>

    <!-- Zoom controls; slide left when the server panel overlays the right edge -->
    <div
      data-map-controls
      class="sm-controls absolute bottom-14 right-4 z-30 flex flex-col overflow-hidden rounded-lg border border-outline-gray-2 bg-surface-elevation-1 shadow-sm"
      :style="{ transform: `translateX(${-panelOffset}px)` }"
    >
      <button
        class="grid size-9 place-items-center text-ink-gray-6 transition-colors hover:bg-surface-gray-2 active:bg-surface-gray-3 disabled:pointer-events-none disabled:opacity-40"
        aria-label="Zoom in"
        :disabled="zoom >= MAX_Z"
        @click="zoomStep(1)"
      >
        <span class="lucide-zoom-in size-4" />
      </button>
      <button
        class="grid size-9 place-items-center border-t border-outline-alpha-gray-1 text-ink-gray-6 transition-colors hover:bg-surface-gray-2 active:bg-surface-gray-3 disabled:pointer-events-none disabled:opacity-40"
        aria-label="Zoom out"
        :disabled="zoom <= 1"
        @click="zoomStep(-1)"
      >
        <span class="lucide-zoom-out size-4" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Badge, Button } from 'frappe-ui'
import ProviderAvatar from './ProviderAvatar.vue'
import ServerActions from './ServerActions.vue'
import WorldDots from './WorldDots.vue'

const props = defineProps({
  // Display-ready server pins (built by the page):
  // { id, name, status, lat, lng, server, provider, region,
  //   card: { badge: {label, theme}, specs, price, metrics: [{label, value, pct}] } }
  pins: { type: Array, default: () => [] },
  // Regions with no servers: { id (regionId), lat, lng, region, provider }
  spots: { type: Array, default: () => [] },
  // Server id hovered elsewhere (the side panel) — bumps its node.
  highlightId: { type: [String, null], default: null },
  // Push the zoom controls left when a panel overlays the right edge (px).
  panelOffset: { type: Number, default: 0 },
})
const emit = defineEmits(['open', 'new-server', 'cluster-open'])

// Same equirectangular projection as WorldMap.vue, so REGIONS lat/lng line up
// with the WorldDots asset generated on the same frame.
const W = 879
const H = 443
const LAT_TOP = 83
const LAT_BOTTOM = -56
const MAX_Z = 5
const STEP = 1.7
// Past this zoom, servers sharing a spot stop counting ("3") and fan out into
// an overlapping avatar stack — whether you clicked the cluster or just
// zoomed your way in. Two zoom-in clicks (1.7² ≈ 2.89) get you there.
const STACK_Z = 2.8

function project(p) {
  return {
    x: ((p.lng + 180) / 360) * W,
    y: ((LAT_TOP - p.lat) / (LAT_TOP - LAT_BOTTOM)) * H,
  }
}

// — Viewport: contain-fit the world, then zoom/pan on top. At zoom 1 the map
//   is centered and locked; zoomed in, it pans within the map's own bounds.
const el = ref(null)
const cw = ref(0)
const ch = ref(0)
const zoom = ref(1)
const tx = ref(0)
const ty = ref(0)
const dragging = ref(false)
const wheeling = ref(false)
const focusing = ref(false)

const base = computed(() => (cw.value && ch.value ? Math.min(cw.value / W, ch.value / H) : 0))
const k = computed(() => base.value * zoom.value)

// Transitions stay off until the first layout lands — the map must appear in
// place instantly, not zoom in from nothing.
const ready = ref(false)
watch(base, (v) => {
  if (v && !ready.value) requestAnimationFrame(() => requestAnimationFrame(() => (ready.value = true)))
})

let ro
onMounted(() => {
  ro = new ResizeObserver(([entry]) => {
    cw.value = entry.contentRect.width
    ch.value = entry.contentRect.height
  })
  ro.observe(el.value)
})
onBeforeUnmount(() => ro?.disconnect())

function clampPan() {
  const w = W * k.value
  const h = H * k.value
  tx.value = w <= cw.value ? (cw.value - w) / 2 : Math.min(0, Math.max(cw.value - w, tx.value))
  ty.value = h <= ch.value ? (ch.value - h) / 2 : Math.min(0, Math.max(ch.value - h, ty.value))
}
watch([base, cw, ch], clampPan)

const mapStyle = computed(() => ({
  transform: `translate3d(${tx.value}px, ${ty.value}px, 0) scale(${k.value})`,
}))

function zoomAt(ax, ay, factor) {
  cancelFocus()
  const zNew = Math.min(MAX_Z, Math.max(1, zoom.value * factor))
  if (zNew === zoom.value) return
  const kOld = k.value
  const kNew = base.value * zNew
  tx.value = ax - ((ax - tx.value) / kOld) * kNew
  ty.value = ay - ((ay - ty.value) / kOld) * kNew
  zoom.value = zNew
  hideCard()
  clampPan()
}
function zoomStep(dir) {
  zoomAt(cw.value / 2, ch.value / 2, dir > 0 ? STEP : 1 / STEP)
}

// Focus a node in one continuous move: zoom to (at least) the stack level
// while the node glides to the viewport centre. Driven frame-by-frame (CSS
// transitions off) — zoom interpolates in log space and the node's on-screen
// path is eased explicitly, so the combined motion never swings.
let focusRaf
function cancelFocus() {
  cancelAnimationFrame(focusRaf)
  focusing.value = false
}
function focusOn(n) {
  cancelFocus()
  hideCard()
  const { x: wx, y: wy } = n
  const z0 = zoom.value
  const z1 = Math.min(MAX_Z, Math.max(z0, STEP * STEP))
  const from = screenOf(n)
  const to = { sx: cw.value / 2, sy: ch.value / 2 }
  const D = 600
  const start = performance.now()
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
  focusing.value = true
  const frame = (now) => {
    const e = ease(Math.min(1, (now - start) / D))
    zoom.value = z0 * Math.pow(z1 / z0, e)
    tx.value = from.sx + (to.sx - from.sx) * e - wx * k.value
    ty.value = from.sy + (to.sy - from.sy) * e - wy * k.value
    clampPan()
    if ((now - start) < D) focusRaf = requestAnimationFrame(frame)
    else focusing.value = false
  }
  focusRaf = requestAnimationFrame(frame)
}

// — Drag to pan (only when zoomed in). A real click is distinguished from a
//   drag by a 4px slop; after a drag the trailing click is swallowed.
let drag = null
let suppressClick = false
function onDown(e) {
  if (e.button !== 0) return
  // A locked card (its ⋯ menu was opened) closes on any press outside it.
  if (cardLocked.value && !e.target.closest('[data-map-card]')) hideCard()
  if (zoom.value <= 1) return
  if (e.target.closest('[data-map-card],[data-map-controls]')) return
  drag = { x: e.clientX, y: e.clientY, tx: tx.value, ty: ty.value, id: e.pointerId, moved: false }
}
function onMove(e) {
  if (!drag) return
  const dx = e.clientX - drag.x
  const dy = e.clientY - drag.y
  if (!drag.moved && Math.hypot(dx, dy) < 4) return
  if (!drag.moved) {
    drag.moved = true
    dragging.value = true
    cancelFocus() // don't fight the user for the viewport
    hideCard()
    el.value.setPointerCapture?.(drag.id)
  }
  tx.value = drag.tx + dx
  ty.value = drag.ty + dy
  clampPan()
}
function onUp() {
  if (drag?.moved) {
    suppressClick = true
    setTimeout(() => (suppressClick = false), 0)
  }
  drag = null
  dragging.value = false
}
function onDblClick(e) {
  if (e.target.closest('[data-map-card],[data-map-controls]')) return
  const r = el.value.getBoundingClientRect()
  zoomAt(e.clientX - r.left, e.clientY - r.top, STEP)
}

// Trackpad: pinch (ctrl+wheel) zooms at the cursor; two-finger scroll pans
// when zoomed in. Both move without the zoom transition.
let wheelT
function onWheel(e) {
  const pinch = e.ctrlKey || e.metaKey
  if (!pinch && zoom.value <= 1) return
  e.preventDefault()
  wheeling.value = true
  cancelFocus()
  clearTimeout(wheelT)
  wheelT = setTimeout(() => (wheeling.value = false), 140)
  hideCard()
  if (pinch) {
    const r = el.value.getBoundingClientRect()
    zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.01))
  } else {
    tx.value -= e.deltaX
    ty.value -= e.deltaY
    clampPan()
  }
}

// — Nodes: greedy proximity clustering in world units, thresholds fixed in
//   screen pixels so groups split apart naturally as you zoom in.
function groupBy(items, threshold) {
  const groups = []
  for (const it of items) {
    let best = null
    let bestD = Infinity
    for (const g of groups) {
      const d = Math.hypot(g.x - it.wx, g.y - it.wy)
      if (d < threshold && d < bestD) {
        best = g
        bestD = d
      }
    }
    if (best) {
      best.members.push(it)
      best.x = best.members.reduce((s, m) => s + m.wx, 0) / best.members.length
      best.y = best.members.reduce((s, m) => s + m.wy, 0) / best.members.length
    } else {
      groups.push({ x: it.wx, y: it.wy, members: [it] })
    }
  }
  return groups
}

// "Falkenstein, Germany" + "Nuremberg, Germany" → "Germany"; one region keeps
// its full name; mixed countries fall back to a neutral label.
function locationLabel(regions) {
  if (regions.length === 1) return regions[0].name
  const countries = [...new Set(regions.map((r) => r.name.split(',').pop().trim()))]
  return countries.length === 1 ? countries[0] : 'This area'
}

function dominantProvider(members) {
  const counts = {}
  for (const m of members) counts[m.provider.id] = (counts[m.provider.id] || 0) + 1
  return members.reduce((a, b) => (counts[b.provider.id] > counts[a.provider.id] ? b : a)).provider
}

const nodes = computed(() => {
  if (!k.value) return []
  const pins = props.pins.map((p) => ({ ...p, ...worldOf(p) }))
  const serverGroups = groupBy(pins, 46 / k.value)
  const out = []
  for (const g of serverGroups) {
    if (g.members.length === 1) {
      out.push({ type: 'server', key: `s-${g.members[0].id}`, x: g.x, y: g.y, pin: g.members[0] })
    } else if (zoom.value >= STACK_Z) {
      const gap = 24 / k.value
      g.members.forEach((m, i) => {
        out.push({
          type: 'server',
          key: `s-${m.id}`,
          x: g.x + (i - (g.members.length - 1) / 2) * gap,
          y: g.y,
          pin: m,
          stacked: true,
          stackZ: g.members.length - i,
        })
      })
    } else {
      out.push({
        type: 'cluster',
        key: clusterKeyOf(g),
        x: g.x,
        y: g.y,
        members: g.members,
        provider: dominantProvider(g.members),
        broken: g.members.some((m) => m.status === 'broken'),
        title: locationLabel(g.members.map((m) => m.region)),
      })
    }
  }
  // Empty regions collapse into one + per spot. A region sitting under a
  // server node is dropped individually, so its neighbours still show.
  const spots = props.spots
    .map((s) => ({ ...s, ...worldOf(s) }))
    .filter((s) => !serverGroups.some((sg) => Math.hypot(sg.x - s.wx, sg.y - s.wy) < 36 / k.value))
  for (const g of groupBy(spots, 30 / k.value)) {
    const seen = new Set()
    const targets = []
    for (const s of g.members) {
      if (seen.has(s.provider.id)) continue
      seen.add(s.provider.id)
      targets.push({ provider: s.provider, regionId: s.id })
    }
    out.push({
      type: 'plus',
      key: `p-${g.members.map((s) => s.id).sort().join('.')}`,
      x: g.x,
      y: g.y,
      targets,
      title: locationLabel(g.members.map((s) => s.region)),
    })
  }
  return out
})

function worldOf(p) {
  const { x, y } = project(p)
  return { wx: x, wy: y }
}

function clusterKeyOf(g) {
  return `c-${g.members.map((m) => m.id).sort().join('.')}`
}

function screenOf(n) {
  return { sx: tx.value + n.x * k.value, sy: ty.value + n.y * k.value }
}

const highlightKey = computed(() => {
  if (!props.highlightId) return null
  const n = nodes.value.find(
    (n) =>
      (n.type === 'server' && n.pin.id === props.highlightId) ||
      (n.type === 'cluster' && n.members.some((m) => m.id === props.highlightId)),
  )
  return n?.key || null
})

function isHot(n) {
  return n.key === hoverKey.value || n.key === highlightKey.value
}

function posStyle(n) {
  const zBase = n.type === 'plus' ? 10 : n.type === 'cluster' ? 21 : 20
  const { sx, sy } = screenOf(n)
  return {
    transform: `translate3d(${sx}px, ${sy}px, 0)`,
    zIndex: isHot(n) ? 30 : zBase + (n.stackZ || 0),
  }
}

// — Hover intent: a short delay in, a grace period out so the pointer can
//   travel from node to card without the card blinking away.
const hoverKey = ref(null)
// Opening a menu inside the card portals its items to <body>, which fires a
// mouseleave on the card. Any click inside the card locks it open; a press
// anywhere outside closes it (see onDown).
const cardLocked = ref(false)
let showT
let hideT
function enterNode(n) {
  if (dragging.value || cardLocked.value) return
  clearTimeout(hideT)
  clearTimeout(showT)
  showT = setTimeout(() => (hoverKey.value = n.key), 40)
}
function leaveNode() {
  if (cardLocked.value) return
  clearTimeout(showT)
  clearTimeout(hideT)
  hideT = setTimeout(() => (hoverKey.value = null), 140)
}
function cancelHide() {
  clearTimeout(hideT)
}
function hideCard() {
  clearTimeout(showT)
  clearTimeout(hideT)
  cardLocked.value = false
  hoverKey.value = null
}

const card = computed(() => {
  const node = hoverKey.value && nodes.value.find((n) => n.key === hoverKey.value)
  if (!node) return null
  const { sx, sy } = screenOf(node)
  const width = node.type === 'server' ? 320 : 288
  // Stacked avatars overlap sideways, so their card drops below instead of
  // covering the neighbours to the right.
  if (node.stacked) {
    const left = Math.min(Math.max(sx - width / 2, 12), Math.max(12, cw.value - width - 12))
    return {
      node,
      style: {
        left: `${left}px`,
        top: `${sy + 28}px`,
        width: `${width}px`,
        transformOrigin: `${sx - left}px top`,
        '--smc-dy': '-6px',
      },
    }
  }
  const r = node.type === 'cluster' ? 28 : node.type === 'server' ? 24 : 18
  let side = 'right'
  let left = sx + r + 12
  if (left + width > cw.value - 12) {
    side = 'left'
    left = sx - r - 12 - width
  }
  const estH = node.type === 'server' ? 250 : node.type === 'cluster' ? 40 + node.members.length * 48 : 160
  const top = Math.min(Math.max(sy - 36, 12), Math.max(12, ch.value - estH - 12))
  return {
    node,
    style: {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      transformOrigin: side === 'right' ? 'left 44px' : 'right 44px',
      '--smc-dx': side === 'right' ? '-6px' : '6px',
    },
  }
})

function clickNode(n) {
  if (suppressClick) return
  if (n.type === 'server') emit('open', n.pin.id)
  else if (n.type === 'plus') emit('new-server', { providerId: n.targets[0].provider.id, regionId: n.targets[0].regionId })
  else {
    // A cluster focuses the map on itself, zooming to the stack level. The
    // page narrows the list to this spot if the panel happens to be open.
    focusOn(n)
    const sameRegion = n.members.every((m) => m.region.id === n.members[0].region.id)
    emit('cluster-open', {
      ids: n.members.map((m) => m.id),
      label: sameRegion ? n.members[0].region.name : n.title,
    })
  }
}

function statusVar(status) {
  if (status === 'broken') return 'var(--ink-red-7)'
  if (status === 'suspended' || status === 'provisioning') return 'var(--ink-amber-7)'
  return 'var(--ink-green-7)'
}
</script>

<style scoped>
/* The map layer and every node share one curve, so pins track the dots
   through the whole zoom. Transitions only arm after the first layout (the
   map must appear in place, not animate in); dragging and pinching switch
   back to direct updates. */
.sm-pos {
  will-change: transform;
}
.sm-anim .sm-pos {
  transition: transform 450ms cubic-bezier(0.77, 0, 0.175, 1);
}
.sm-drag .sm-pos {
  transition: none;
}
.sm-center {
  transform: translate(-50%, -50%);
  transition: transform 250ms cubic-bezier(0.23, 1, 0.32, 1), opacity 200ms ease-out;
}

/* Recluster: merged/split nodes scale in from something, never from nothing. */
.smn-enter-from .sm-center {
  transform: translate(-50%, -50%) scale(0.6);
  opacity: 0;
}
.smn-leave-active {
  transition: opacity 140ms ease-in;
}
.smn-leave-to {
  opacity: 0;
}

/* Hover card: origin-aware scale from the node's side; exit is faster. */
.smc-enter-active {
  transition: opacity 150ms cubic-bezier(0.23, 1, 0.32, 1), transform 150ms cubic-bezier(0.23, 1, 0.32, 1);
}
.smc-enter-from {
  opacity: 0;
  transform: translate(var(--smc-dx, 0px), var(--smc-dy, 0px)) scale(0.97);
}
.smc-leave-active {
  transition: opacity 100ms ease-in;
}
.smc-leave-to {
  opacity: 0;
}

.sm-controls {
  transition: transform 300ms cubic-bezier(0.32, 0.72, 0, 1);
}

.sm-pulse {
  animation: sm-pulse 1.8s ease-in-out infinite;
}
@keyframes sm-pulse {
  0%,
  100% {
    opacity: 0.28;
  }
  50% {
    opacity: 0.08;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sm-pos,
  .sm-center,
  .sm-controls {
    transition: none;
  }
  .sm-pulse {
    animation: none;
    opacity: 0.2;
  }
}
</style>

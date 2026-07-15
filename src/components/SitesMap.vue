<template>
  <!-- overflow-clip (not -hidden): the scaled map layer overflows the frame,
       and a hidden-overflow box can still be scrolled by focus movement —
       clip forbids scrolling entirely. -->
  <div ref="el" class="relative isolate h-full w-full select-none overflow-clip bg-surface-base">
    <!-- Everything map-anchored rides one settle wrapper: the page lands
         mid-zoom (0.94 → 1 about the server), finishing the move the user
         started by clicking the server in Central. Chrome (pills/panel)
         stays outside so it holds still. -->
    <div class="ssm-settle h-full w-full" :class="ready && 'ssm-in'" :style="settleStyle">
      <!-- Dotted world, fixed framing centred on the server's region. Same
           asset as Central's map so both stages share one texture. -->
      <div class="absolute left-0 top-0 origin-top-left" :style="mapStyle">
        <WorldDots class="block text-ink-gray-2" :style="{ width: `${W}px`, height: `${H}px` }" />
      </div>

      <template v-if="ready">
        <!-- Connections. Every line fades out toward the hub so the spokes
             don't pile up on the server mark; cards end in a terminal dot. -->
        <svg class="pointer-events-none absolute inset-0 h-full w-full">
          <defs>
            <linearGradient
              v-for="l in lines"
              :id="l.gradId"
              :key="l.gradId"
              gradientUnits="userSpaceOnUse"
              :x1="l.S.x" :y1="l.S.y" :x2="l.E.x" :y2="l.E.y"
            >
              <stop offset="0" stop-color="var(--ink-gray-5)" stop-opacity="0" />
              <stop offset="0.3" stop-color="var(--ink-gray-5)" stop-opacity="0.6" />
              <stop offset="1" stop-color="var(--ink-gray-5)" stop-opacity="0.75" />
            </linearGradient>
            <mask v-for="l in lines" :id="l.maskId" :key="l.maskId">
              <path
                :d="l.d"
                pathLength="100"
                fill="none"
                stroke="#fff"
                stroke-width="8"
                stroke-dasharray="100"
                class="ssm-reveal"
                :style="{ animationDelay: `${l.delay}ms` }"
              />
            </mask>
          </defs>
          <g>
            <path
              v-for="l in lines"
              :key="l.id"
              :d="l.d"
              fill="none"
              :stroke="`url(#${l.gradId})`"
              stroke-width="1.5"
              stroke-dasharray="6 5"
              stroke-linecap="round"
              :mask="`url(#${l.maskId})`"
            />
            <circle
              v-for="l in lines"
              :key="`${l.id}-dot`"
              :cx="l.E.x" :cy="l.E.y" r="2.25"
              fill="var(--ink-gray-5)" opacity="0.8"
              :mask="`url(#${l.maskId})`"
            />
          </g>
        </svg>

        <!-- Server mark + region pill -->
        <div class="absolute z-20" :style="{ left: `${serverPt.x}px`, top: `${serverPt.y}px` }">
          <div class="flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
            <span class="relative block">
              <span v-if="server.status === 'broken'" class="ssm-pulse absolute -inset-1.5 rounded-full" style="background: var(--ink-red-7)" />
              <ProviderAvatar :provider="prov" :size="40" />
              <span class="absolute bottom-0 right-0 size-3 rounded-full border-2 border-[var(--surface-base)]" :style="{ background: statusVar(server.status) }" />
            </span>
            <Badge size="md" variant="outline" theme="gray" :label="`${region.flag} ${region.name}`" class="mt-2 whitespace-nowrap bg-surface-elevation-1 shadow-sm" />
          </div>
        </div>

        <!-- Site cards, one per slot -->
        <div
          v-for="(c, i) in cards"
          :key="c.site.id"
          class="ssm-land absolute z-10"
          :style="{ left: `${c.x - CARD_W / 2}px`, top: `${c.y - CARD_H / 2}px`, animationDelay: `${260 + i * 70}ms` }"
        >
          <div
            role="button"
            tabindex="0"
            class="flex cursor-pointer items-center gap-2 rounded-xl border bg-surface-elevation-1 py-2 pl-2 pr-3 shadow-sm transition-[box-shadow,border-color] duration-150 ease-out hover:border-outline-gray-3 hover:shadow-md"
            :style="{ width: `${CARD_W}px` }"
            :class="highlightId === c.site.id ? 'border-outline-gray-4 shadow-md' : 'border-outline-gray-2'"
            @click="goSite(c.site)"
            @keydown.enter="goSite(c.site)"
          >
            <span class="relative shrink-0">
              <SiteIcon size="md" />
              <span class="absolute -bottom-px -right-px flex size-2.5">
                <span v-if="c.site.status === 'broken'" class="ssm-pulse absolute -inset-1 rounded-full" style="background: var(--ink-red-7)" />
                <span class="relative size-2.5 rounded-full border-2 border-[var(--surface-elevation-1)]" :style="{ background: siteStatusVar(c.site) }" />
              </span>
            </span>
            <span class="min-w-0 flex-1 truncate text-sm font-medium text-ink-gray-8">{{ c.site.name }}</span>
            <Dropdown :options="siteOptions(c.site)" placement="bottom-end">
              <button class="grid size-6 shrink-0 place-items-center rounded text-ink-gray-5 hover:bg-surface-gray-3 hover:text-ink-gray-7" :aria-label="`Actions for ${c.site.name}`" @click.stop>
                <span class="lucide-ellipsis size-4" />
              </button>
            </Dropdown>
          </div>
        </div>

        <!-- Overflow: the sites beyond the five slots live in the panel -->
        <div
          v-if="extraCount > 0"
          class="ssm-land absolute z-10"
          :style="{ left: `${morePt.x - MORE_W / 2}px`, top: `${morePt.y - 18}px`, animationDelay: `${260 + cards.length * 70}ms` }"
        >
          <button
            class="flex items-center gap-2 rounded-xl border border-dashed border-outline-gray-3 bg-surface-elevation-1/70 px-3 py-1.5 text-sm font-medium text-ink-gray-6 shadow-sm transition-[box-shadow,color] duration-150 ease-out hover:text-ink-gray-8 hover:shadow-md"
            :style="{ width: `${MORE_W}px` }"
            @click="panelOpen = true"
          >
            <span class="min-w-0 flex-1 truncate text-left">+{{ extraCount }} more</span>
            <span class="lucide-arrow-up-right size-3.5 shrink-0" />
          </button>
        </div>

      </template>
    </div>

    <!-- All sites — pill that expands into the full-height floating list -->
    <div class="pointer-events-none absolute bottom-4 left-4 top-4 z-30">
      <Transition name="ssm-panel">
        <div
          v-if="panelOpen"
          class="pointer-events-auto flex h-full w-[24rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-outline-gray-1 bg-surface-elevation-1 shadow-xl"
          :style="{ transformOrigin: 'top left' }"
        >
          <div class="flex items-center justify-between px-4 pb-2 pt-3.5">
            <div class="text-base font-semibold text-ink-gray-9">
              All sites <span class="font-normal text-ink-gray-5">({{ sites.length }})</span>
            </div>
            <button class="grid size-7 place-items-center rounded text-ink-gray-5 hover:bg-surface-gray-3 hover:text-ink-gray-7" aria-label="Collapse site list" @click="panelOpen = false">
              <span class="lucide-minimize-2 size-4" />
            </button>
          </div>
          <div class="shrink-0 px-4 pb-3">
            <FormControl v-model="q" type="text" placeholder="Search" autocomplete="off" class="[&_input]:w-full">
              <template #prefix><span class="lucide-search size-4 text-ink-gray-5" /></template>
            </FormControl>
          </div>
          <div class="min-h-0 flex-1 divide-y divide-outline-alpha-gray-1 overflow-y-auto border-t border-outline-alpha-gray-1 px-2 pb-2">
            <p v-if="!panelSites.length" class="px-2.5 py-3 text-sm text-ink-gray-5">No sites match.</p>
            <div
              v-for="site in panelSites"
              :key="site.id"
              role="button"
              tabindex="0"
              class="group flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-3 text-left transition-colors hover:bg-surface-gray-2"
              @click="goSite(site)"
              @keydown.enter="goSite(site)"
              @mouseenter="highlightId = site.id"
              @mouseleave="highlightId = null"
            >
              <span class="relative shrink-0">
                <SiteIcon size="md" />
                <span class="absolute -bottom-px -right-px size-2.5 rounded-full border-2 border-[var(--surface-elevation-1)]" :style="{ background: siteStatusVar(site) }" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="flex items-center gap-1.5">
                  <span class="truncate text-sm font-medium text-ink-gray-9">{{ site.name }}</span>
                  <Badge v-if="site.status !== 'live'" :theme="statusTheme(site)" variant="subtle" size="sm" :label="statusLabel(site)" class="shrink-0" />
                </span>
                <span class="mt-1 block truncate text-sm text-ink-gray-5">{{ subLine(site) }}</span>
              </span>
              <span @click.stop>
                <Dropdown :options="siteOptions(site)" placement="bottom-end">
                  <button class="grid size-6 shrink-0 place-items-center rounded text-ink-gray-5 hover:bg-surface-gray-3 hover:text-ink-gray-7" :aria-label="`Actions for ${site.name}`" @click.stop>
                    <span class="lucide-ellipsis size-4" />
                  </button>
                </Dropdown>
              </span>
            </div>
          </div>
        </div>
        <button
          v-else
          class="pointer-events-auto flex h-9 items-center gap-2 rounded-lg border border-outline-gray-2 bg-surface-elevation-1 px-3 shadow-sm transition-shadow hover:shadow-md"
          @click="panelOpen = true"
        >
          <span class="text-sm font-semibold text-ink-gray-9">All sites</span>
          <span class="text-sm text-ink-gray-5">({{ sites.length }})</span>
          <span class="lucide-maximize-2 size-3.5 text-ink-gray-5" />
        </button>
      </Transition>
    </div>

    <!-- Server — pill that expands into the compact detail card -->
    <div ref="serverBox" class="absolute right-4 top-4 z-30">
      <Transition name="ssm-pill">
        <div
          v-if="serverOpen"
          class="w-80 rounded-xl border border-outline-gray-1 bg-surface-elevation-1 p-4 shadow-xl"
          :style="{ transformOrigin: 'top right' }"
        >
          <div class="flex items-center gap-2.5">
            <ProviderAvatar :provider="prov" :size="32" />
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="truncate text-base font-semibold text-ink-gray-9">{{ server.name }}</span>
                <Badge :theme="serverBadge.theme" variant="subtle" size="sm" :label="serverBadge.label" class="shrink-0" />
              </div>
            </div>
            <button class="grid size-7 shrink-0 place-items-center rounded text-ink-gray-5 hover:bg-surface-gray-3 hover:text-ink-gray-7" aria-label="Collapse server details" @click="serverOpen = false">
              <span class="lucide-chevron-up size-4" />
            </button>
          </div>
          <dl class="mt-3 space-y-1.5 text-sm">
            <div class="grid grid-cols-[6rem_1fr] gap-2">
              <dt class="text-ink-gray-5 text-p-sm">Region</dt>
              <dd class="truncate text-ink-gray-8 text-p-sm">{{ region.flag }} {{ region.name }}</dd>
            </div>
            <div class="grid grid-cols-[6rem_1fr] gap-2">
              <dt class="text-ink-gray-5 text-p-sm">Version</dt>
              <dd class="text-ink-gray-8 text-p-sm">{{ server.version }}</dd>
            </div>
            <div class="grid grid-cols-[6rem_1fr] gap-2">
              <dt class="text-ink-gray-5 text-p-sm">Plan</dt>
              <dd class="text-ink-gray-8 text-p-sm">
                {{ plan.name }} <span class="text-ink-gray-5">· {{ inr(monthlyPrice) }}/mo</span>
              </dd>
            </div>
            <div class="grid grid-cols-[6rem_1fr] gap-2">
              <dt class="text-ink-gray-5 text-p-sm">Compute</dt>
              <dd class="tabular-nums text-ink-gray-8 text-p-sm">{{ spec.vcpu }} vCPU · {{ spec.memory }} GB · {{ spec.disk }} GB</dd>
            </div>
            <div class="grid grid-cols-[6rem_1fr] gap-2">
              <dt class="text-ink-gray-5 text-p-sm">Inbound IP</dt>
              <dd class="tabular-nums text-ink-gray-8 text-p-sm">{{ server.inboundIp }}</dd>
            </div>
          </dl>
          <div class="mt-3 flex items-center gap-1.5">
            <Button variant="subtle" size="sm" label="Change version" class="flex-1" @click="versionOpen = true" />
            <ServerActions :server="server" />
          </div>
        </div>
        <button
          v-else
          class="flex h-9 items-center gap-2 rounded-lg border border-outline-gray-2 bg-surface-elevation-1 pl-2 pr-3 shadow-sm transition-shadow hover:shadow-md"
          @click="serverOpen = true"
        >
          <ProviderAvatar :provider="prov" :size="18" />
          <span class="text-sm font-semibold text-ink-gray-9">{{ server.name }}</span>
          <span class="lucide-chevron-down size-3.5 text-ink-gray-5" />
        </button>
      </Transition>
    </div>

    <!-- No sites yet: the invitation floats just below the server mark (clearing
         the avatar + region badge) so it never covers the pin. -->
    <div
      v-if="ready && !sites.length"
      class="pointer-events-none absolute z-20 -translate-x-1/2"
      :style="{ left: `${serverPt.x}px`, top: `${serverPt.y + 64}px` }"
    >
      <div class="pointer-events-auto rounded-xl border border-outline-gray-1 bg-surface-elevation-1 px-8 py-6 text-center shadow-xl">
        <div class="text-base font-semibold text-ink-gray-9">No sites on this server yet</div>
        <div class="mt-1 text-sm text-ink-gray-5">Create your first site.</div>
        <Button
          v-if="server.status === 'active'"
          class="mt-4"
          variant="solid"
          size="sm"
          label="New site"
          icon-left="lucide-plus"
          @click="emit('new-site')"
        />
      </div>
    </div>

    <ChangeVersionDialog v-model:open="versionOpen" :server="server" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Badge, Button, Dropdown, FormControl, toast } from 'frappe-ui'
import ChangeVersionDialog from './ChangeVersionDialog.vue'
import ProviderAvatar from './ProviderAvatar.vue'
import ServerActions from './ServerActions.vue'
import SiteIcon from './SiteIcon.vue'
import WorldDots from './WorldDots.vue'
import { providerById } from '../data/catalog'
import { useCloudStore } from '../stores/cloud'
import { inr, timeAgo } from '../utils/format'

const props = defineProps({
  server: { type: Object, required: true },
})
const emit = defineEmits(['new-site'])

const store = useCloudStore()
const router = useRouter()

const region = computed(() => store.regionOf(props.server))
const prov = computed(() => providerById(region.value.providerId))
const plan = computed(() => store.planOf(props.server))
const spec = computed(() => props.server.customSpec || plan.value.specs)
const monthlyPrice = computed(() => store.monthlyPriceOf(props.server))
const sites = computed(() => props.server.sites)

// — Framing: contain-fit the world, then hold a fixed zoom centred on the
//   server's region. No pan, no wheel — this map is a stage, not a viewport.
//   Same equirectangular projection as WorldMap/ServerMap; REGIONS lat/lng is
//   the source of truth (the catalog x/y belong to an older frame).
const W = 879
const H = 443
const LAT_TOP = 83
const LAT_BOTTOM = -56
const ZOOM = 1.9
const FX = 0.5
const FY = 0.44

const regionPt = computed(() => ({
  x: ((region.value.lng + 180) / 360) * W,
  y: ((LAT_TOP - region.value.lat) / (LAT_TOP - LAT_BOTTOM)) * H,
}))

const el = ref(null)
const cw = ref(0)
const ch = ref(0)
const base = computed(() => (cw.value && ch.value ? Math.min(cw.value / W, ch.value / H) : 0))
const k = computed(() => base.value * ZOOM)

const frame = computed(() => {
  if (!k.value) return { tx: 0, ty: 0 }
  let tx = cw.value * FX - regionPt.value.x * k.value
  let ty = ch.value * FY - regionPt.value.y * k.value
  tx = Math.min(0, Math.max(cw.value - W * k.value, tx))
  ty = Math.min(0, Math.max(ch.value - H * k.value, ty))
  return { tx, ty }
})
const mapStyle = computed(() => ({
  transform: `translate3d(${frame.value.tx}px, ${frame.value.ty}px, 0) scale(${k.value})`,
}))
const serverPt = computed(() => ({
  x: frame.value.tx + regionPt.value.x * k.value,
  y: frame.value.ty + regionPt.value.y * k.value,
}))
// The arrival settle scales about the server, so the landing finishes the
// zoom the user started from Central's map.
const settleStyle = computed(() => ({ transformOrigin: `${serverPt.value.x}px ${serverPt.value.y}px` }))

// Entrance choreography only arms after the first layout lands.
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
  document.addEventListener('pointerdown', onStagePointerDown, true)
})
onBeforeUnmount(() => {
  ro?.disconnect()
  document.removeEventListener('pointerdown', onStagePointerDown, true)
})

// — Slots: five fixed positions fanned around the server, biased away from
//   the corners the pills own. Angular spread (fix D): every occupied slot —
//   including the overflow card — owns its own ~35°+ sector with varied radii,
//   so no two lines ever share a corridor and the hub can't read as an
//   octopus. Scaled down gently on small viewports and clamped inside the
//   frame so nothing hides under the chrome.
const CARD_W = 236
const CARD_H = 48 // py-2 (16) + 32px SiteIcon tile; drives card offset + line landing
const MORE_W = 128
const SLOTS = [
  [-290, -88],
  [189, -128],
  [-289, 98],
  [318, -8],
  [-4, 198],
]
const MORE_AT = [244, 148]

const slotScale = computed(() => Math.min(Math.max(Math.min(cw.value / 1150, ch.value / 720), 0.7), 1.1))

function slotPoint([dx, dy]) {
  const s = slotScale.value
  const x = Math.min(Math.max(serverPt.value.x + dx * s, CARD_W / 2 + 16), cw.value - CARD_W / 2 - 16)
  const y = Math.min(Math.max(serverPt.value.y + dy * s, 84), ch.value - 44)
  return { x, y }
}

// Sites that need eyes come first, so they never fall into the overflow.
const ATTENTION = { broken: 0, suspended: 1, creating: 2, restoring: 2, moving: 2, live: 3 }
const ordered = computed(() =>
  [...sites.value].sort((a, b) => (ATTENTION[a.status] ?? 3) - (ATTENTION[b.status] ?? 3) || a.name.localeCompare(b.name)),
)
const cards = computed(() => ordered.value.slice(0, SLOTS.length).map((site, i) => ({ site, ...slotPoint(SLOTS[i]) })))
const extraCount = computed(() => Math.max(0, ordered.value.length - SLOTS.length))
const morePt = computed(() => slotPoint(MORE_AT))

// — Connections: cubic routes that leave the server radially and land on the
//   card's nearest edge. The pull is gentle (0.18) — deep uniform curls made
//   the hub read as an octopus — and cards mostly above/below the server are
//   entered through their top/bottom edge instead of looping to a side.
function cubicTo(E) {
  const S0 = serverPt.value
  const dx = E.x - S0.x
  const dy = E.y - S0.y
  const dist0 = Math.hypot(dx, dy) || 1
  const S = { x: S0.x + (dx / dist0) * 26, y: S0.y + (dy / dist0) * 26 }
  const d = Math.hypot(E.x - S.x, E.y - S.y)
  const pull = d * 0.18
  const c1 = { x: S.x + (dx / dist0) * pull, y: S.y + (dy / dist0) * pull }
  const c2 = E.axis === 'v'
    ? { x: E.x, y: E.y + Math.sign(S0.y - E.y) * pull }
    : { x: E.x + Math.sign(S0.x - E.x) * pull, y: E.y }
  return { d: `M ${S.x} ${S.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${E.x} ${E.y}`, S, E }
}

// Lines land ON the card edge — the terminal dot plugs into the pill rather
// than hovering short of it.
function edgePoint(center, halfW, halfH) {
  const dx = center.x - serverPt.value.x
  const dy = center.y - serverPt.value.y
  if (Math.abs(dy) > Math.abs(dx)) {
    return { x: center.x, y: center.y - Math.sign(dy) * halfH, axis: 'v' }
  }
  return { x: center.x - Math.sign(dx) * halfW, y: center.y, axis: 'h' }
}

const lines = computed(() => {
  const out = cards.value.map((c, i) => ({
    id: `site-${c.site.id}`,
    kind: 'site',
    delay: 80 + i * 70,
    ...cubicTo(edgePoint(c, CARD_W / 2, CARD_H / 2)),
  }))
  if (extraCount.value > 0) {
    out.push({
      id: 'more',
      kind: 'more',
      delay: 80 + out.length * 70,
      ...cubicTo(edgePoint(morePt.value, MORE_W / 2, 17)),
    })
  }
  // Ids keyed by the line's identity (not index), so a site created later
  // draws its own line in without re-triggering everyone else's reveal.
  return out.map((l) => ({ ...l, gradId: `ssm-g-${l.id}`, maskId: `ssm-m-${l.id}` }))
})

// — Chrome state
const panelOpen = ref(false)
const serverOpen = ref(false)
const versionOpen = ref(false)
const highlightId = ref(null)
const q = ref('')

// The server card closes on outside click — it's a glance, not a workspace.
// (The sites panel deliberately does NOT: it stays until dismissed.) Menus and
// dialogs the card spawns portal to <body>, so clicks inside them must not
// count as outside.
const serverBox = ref(null)
function onStagePointerDown(e) {
  if (!serverOpen.value || versionOpen.value) return
  if (serverBox.value?.contains(e.target)) return
  if (e.target.closest?.('[role="menu"], [role="dialog"], [data-reka-popper-content-wrapper]')) return
  serverOpen.value = false
}

const panelSites = computed(() => {
  const term = q.value.trim().toLowerCase()
  return ordered.value.filter((s) => !term || s.name.toLowerCase().includes(term))
})

const serverBadge = computed(() => {
  const s = props.server.status
  if (s === 'broken') return { theme: 'red', label: 'Broken' }
  if (s === 'suspended') return { theme: 'orange', label: 'Suspended' }
  if (s === 'provisioning') return { theme: 'orange', label: 'Setting up…' }
  return { theme: 'green', label: 'Active' }
})

function statusVar(status) {
  if (status === 'broken') return 'var(--ink-red-7)'
  if (status === 'suspended' || status === 'provisioning') return 'var(--ink-amber-7)'
  return 'var(--ink-green-7)'
}
function siteStatusVar(site) {
  if (site.status === 'broken') return 'var(--ink-red-7)'
  if (site.status === 'live') return 'var(--ink-green-7)'
  return 'var(--ink-amber-7)'
}
function statusLabel(site) {
  return { live: 'Active', broken: 'Broken', creating: 'Setting up…', restoring: 'Restoring…', moving: 'Moving…', suspended: 'Paused' }[site.status] || site.status
}
function appsLabel(site) {
  const n = site.apps?.length ?? 0
  return n === 1 ? '1 app' : `${n} apps`
}
// Row subtext mirrors SiteCard: apps count, plus backup recency when there is
// one. Lives on its own line so the status badge has room on the line above.
function subLine(site) {
  const backup = store.lastBackupOf(site)
  return backup ? `${appsLabel(site)} · backed up ${timeAgo(backup.at)}` : appsLabel(site)
}
function statusTheme(site) {
  if (site.status === 'live') return 'green'
  if (site.status === 'broken') return 'red'
  return 'orange'
}
function goSite(site) {
  router.push(`/manage/${props.server.id}/sites/${site.id}`)
}
function siteOptions(site) {
  return [
    { label: 'Open site', icon: 'lucide-arrow-up-right', onClick: () => { store.openSite(site.id); router.push('/app') } },
    {
      label: 'Backup now',
      icon: 'lucide-archive',
      onClick: () => toast.promise(store.backupNow(site.id), { loading: 'Backing up…', success: 'Backed up just now', error: 'Backup failed' }),
    },
  ]
}
</script>

<style scoped>
/* Arrival: land mid-zoom and settle, on the same curve the Central map moves
   with. Held at opacity 0 until the first layout so nothing flashes unframed. */
.ssm-settle {
  opacity: 0;
}
.ssm-in {
  animation: ssm-settle 450ms cubic-bezier(0.77, 0, 0.175, 1) forwards;
}
@keyframes ssm-settle {
  from {
    opacity: 1;
    transform: scale(0.94);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* Lines draw out from the server; each card lands as its line arrives. */
.ssm-reveal {
  stroke-dashoffset: 100;
  animation: ssm-draw 420ms cubic-bezier(0.23, 1, 0.32, 1) forwards;
}
@keyframes ssm-draw {
  to {
    stroke-dashoffset: 0;
  }
}
.ssm-land {
  opacity: 0;
  animation: ssm-land 240ms cubic-bezier(0.23, 1, 0.32, 1) forwards;
}
@keyframes ssm-land {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* Pill ⇄ card: origin-aware scale from the corner each one lives in. */
.ssm-panel-enter-active,
.ssm-pill-enter-active {
  transition: opacity 200ms cubic-bezier(0.23, 1, 0.32, 1), transform 200ms cubic-bezier(0.23, 1, 0.32, 1);
}
.ssm-panel-leave-active,
.ssm-pill-leave-active {
  transition: opacity 120ms ease-in;
  position: absolute;
}
.ssm-pill-leave-active {
  right: 0;
}
.ssm-panel-leave-active {
  left: 0;
}
.ssm-panel-enter-from,
.ssm-pill-enter-from {
  opacity: 0;
  transform: scale(0.97);
}
.ssm-panel-leave-to,
.ssm-pill-leave-to {
  opacity: 0;
}

.ssm-pulse {
  animation: ssm-pulse 1.8s ease-in-out infinite;
}
@keyframes ssm-pulse {
  0%,
  100% {
    opacity: 0.28;
  }
  50% {
    opacity: 0.08;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ssm-in,
  .ssm-reveal,
  .ssm-land {
    animation: none;
  }
  .ssm-in {
    opacity: 1;
  }
  .ssm-reveal {
    stroke-dashoffset: 0;
  }
  .ssm-land {
    opacity: 1;
  }
  .ssm-pulse {
    animation: none;
    opacity: 0.2;
  }
  .ssm-panel-enter-active,
  .ssm-pill-enter-active,
  .ssm-panel-leave-active,
  .ssm-pill-leave-active {
    transition: opacity 100ms ease;
  }
}
</style>

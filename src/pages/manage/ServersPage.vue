<template>
  <CentralShell :crumbs="[{ label: 'Servers', route: '/servers' }]" wide>
    <template #actions>
      <Button variant="solid" size="sm" label="New server" icon-left="lucide-plus" @click="$router.push('/servers/new')" />
    </template>

    <!-- The map is the page. Everything else floats above it. -->
    <div class="relative h-full overflow-hidden">
      <ServerMap
        class="absolute inset-0"
        :pins="pins"
        :spots="spots"
        :highlight-id="hoverId"
        @open="openServer"
        @new-server="goNewServer"
        @cluster-open="onClusterOpen"
      />

      <!-- Graduation note (decision 9): a calm, one-time greeting the first time
           Central becomes home, right after a 2nd server is created. -->
      <Alert
        v-if="store.graduationNotice"
        theme="blue"
        title="You've got two servers now"
        :action="{ label: 'Got it', onClick: () => store.dismissGraduationNotice() }"
        class="absolute left-1/2 top-4 w-[34rem] max-w-[calc(100%-2rem)] -translate-x-1/2 shadow-md"
      >
        <template #description>This is your home for managing them. Your bill now combines both servers into one — nothing else changed.</template>
      </Alert>

      <!-- Filters (top right). Nothing the page floats over the map carries a
           z-index: DOM order already stacks it above the (isolated) map, and a
           positive z here would escape to the root context and paint over the
           dropdown menus these very buttons open, which teleport to <body>. -->
      <div class="absolute right-4 top-4 flex items-center gap-2">
        <Dropdown :options="statusMenu" placement="bottom-end">
          <button class="sp-pill">
            <span class="size-2 rounded-full transition-colors" :style="{ background: statusDot }" />
            {{ statusLabelText }}
            <span class="lucide-chevron-down size-3.5 text-ink-gray-5" />
          </button>
        </Dropdown>
        <!-- Cluster = provider → region, drilled through a nested menu. -->
        <Dropdown :options="clusterMenu" placement="bottom-end">
          <button class="sp-pill">
            {{ clusterLabelText }}
            <span class="lucide-chevron-down size-3.5 text-ink-gray-5" />
          </button>
        </Dropdown>
      </div>

      <!-- Servers pill (top left) — the panel grows out of it, so the two
           share a top-left corner and the pill hands off as it opens. -->
      <Transition name="sp-pill-t">
        <button v-if="!panelOpen" class="sp-pill absolute left-4 top-4 !gap-2.5 font-semibold !text-ink-gray-9" @click="panelOpen = true">
          {{ pillLabel }}
          <span class="lucide-maximize-2 size-3.5 text-ink-gray-6" />
        </button>
      </Transition>

      <!-- Server list — a floating card, inset from every edge so the map still
           reads as the page underneath it rather than being cut in half. Its
           top-left corner sits exactly where the pill's was, which is what makes
           the scale-from-origin read as the pill expanding. -->
      <Transition name="sp-panel">
        <aside
          v-if="panelOpen"
          data-server-panel
          class="absolute bottom-4 left-4 top-4 flex w-[24rem] max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-xl border border-outline-gray-2 bg-surface-elevation-1 shadow-xl"
        >
          <div class="flex shrink-0 items-center justify-between gap-2 px-4 pb-2 pt-4">
            <h2 class="text-lg font-semibold text-ink-gray-9">Your servers ({{ filtered.length }})</h2>
            <Button variant="ghost" icon="lucide-minimize-2" aria-label="Collapse list" @click="panelOpen = false" />
          </div>
          <div class="shrink-0 px-4 pb-3">
            <FormControl v-model="q" type="text" placeholder="Search servers or sites" autocomplete="off" class="[&_input]:w-full">
              <template #prefix><span class="lucide-search size-4 text-ink-gray-5" /></template>
            </FormControl>
          </div>

          <!-- Set by clicking a cluster on the map — the rows narrow to that spot. -->
          <div v-if="locationFilter" class="flex shrink-0 items-center justify-between gap-3 px-4 pb-2.5">
            <span class="min-w-0 truncate text-sm text-ink-gray-5">
              Filtering for <span class="font-medium text-ink-gray-8">{{ locationFilter.label }}</span>
            </span>
            <button
              class="flex shrink-0 items-center gap-1.5 text-sm text-ink-gray-6 transition-colors hover:text-ink-gray-8"
              @click="locationFilter = null"
            >
              <span class="lucide-filter size-3.5" />
              Clear
            </button>
          </div>

          <div class="min-h-0 flex-1 divide-y divide-outline-alpha-gray-1 overflow-y-auto border-t border-outline-alpha-gray-1 px-2 pb-2">
            <div
              v-for="(row, i) in panelRows"
              :key="row.srv.id"
              class="sp-row group flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2.5 transition-colors hover:bg-surface-gray-2"
              :style="{ animationDelay: `${Math.min(i * 25, 200)}ms` }"
              @click="openRow(row.srv)"
              @mouseenter="hoverId = row.srv.id"
              @mouseleave="hoverId = null"
            >
              <span class="relative shrink-0">
                <ProviderAvatar :provider="provOf(row.srv)" :size="32" />
                <span class="absolute -bottom-px -right-px size-2.5 rounded-full border-2 border-[var(--surface-elevation-1)]" :style="{ background: dotColor(row.srv) }" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="flex items-center gap-1.5">
                  <span class="truncate text-sm font-medium text-ink-gray-9">{{ row.srv.name }}</span>
                  <Badge v-if="row.srv.status === 'migrating'" theme="blue" variant="subtle" size="sm">
                    <template #prefix><Spinner class="size-3 shrink-0" /></template>
                    Migrating…
                  </Badge>
                  <button v-else-if="row.srv.status === 'migration-scheduled'" type="button" class="cursor-pointer" @click.stop="scheduledServer = row.srv; scheduledModalOpen = true">
                    <Badge label="Scheduled" theme="blue" variant="subtle" size="sm" />
                  </button>
                  <Badge v-else-if="row.srv.status === 'broken'" label="Broken" theme="red" variant="subtle" size="sm" />
                </span>
                <!-- When the row was found by a site name, name that site — that's
                     the answer to "which server is my site on". Otherwise the
                     site count, matching the map's hover card. -->
                <span v-if="row.matchedSite" class="flex items-center gap-1 truncate text-sm text-ink-blue-6">
                  <span class="lucide-corner-down-right size-3.5 shrink-0" />
                  <span class="truncate">{{ row.matchedSite.name }}</span>
                </span>
                <span v-else class="block truncate text-sm text-ink-gray-5">{{ siteCountLabel(row.srv) }}</span>
              </span>
              <span @click.stop>
                <ServerActions :server="row.srv" central />
              </span>
            </div>

            <EmptyState
              v-if="!panelRows.length"
              class="m-4"
              :icon="store.allServers.length ? 'lucide-search' : 'lucide-server'"
              :title="store.allServers.length ? 'No servers match' : 'No servers yet'"
              :description="store.allServers.length ? 'Try a different search or clear the filters.' : 'Create your first server to host your sites.'"
            />
          </div>
        </aside>
      </Transition>

      <!-- First run: nothing deployed yet, so the map is all + spots -->
      <div v-if="!store.allServers.length" class="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center px-4">
        <EmptyState
          class="pointer-events-auto w-[26rem] max-w-full rounded-lg border border-outline-gray-1 bg-surface-elevation-1 p-6 shadow-lg"
          icon="lucide-server"
          title="No servers yet"
          description="Create your first server to host your sites — or pick a spot on the map."
        >
          <Button variant="solid" size="sm" label="New server" icon-left="lucide-plus" @click="router.push('/servers/new')" />
        </EmptyState>
      </div>

      <MigrationScheduledModal v-model:open="scheduledModalOpen" :server="scheduledServer" />
      <MigrationProgressModal v-model:open="progressModalOpen" :server="progressServer" />
    </div>
  </CentralShell>
</template>

<script setup>
import { computed, h, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Badge, Button, Dropdown, FormControl, Spinner } from 'frappe-ui'
import Alert from '../../components/Alert.vue'
import CentralShell from '../../components/CentralShell.vue'
import EmptyState from '../../components/EmptyState.vue'
import MigrationScheduledModal from '../../components/MigrationScheduledModal.vue'
import MigrationProgressModal from '../../components/MigrationProgressModal.vue'
import ProviderAvatar from '../../components/ProviderAvatar.vue'
import ServerActions from '../../components/ServerActions.vue'
import ServerMap from '../../components/ServerMap.vue'
import { PROVIDERS, REGIONS, providerById, regionsOf } from '../../data/catalog'
import { useCloudStore } from '../../stores/cloud'
import { inr } from '../../utils/format'

const store = useCloudStore()
const router = useRouter()

const q = ref('')
const statusFilter = ref('')
const clusterFilter = ref({ providerId: '', regionId: '' })
const hoverId = ref(null)
const panelOpen = ref(false)
const scheduledModalOpen = ref(false)
const scheduledServer = ref(null)
const progressModalOpen = ref(false)
const progressServer = ref(null)

// — Filters. Status and cluster scope the map and the panel; search only
//   narrows the panel rows.
const STATUSES = [
  { label: 'Active', value: 'active', dot: 'var(--ink-green-7)' },
  { label: 'Broken', value: 'broken', dot: 'var(--ink-red-7)' },
  { label: 'Suspended', value: 'suspended', dot: 'var(--ink-amber-7)' },
  { label: 'Setting up', value: 'provisioning', dot: 'var(--ink-amber-7)' },
  { label: 'Migrating', value: 'migrating', dot: 'var(--ink-blue-7)' },
]

const check = () => h('span', { class: 'lucide-check size-4 text-ink-gray-7' })
const statusMenu = computed(() => [
  {
    label: 'All statuses',
    onClick: () => (statusFilter.value = ''),
    slots: { suffix: () => (statusFilter.value === '' ? check() : null) },
  },
  ...STATUSES.map((s) => ({
    label: s.label,
    onClick: () => (statusFilter.value = s.value),
    slots: { suffix: () => (statusFilter.value === s.value ? check() : null) },
  })),
])
const statusLabelText = computed(() => STATUSES.find((s) => s.value === statusFilter.value)?.label || 'Status')
const statusDot = computed(() => STATUSES.find((s) => s.value === statusFilter.value)?.dot || 'var(--ink-gray-4)')

const clusterMenu = computed(() => [
  {
    label: 'All clusters',
    onClick: () => (clusterFilter.value = { providerId: '', regionId: '' }),
    slots: { suffix: () => (!clusterFilter.value.providerId ? check() : null) },
  },
  ...PROVIDERS.map((p) => ({
    label: p.short,
    submenu: [
      {
        label: `All ${p.short} regions`,
        onClick: () => (clusterFilter.value = { providerId: p.id, regionId: '' }),
      },
      ...regionsOf(p.id).map((r) => ({
        label: `${r.flag} ${r.name}`,
        onClick: () => (clusterFilter.value = { providerId: p.id, regionId: r.id }),
      })),
    ],
  })),
])
const clusterLabelText = computed(() => {
  const { providerId, regionId } = clusterFilter.value
  if (!providerId) return 'All clusters'
  const p = providerById(providerId)
  if (!regionId) return `${p.short} clusters`
  return `${p.short} · ${REGIONS.find((r) => r.id === regionId)?.name.split(',')[0]}`
})

const filtered = computed(() =>
  store.allServers.filter((srv) => {
    const region = store.regionOf(srv)
    if (clusterFilter.value.providerId && region.providerId !== clusterFilter.value.providerId) return false
    if (clusterFilter.value.regionId && srv.regionId !== clusterFilter.value.regionId) return false
    if (statusFilter.value && srv.status !== statusFilter.value) return false
    return true
  }),
)

// Clicking a map cluster narrows the panel to that spot ({ ids, label }).
const locationFilter = ref(null)

// Rows are { srv, matchedSite }. A search matches a server directly (name /
// region / provider) or by one of its sites — and a site match resolves to the
// server that hosts it, since from Central you know the site's name, not which
// server it lives on. matchedSite is set only when the row was found that way,
// so the row can name the site instead of the site count.
const panelRows = computed(() => {
  let rows = filtered.value
  if (locationFilter.value) rows = rows.filter((srv) => locationFilter.value.ids.includes(srv.id))
  const term = q.value.trim().toLowerCase()
  if (!term) return rows.map((srv) => ({ srv, matchedSite: null }))
  const out = []
  for (const srv of rows) {
    const region = store.regionOf(srv)
    const serverHit = `${srv.name} ${region.name} ${region.provider}`.toLowerCase().includes(term)
    const matchedSite = srv.sites.find((st) => `${st.subdomain} ${st.name}`.toLowerCase().includes(term))
    if (serverHit) out.push({ srv, matchedSite: null })
    else if (matchedSite) out.push({ srv, matchedSite })
  }
  return out
})

// Unfiltered, the pill names the whole fleet and matches the panel's own title.
// Filtered, it drops to a plain "Servers" — the count is a subset then, and
// claiming it's yours-in-full would be a lie about what you're looking at.
const pillLabel = computed(() =>
  statusFilter.value || clusterFilter.value.providerId
    ? `Servers (${filtered.value.length})`
    : `Your servers (${filtered.value.length})`,
)

// — Map data. Pins carry everything their hover card shows so ServerMap stays
//   purely presentational.
const BADGES = {
  active: { label: 'Active', theme: 'green' },
  provisioning: { label: 'Setting up', theme: 'amber' },
  suspended: { label: 'Suspended', theme: 'amber' },
  broken: { label: 'Broken', theme: 'red' },
  migrating: { label: 'Migrating…', theme: 'blue' },
  'migration-scheduled': { label: 'Scheduled', theme: 'blue' },
}

function fmtGb(g) {
  return g < 1 ? `${Math.round(g * 1024)} MB` : `${g} GB`
}
function provOf(srv) {
  return providerById(store.regionOf(srv).providerId)
}
// On Central, "how many sites is this server carrying" is the useful read — the
// vCPU/RAM/disk numbers still live in the hover card's usage bars. Empty servers
// say so plainly rather than "0 sites".
function siteCountLabel(srv) {
  const n = srv.sites?.length || 0
  if (!n) return 'No sites yet'
  return n === 1 ? '1 site' : `${n} sites`
}
function dotColor(srv) {
  if (srv.status === 'broken') return 'var(--ink-red-7)'
  if (srv.status === 'suspended' || srv.status === 'provisioning') return 'var(--ink-amber-7)'
  return 'var(--ink-green-7)'
}

const pins = computed(() =>
  filtered.value.map((srv) => {
    const region = store.regionOf(srv)
    const specs = store.specsOf(srv)
    const health = store.healthOf(srv)
    return {
      id: srv.id,
      name: srv.name,
      status: srv.status,
      lat: region.lat,
      lng: region.lng,
      server: srv,
      provider: providerById(region.providerId),
      region,
      card: {
        badge: BADGES[srv.status] || BADGES.active,
        sub: siteCountLabel(srv),
        price: inr(store.monthlyPriceOf(srv)),
        metrics: [
          { label: 'vCPU', value: `${health.cpuPct}% of ${specs.vcpu} vCPUs`, pct: health.cpuPct },
          { label: 'Memory', value: `${fmtGb(health.memUsed)} of ${fmtGb(health.memTotal)}`, pct: health.memPct },
          { label: 'Storage', value: `${health.diskUsed} GB of ${health.diskTotal} GB`, pct: health.diskPct },
        ],
      },
    }
  }),
)

// Regions with no servers show as + spots — everywhere you could deploy next.
// The status filter doesn't change what "empty" means, but a cluster filter
// scopes the offer too.
const spots = computed(() => {
  const occupied = new Set(store.allServers.map((srv) => srv.regionId))
  return REGIONS.filter((r) => !occupied.has(r.id))
    .filter((r) => !clusterFilter.value.providerId || r.providerId === clusterFilter.value.providerId)
    .filter((r) => !clusterFilter.value.regionId || r.id === clusterFilter.value.regionId)
    .map((r) => ({ id: r.id, lat: r.lat, lng: r.lng, region: r, provider: providerById(r.providerId) }))
})

// Each server is its own workspace — open it in a new browser tab. A migrating
// server opens its progress modal instead.
function openServer(id) {
  const srv = store.findServer(id)
  if (srv?.status === 'migrating') {
    progressServer.value = srv
    progressModalOpen.value = true
  } else {
    window.open(`/manage/${id}`, '_blank', 'noopener')
  }
}
function openRow(srv) {
  openServer(srv.id)
}
function goNewServer({ providerId, regionId }) {
  router.push({ path: '/servers/new', query: { provider: providerId, region: regionId } })
}
// A cluster only narrows a list that's already showing; the map's "+N" overflow
// chip asks for the list outright, since seeing all of them is the point of it.
function onClusterOpen({ ids, label, open }) {
  if (open) panelOpen.value = true
  if (panelOpen.value) locationFilter.value = { ids, label }
}
// Closing the panel drops the spot filter with it.
watch(panelOpen, (open) => {
  if (!open) locationFilter.value = null
})

// The panel is an overlay, so it dismisses like one: Escape, or a press outside
// it. Two things are deliberately not "outside" — map nodes and the hover card,
// because clicking those is how you drive the list, not how you dismiss it. And
// a press that travels is a map pan, not a click, so it's left alone.
let pressX = 0
let pressY = 0
function onDocPointerDown(e) {
  pressX = e.clientX
  pressY = e.clientY
}
function onDocPointerUp(e) {
  if (!panelOpen.value) return
  if (Math.hypot(e.clientX - pressX, e.clientY - pressY) > 4) return
  const t = e.target
  if (!(t instanceof Element)) return
  if (t.closest('[data-server-panel],[data-map-node],[data-map-card]')) return
  panelOpen.value = false
}
function onKeydown(e) {
  if (e.key === 'Escape' && panelOpen.value) panelOpen.value = false
}
onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown, true)
  document.addEventListener('pointerup', onDocPointerUp, true)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown, true)
  document.removeEventListener('pointerup', onDocPointerUp, true)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.sp-pill {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  height: 2.25rem;
  padding: 0 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid var(--outline-gray-2);
  background: var(--surface-elevation-1);
  box-shadow: var(--shadow-sm, 0 1px 2px rgb(0 0 0 / 0.05));
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--ink-gray-7);
  transition: background-color 150ms ease, transform 150ms cubic-bezier(0.23, 1, 0.32, 1);
}
.sp-pill:hover {
  background: var(--surface-gray-1);
}
.sp-pill:active {
  transform: scale(0.97);
}

/* The panel unfolds from the pill. Both are anchored at left-4/top-4, so scaling
   from that corner grows it out of exactly where the pill was standing. Opacity
   lands well before the shape does — the panel reads as present almost at once,
   while the geometry keeps settling, which is what makes a short duration feel
   quick rather than clipped. */
.sp-panel-enter-active {
  transform-origin: top left;
  transition: opacity 100ms linear, transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
}
.sp-panel-leave-active {
  transform-origin: top left;
  transition: opacity 120ms ease-in, transform 150ms cubic-bezier(0.4, 0, 1, 1);
}
.sp-panel-enter-from,
.sp-panel-leave-to {
  opacity: 0;
  transform: scale(0.94);
}

/* The pill gets out of the way immediately, then comes back only once the panel
   has finished collapsing — so the two are never on screen together. */
.sp-pill-t-enter-active {
  transition: opacity 120ms ease-out 110ms, transform 120ms cubic-bezier(0.23, 1, 0.32, 1) 110ms;
}
.sp-pill-t-leave-active {
  transition: opacity 80ms ease-in;
}
.sp-pill-t-enter-from {
  opacity: 0;
  transform: scale(0.95);
}
.sp-pill-t-leave-to {
  opacity: 0;
}

/* Rows settle in behind the panel's own motion — kept short so the two don't
   compete, and so retyping in the search box doesn't feel busy. */
.sp-row {
  animation: sp-row-in 160ms cubic-bezier(0.23, 1, 0.32, 1) both;
}
@keyframes sp-row-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .sp-panel-enter-active,
  .sp-panel-leave-active,
  .sp-pill-t-enter-active,
  .sp-pill-t-leave-active {
    transition: opacity 150ms ease;
  }
  .sp-panel-enter-from,
  .sp-panel-leave-to {
    transform: none;
    opacity: 0;
  }
  .sp-row {
    animation: none;
  }
}
</style>

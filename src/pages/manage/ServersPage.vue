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
        :panel-offset="panelOffset"
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

      <!-- Filters (top left) -->
      <div class="absolute left-4 top-4 flex items-center gap-2">
        <Dropdown :options="statusMenu" placement="bottom-start">
          <button class="sp-pill">
            <span class="size-2 rounded-full transition-colors" :style="{ background: statusDot }" />
            {{ statusLabelText }}
            <span class="lucide-chevron-down size-3.5 text-ink-gray-5" />
          </button>
        </Dropdown>
        <!-- Cluster = provider → region, drilled through a nested menu. -->
        <Dropdown :options="clusterMenu" placement="bottom-start">
          <button class="sp-pill">
            {{ clusterLabelText }}
            <span class="lucide-chevron-down size-3.5 text-ink-gray-5" />
          </button>
        </Dropdown>
      </div>

      <!-- All servers pill (top right) — expands into the side panel -->
      <Transition name="sp-pill-t">
        <button v-if="!panelOpen" class="sp-pill absolute right-4 top-4 !gap-2.5 font-semibold !text-ink-gray-9" @click="panelOpen = true">
          {{ pillLabel }}
          <span class="lucide-maximize-2 size-3.5 text-ink-gray-6" />
        </button>
      </Transition>

      <!-- Server list — an overlay panel, above the map so the map never reflows -->
      <Transition name="sp-panel">
        <aside
          v-if="panelOpen"
          class="absolute inset-y-0 right-0 flex w-full max-w-[24rem] flex-col border-l border-outline-gray-2 bg-surface-elevation-1 shadow-xl"
        >
          <div class="flex shrink-0 items-center justify-between gap-2 px-4 pb-2 pt-4">
            <h2 class="text-lg font-semibold text-ink-gray-9">Your servers ({{ filtered.length }})</h2>
            <Button variant="ghost" icon="lucide-minimize-2" aria-label="Collapse list" @click="panelOpen = false" />
          </div>
          <div class="shrink-0 px-4 pb-3">
            <FormControl v-model="q" type="text" placeholder="Search" autocomplete="off" class="[&_input]:w-full">
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
              v-for="(srv, i) in panelRows"
              :key="srv.id"
              class="sp-row group flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2.5 transition-colors hover:bg-surface-gray-2"
              :style="{ animationDelay: `${Math.min(i * 25, 200)}ms` }"
              @click="openRow(srv)"
              @mouseenter="hoverId = srv.id"
              @mouseleave="hoverId = null"
            >
              <span class="relative shrink-0">
                <ProviderAvatar :provider="provOf(srv)" :size="32" />
                <span class="absolute -bottom-px -right-px size-2.5 rounded-full border-2 border-[var(--surface-elevation-1)]" :style="{ background: dotColor(srv) }" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="flex items-center gap-1.5">
                  <span class="truncate text-sm font-medium text-ink-gray-9">{{ srv.name }}</span>
                  <Badge v-if="srv.status === 'migrating'" theme="blue" variant="subtle" size="sm">
                    <template #prefix><Spinner class="size-3 shrink-0" /></template>
                    Migrating…
                  </Badge>
                  <button v-else-if="srv.status === 'migration-scheduled'" type="button" class="cursor-pointer" @click.stop="scheduledServer = srv; scheduledModalOpen = true">
                    <Badge label="Scheduled" theme="blue" variant="subtle" size="sm" />
                  </button>
                  <Badge v-else-if="srv.status === 'broken'" label="Broken" theme="red" variant="subtle" size="sm" />
                </span>
                <span class="block truncate text-sm text-ink-gray-5">{{ specLineOf(srv) }}</span>
              </span>
              <span @click.stop>
                <ServerActions :server="srv" central />
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
import { computed, h, ref, watch } from 'vue'
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

const PANEL_W = 384 // w-[24rem] — the zoom controls slide out of its way
const panelOffset = computed(() => (panelOpen.value ? PANEL_W : 0))

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

const panelRows = computed(() => {
  let rows = filtered.value
  if (locationFilter.value) rows = rows.filter((srv) => locationFilter.value.ids.includes(srv.id))
  const term = q.value.trim().toLowerCase()
  if (!term) return rows
  return rows.filter((srv) => {
    const region = store.regionOf(srv)
    return `${srv.name} ${region.name} ${region.provider}`.toLowerCase().includes(term)
  })
})

const pillLabel = computed(() =>
  statusFilter.value || clusterFilter.value.providerId
    ? `Servers (${filtered.value.length})`
    : `All servers (${filtered.value.length})`,
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
function specLineOf(srv) {
  const specs = store.specsOf(srv)
  return `${specs.vcpu} vCPU, ${specs.memory} GB RAM, ${store.healthOf(srv).diskTotal} GB Disk`
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
        specs: specLineOf(srv),
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
// Don't force the list open — only narrow it when it's already showing.
function onClusterOpen({ ids, label }) {
  if (panelOpen.value) locationFilter.value = { ids, label }
}
// Closing the panel drops the spot filter with it.
watch(panelOpen, (open) => {
  if (!open) locationFilter.value = null
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

/* The list panel slides over the map; the pill hands off to it. */
.sp-panel-enter-active {
  transition: transform 300ms cubic-bezier(0.32, 0.72, 0, 1);
}
.sp-panel-leave-active {
  transition: transform 240ms cubic-bezier(0.32, 0.72, 0, 1);
}
.sp-panel-enter-from,
.sp-panel-leave-to {
  transform: translateX(100%);
}

.sp-pill-t-enter-active {
  transition: opacity 150ms ease-out 150ms, transform 150ms cubic-bezier(0.23, 1, 0.32, 1) 150ms;
}
.sp-pill-t-leave-active {
  transition: opacity 100ms ease-in;
}
.sp-pill-t-enter-from {
  opacity: 0;
  transform: scale(0.95);
}
.sp-pill-t-leave-to {
  opacity: 0;
}

/* Rows cascade in as the panel opens — brief, then out of the way. */
.sp-row {
  animation: sp-row-in 250ms cubic-bezier(0.23, 1, 0.32, 1) both;
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

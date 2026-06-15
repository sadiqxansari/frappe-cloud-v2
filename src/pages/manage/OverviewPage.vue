<template>
  <ServerShell v-if="server" :server="server" :crumbs="crumbs" wide>
    <template #actions>
      <Button variant="solid" size="sm" label="New site" icon-left="lucide-plus" @click="newSiteOpen = true" />
    </template>

    <div class="flex h-full">
      <!-- Sites (scrolls) -->
      <div class="min-w-0 flex-1 overflow-y-auto px-6 py-6">
        <div class="mx-auto max-w-4xl">
          <Alert
            v-if="store.creditExpired"
            theme="red"
            title="Your sites are paused — credit ran out"
            :dismissible="false"
            class="mb-5"
          >
            <template #description>Nothing is deleted. Add a card and they're back in seconds, exactly as they were.</template>
            <template #footer><Button variant="solid" size="sm" label="Add a card" @click="addCardOpen = true" /></template>
          </Alert>

          <h2 class="text-base font-semibold text-ink-gray-8">
            Your sites <span class="font-normal text-ink-gray-5">({{ server.sites.length }})</span>
          </h2>

          <!-- Toolbar -->
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <FormControl v-model="q" class="min-w-0 flex-1 [&_input]:w-full" type="text" placeholder="Search" autocomplete="off" />
            <div class="w-32 shrink-0"><FormControl v-model="statusFilter" type="select" :options="statusOptions" /></div>
            <Dropdown :options="sortOptions" placement="bottom-end">
              <Button variant="subtle" size="sm" label="Sort" icon-left="lucide-arrow-up-down" />
            </Dropdown>
            <div class="flex shrink-0 overflow-hidden rounded-lg border border-outline-gray-2">
              <button class="grid size-7 place-items-center" :class="view === 'grid' ? 'bg-surface-gray-3 text-ink-gray-9' : 'text-ink-gray-5 hover:bg-surface-gray-2'" aria-label="Grid view" @click="view = 'grid'">
                <span class="lucide-layout-grid size-4" />
              </button>
              <button class="grid size-7 place-items-center border-l border-outline-gray-2" :class="view === 'list' ? 'bg-surface-gray-3 text-ink-gray-9' : 'text-ink-gray-5 hover:bg-surface-gray-2'" aria-label="List view" @click="view = 'list'">
                <span class="lucide-list size-4" />
              </button>
            </div>
          </div>

          <!-- Empty -->
          <div v-if="!filteredSites.length" class="mt-4 rounded-xl border border-dashed border-outline-gray-2 p-8 text-center">
            <p class="text-sm text-ink-gray-5">{{ q || statusFilter ? 'No sites match.' : 'No sites on this server yet.' }}</p>
            <Button v-if="!q && !statusFilter" variant="subtle" size="sm" label="New site" icon-left="lucide-plus" class="mt-3" @click="newSiteOpen = true" />
          </div>

          <!-- Grid -->
          <div v-else-if="view === 'grid'" class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div
              v-for="site in filteredSites"
              :key="site.id"
              role="button"
              tabindex="0"
              class="cursor-pointer overflow-hidden rounded-xl border border-outline-gray-2 bg-surface-white transition-colors hover:border-outline-gray-3 hover:bg-surface-gray-1"
              @click="goSite(site)"
              @keydown.enter="goSite(site)"
            >
              <div class="p-4">
                <div class="flex items-start justify-between gap-2">
                  <span class="min-w-0 flex-1 truncate font-medium text-ink-gray-9">{{ site.name }}</span>
                  <Dropdown :options="siteOptions(site)" placement="bottom-end">
                    <button class="-mr-1 -mt-1 rounded p-1 text-ink-gray-5 hover:bg-surface-gray-2" :aria-label="`Actions for ${site.name}`" @click.stop><span class="lucide-ellipsis size-4" /></button>
                  </Dropdown>
                </div>
                <div class="mt-1.5 flex items-center gap-1.5 text-sm">
                  <span class="size-1.5 rounded-full" :class="statusDot(site)" />
                  <span class="text-ink-gray-6">{{ statusLabel(site) }}</span>
                </div>
                <div class="mt-3 space-y-1.5 text-sm text-ink-gray-6">
                  <div class="flex items-center gap-2"><span class="lucide-rocket size-4 shrink-0 text-ink-gray-5" />{{ site.apps.length }} {{ site.apps.length === 1 ? 'app' : 'apps' }}</div>
                  <div v-if="hasUpdate(site)" class="flex items-center gap-2">
                    <span class="lucide-layout-grid size-4 shrink-0 text-ink-gray-5" />Updates available
                    
                  </div>
                  <div v-else class="flex items-center gap-2"><span class="lucide-layout-grid size-4 shrink-0 text-ink-gray-5" />{{ versionLabel }}</div>
                </div>
              </div>
              <div class="flex items-center gap-2 border-t border-outline-gray-1 px-4 py-3 text-sm text-ink-gray-6">
                <Avatar :label="store.user.name || 'You'" size="sm" />
                Created {{ timeAgo(site.createdAt) }}
              </div>
            </div>
          </div>

          <!-- List -->
          <div v-else class="mt-4 divide-y divide-outline-gray-1 overflow-hidden rounded-xl border border-outline-gray-2 bg-surface-white">
            <div
              v-for="site in filteredSites"
              :key="site.id"
              role="button"
              tabindex="0"
              class="flex cursor-pointer items-center gap-3 p-3.5 transition-colors hover:bg-surface-gray-1"
              @click="goSite(site)"
              @keydown.enter="goSite(site)"
            >
              <div class="min-w-0 flex-1">
                <div class="truncate font-medium text-ink-gray-9">{{ site.name }}</div>
                <div class="mt-0.5 flex items-center gap-1.5 text-xs">
                  <span class="size-1.5 rounded-full" :class="statusDot(site)" />
                  <span class="text-ink-gray-6">{{ statusLabel(site) }}</span>
                  <span class="text-ink-gray-4">· {{ site.apps.length }} apps · {{ versionLabel }}</span>
                </div>
              </div>
              <span class="hidden shrink-0 text-xs text-ink-gray-5 sm:block">Created {{ timeAgo(site.createdAt) }}</span>
              <Dropdown :options="siteOptions(site)" placement="bottom-end">
                <Button variant="ghost" size="sm" icon="lucide-ellipsis-vertical" :aria-label="`Actions for ${site.name}`" @click.stop />
              </Dropdown>
            </div>
          </div>
        </div>
      </div>

      <!-- Server specs rail — pinned right, full-width sections -->
      <aside class="hidden w-80 shrink-0 overflow-y-auto border-l border-outline-gray-2 xl:block">
        <div class="border-b border-outline-gray-2 p-4">
          <div class="h-32 overflow-hidden rounded-lg border border-outline-gray-2 bg-surface-gray-1">
            <WorldMap :pins="locatorPins" :focus="server.regionId" :pin-scale="3" class="h-full w-full" />
          </div>
          <div class="mt-3 flex min-w-0 items-center gap-2">
            <span class="min-w-0 truncate font-semibold text-ink-gray-9">{{ server.name }}</span>
            <Badge v-if="server.status === 'broken'" theme="red" variant="subtle" label="Broken" class="shrink-0" />
            <Badge v-else-if="server.status === 'suspended'" theme="orange" variant="subtle" label="Suspended" class="shrink-0" />
            <Badge v-else-if="server.status === 'active'" theme="green" variant="subtle" label="Active" class="shrink-0" />
            <Badge v-else theme="orange" variant="subtle" label="Setting up…" class="shrink-0" />
          </div>
          <div class="mt-2 flex items-center gap-1">
            <Button variant="subtle" size="sm" label="Change plan" class="flex-1" @click="resizeOpen = true" />
            <Button variant="subtle" size="sm" label="Change version" class="flex-1" @click="versionOpen = true" />
            <ServerActions :server="server" />
          </div>
        </div>

        <div class="border-b border-outline-gray-2 p-4">
          <div class="text-xs font-medium uppercase tracking-wide text-ink-gray-5">Specifications</div>
          <dl class="mt-2 space-y-1.5 text-sm">
            <div class="grid grid-cols-[7rem_1fr] gap-2">
              <dt class="text-ink-gray-5">Provider</dt>
              <dd class="flex items-center gap-1.5 text-ink-gray-8">
                <span class="grid size-4 shrink-0 place-items-center rounded text-[8px] font-bold leading-none" :class="prov.tile">{{ prov.mono }}</span>
                {{ region.provider }}
              </dd>
            </div>
            <div class="grid grid-cols-[7rem_1fr] gap-2"><dt class="text-ink-gray-5">Region</dt><dd class="truncate text-ink-gray-8">{{ region.name }}</dd></div>
            <div class="grid grid-cols-[7rem_1fr] gap-2"><dt class="text-ink-gray-5">Frappe version</dt><dd class="text-ink-gray-8">{{ versionLabel }}</dd></div>
            <div class="grid grid-cols-[7rem_1fr] gap-2">
              <dt class="flex items-center gap-1 text-ink-gray-5">
                Inbound IP
                <Tooltip text="The address visitors and DNS records point at to reach your sites.">
                  <span class="lucide-info size-3.5 text-ink-gray-4" />
                </Tooltip>
              </dt>
              <dd class="tabular-nums text-ink-gray-8">{{ server.inboundIp }}</dd>
            </div>
            <div class="grid grid-cols-[7rem_1fr] gap-2">
              <dt class="flex items-center gap-1 text-ink-gray-5">
                Outbound IP
                <Tooltip text="The address your server uses when it calls out to other services.">
                  <span class="lucide-info size-3.5 text-ink-gray-4" />
                </Tooltip>
              </dt>
              <dd class="tabular-nums text-ink-gray-8">{{ server.outboundIp }}</dd>
            </div>
          </dl>
        </div>

        <div class="border-b border-outline-gray-2 p-4">
          <div class="flex items-center justify-between">
            <div class="text-xs font-medium uppercase tracking-wide text-ink-gray-5">Plan</div>
            <span class="text-sm font-medium text-ink-gray-8">{{ plan.name }} · {{ inr(monthlyPrice) }}/mo</span>
          </div>
          <div class="mt-3 space-y-3">
            <div v-for="row in usageRows" :key="row.label">
              <div class="flex justify-between text-xs">
                <span class="text-ink-gray-5">{{ row.label }}</span>
                <span class="tabular-nums text-ink-gray-7">{{ row.value }}</span>
              </div>
              <Progress :value="row.pct" size="sm" class="mt-1" />
            </div>
          </div>
        </div>

        <div class="border-b border-outline-gray-2 p-4">
          <div class="text-xs font-medium uppercase tracking-wide text-ink-gray-5">Details</div>
          <dl class="mt-2 space-y-1.5 text-sm">
            <div class="grid grid-cols-[7rem_1fr] gap-2"><dt class="text-ink-gray-5">Created by</dt><dd class="truncate text-ink-gray-8">{{ store.user.name || 'You' }}</dd></div>
            <div class="grid grid-cols-[7rem_1fr] gap-2"><dt class="text-ink-gray-5">Created on</dt><dd class="text-ink-gray-8">{{ fmtDateTime(server.createdAt) }}</dd></div>
            <div class="grid grid-cols-[7rem_1fr] gap-2"><dt class="text-ink-gray-5">Owned by</dt><dd class="truncate text-ink-gray-8">{{ store.user.email || '—' }}</dd></div>
          </dl>
        </div>

        <div class="p-4">
          <div class="flex items-center justify-between">
            <div class="text-xs font-medium uppercase tracking-wide text-ink-gray-5">Tags</div>
            <button class="text-xs text-ink-gray-5 hover:text-ink-gray-7">+ Add</button>
          </div>
          <p class="mt-1.5 text-sm text-ink-gray-4">No tags yet.</p>
        </div>
      </aside>
    </div>

    <ResizeDialog v-model:open="resizeOpen" :server="server" />
    <ChangeVersionDialog v-model:open="versionOpen" :server="server" />
    <AddCardDialog v-model:open="addCardOpen" />
    <NewSiteDialog v-model:open="newSiteOpen" :server="server" />
  </ServerShell>
</template>

<script setup>
import { computed, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Alert, Avatar, Badge, Button, Dropdown, FormControl, Progress, Tooltip, toast } from 'frappe-ui'
import AddCardDialog from '../../components/AddCardDialog.vue'
import ChangeVersionDialog from '../../components/ChangeVersionDialog.vue'
import NewSiteDialog from '../../components/NewSiteDialog.vue'
import WorldMap from '../../components/WorldMap.vue'
import ResizeDialog from '../../components/ResizeDialog.vue'
import ServerActions from '../../components/ServerActions.vue'
import ServerShell from '../../components/ServerShell.vue'
import { providerById, versionById } from '../../data/catalog'
import { useCloudStore } from '../../stores/cloud'
import { fmtDateTime, inr, timeAgo } from '../../utils/format'

const store = useCloudStore()
const route = useRoute()
const router = useRouter()

const server = computed(() => (route.params.serverId ? store.findServer(route.params.serverId) : store.server))
watchEffect(() => {
  if (!server.value) router.replace('/')
})

const base = computed(() => `/manage/${server.value.id}`)
const plan = computed(() => store.planOf(server.value))
const region = computed(() => store.regionOf(server.value))
const prov = computed(() => providerById(region.value.providerId))
const monthlyPrice = computed(() => store.monthlyPriceOf(server.value))
const health = computed(() => store.healthOf(server.value))
const versionLabel = computed(() => versionById(server.value.version).label)

const crumbs = computed(() => [{ label: 'Sites', route: base.value }])

const locatorPins = computed(() => [
  { id: server.value.regionId, lat: region.value.lat, lng: region.value.lng, status: server.value.status, selected: true },
])

const usageRows = computed(() => [
  { label: 'vCPU', value: `${health.value.cpuPct}%`, pct: health.value.cpuPct },
  { label: 'Memory', value: `${health.value.memUsed} of ${health.value.memTotal} GB`, pct: health.value.memPct },
  { label: 'Storage', value: `${health.value.diskUsed} of ${health.value.diskTotal} GB`, pct: health.value.diskPct },
])

// — Sites list controls
const q = ref('')
const statusFilter = ref('')
const view = ref('grid')
const sortBy = ref('name')
const statusOptions = [
  { label: 'Status', value: '' },
  { label: 'Active', value: 'live' },
  { label: 'Paused', value: 'suspended' },
]
const sortOptions = [
  { label: 'Name (A–Z)', icon: 'lucide-arrow-down-a-z', onClick: () => (sortBy.value = 'name') },
  { label: 'Newest first', icon: 'lucide-clock', onClick: () => (sortBy.value = 'newest') },
  { label: 'Oldest first', icon: 'lucide-history', onClick: () => (sortBy.value = 'oldest') },
]

const filteredSites = computed(() => {
  const term = q.value.trim().toLowerCase()
  let out = server.value.sites.filter((s) => {
    if (statusFilter.value && s.status !== statusFilter.value) return false
    if (term && !s.name.toLowerCase().includes(term)) return false
    return true
  })
  out = [...out]
  if (sortBy.value === 'name') out.sort((a, b) => a.name.localeCompare(b.name))
  else if (sortBy.value === 'newest') out.sort((a, b) => b.createdAt - a.createdAt)
  else out.sort((a, b) => a.createdAt - b.createdAt)
  return out
})

function goSite(site) {
  router.push(`${base.value}/sites/${site.id}`)
}
function hasUpdate(site) {
  return site.apps.some((a) => store.appUpdate(a))
}
function statusDot(site) {
  if (site.status === 'suspended') return 'bg-[var(--ink-amber-3)]'
  if (site.status === 'live') return 'bg-[var(--ink-green-3)]'
  return 'bg-[var(--ink-amber-3)]'
}
function statusLabel(site) {
  return { live: 'Active', creating: 'Setting up…', restoring: 'Restoring…', moving: 'Moving…', suspended: 'Paused' }[site.status] || site.status
}
function siteOptions(site) {
  return [
    { label: 'Open site', icon: 'lucide-arrow-up-right', onClick: () => { store.openSite(site.id); router.push('/app') } },
    {
      label: 'Back up now',
      icon: 'lucide-archive',
      onClick: () => toast.promise(store.backupNow(site.id), { loading: 'Backing up…', success: 'Backed up just now', error: 'Backup failed' }),
    },
  ]
}

const resizeOpen = ref(false)
const versionOpen = ref(false)
const addCardOpen = ref(false)
const newSiteOpen = ref(false)
</script>

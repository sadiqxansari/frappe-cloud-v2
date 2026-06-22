<template>
  <ServerShell v-if="server" :server="server" :crumbs="crumbs" wide>
    <template #actions>
      <Button variant="solid" size="sm" label="New site" icon-left="lucide-plus" :disabled="server.status !== 'active'" @click="newSiteOpen = true" />
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

          <!-- Server lifecycle banners. Independent v-if from creditExpired (both can
               be true); the three statuses are mutually exclusive so they chain. -->
          <Alert v-if="server.status === 'suspended'" theme="yellow" title="This server is suspended" :dismissible="false" class="mb-5">
            <template #description>Billing was stopped, so its sites are offline. Resume to bring them back — nothing is deleted.</template>
            <template #footer><Button variant="solid" size="sm" label="Resume server" @click="resumeServer" /></template>
          </Alert>

          <Alert v-else-if="server.status === 'broken'" theme="red" title="This server is unreachable" :dismissible="false" class="mb-5">
            <template #description>We've lost contact with the host and are looking into it. Your data is safe; actions here are paused until it's back.</template>
            <template #footer><Button variant="subtle" size="sm" label="Contact support" icon-left="lucide-life-buoy" @click="contactSupport" /></template>
          </Alert>

          <Alert v-else-if="server.status === 'provisioning'" theme="blue" title="Setting up your server" :dismissible="false" class="mb-5">
            <template #description>This usually takes a couple of minutes. You can add sites as soon as it's ready.</template>
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
            <div class="flex shrink-0 overflow-hidden rounded border border-outline-gray-2">
              <button class="grid size-7 place-items-center" :class="view === 'cards' ? 'bg-surface-gray-3 text-ink-gray-9' : 'text-ink-gray-5 hover:bg-surface-gray-2'" aria-label="Card view" @click="view = 'cards'">
                <span class="lucide-layout-grid size-4" />
              </button>
              <button class="grid size-7 place-items-center border-l border-outline-gray-2" :class="view === 'list' ? 'bg-surface-gray-3 text-ink-gray-9' : 'text-ink-gray-5 hover:bg-surface-gray-2'" aria-label="List view" @click="view = 'list'">
                <span class="lucide-list size-4" />
              </button>
            </div>
          </div>

          <!-- Empty -->
          <EmptyState
            v-if="!filteredSites.length"
            class="mt-4"
            :icon="q || statusFilter ? 'lucide-search' : 'lucide-layout-grid'"
            :title="q || statusFilter ? 'No sites match' : 'No sites on this server yet'"
            :description="q || statusFilter ? 'Try a different search or clear the filter.' : 'Create your first site to get started.'"
          >
            <Button v-if="!q && !statusFilter && server.status === 'active'" variant="solid" size="sm" label="New site" icon-left="lucide-plus" @click="newSiteOpen = true" />
          </EmptyState>

          <!-- Cards — operational: status + a compact facts line. Two per row. -->
          <div v-else-if="view === 'cards'" class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div
              v-for="site in filteredSites"
              :key="site.id"
              role="button"
              tabindex="0"
              class="cursor-pointer rounded-xl border border-outline-gray-2 bg-surface-white p-4 transition-colors hover:border-outline-gray-3 hover:bg-surface-gray-1"
              @click="goSite(site)"
              @keydown.enter="goSite(site)"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <div class="truncate font-medium text-ink-gray-9">{{ site.name }}</div>
                  <div class="mt-0.5 flex items-center gap-1.5 text-xs">
                    <span class="size-1.5 rounded-full" :class="statusDot(site)" />
                    <span class="text-ink-gray-6">{{ statusLabel(site) }}</span>
                    <Badge v-if="hasUpdate(site)" theme="orange" variant="subtle" label="Update" class="ml-0.5" />
                  </div>
                </div>
                <Dropdown :options="siteOptions(site)" placement="bottom-end">
                  <button class="-mr-1 -mt-1 shrink-0 rounded p-1 text-ink-gray-5 hover:bg-surface-gray-2" :aria-label="`Actions for ${site.name}`" @click.stop><span class="lucide-ellipsis size-4" /></button>
                </Dropdown>
              </div>
              <div class="mt-3 truncate border-t border-outline-gray-1 pt-3 text-xs text-ink-gray-5">
                {{ site.apps.length }} {{ site.apps.length === 1 ? 'app' : 'apps' }} · {{ versionBadge }} · backed up {{ backupLabel(site) }}
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
      <aside class="hidden w-80 shrink-0 overflow-y-auto border-l border-outline-gray-2 lg:block">
        <div class="border-b border-outline-gray-2 p-4">
          <div class="h-32 overflow-hidden rounded-lg border border-outline-gray-2 bg-surface-gray-1">
            <WorldMap :pins="locatorPins" :focus="server.regionId" :pin-scale="3" class="h-full w-full" />
          </div>
          <div class="mt-3 flex min-w-0 items-center gap-2">
            <span class="min-w-0 truncate font-semibold text-ink-gray-9">{{ server.name }}</span>
            <Badge theme="gray" variant="subtle" :label="versionBadge" class="shrink-0" />
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

        <!-- About — specs and ownership in one block (accordion) -->
        <div class="border-b border-outline-gray-2 p-4">
          <button
            class="flex w-full items-center gap-2"
            :aria-expanded="aboutOpen"
            @click="aboutOpen = !aboutOpen"
          >
            <span class="lucide-info size-3.5 text-ink-gray-5" />
            <span class="text-xs font-medium uppercase tracking-wide text-ink-gray-5">About</span>
            <span
              class="lucide-chevron-down ml-auto size-4 text-ink-gray-5 transition-transform"
              :class="{ 'rotate-180': aboutOpen }"
            />
          </button>
          <dl v-show="aboutOpen" class="mt-3 space-y-1.5 text-sm">
            <div class="grid grid-cols-[7rem_1fr] gap-2">
              <dt class="text-ink-gray-5 text-p-sm">Provider</dt>
              <dd class="flex items-center gap-1.5 text-ink-gray-8 text-p-sm">
                <span class="grid size-4 shrink-0 place-items-center rounded text-[8px] font-bold leading-none" :class="prov.tile">{{ prov.mono }}</span>
                {{ region.provider }}
              </dd>
            </div>
            <div class="grid grid-cols-[7rem_1fr] gap-2"><dt class="text-ink-gray-5 text-p-sm">Region</dt><dd class="truncate text-ink-gray-8 text-p-sm">{{ region.name }}</dd></div>
            <div class="grid grid-cols-[7rem_1fr] gap-2"><dt class="text-ink-gray-5 text-p-sm">Monthly cost</dt><dd class="text-ink-gray-8 text-p-sm">{{ inr(monthlyPrice) }} <span class="text-ink-gray-5 text-p-sm">({{ inr(store.perDayOf(server)) }}/day)</span></dd></div>
            <div class="grid grid-cols-[7rem_1fr] gap-2">
              <dt class="flex items-center gap-1 text-ink-gray-5 text-p-sm">
                Inbound IP
                <Tooltip text="The address visitors and DNS records point at to reach your sites.">
                  <span class="lucide-info size-3.5 text-ink-gray-4" />
                </Tooltip>
              </dt>
              <dd class="tabular-nums text-ink-gray-8 text-p-sm">{{ server.inboundIp }}</dd>
            </div>
            <div class="grid grid-cols-[7rem_1fr] gap-2">
              <dt class="flex items-center gap-1 text-ink-gray-5 text-p-sm">
                Outbound IP
                <Tooltip text="The address your server uses when it calls out to other services.">
                  <span class="lucide-info size-3.5 text-ink-gray-4" />
                </Tooltip>
              </dt>
              <dd class="tabular-nums text-ink-gray-8 text-p-sm">{{ server.outboundIp }}</dd>
            </div>
          </dl>

          <div v-show="aboutOpen" class="my-3 border-t border-outline-gray-1" />

          <dl v-show="aboutOpen" class="space-y-1.5 text-sm">
            <div class="grid grid-cols-[7rem_1fr] gap-2"><dt class="text-ink-gray-5 text-p-sm">Created by</dt><dd class="truncate text-ink-gray-8 text-p-sm">{{ store.user.name || 'You' }}</dd></div>
            <div class="grid grid-cols-[7rem_1fr] gap-2"><dt class="text-ink-gray-5 text-p-sm">Created on</dt><dd class="text-ink-gray-8 text-p-sm">{{ fmtDateTime(server.createdAt) }}</dd></div>
            <div class="grid grid-cols-[7rem_1fr] gap-2"><dt class="text-ink-gray-5 text-p-sm">Owned by</dt><dd class="truncate text-ink-gray-8 text-p-sm">{{ store.user.email || '—' }}</dd></div>
          </dl>
        </div>

        <!-- Plan history — most recent first, capped at 2 with a View all (accordion) -->
        <div class="p-4">
          <button
            class="flex w-full items-center gap-2"
            :aria-expanded="planOpen"
            @click="planOpen = !planOpen"
          >
            <span class="lucide-history size-3.5 text-ink-gray-5" />
            <span class="text-xs font-medium uppercase tracking-wide text-ink-gray-5">Plan history</span>
            <span
              class="lucide-chevron-down ml-auto size-4 text-ink-gray-5 transition-transform"
              :class="{ 'rotate-180': planOpen }"
            />
          </button>
          <div v-show="planOpen">
            <div v-if="server.planHistory.length" class="mt-3 space-y-3">
              <div v-for="h in server.planHistory.slice(0, 2)" :key="h.id" class="flex items-start gap-2.5">
                <span
                  class="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full"
                  :class="h.direction === 'upgrade' ? 'bg-surface-green-2 text-ink-green-3' : 'bg-surface-amber-2 text-ink-amber-3'"
                >
                  <span class="size-3" :class="h.direction === 'upgrade' ? 'lucide-arrow-up' : 'lucide-arrow-down'" />
                </span>
                <div class="min-w-0 flex-1">
                  <div class="truncate text-ink-gray-8 text-p-sm">{{ h.from }} → {{ h.to }}</div>
                  <div class="text-xs text-ink-gray-5"><span class="capitalize">{{ h.direction }}</span> · {{ h.date }}</div>
                </div>
              </div>
              <div v-if="server.planHistory.length > 2" class="flex justify-end">
                <button class="text-xs text-ink-gray-5 hover:text-ink-gray-7" @click="historyOpen = true">View all</button>
              </div>
            </div>
            <p v-else class="mt-3 text-sm text-ink-gray-4">No plan changes yet.</p>
          </div>
        </div>
      </aside>
    </div>

    <ChangePlanDialog v-model:open="resizeOpen" :server="server" />
    <ChangeVersionDialog v-model:open="versionOpen" :server="server" />
    <PlanHistoryDialog v-model:open="historyOpen" :server="server" />
    <AddCardDialog v-model:open="addCardOpen" />
    <NewSiteDialog v-model:open="newSiteOpen" :server="server" />
  </ServerShell>
</template>

<script setup>
import { computed, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Alert, Badge, Button, Dropdown, FormControl, Tooltip, toast } from 'frappe-ui'
import AddCardDialog from '../../components/AddCardDialog.vue'
import ChangeVersionDialog from '../../components/ChangeVersionDialog.vue'
import EmptyState from '../../components/EmptyState.vue'
import NewSiteDialog from '../../components/NewSiteDialog.vue'
import WorldMap from '../../components/WorldMap.vue'
import ChangePlanDialog from '../../components/ChangePlanDialog.vue'
import PlanHistoryDialog from '../../components/PlanHistoryDialog.vue'
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
const region = computed(() => store.regionOf(server.value))
const prov = computed(() => providerById(region.value.providerId))
const monthlyPrice = computed(() => store.monthlyPriceOf(server.value))
const versionLabel = computed(() => versionById(server.value.version).label)
const versionBadge = computed(() => {
  const m = versionLabel.value.match(/\d+/)
  return m ? `v${m[0]}` : versionLabel.value
})

const crumbs = computed(() => [{ label: 'Sites', route: base.value }])

const locatorPins = computed(() => [
  { id: server.value.regionId, lat: region.value.lat, lng: region.value.lng, status: server.value.status, selected: true },
])

// — Rail section state (accordions closed by default)
const aboutOpen = ref(false)
const planOpen = ref(false)
const historyOpen = ref(false)

// — Sites list controls
const q = ref('')
const statusFilter = ref('')
const view = ref('cards')
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
function backupLabel(site) {
  const b = store.lastBackupOf(site)
  return b ? timeAgo(b.at) : 'none yet'
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

function resumeServer() {
  store.setServerSuspended(server.value.id, false)
  toast.success(`${server.value.name} resumed`)
}
function contactSupport() {
  toast('In the real thing, this opens a support ticket for this server')
}
</script>

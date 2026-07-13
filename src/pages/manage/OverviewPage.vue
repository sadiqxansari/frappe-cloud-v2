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
            :action="{ label: 'Add a card', onClick: () => (addCardOpen = true) }"
            class="mb-5"
          >
            <template #description>Nothing is deleted. Add a card and they're back in seconds.</template>
          </Alert>

          <!-- Server lifecycle banners. Independent v-if from creditExpired (both can
               be true); the three statuses are mutually exclusive so they chain. -->
          <Alert v-if="server.status === 'suspended'" theme="yellow" title="This server is suspended" :action="{ label: 'Resume server', onClick: resumeServer }" class="mb-5">
            <template #description>Sites are offline. Resume to bring them back — nothing is deleted.</template>
          </Alert>

          <Alert v-else-if="server.status === 'broken'" theme="red" title="This server is unreachable" :action="{ label: 'Contact support', icon: 'lucide-life-buoy', onClick: contactSupport }" class="mb-5">
            <template #description>We've lost contact with the host and are looking into it. Your data is safe; actions here are paused until it's back.</template>
          </Alert>

          <Alert v-else-if="server.status === 'provisioning'" theme="blue" title="Setting up your server" :dismissible="false" class="mb-5">
            <template #description>This usually takes a couple of minutes. You can add sites as soon as it's ready.</template>
          </Alert>

          <h2 class="text-base font-semibold text-ink-gray-8">
            Your sites <span class="font-normal text-ink-gray-5">({{ server.sites.length }})</span>
          </h2>

          <!-- Toolbar -->
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <FormControl v-model="q" class="min-w-0 flex-1 [&_input]:w-full" type="text" placeholder="Search" autocomplete="off">
              <template #prefix><span class="lucide-search size-4 text-ink-gray-4" /></template>
            </FormControl>
            <div class="w-32 shrink-0"><FormControl v-model="statusFilter" type="select" :options="statusOptions" /></div>
            <TabButtons
              v-model="view"
              class="shrink-0"
              :options="[
                { value: 'grid', icon: 'lucide-layout-grid', tooltip: 'Grid view' },
                { value: 'list', icon: 'lucide-list', tooltip: 'List view' },
              ]"
            />
            <Dropdown :options="sortOptions" placement="bottom-end">
              <Button variant="subtle" size="sm" label="Sort" icon-left="lucide-arrow-up-down" />
            </Dropdown>
            <Dropdown :options="siteListMenu" placement="bottom-end">
              <Button variant="subtle" size="sm" icon="lucide-ellipsis" aria-label="More" />
            </Dropdown>
          </div>

          <!-- Empty -->
          <EmptyState
            v-if="!filteredSites.length"
            class="mt-4"
            :icon="q || statusFilter ? 'lucide-search' : 'lucide-layout-grid'"
            :title="q || statusFilter ? 'No sites match' : 'No sites on this server yet'"
            :description="q || statusFilter ? 'Try a different search or clear the filter.' : 'Create your first site.'"
          >
            <Button v-if="!q && !statusFilter && server.status === 'active'" variant="solid" size="sm" label="New site" icon-left="lucide-plus" @click="newSiteOpen = true" />
          </EmptyState>

          <!-- Grid -->
          <div v-else-if="view === 'grid'" class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div
              v-for="site in filteredSites"
              :key="site.id"
              role="button"
              tabindex="0"
              class="flex cursor-pointer items-start gap-3 rounded-lg border border-outline-gray-2 bg-surface-elevation-1 p-4 transition-colors hover:border-outline-gray-3 hover:bg-surface-gray-1"
              @click="goSite(site)"
              @keydown.enter="goSite(site)"
            >
              <SiteIcon size="lg" class="shrink-0" />
              <div class="min-w-0 flex-1">
                <div class="flex items-start justify-between gap-2">
                  <div class="flex min-w-0 items-center gap-2">
                    <span class="truncate text-base font-semibold text-ink-gray-9">{{ site.name }}</span>
                    <Badge :theme="statusTheme(site)" variant="subtle" :label="statusLabel(site)" class="shrink-0" />
                  </div>
                  <Dropdown :options="siteOptions(site)" placement="bottom-end">
                    <button class="-mr-1 -mt-0.5 rounded p-1 text-ink-gray-5 hover:bg-surface-gray-3 hover:text-ink-gray-7" :aria-label="`Actions for ${site.name}`" @click.stop><span class="lucide-ellipsis size-4" /></button>
                  </Dropdown>
                </div>
                <div class="text-p-sm text-ink-gray-5">
                  {{ site.apps.length }} {{ site.apps.length === 1 ? 'app' : 'apps' }}
                </div>
              </div>
            </div>
          </div>

          <!-- List — frappe-ui ListView, kept basic. -->
          <ListView
            v-else
            class="mt-4 fc-listview"
            :style="{ height: `${52 + listRows.length * 50}px` }"
            :columns="listColumns"
            :rows="listRows"
            :options="{ selectable: false, showTooltip: false, rowHeight: 50, onRowClick: (row) => goSite(row._site) }"
            row-key="id"
          >
            <template #cell="{ column, row }">
              <div v-if="column.key === 'name'" class="flex min-w-0 items-center gap-2.5">
                <SiteIcon size="sm" />
                <span class="truncate text-base font-medium text-ink-gray-8">{{ row.name }}</span>
              </div>
              <Badge v-else-if="column.key === 'status'" :theme="statusTheme(row._site)" variant="subtle" :label="statusLabel(row._site)" />
              <span v-else-if="column.key === 'apps'" class="text-sm tabular-nums text-ink-gray-6">{{ row._site.apps.length }} {{ row._site.apps.length === 1 ? 'app' : 'apps' }}</span>
              <Dropdown v-else-if="column.key === 'actions'" :options="siteOptions(row._site)" placement="bottom-end">
                <button class="grid size-7 place-items-center rounded text-ink-gray-5 hover:bg-surface-gray-3 hover:text-ink-gray-7" :aria-label="`Actions for ${row.name}`" @click.stop><span class="lucide-ellipsis-vertical size-4" /></button>
              </Dropdown>
            </template>
          </ListView>
        </div>
      </div>

      <!-- Server specs rail — pinned right, full-width sections -->
      <aside class="hidden w-80 shrink-0 overflow-y-auto border-l border-outline-gray-2 lg:block">
        <div class="border-b border-outline-gray-2 p-4">
          <div class="h-32 overflow-hidden rounded-lg border border-outline-gray-2 bg-surface-gray-1">
            <WorldMap :pins="locatorPins" :focus="server.regionId" :pin-scale="3" class="h-full w-full" />
          </div>
          <div class="mt-3 flex min-w-0 items-center gap-1.5">
            <span class="min-w-0 truncate font-semibold text-ink-gray-9">{{ server.name }}</span>
            <Badge v-if="server.status === 'broken'" theme="red" variant="subtle" label="Broken" class="shrink-0" />
            <Badge v-else-if="server.status === 'suspended'" theme="orange" variant="subtle" label="Suspended" class="shrink-0" />
            <Badge v-else-if="server.status === 'active'" theme="green" variant="subtle" label="Active" class="shrink-0" />
            <Badge v-else theme="orange" variant="subtle" label="Setting up…" class="shrink-0" />
            <Badge theme="gray" variant="subtle" :label="server.version" class="shrink-0" />
          </div>
          <div class="mt-2 flex items-center gap-1">
            <Button variant="subtle" size="sm" label="Change version" class="flex-1" @click="versionOpen = true" />
            <ServerActions :server="server" />
          </div>
        </div>

        <RailAccordion title="About server" icon="lucide-server">
          <dl class="space-y-1.5 text-sm">
            <div class="grid grid-cols-[7rem_1fr] gap-2">
              <dt class="text-ink-gray-5 text-p-sm">Provider</dt>
              <dd class="flex items-center gap-1.5 text-ink-gray-8 text-p-sm">
                <ProviderIcon :provider="prov" :size="16" class="rounded" />
                {{ region.provider }}
              </dd>
            </div>
            <div class="grid grid-cols-[7rem_1fr] gap-2"><dt class="text-ink-gray-5 text-p-sm">Region</dt><dd class="truncate text-ink-gray-8 text-p-sm">{{ region.name }}</dd></div>
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
            <div class="grid grid-cols-[7rem_1fr] gap-2"><dt class="text-ink-gray-5 text-p-sm">Created by</dt><dd class="truncate text-ink-gray-8 text-p-sm">{{ store.user.name || 'You' }}</dd></div>
            <div class="grid grid-cols-[7rem_1fr] gap-2"><dt class="text-ink-gray-5 text-p-sm">Created on</dt><dd class="text-ink-gray-8 text-p-sm">{{ fmtDateTime(server.createdAt) }}</dd></div>
            <div class="grid grid-cols-[7rem_1fr] gap-2"><dt class="text-ink-gray-5 text-p-sm">Owned by</dt><dd class="truncate text-ink-gray-8 text-p-sm">{{ store.user.email || '—' }}</dd></div>
          </dl>
        </RailAccordion>

        <RailAccordion title="Plan" icon="lucide-receipt-text">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-ink-gray-8">{{ plan.name }}</span>
            <span class="text-sm tabular-nums text-ink-gray-6">{{ inr(monthlyPrice) }}/mo</span>
          </div>
          <template v-if="server.planHistory.length">
            <div class="mt-4 text-xs font-medium uppercase tracking-wide text-ink-gray-5">Plan history</div>
            <div class="mt-2 space-y-3">
              <PlanChangeRow v-for="h in recentHistory" :key="h.id" :entry="h" />
            </div>
            <button
              v-if="server.planHistory.length > recentHistory.length"
              class="mt-3 text-xs font-medium text-ink-gray-7 hover:text-ink-gray-9"
              @click="historyOpen = true"
            >
              View all {{ server.planHistory.length }} changes →
            </button>
          </template>
          <p v-else class="mt-3 text-p-sm text-ink-gray-5">No plan changes yet.</p>
        </RailAccordion>
      </aside>
    </div>

    <ChangeVersionDialog v-model:open="versionOpen" :server="server" />
    <AddCardDialog v-model:open="addCardOpen" />
    <NewSiteDialog v-model:open="newSiteOpen" :server="server" />

    <Dialog v-model:open="historyOpen" size="sm">
      <template #title><span class="text-xl font-semibold text-ink-gray-9">Plan history</span></template>
      <div class="space-y-3">
        <PlanChangeRow v-for="h in server.planHistory" :key="h.id" :entry="h" />
      </div>
    </Dialog>
  </ServerShell>
</template>

<script setup>
import { computed, h, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Badge, Button, Dialog, Dropdown, FormControl, ListView, TabButtons, Tooltip, toast } from 'frappe-ui'
import Alert from '../../components/Alert.vue'
import SiteIcon from '../../components/SiteIcon.vue'
import AddCardDialog from '../../components/AddCardDialog.vue'
import ChangeVersionDialog from '../../components/ChangeVersionDialog.vue'
import EmptyState from '../../components/EmptyState.vue'
import NewSiteDialog from '../../components/NewSiteDialog.vue'
import WorldMap from '../../components/WorldMap.vue'
import ProviderIcon from '../../components/ProviderIcon.vue'
import RailAccordion from '../../components/RailAccordion.vue'
import ServerActions from '../../components/ServerActions.vue'
import ServerShell from '../../components/ServerShell.vue'
import { providerById } from '../../data/catalog'
import { useCloudStore } from '../../stores/cloud'
import { fmtDateTime, inr } from '../../utils/format'

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
// Plan history: show the two most recent inline; the rest live in a modal.
const recentHistory = computed(() => server.value.planHistory.slice(0, 2))
const historyOpen = ref(false)

// A single plan-change row, reused inline and in the "view all" modal.
const PlanChangeRow = (p) => {
  const up = p.entry.direction === 'upgrade'
  return h('div', { class: 'flex items-center gap-2.5 text-sm' }, [
    h('span', { class: `grid size-5 shrink-0 place-items-center rounded-full ${up ? 'bg-surface-green-2 text-ink-green-6' : 'bg-surface-amber-2 text-ink-amber-8'}` }, [
      h('span', { class: `size-3 ${up ? 'lucide-arrow-up' : 'lucide-arrow-down'}` }),
    ]),
    h('div', { class: 'min-w-0 flex-1 truncate text-ink-gray-7' }, `${p.entry.from} → ${p.entry.to}`),
    h('span', { class: 'shrink-0 tabular-nums text-xs text-ink-gray-5' }, p.entry.date),
  ])
}
PlanChangeRow.props = ['entry']

const crumbs = computed(() => [{ label: 'Sites', route: base.value }])

const locatorPins = computed(() => [
  { id: server.value.regionId, lat: region.value.lat, lng: region.value.lng, status: server.value.status, selected: true },
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

// Overflow menu for the sites list. Export is a placeholder for now.
const siteListMenu = [
  { label: 'Export as CSV', icon: 'lucide-download', onClick: () => toast('Exported sites.csv') },
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

// List view rows/columns for the basic ListView.
const listColumns = [
  { label: 'Site', key: 'name', width: 2 },
  { label: 'Status', key: 'status', width: 1 },
  { label: 'Apps', key: 'apps', width: '5rem' },
  { label: '', key: 'actions', width: '3rem', align: 'right' },
]
const listRows = computed(() => filteredSites.value.map((s) => ({ id: s.id, name: s.name, _site: s })))

function goSite(site) {
  router.push(`${base.value}/sites/${site.id}`)
}
function statusLabel(site) {
  return { live: 'Active', creating: 'Setting up…', restoring: 'Restoring…', moving: 'Moving…', suspended: 'Paused' }[site.status] || site.status
}
function statusTheme(site) {
  if (site.status === 'live') return 'green'
  if (site.status === 'broken') return 'red'
  return 'orange'
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

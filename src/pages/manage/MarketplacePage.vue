<template>
  <ServerShell v-if="server" :server="server" :crumbs="crumbs">
    <!-- ── Header ───────────────────────────────────────────────────────── -->
    <div class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-2.5">
        <h1 class="text-lg font-semibold text-ink-gray-9">Explore Frappe Marketplace</h1>
        <span class="inline-flex h-min shrink-0 items-center gap-1 rounded-full bg-surface-gray-2 px-2 py-0.5 text-p-xs text-ink-gray-6">
          <span class="size-3 lucide-box" /> {{ versionLabel }}
        </span>
      </div>
      <button
        type="button"
        class="inline-flex h-min shrink-0 items-center gap-1.5 rounded-full bg-surface-gray-2 px-2.5 py-1 text-p-sm text-ink-gray-7 transition-colors hover:bg-surface-gray-3"
        @click="siteChooserOpen = true"
      >
        <span class="size-3.5 text-ink-gray-5" :class="preselectedSite ? 'lucide-globe' : 'lucide-layout-grid'" />
        {{ siteLabel }}
      </button>
    </div>

    <!-- Search + works-with + import + category pills -->
    <MarketplaceFilters
      v-model:search="search"
      v-model:pill="selectedPill"
      v-model:works-with="worksWith"
      :works-with-options="worksWithOptions"
      @add-from-github="ghOpen = true"
    />

    <!-- ── Filtered: a single combined section ──────────────────────────── -->
    <template v-if="isFiltered">
      <section v-if="filteredApps.length" class="mt-12">
        <p class="text-base font-medium text-ink-gray-9">{{ filteredHeading }}</p>
        <div class="mt-3 grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
          <MarketplaceAppRow
            v-for="app in filteredApps"
            :key="app.key"
            :app="app"
            :version-label="versionLabel"
            :can-uninstall="canUninstall(app)"
            @install="onInstall(app)"
            @uninstall="askUninstall(app)"
          />
        </div>
      </section>
      <p v-else class="mt-8 text-center text-sm text-ink-gray-5">No apps found.</p>
    </template>

    <!-- ── Default: Your custom apps / From Frappe / Community ────────────── -->
    <template v-else>
      <section v-if="customApps.length" class="mt-12">
        <p class="text-base font-medium text-ink-gray-9">Your custom apps</p>
        <div class="mt-3 grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
          <MarketplaceAppRow
            v-for="app in customApps"
            :key="app.key"
            :app="app"
            :version-label="versionLabel"
            :can-uninstall="canUninstall(app)"
            @uninstall="askUninstall(app)"
          />
        </div>
      </section>

      <section v-if="frappeApps.length" class="mt-12">
        <p class="text-base font-medium text-ink-gray-9">From Frappe</p>
        <div class="mt-3 grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
          <MarketplaceAppRow
            v-for="app in frappeApps"
            :key="app.key"
            :app="app"
            :version-label="versionLabel"
            :can-uninstall="canUninstall(app)"
            @install="onInstall(app)"
            @uninstall="askUninstall(app)"
          />
        </div>
      </section>

      <section v-if="communityApps.length" class="mt-12">
        <p class="text-base font-medium text-ink-gray-9">Community</p>
        <div class="mt-3 grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
          <MarketplaceAppRow
            v-for="app in communityApps"
            :key="app.key"
            :app="app"
            :version-label="versionLabel"
            :can-uninstall="canUninstall(app)"
            @install="onInstall(app)"
            @uninstall="askUninstall(app)"
          />
        </div>
      </section>

      <p v-if="!frappeApps.length && !communityApps.length && !customApps.length" class="mt-8 text-center text-sm text-ink-gray-5">
        No apps found.
      </p>
    </template>

    <!-- Import from GitHub -->
    <Dialog v-model:open="ghOpen" title="Import custom app" size="sm">
      <TabButtons v-model="ghTab" :options="ghTabs" />
      <div class="mt-4 grid gap-3">
        <div class="grid min-h-28 content-start gap-3">
          <FormControl
            v-if="ghTab === 'public'"
            v-model="ghRepo"
            type="text"
            label="Repository URL"
            placeholder="https://github.com/you/your-app"
          />
          <template v-else>
            <div class="flex items-center gap-2 rounded-lg border border-outline-gray-2 bg-surface-gray-1 px-3 py-2">
              <span class="size-3.5 shrink-0 text-ink-green-6 lucide-circle-check" />
              <span class="text-p-sm text-ink-gray-7">
                Connected as <span class="font-medium text-ink-gray-9">{{ GH_ACCOUNT.username }}</span>
              </span>
            </div>
            <FormControl
              v-model="ghRepo"
              type="select"
              label="Repository"
              :options="[{ label: 'Select a repository', value: '' }, ...GH_ACCOUNT.repos.map((r) => ({ label: r, value: r }))]"
            />
          </template>
        </div>
        <FormControl v-model="ghBranch" type="text" label="Branch" placeholder="develop" />
      </div>
      <template #actions>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" @click="resetGh" />
          <Button variant="solid" label="Install" :disabled="!ghRepo.trim()" @click="onInstallGitHub" />
        </div>
      </template>
    </Dialog>

    <!-- Confirm install (a site is already chosen). -->
    <Dialog v-model:open="confirmOpen" :title="`Install ${pending?.name || 'app'}`" size="sm">
      <p class="text-p-base text-ink-gray-7">
        Install <span class="font-medium text-ink-gray-9">{{ pending?.name }}</span> on
        <span class="font-medium text-ink-gray-9">{{ preselectedSite?.name }}</span>?
      </p>
      <template #actions>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" @click="confirmOpen = false" />
          <Button variant="solid" label="Install" @click="confirmDirectInstall" />
        </div>
      </template>
    </Dialog>

    <!-- Choose where to install (direct entry, or "All sites"). Skipped when a
         site was already chosen. -->
    <Dialog v-model:open="pickerOpen" :title="`Install ${pending?.name || 'app'}`" size="sm">
      <div v-if="liveSites.length" class="space-y-2">
        <button
          v-if="liveSites.length > 1"
          class="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors"
          :class="[
            targetSiteId === ALL ? 'border-outline-gray-4 ring-1 ring-outline-gray-4' : 'border-outline-gray-2',
            allDisabled ? 'opacity-50' : 'hover:bg-surface-gray-1',
          ]"
          :disabled="allDisabled"
          @click="targetSiteId = ALL"
        >
          <span class="grid size-7 shrink-0 place-items-center rounded-md bg-surface-gray-2 text-ink-gray-6"><span class="lucide-layout-grid size-4" /></span>
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-medium text-ink-gray-9">All sites</span>
            <span class="block truncate text-xs text-ink-gray-5">{{ allNote }}</span>
          </span>
        </button>
        <button
          v-for="c in siteChoices"
          :key="c.site.id"
          class="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors"
          :class="[
            c.site.id === targetSiteId ? 'border-outline-gray-4 ring-1 ring-outline-gray-4' : 'border-outline-gray-2',
            c.disabled ? 'opacity-50' : 'hover:bg-surface-gray-1',
          ]"
          :disabled="c.disabled"
          @click="targetSiteId = c.site.id"
        >
          <SiteIcon size="sm" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium text-ink-gray-9">{{ c.site.name }}</span>
            <span class="block truncate text-xs text-ink-gray-5">{{ c.note }}</span>
          </span>
        </button>
      </div>
      <p v-else class="text-p-base text-ink-gray-6">
        {{ server.name }} has no live site yet — create one first, then install apps on it.
      </p>
      <template #actions>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" @click="pickerOpen = false" />
          <Button variant="solid" label="Install" :disabled="!targetSiteId" @click="confirmPicker" />
        </div>
      </template>
    </Dialog>

    <!-- Which site are you browsing for? "All sites" + one row per site. -->
    <Dialog v-model:open="siteChooserOpen" title="Which site are you browsing for?" size="md">
      <p v-if="!liveSites.length" class="py-6 text-center text-sm text-ink-gray-5">
        {{ server.name }} has no live sites yet — create one first, then install apps on it.
      </p>
      <template v-else>
        <p class="mb-4 text-p-sm text-ink-gray-6">Installed apps are marked, and installs target this site.</p>
        <div class="grid max-h-96 gap-2 overflow-y-auto">
          <button
            type="button"
            class="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors"
            :class="!currentSiteId ? 'border-outline-gray-4 bg-surface-gray-1' : 'border-outline-gray-2 hover:bg-surface-gray-1'"
            @click="chooseSite('')"
          >
            <span class="grid size-8 shrink-0 place-items-center rounded-md bg-surface-gray-2"><span class="size-4 text-ink-gray-6 lucide-layout-grid" /></span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-medium text-ink-gray-8">All sites</span>
              <span class="block truncate text-p-sm text-ink-gray-5">Browse every available app</span>
            </span>
            <span v-if="!currentSiteId" class="size-4 shrink-0 text-ink-gray-8 lucide-check" />
          </button>
          <button
            v-for="s in liveSites"
            :key="s.id"
            type="button"
            class="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors"
            :class="s.id === currentSiteId ? 'border-outline-gray-4 bg-surface-gray-1' : 'border-outline-gray-2 hover:bg-surface-gray-1'"
            @click="chooseSite(s.id)"
          >
            <span class="grid size-8 shrink-0 place-items-center rounded-md bg-surface-gray-2"><span class="size-4 text-ink-gray-6 lucide-globe" /></span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-medium text-ink-gray-8">{{ s.name }}</span>
              <span class="block truncate text-p-sm text-ink-gray-5">{{ s.apps.length }} {{ s.apps.length === 1 ? 'app' : 'apps' }} · {{ versionLabel }}</span>
            </span>
            <span v-if="s.id === currentSiteId" class="size-4 shrink-0 text-ink-gray-8 lucide-check" />
          </button>
        </div>
      </template>
    </Dialog>

    <ConfirmDialog
      v-model:open="uninstallOpen"
      theme="red"
      :title="`Uninstall ${pendingUninstall?.name}?`"
      :message="pendingUninstallSite ? `It comes off ${pendingUninstallSite.name}. Its data stays in your backups for 30 days.` : ''"
      confirm-label="Uninstall"
      @confirm="confirmUninstall"
    />
  </ServerShell>
</template>

<script setup>
import { computed, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button, Dialog, FormControl, TabButtons, toast } from 'frappe-ui'
import ConfirmDialog from '../../components/ConfirmDialog.vue'
import MarketplaceAppRow from '../../components/MarketplaceAppRow.vue'
import MarketplaceFilters from '../../components/MarketplaceFilters.vue'
import ServerShell from '../../components/ServerShell.vue'
import SiteIcon from '../../components/SiteIcon.vue'
import { APP_CATALOG, APP_CATEGORIES, categoryOf, isFrappeApp, versionById, worksWithOf } from '../../data/catalog'
import { useCloudStore } from '../../stores/cloud'

const store = useCloudStore()
const route = useRoute()
const router = useRouter()

const server = computed(() => store.findServer(route.params.serverId) || store.currentServer)
watchEffect(() => {
  if (!server.value) router.replace('/')
})
const crumbs = [{ label: 'Marketplace' }]

const versionLabel = computed(() => versionById(server.value.version).label)
const liveSites = computed(() => (server.value?.sites || []).filter((s) => s.status === 'live'))

// Arrived from a site (?site=) → that live site is chosen, and installs go
// straight to it. Direct entry leaves it '': you browse "All sites" first, and
// pick where to install on commit. The header pill reopens this choice anytime.
const currentSiteId = ref(route.query.site || '')
const preselectedSite = computed(() => liveSites.value.find((s) => s.id === currentSiteId.value) || null)
const siteLabel = computed(() => preselectedSite.value?.name || 'All sites')
const siteChooserOpen = ref(false)
function chooseSite(id) {
  currentSiteId.value = id
  siteChooserOpen.value = false
}

const search = ref('')
const selectedPill = ref('all')
const worksWith = ref('')

// ── Catalog shaping ──────────────────────────────────────────────────────
// Every view renders the same decorated app: compatibility with this server,
// what it needs if locked, and whether it's already on the site we arrived from.
function decorate(a) {
  const ver = server.value?.version
  const onSite = new Set((preselectedSite.value?.apps || []).map((x) => x.key))
  return {
    ...a,
    compatible: a.compat.includes(ver),
    needs: versionById(a.compat[0]).label,
    installedHere: onSite.has(a.key),
  }
}
function installsNum(app) {
  const s = String(app.installs || '').trim().toLowerCase()
  if (s.endsWith('m')) return parseFloat(s) * 1e6
  if (s.endsWith('k')) return parseFloat(s) * 1e3
  return parseFloat(s) || 0
}
function bySort(a, b) {
  if (a.installedHere !== b.installedHere) return a.installedHere ? -1 : 1
  const diff = installsNum(b) - installsNum(a)
  return diff !== 0 ? diff : a.name.localeCompare(b.name)
}

// Your custom apps — installed from GitHub, so they don't live in the catalog
// at all. With a site chosen, only that site's custom apps show; on "All
// sites", the union across every live site (deduped by key) shows instead.
// Not narrowed by search/pill/works-with, and only shown in the default
// (unfiltered) view, same as pilot.
const customApps = computed(() => {
  const sites = preselectedSite.value ? [preselectedSite.value] : liveSites.value
  const byKey = new Map()
  for (const site of sites) {
    for (const a of site.apps || []) {
      if (a.key.startsWith('gh-') && !byKey.has(a.key)) {
        byKey.set(a.key, { ...a, compatible: true, installedHere: true, siteId: site.id })
      }
    }
  }
  return [...byKey.values()]
})

// Which site an installed app's uninstall action targets: the app's own
// siteId when aggregated from "All sites" (customApps), otherwise whichever
// site is currently chosen.
function uninstallSiteFor(app) {
  return store.findSite(app.siteId) || preselectedSite.value || null
}
// A site needs at least one app, so uninstall is withheld for its last one.
function canUninstall(app) {
  const site = uninstallSiteFor(app)
  return Boolean(site && site.apps.length > 1)
}

const uninstallOpen = ref(false)
const pendingUninstall = ref(null)
const pendingUninstallSite = computed(() => (pendingUninstall.value ? uninstallSiteFor(pendingUninstall.value) : null))
function askUninstall(app) {
  pendingUninstall.value = app
  uninstallOpen.value = true
}
function confirmUninstall() {
  const app = pendingUninstall.value
  const site = uninstallSiteFor(app)
  if (!site) return
  toast.promise(store.uninstallApp(site.id, app.key), {
    loading: `Uninstalling ${app.name}…`,
    success: `${app.name} uninstalled`,
    error: 'Uninstall failed',
  })
}

function matchesPill(app, pill) {
  return pill === 'all' || categoryOf(app.key) === pill
}
function matchesWorksWith(app, w) {
  return !w || worksWithOf(app.key) === w
}
const matchingApps = computed(() => {
  const q = search.value.trim().toLowerCase()
  return APP_CATALOG.filter(
    (a) =>
      matchesPill(a, selectedPill.value) &&
      matchesWorksWith(a, worksWith.value) &&
      (!q || a.name.toLowerCase().includes(q) || a.tagline.toLowerCase().includes(q)),
  ).map(decorate)
})
const frappeApps = computed(() => matchingApps.value.filter((a) => isFrappeApp(a.key)).sort(bySort))
const communityApps = computed(() => matchingApps.value.filter((a) => !isFrappeApp(a.key)).sort(bySort))

// A pill or works-with filter collapses the frappe/community split into one
// combined, sorted list — search alone does not (it just narrows within
// whichever view is active), matching pilot.
const isFiltered = computed(() => selectedPill.value !== 'all' || Boolean(worksWith.value))
const filteredApps = computed(() => [...matchingApps.value].sort(bySort))
const filteredHeading = computed(() => {
  const name = selectedPill.value !== 'all' ? APP_CATEGORIES.find((c) => c.value === selectedPill.value)?.label : 'Matching apps'
  const count = filteredApps.value.length
  return `${name} · ${count} ${count === 1 ? 'app' : 'apps'}`
})

// "Works with" — only Frappe apps that something in the catalog is built for
// (ERPNext, Frappe HR, …), each resolved back to its own catalog entry for icon/name.
const worksWithOptions = computed(() => {
  const names = [...new Set(APP_CATALOG.map((a) => worksWithOf(a.key)).filter((w) => w !== 'Frappe Framework'))]
  return names
    .map((name) => APP_CATALOG.find((a) => a.name === name))
    .filter(Boolean)
    .map((a) => ({ name: a.name, key: a.key }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

// Entry point from a row's Install button: confirm against the chosen site,
// otherwise ask where it should land.
function onInstall(app) {
  if (!liveSites.value.length) {
    toast('Create a live site first, then install apps onto it')
    return
  }
  if (preselectedSite.value) {
    pending.value = app
    confirmOpen.value = true
  } else {
    openPicker(app)
  }
}

function commitInstall(app, site) {
  toast.promise(store.addApp(site.id, app.key), {
    loading: `Installing ${app.name} on ${site.name}…`,
    success: () => `${app.name} installed on ${site.name}`,
    error: () => {
      store.logTask('Install App', {
        site: site.name,
        status: 'failed',
        duration: '1m 12s',
        steps: [
          { name: 'Resolve app dependencies', status: 'success', duration: '3s' },
          { name: 'Build assets', status: 'success', duration: '58s' },
          { name: 'Run migrations', status: 'failed', duration: '11s' },
        ],
      })
      return `Couldn't install ${app.name} — try again`
    },
  })
}

// — Confirm against the chosen site.
const confirmOpen = ref(false)
function confirmDirectInstall() {
  confirmOpen.value = false
  const site = preselectedSite.value
  if (!site || !pending.value) return
  commitInstall(pending.value, site)
}

// — "Where do I install this?" picker (direct entry, or the All-sites path).
// `pending` is a catalog app, or a { github, name, repo, branch } payload.
const ALL = '__all__'
const pickerOpen = ref(false)
const pending = ref(null)
const targetSiteId = ref(null)

const siteChoices = computed(() =>
  liveSites.value.map((site) => {
    const already = pending.value && !pending.value.github && site.apps.some((a) => a.key === pending.value.key)
    return {
      site,
      disabled: already,
      note: already ? `${site.name} · already installed` : `${site.name} · ${versionLabel.value}`,
    }
  }),
)
const eligibleSites = computed(() => siteChoices.value.filter((c) => !c.disabled).map((c) => c.site))
const allDisabled = computed(() => eligibleSites.value.length === 0)
const allNote = computed(() =>
  allDisabled.value
    ? 'Already on every site'
    : `Installs on ${eligibleSites.value.length} ${eligibleSites.value.length === 1 ? 'site' : 'sites'}`,
)

function openPicker(payload) {
  pending.value = payload
  targetSiteId.value = siteChoices.value.find((c) => !c.disabled)?.site.id || null
  pickerOpen.value = true
}
function confirmPicker() {
  pickerOpen.value = false
  const payload = pending.value
  if (targetSiteId.value === ALL) {
    const sites = eligibleSites.value
    if (!sites.length) return
    sites.forEach((s) => fireInstall(s, payload))
    if (payload.github) resetGh()
    toast.success(`Installing ${payload.name} on ${sites.length} ${sites.length === 1 ? 'site' : 'sites'}…`)
    return
  }
  const site = store.findSite(targetSiteId.value)
  if (!site) return
  if (payload.github) commitGitHub(site, payload)
  else commitInstall(payload, site)
}
function fireInstall(site, payload) {
  return payload.github
    ? store.addCustomApp(site.id, { repo: payload.repo, branch: payload.branch })
    : store.addApp(site.id, payload.key)
}

// — Install from GitHub (marketplace-only). Same destination logic: straight to
// the chosen site, otherwise through the picker. Two tabs, same as pilot: a
// public repo URL, or one of the demo account's own repos.
const ghOpen = ref(false)
const ghTab = ref('public')
const ghTabs = [
  { label: 'Public repository', value: 'public' },
  { label: 'Your GitHub account', value: 'private' },
]
const GH_ACCOUNT = { username: 'ravibakes-dev', repos: ['acme/portal', 'acme/loyalty-app', 'acme/internal-tools'] }
const ghRepo = ref('')
const ghBranch = ref('')
function resetGh() {
  ghTab.value = 'public'
  ghRepo.value = ''
  ghBranch.value = ''
  ghOpen.value = false
}
function onInstallGitHub() {
  if (!ghRepo.value.trim()) return
  if (!liveSites.value.length) {
    toast('Create a live site first, then install apps onto it')
    return
  }
  const payload = { github: true, name: ghRepo.value.split('/').pop(), repo: ghRepo.value.trim(), branch: ghBranch.value.trim() || 'develop' }
  if (preselectedSite.value) commitGitHub(preselectedSite.value, payload)
  else openPicker(payload)
}
function commitGitHub(site, payload) {
  toast.promise(store.addCustomApp(site.id, { repo: payload.repo, branch: payload.branch }), {
    loading: `Installing on ${site.name}…`,
    success: (app) => `${app?.name || payload.name} installed on ${site.name}`,
    error: 'Install failed',
  })
  resetGh()
}
</script>

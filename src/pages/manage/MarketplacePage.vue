<template>
  <ServerShell v-if="server" :server="server" :crumbs="crumbs">
    <!-- ── Header ─────────────────────────────────────────────────────────
         Browsing shows the Marketplace title + version context. Inside a
         category ("See all"), it swaps to a Back link + the category title,
         App Store style. -->
    <template v-if="!activeCategory">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h1 class="text-2xl font-semibold text-ink-gray-9">Marketplace</h1>
          <p class="mt-1 text-p-base text-ink-gray-5">
            Apps built by developers worldwide, ready to install on {{ server.name }}'s sites.
          </p>
        </div>
        <Tooltip :text="`This server runs ${versionLabel}. Only apps that support it can be installed.`">
          <span class="mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-outline-gray-2 bg-surface-gray-1 px-2.5 py-1 text-p-sm text-ink-gray-6">
            <span class="lucide-box size-3.5" />
            {{ versionLabel }}
          </span>
        </Tooltip>
      </div>

      <!-- Arriving from a site preselects it; that's the only banner. Direct entry
           shows nothing — you browse first and pick where to install on commit. -->
      <div v-if="preselectedSite" class="mt-4 flex items-center gap-2 rounded-lg border border-outline-gray-2 bg-surface-gray-1 px-3 py-2">
        <SiteIcon size="sm" />
        <span class="text-sm text-ink-gray-7">Installing onto <span class="font-medium text-ink-gray-9">{{ preselectedSite.name }}</span></span>
        <button v-if="liveSites.length > 1" class="ml-auto text-sm text-ink-gray-5 underline-offset-2 hover:underline" @click="siteSelectOpen = true">Choose a different site</button>
      </div>
      <Alert
        v-else-if="!liveSites.length"
        theme="yellow"
        class="mt-4"
        :title="`${server.name} has no live site yet — create one first, then install apps on it.`"
      />
    </template>

    <template v-else>
      <h1 class="text-2xl font-semibold text-ink-gray-9">{{ detail.label }}</h1>
      <p class="mt-1 text-p-base text-ink-gray-5">{{ detail.tagline }}</p>
    </template>

    <!-- Search. On the marketplace it collapses the sections into a flat result
         list; inside a category it sits alongside the Categories / Works-with
         filters. -->
    <FormControl v-if="!activeCategory" v-model="search" type="text" placeholder="Search for any app" autocomplete="off" class="mt-5 [&_input]:w-full" />
    <div v-else class="mt-5 flex flex-col gap-2 sm:flex-row">
      <FormControl v-model="search" type="text" placeholder="Search for any app" autocomplete="off" class="flex-1 [&_input]:w-full" />
      <FormControl v-model="categoryFilter" type="select" :options="categoryFilterOptions" class="sm:w-44" />
      <FormControl v-model="worksWith" type="select" :options="worksWithOptions" class="sm:w-44" />
    </div>

    <!-- ── Category detail ("See all") ──────────────────────────────────── -->
    <div v-if="activeCategory" class="mt-4">
      <div class="grid gap-x-8 sm:grid-cols-2">
        <MarketplaceAppRow
          v-for="app in detail.apps"
          :key="app.key"
          :app="app"
          :version-label="versionLabel"
          :installing="isInstalling(app.key)"
          :progress="installProgress[app.key]"
          :failed="isFailed(app.key)"
          @install="onInstall(app)"
          @cancel="cancelInstall(app.key)"
          @retry="retryInstall(app)"
          @view-log="viewLog"
        />
      </div>
      <p v-if="!detail.apps.length" class="py-3 text-p-sm text-ink-gray-5">No apps match{{ search ? ` “${search}”` : '' }}.</p>
    </div>

    <!-- ── Search results (flat list) ───────────────────────────────────── -->
    <div v-else-if="search.trim()" class="mt-4">
      <div class="grid gap-x-8 sm:grid-cols-2">
        <MarketplaceAppRow
          v-for="app in searchResults"
          :key="app.key"
          :app="app"
          :version-label="versionLabel"
          :installing="isInstalling(app.key)"
          :progress="installProgress[app.key]"
          :failed="isFailed(app.key)"
          @install="onInstall(app)"
          @cancel="cancelInstall(app.key)"
          @retry="retryInstall(app)"
          @view-log="viewLog"
        />
      </div>
      <p v-if="!searchResults.length" class="py-3 text-p-sm text-ink-gray-5">No apps match “{{ search }}”.</p>
    </div>

    <!-- ── Browse: Featured + a section per category + All apps ──────────── -->
    <div v-else>
      <section v-for="s in browseSections" :key="s.key" class="mt-8 first:mt-6">
        <div class="mb-1 flex items-center justify-between">
          <h2 class="text-base font-semibold text-ink-gray-9">{{ s.label }}</h2>
          <button
            v-if="s.apps.length > PREVIEW"
            class="flex items-center gap-0.5 text-p-sm font-medium text-ink-gray-6 hover:text-ink-gray-9"
            @click="openCategory(s.key)"
          >
            See all <span class="lucide-chevron-right size-4" />
          </button>
        </div>
        <div class="grid gap-x-8 sm:grid-cols-2">
          <MarketplaceAppRow
            v-for="app in s.apps.slice(0, PREVIEW)"
            :key="app.key"
            :app="app"
            :version-label="versionLabel"
            :installing="isInstalling(app.key)"
            :progress="installProgress[app.key]"
            :failed="isFailed(app.key)"
            @install="onInstall(app)"
            @cancel="cancelInstall(app.key)"
            @retry="retryInstall(app)"
            @view-log="viewLog"
          />
        </div>
      </section>

      <!-- Install from a GitHub repo (marketplace-only path). The last app row's
           own bottom border is the divider here, so no border-t. -->
      <div class="mt-6">
        <button v-if="!ghOpen" class="text-sm text-ink-gray-6 underline-offset-2 hover:underline" @click="ghOpen = true">
          Building your own? Install from GitHub
        </button>
        <div v-else class="grid gap-3 sm:grid-cols-[1fr,8rem,auto] sm:items-end">
          <FormControl v-model="ghRepo" type="text" label="GitHub repository" placeholder="github.com/you/your-app" />
          <FormControl v-model="ghBranch" type="text" label="Branch" placeholder="develop" />
          <Button variant="subtle" label="Install" :disabled="!ghRepo.trim()" @click="onInstallGitHub" />
        </div>
      </div>
    </div>

    <!-- Choose where to install (direct entry, or "All sites"). Skipped when a
         site was preselected. -->
    <Dialog v-model:open="pickerOpen" size="sm">
      <template #title><span class="text-xl font-semibold text-ink-gray-9">Install {{ pending?.name || 'app' }}</span></template>
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

    <!-- Switch the preselected site (only offered when there's more than one). -->
    <Dialog v-model:open="siteSelectOpen" size="sm">
      <template #title><span class="text-xl font-semibold text-ink-gray-9">Choose a site</span></template>
      <div class="space-y-2">
        <button
          v-for="s in liveSites"
          :key="s.id"
          class="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors"
          :class="s.id === preselectId ? 'border-outline-gray-4 ring-1 ring-outline-gray-4' : 'border-outline-gray-2 hover:bg-surface-gray-1'"
          @click="switchSite(s)"
        >
          <SiteIcon size="sm" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium text-ink-gray-9">{{ s.name }}</span>
            <span class="block truncate text-xs text-ink-gray-5">{{ s.apps.length }} {{ s.apps.length === 1 ? 'app' : 'apps' }} · {{ versionLabel }}</span>
          </span>
          <span v-if="s.id === preselectId" class="lucide-check size-4 shrink-0 text-ink-gray-7" />
        </button>
      </div>
    </Dialog>
  </ServerShell>
</template>

<script setup>
import { computed, onUnmounted, reactive, ref, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button, Dialog, FormControl, Tooltip, toast } from 'frappe-ui'
import Alert from '../../components/Alert.vue'
import MarketplaceAppRow from '../../components/MarketplaceAppRow.vue'
import ServerShell from '../../components/ServerShell.vue'
import SiteIcon from '../../components/SiteIcon.vue'
import { APP_CATALOG, APP_CATEGORIES, categoryOf, versionById, worksWithOf } from '../../data/catalog'
import { useCloudStore } from '../../stores/cloud'

const store = useCloudStore()
const route = useRoute()
const router = useRouter()

const server = computed(() => store.findServer(route.params.serverId) || store.currentServer)
watchEffect(() => {
  if (!server.value) router.replace('/')
})
// Inside a category ("See all") the breadcrumb becomes the way back — the
// clickable "Marketplace" crumb drops the ?category= param, and a browser/
// trackpad back gesture pops that same history entry, landing here rather than
// on wherever you came from before the marketplace.
const marketplacePath = computed(() => `/manage/${server.value.id}/marketplace`)
const crumbs = computed(() =>
  activeCategory.value
    ? [{ label: 'Marketplace', route: marketplacePath.value }, { label: detail.value.label }]
    : [{ label: 'Marketplace' }],
)

const versionLabel = computed(() => versionById(server.value.version).label)
const liveSites = computed(() => (server.value?.sites || []).filter((s) => s.status === 'live'))

// Arrived from a site (?site=) → that live site is preselected, and installs go
// straight to it. Direct entry leaves it null: you browse, then pick on commit.
const preselectId = ref(route.query.site || null)
const preselectedSite = computed(() => liveSites.value.find((s) => s.id === preselectId.value) || null)
const siteSelectOpen = ref(false)
function switchSite(site) {
  preselectId.value = site.id
  siteSelectOpen.value = false
}

const search = ref('')

// ── Catalog shaping ──────────────────────────────────────────────────────
// Every browse view renders the same decorated app: compatibility with this
// server, what it needs if locked, and whether it's already on the site we
// arrived from.
function decorate(a) {
  const ver = server.value?.version
  const onSite = new Set((preselectedSite.value?.apps || []).map((x) => x.key))
  return {
    ...a,
    compatible: a.compat.includes(ver),
    needs: versionById(a.compat[0]).label,
    installedHere: onSite.has(a.key),
    worksWith: worksWithOf(a.key),
  }
}
const allApps = computed(() => APP_CATALOG.map(decorate))

function matches(app, q) {
  return app.name.toLowerCase().includes(q) || app.tagline.toLowerCase().includes(q)
}
function installsNum(app) {
  const s = String(app.installs || '').trim().toLowerCase()
  if (s.endsWith('m')) return parseFloat(s) * 1e6
  if (s.endsWith('k')) return parseFloat(s) * 1e3
  return parseFloat(s) || 0
}

// — Featured = most installed, across the whole catalog.
const featuredApps = computed(() => [...allApps.value].sort((a, b) => installsNum(b) - installsNum(a)))

// — Section-per-category preview cap and the sentinel keys the "See all" links
// route to (kept distinct from the site-picker's ALL constant).
const PREVIEW = 6
const FEATURED = 'featured'
const ALL_APPS = 'all'
const CATEGORY_TAGLINES = {
  integrations: 'Sync, connect and extend your Frappe apps with external services',
  utility: 'Everyday tools to get more out of your sites',
  payments: 'Collect payments the way your customers prefer',
  business: 'Run your operations end to end',
  'dev-tools': 'Build, debug and ship on the Frappe framework',
  localisation: 'Stay compliant, wherever you operate',
}

const browseSections = computed(() => {
  const out = [{ key: FEATURED, label: 'Featured apps', apps: featuredApps.value }]
  for (const c of APP_CATEGORIES) {
    const apps = allApps.value.filter((a) => categoryOf(a.key) === c.value)
    if (apps.length) out.push({ key: c.value, label: c.label, apps })
  }
  out.push({ key: ALL_APPS, label: 'All apps', apps: allApps.value })
  return out
})

const searchResults = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return []
  return allApps.value.filter((a) => matches(a, q))
})

// ── "See all" category detail ────────────────────────────────────────────
// The active category lives in the URL (?category=), so it's a real history
// entry: "See all" pushes, the breadcrumb pops, and the back gesture works.
const activeCategory = computed(() => route.query.category || null)
function openCategory(key) {
  router.push({ path: marketplacePath.value, query: { ...route.query, category: key } })
}
// A fresh search + cleared filters whenever we cross into or out of a category.
watch(activeCategory, () => {
  search.value = ''
  worksWith.value = ''
})

// The "Categories" dropdown doubles as a section switcher — picking one routes
// to that view (so history/back stays consistent).
const categoryFilter = computed({
  get: () => activeCategory.value,
  set: (v) => openCategory(v),
})
const categoryFilterOptions = [
  { label: 'Featured', value: FEATURED },
  { label: 'All apps', value: ALL_APPS },
  ...APP_CATEGORIES,
]

// "Works with" — narrow to apps built for a given Frappe app (ERPNext, HR, …).
const worksWith = ref('')

// The set of apps for the current view, before search / works-with narrowing.
const detailBaseApps = computed(() => {
  const v = activeCategory.value
  if (!v) return []
  if (v === FEATURED) return featuredApps.value.slice(0, 12)
  if (v === ALL_APPS) return allApps.value
  return allApps.value.filter((a) => categoryOf(a.key) === v)
})

// Only offer "Works with" values that actually appear in this view.
const worksWithOptions = computed(() => {
  const seen = [...new Set(detailBaseApps.value.map((a) => a.worksWith))].sort()
  return [{ label: 'Works with', value: '' }, ...seen.map((w) => ({ label: w, value: w }))]
})

const detail = computed(() => {
  const v = activeCategory.value
  let label
  let tagline
  if (v === FEATURED) {
    label = 'Featured apps'
    tagline = 'The most installed apps on Frappe Cloud'
  } else if (v === ALL_APPS) {
    label = 'All apps'
    tagline = 'Every app in the marketplace'
  } else {
    const c = APP_CATEGORIES.find((x) => x.value === v)
    label = c?.label || 'Apps'
    tagline = CATEGORY_TAGLINES[v] || `${label} apps for your sites`
  }
  const q = search.value.trim().toLowerCase()
  const apps = detailBaseApps.value.filter(
    (a) => (!q || matches(a, q)) && (!worksWith.value || a.worksWith === worksWith.value),
  )
  return { label, tagline, apps }
})

// — Install ring: a real-feeling determinate ring that fills over ~30s against a
// chosen site, then commits through the store (which can fail in edge mode).
const INSTALL_MS = 30000
const TICK_MS = 200
const installProgress = reactive({})
const installTargetId = reactive({}) // app.key → site id it's installing onto
const installTimers = {}
const failedKeys = reactive(new Set())
const isInstalling = (key) => key in installProgress
const isFailed = (key) => failedKeys.has(key)

// Entry point from a row's Install button: go straight to the preselected site,
// otherwise ask where it should land.
function onInstall(app) {
  if (!liveSites.value.length) {
    toast('Create a live site first, then install apps onto it')
    return
  }
  if (preselectedSite.value) beginRing(app, preselectedSite.value.id)
  else openPicker(app)
}
function retryInstall(app) {
  const siteId = installTargetId[app.key]
  if (siteId && store.findSite(siteId)) beginRing(app, siteId)
  else onInstall(app)
}

function beginRing(app, siteId) {
  failedKeys.delete(app.key)
  installTargetId[app.key] = siteId
  installProgress[app.key] = 0
  const step = (TICK_MS / INSTALL_MS) * 100
  installTimers[app.key] = setInterval(() => {
    const next = (installProgress[app.key] || 0) + step
    if (next >= 100) {
      installProgress[app.key] = 100
      stopTimer(app.key)
      commitInstall(app)
    } else {
      installProgress[app.key] = next
    }
  }, TICK_MS)
}
function commitInstall(app) {
  const site = store.findSite(installTargetId[app.key])
  if (!site) {
    delete installProgress[app.key]
    return
  }
  store
    .addApp(site.id, app.key)
    .then(() => {
      delete installProgress[app.key]
      toast.success(`${app.name} installed on ${site.name}`)
    })
    .catch(() => {
      delete installProgress[app.key]
      failedKeys.add(app.key)
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
      toast.error(`Couldn't install ${app.name} — try again`)
    })
}
function cancelInstall(key) {
  stopTimer(key)
  delete installProgress[key]
  toast('Install cancelled')
}
function stopTimer(key) {
  clearInterval(installTimers[key])
  delete installTimers[key]
}
function viewLog() {
  router.push(`/manage/${server.value.id}/developer/tasks`)
}
onUnmounted(() => Object.keys(installTimers).forEach(stopTimer))

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
    router.push(`/manage/${server.value.id}`)
    return
  }
  const site = store.findSite(targetSiteId.value)
  if (!site) return
  if (payload.github) commitGitHub(site, payload)
  else beginRing(payload, site.id)
}
function fireInstall(site, payload) {
  return payload.github
    ? store.addCustomApp(site.id, { repo: payload.repo, branch: payload.branch })
    : store.addApp(site.id, payload.key)
}

// — Install from GitHub (marketplace-only). Same destination logic: straight to
// the preselected site, otherwise through the picker.
const ghOpen = ref(false)
const ghRepo = ref('')
const ghBranch = ref('')
function resetGh() {
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
  router.push(`/manage/${server.value.id}/sites/${site.id}`)
}
</script>

<template>
  <ServerShell v-if="server" :server="server" :crumbs="crumbs">
    <!-- Title + tagline as one block; the version sits beside it as a quiet
         context chip, not a third sentence. It's informational only — you don't
         upgrade a whole server (risking every site on it) to install one app, so
         there's no "change" here. That lives in the server's own upgrade flow. -->
    <div class="flex items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold text-ink-gray-9">Marketplace</h1>
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
    <div v-else-if="!liveSites.length" class="mt-4 flex items-center gap-2 rounded-lg border border-outline-amber-1 bg-surface-amber-1 px-3 py-2 text-sm text-ink-amber-8">
      <span class="lucide-triangle-alert size-4 shrink-0" />
      {{ server.name }} has no live site yet — create one first, then install apps on it.
    </div>

    <!-- Search + category filter. -->
    <div class="mt-5 flex flex-col gap-2 sm:flex-row">
      <FormControl v-model="search" type="text" placeholder="Search for any app" autocomplete="off" class="flex-1" />
      <FormControl v-model="category" type="select" :options="categoryOptions" class="sm:w-48" />
    </div>

    <div class="mt-5 text-xs font-medium uppercase tracking-wide text-ink-gray-5">From Frappe</div>

    <!-- App rows — one tappable list. Marketplace is a catalog: it installs and
         shows status, but managing an installed app (update, uninstall) happens
         on the site that owns it, so there's a single source of truth. -->
    <div class="mt-2 grid gap-x-8 sm:grid-cols-2">
      <div v-for="app in marketApps" :key="app.key" class="flex items-center gap-2.5">
        <AppIcon :app-key="app.key" size="md" class="shrink-0" />
        <div class="flex min-w-0 flex-1 items-center justify-between gap-2 border-b border-outline-gray-2 py-4">
          <div class="min-w-0">
            <div class="flex items-center gap-1.5">
              <span class="truncate text-base font-medium text-ink-gray-8">{{ app.name }}</span>
              <span class="shrink-0 text-p-xs text-ink-gray-5">{{ app.version }}</span>
            </div>
            <div v-if="isFailed(app.key)" class="truncate text-p-sm text-ink-red-6">Install failed — couldn't build on this server</div>
            <div v-else class="truncate text-p-sm text-ink-gray-5">{{ app.tagline }}</div>
          </div>

          <!-- Installing: a determinate ring that fills over ~30s, with a stop
               control in the center to cancel mid-flight. -->
          <div v-if="isInstalling(app.key)" class="relative grid size-7 shrink-0 place-items-center">
            <svg class="size-7 -rotate-90" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="var(--surface-gray-3)" stroke-width="2.5" />
              <circle
                cx="12" cy="12" r="9"
                stroke="var(--ink-gray-8)" stroke-width="2.5" stroke-linecap="round"
                :stroke-dasharray="RING_C"
                :stroke-dashoffset="RING_C * (1 - (installProgress[app.key] || 0) / 100)"
                class="transition-[stroke-dashoffset] duration-200 ease-linear"
              />
            </svg>
            <Tooltip text="Cancel install">
              <button class="absolute inset-0 grid place-items-center text-ink-gray-6 hover:text-ink-gray-9" aria-label="Cancel install" @click="cancelInstall(app.key)">
                <span class="lucide-x size-3" />
              </button>
            </Tooltip>
          </div>

          <!-- Failed: name turns red above; offer a retry and the log. -->
          <div v-else-if="isFailed(app.key)" class="flex shrink-0 items-center gap-1">
            <Button size="xs" variant="ghost" label="View log" @click="viewLog" />
            <Button size="sm" variant="subtle" label="Retry" @click="retryInstall(app)" />
          </div>

          <!-- Already on the site we arrived from — status, not a control.
               Updating or removing it happens on that site's Apps page. -->
          <span v-else-if="app.installedHere" class="flex shrink-0 items-center gap-1 text-p-sm text-ink-gray-5">
            <span class="lucide-check size-4 text-ink-green-6" /> Installed
          </span>

          <!-- Not installed, version-locked: explain what it needs. -->
          <Tooltip v-else-if="!app.compatible" :text="`Needs ${app.needs} — this server runs ${versionLabel}`">
            <span class="inline-flex shrink-0">
              <Button variant="ghost" size="xs" :label="`Needs ${app.needs}`" disabled class="pointer-events-none" />
            </span>
          </Tooltip>

          <!-- Not installed, installable. -->
          <Button v-else size="sm" label="Install" class="shrink-0" @click="onInstall(app)" />
        </div>
      </div>
    </div>
    <p v-if="!marketApps.length" class="py-3 text-p-sm text-ink-gray-5">No apps match{{ search ? ` “${search}”` : '' }}.</p>

    <!-- Install from a GitHub repo (marketplace-only path). -->
    <div class="mt-4 border-t border-outline-alpha-gray-1 pt-4">
      <button v-if="!ghOpen" class="text-sm text-ink-gray-6 underline-offset-2 hover:underline" @click="ghOpen = true">
        Building your own? Install from GitHub
      </button>
      <div v-else class="grid gap-3 sm:grid-cols-[1fr,8rem,auto] sm:items-end">
        <FormControl v-model="ghRepo" type="text" label="GitHub repository" placeholder="github.com/you/your-app" />
        <FormControl v-model="ghBranch" type="text" label="Branch" placeholder="develop" />
        <Button variant="subtle" label="Install" :disabled="!ghRepo.trim()" @click="onInstallGitHub" />
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
import { computed, onUnmounted, reactive, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button, Dialog, FormControl, Tooltip, toast } from 'frappe-ui'
import AppIcon from '../../components/AppIcon.vue'
import ServerShell from '../../components/ServerShell.vue'
import SiteIcon from '../../components/SiteIcon.vue'
import { APP_CATALOG, APP_CATEGORIES, categoryOf, versionById } from '../../data/catalog'
import { useCloudStore } from '../../stores/cloud'

const store = useCloudStore()
const route = useRoute()
const router = useRouter()

const server = computed(() => store.findServer(route.params.serverId) || store.currentServer)
watchEffect(() => {
  if (!server.value) router.replace('/')
})
const crumbs = computed(() => [{ label: 'Marketplace' }])

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
const category = ref('')
const categoryOptions = [{ label: 'All categories', value: '' }, ...APP_CATEGORIES]

// — Catalog: every app, filtered by search + category, ranked compatible-first
// (locked apps sink), with installed-here status when we have a site context.
const marketApps = computed(() => {
  const q = search.value.trim().toLowerCase()
  const ver = server.value?.version
  const onSite = new Set((preselectedSite.value?.apps || []).map((a) => a.key))
  const list = APP_CATALOG
    .filter(
      (a) =>
        (!q || a.name.toLowerCase().includes(q) || a.tagline.toLowerCase().includes(q)) &&
        (!category.value || categoryOf(a.key) === category.value),
    )
    .map((a) => ({
      ...a,
      compatible: a.compat.includes(ver),
      needs: versionById(a.compat[0]).label,
      installedHere: onSite.has(a.key),
    }))
  const rank = (x) => (x.installedHere ? 1 : x.compatible ? 0 : 2)
  return list.sort((a, b) => rank(a) - rank(b))
})

// — Install ring: a real-feeling determinate ring that fills over ~30s against a
// chosen site, then commits through the store (which can fail in edge mode).
const RING_C = 2 * Math.PI * 9
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

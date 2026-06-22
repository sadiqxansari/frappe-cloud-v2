<template>
  <ServerShell v-if="server" :server="server" :crumbs="crumbs">
    <h1 class="text-xl font-semibold text-ink-gray-9">Marketplace</h1>
    <p class="mt-1 text-base leading-6 text-ink-gray-5">
      Apps built by developers worldwide, ready to install on {{ server.name }}'s sites.
    </p>

    <!-- Current Frappe version + change action — apps below are gated on this,
         so surface it upfront rather than only in tooltips. (#38) -->
    <div class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-outline-gray-2 bg-surface-gray-1 px-4 py-3">
      <div class="flex min-w-0 items-center gap-2">
        <span class="lucide-box size-4 shrink-0 text-ink-gray-5" />
        <span class="text-sm text-ink-gray-6">
          This server runs <span class="font-medium text-ink-gray-9">{{ versionLabel }}</span> — apps must support it to install.
        </span>
      </div>
      <Button variant="outline" size="sm" label="Change version" icon-left="lucide-arrow-up-down" class="shrink-0" @click="versionOpen = true" />
    </div>

    <div v-if="preselectedSite" class="mt-3 flex items-center gap-2 rounded-lg border border-outline-gray-2 bg-surface-gray-1 px-3 py-2">
      <AppIcon :app-key="preselectedSite.apps[0]?.key || 'erpnext'" size="sm" />
      <span class="text-sm text-ink-gray-7">Installing onto <span class="font-medium text-ink-gray-9">{{ preselectedSite.name }}</span></span>
      <button class="ml-auto text-sm text-ink-gray-5 underline-offset-2 hover:underline" @click="siteSelectOpen = true">Choose a different site</button>
    </div>

    <FormControl v-model="search" type="text" placeholder="Search for any app" autocomplete="off" class="mt-5" />

    <div class="mt-5 text-xs font-medium uppercase tracking-wide text-ink-gray-5">From Frappe</div>

    <!-- App cards -->
    <div class="mt-2 grid gap-3 sm:grid-cols-2">
      <div
        v-for="app in filteredApps"
        :key="app.key"
        class="flex flex-col gap-3 rounded-lg border border-outline-gray-2 bg-surface-white p-4"
      >
        <div class="flex items-start gap-3">
          <AppIcon :app-key="app.key" size="md" />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <span class="truncate text-sm font-medium text-ink-gray-9">{{ app.name }}</span>
              <span class="text-xs text-ink-gray-4">{{ app.version }}</span>
            </div>
            <div class="mt-0.5 line-clamp-2 text-sm leading-5 text-ink-gray-5">{{ app.tagline }}</div>
          </div>
        </div>
        <div class="flex items-center justify-between">
          <span class="flex items-center gap-1 text-sm tabular-nums text-ink-gray-5">
            <span class="lucide-download size-3.5" />
            {{ app.installs }}
          </span>
          <Tooltip v-if="!isCompatible(app)" :text="`This app needs ${neededLabel(app)}. ${server.name} runs ${versionLabel} — change the server's version to install it.`">
            <Button variant="outline" size="sm" :label="`Needs ${neededLabel(app)}`" disabled class="pointer-events-none" />
          </Tooltip>
          <Button v-else variant="subtle" size="sm" label="Install" @click="pick(app)" />
        </div>
      </div>
    </div>
    <EmptyState v-if="!filteredApps.length" class="mt-4" icon="lucide-search" title="No apps match" description="Try a different word, or install from a GitHub repo below." />

    <div class="mt-4 border-t border-outline-gray-1 pt-4">
      <button
        v-if="!ghOpen"
        class="text-sm text-ink-gray-6 underline-offset-2 hover:underline"
        @click="ghOpen = true"
      >
        Building your own? Install from GitHub
      </button>
      <div v-else class="grid gap-3 sm:grid-cols-[1fr,8rem,auto] sm:items-end">
        <FormControl v-model="ghRepo" type="text" label="GitHub repository" placeholder="github.com/you/your-app" />
        <FormControl v-model="ghBranch" type="text" label="Branch" placeholder="develop" />
        <Button variant="subtle" label="Install" :disabled="!ghRepo.trim()" @click="pickGitHub" />
      </div>
    </div>

    <!-- Switch which site we're installing onto -->
    <Dialog v-model:open="siteSelectOpen" size="sm">
      <template #title><span class="text-xl font-semibold text-ink-gray-9">Choose a site</span></template>
      <div v-if="liveSites.length" class="space-y-2">
        <button
          v-for="s in liveSites"
          :key="s.id"
          class="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors"
          :class="s.id === preselectId ? 'border-outline-gray-4 ring-1 ring-outline-gray-4' : 'border-outline-gray-2 hover:bg-surface-gray-1'"
          @click="chooseSite(s)"
        >
          <AppIcon :app-key="s.apps[0]?.key || 'erpnext'" size="sm" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium text-ink-gray-9">{{ s.name }}</span>
            <span class="block truncate text-xs text-ink-gray-5">{{ s.apps.length }} {{ s.apps.length === 1 ? 'app' : 'apps' }} · {{ versionLabel }}</span>
          </span>
          <span v-if="s.id === preselectId" class="lucide-check size-4 shrink-0 text-ink-gray-7" />
        </button>
      </div>
      <p v-else class="text-base leading-6 text-ink-gray-6">
        {{ server.name }} has no live site yet — create one first, then install apps on it.
      </p>
    </Dialog>

    <!-- Pick where it goes (entry 2, or when the preselected site can't take it) -->
    <Dialog v-model:open="pickerOpen" size="sm">
      <template #title>
        <span class="text-xl font-semibold text-ink-gray-9">Install {{ pending?.name || 'app' }}</span>
      </template>

      <div v-if="siteChoices.length" class="space-y-2">
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
          <AppIcon :app-key="c.site.apps[0]?.key || 'erpnext'" size="sm" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium text-ink-gray-9">{{ c.site.name }}</span>
            <span class="block truncate text-xs text-ink-gray-5">{{ c.note }}</span>
          </span>
        </button>
      </div>
      <p v-else class="text-base leading-6 text-ink-gray-6">
        {{ server.name }} has no live site yet — create one first, then install apps on it.
      </p>

      <template #actions>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" @click="pickerOpen = false" />
          <Button variant="solid" label="Install" :disabled="!targetSiteId" @click="installToTarget" />
        </div>
      </template>
    </Dialog>

    <!-- Change the server's Frappe version (#38) -->
    <ChangeVersionDialog v-model:open="versionOpen" :server="server" />
  </ServerShell>
</template>

<script setup>
import { computed, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button, Dialog, FormControl, Tooltip, toast } from 'frappe-ui'
import AppIcon from '../../components/AppIcon.vue'
import ChangeVersionDialog from '../../components/ChangeVersionDialog.vue'
import EmptyState from '../../components/EmptyState.vue'
import ServerShell from '../../components/ServerShell.vue'
import { APP_CATALOG, versionById } from '../../data/catalog'
import { useCloudStore } from '../../stores/cloud'

const store = useCloudStore()
const route = useRoute()
const router = useRouter()

const server = computed(() => store.findServer(route.params.serverId) || store.currentServer)
watchEffect(() => {
  if (!server.value) router.replace('/')
})
const crumbs = computed(() => [{ label: 'Marketplace' }])

// Entry 1: arrived from a site → that site is preselected (must be live + on this server).
const preselectId = ref(route.query.site || null)
const preselectedSite = computed(
  () => server.value?.sites.find((s) => s.id === preselectId.value && s.status === 'live') || null,
)

// "Choose a different site" → a site selector over this server's live sites.
const siteSelectOpen = ref(false)
const liveSites = computed(() => (server.value?.sites || []).filter((s) => s.status === 'live'))
const versionLabel = computed(() => versionById(server.value.version).label)
function chooseSite(site) {
  preselectId.value = site.id
  siteSelectOpen.value = false
}

const versionOpen = ref(false)
const search = ref('')
const ghOpen = ref(false)
const ghRepo = ref('')
const ghBranch = ref('')

const filteredApps = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return APP_CATALOG
  return APP_CATALOG.filter(
    (a) => a.name.toLowerCase().includes(q) || a.tagline.toLowerCase().includes(q),
  )
})

// A server runs one Frappe version; every site on it shares that version.
function isCompatible(app) {
  return app.compat.includes(server.value.version)
}
function neededLabel(app) {
  return versionById(app.compat[0]).label
}

// — Picker (entry 2): choose among this server's sites.
const pickerOpen = ref(false)
const pending = ref(null) // a catalog app, or { github:true, ... }
const targetSiteId = ref(null)

const siteChoices = computed(() => {
  const out = []
  for (const site of server.value?.sites || []) {
    if (site.status !== 'live') continue
    let note = `${site.name} · ${versionById(server.value.version).label}`
    let disabled = false
    if (pending.value && !pending.value.github && site.apps.some((a) => a.key === pending.value.key)) {
      note = `${site.name} · already installed`
      disabled = true
    }
    out.push({ site, note, disabled })
  }
  return out
})

function openPicker(payload) {
  pending.value = payload
  targetSiteId.value = siteChoices.value.find((c) => !c.disabled)?.site.id || null
  pickerOpen.value = true
}

function pick(app) {
  // Preselected + already-installed → just send them back to the site.
  if (preselectedSite.value) {
    if (preselectedSite.value.apps.some((a) => a.key === app.key)) {
      toast(`${app.name} is already on ${preselectedSite.value.name}`)
      return
    }
    commit(preselectedSite.value, app)
    return
  }
  openPicker(app)
}

function pickGitHub() {
  const payload = { github: true, name: ghRepo.value.split('/').pop(), repo: ghRepo.value.trim(), branch: ghBranch.value.trim() || 'develop' }
  if (preselectedSite.value) {
    commit(preselectedSite.value, payload)
    return
  }
  openPicker(payload)
}

// "All sites" option in the picker — installs onto every site that can take it.
const ALL = '__all__'
const eligibleSites = computed(() => siteChoices.value.filter((c) => !c.disabled).map((c) => c.site))
const allDisabled = computed(() => eligibleSites.value.length === 0)
const allNote = computed(() =>
  allDisabled.value
    ? 'Already on every site'
    : `Installs on ${eligibleSites.value.length} ${eligibleSites.value.length === 1 ? 'site' : 'sites'}`,
)

function installToTarget() {
  pickerOpen.value = false
  if (targetSiteId.value === ALL) {
    const sites = eligibleSites.value
    if (!sites.length) return
    sites.forEach((s) => fireInstall(s, pending.value))
    if (pending.value.github) {
      ghRepo.value = ''
      ghBranch.value = ''
      ghOpen.value = false
    }
    toast.success(`Installing ${pending.value.name} on ${sites.length} ${sites.length === 1 ? 'site' : 'sites'}…`)
    router.push(`/manage/${server.value.id}`)
    return
  }
  const site = store.findSite(targetSiteId.value)
  if (site) commit(site, pending.value)
}

function fireInstall(site, payload) {
  return payload.github
    ? store.addCustomApp(site.id, { repo: payload.repo, branch: payload.branch })
    : store.addApp(site.id, payload.key)
}

// Install = commit. Fire the install, then land back on the site's Installed apps
// so the user watches it go Installing… → Installed ✓.
function commit(site, payload) {
  const p = fireInstall(site, payload)
  if (payload.github) {
    toast.promise(p, {
      loading: `Installing on ${site.name}…`,
      success: (app) => `${app.name} installed on ${site.name}`,
      error: 'Install failed',
    })
    ghRepo.value = ''
    ghBranch.value = ''
    ghOpen.value = false
  } else {
    toast.promise(p, {
      loading: `Installing ${payload.name} on ${site.name}…`,
      success: `${payload.name} installed on ${site.name}`,
      error: 'Install failed',
    })
  }
  router.push(`/manage/${server.value.id}/sites/${site.id}`)
}
</script>

<template>
  <div v-if="site" class="min-h-screen bg-surface-gray-1">
    <!-- Desk-style top bar -->
    <header class="sticky top-0 z-10 border-b border-outline-gray-2 bg-surface-white">
      <div class="mx-auto flex h-12 max-w-6xl items-center gap-3 px-4">
        <div class="flex min-w-0 items-center gap-2">
          <span class="grid size-7 shrink-0 place-items-center rounded-md bg-surface-gray-2">
            <span class="lucide-layout-grid size-4 text-ink-gray-7" />
          </span>
          <span class="truncate text-sm font-medium text-ink-gray-9">{{ site.subdomain }}</span>
          <Dropdown v-if="siteOptions.length > 1" :options="siteOptions" placement="bottom-start">
            <Button variant="ghost" size="sm" icon="lucide-chevrons-up-down" label="Switch site" />
          </Dropdown>
        </div>

        <!-- Command bar (visual) -->
        <button
          class="mx-auto hidden h-8 w-full max-w-md items-center gap-2 rounded-lg border border-outline-gray-2 bg-surface-gray-1 px-3 text-sm text-ink-gray-5 hover:bg-surface-gray-2 sm:flex"
          @click="mock('Search')"
        >
          <span class="lucide-search size-4" />
          <span>Search or type a command</span>
          <kbd class="ml-auto rounded border border-outline-gray-2 bg-surface-white px-1.5 py-0.5 text-xs text-ink-gray-5">⌘K</kbd>
        </button>

        <div class="ml-auto flex shrink-0 items-center gap-1.5">
          <Button variant="ghost" icon="lucide-bell" label="Notifications" @click="mock('Notifications')" />
          <Button variant="ghost" icon="lucide-circle-help" label="Help" @click="mock('Help')" />
          <Button variant="outline" label="Manage" icon-left="lucide-cloud" @click="goManage" />
          <Dropdown :options="userOptions" placement="bottom-end">
            <button class="ml-1 rounded-full outline-none ring-outline-gray-3 focus-visible:ring-2">
              <Avatar :label="store.user.name || 'You'" size="md" />
            </button>
          </Dropdown>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-6xl px-6 py-10">
      <h1 class="text-xl font-semibold text-ink-gray-9">{{ greeting }}, {{ firstName }}</h1>
      <p class="mt-1 text-base text-ink-gray-5">Choose an app to get started.</p>

      <!-- Installed apps — the launcher grid, driven by what's on this site -->
      <section class="mt-8">
        <h2 class="text-xs font-medium uppercase tracking-wide text-ink-gray-5">Your apps</h2>
        <div class="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <button
            v-for="app in site.apps"
            :key="app.id"
            class="group flex flex-col gap-3 rounded-2xl border border-outline-gray-2 bg-surface-white p-5 text-left transition-all hover:-translate-y-0.5 hover:border-outline-gray-3 hover:shadow-md"
            @click="mock(app.name)"
          >
            <AppIcon :app-key="app.key" size="lg" />
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="truncate font-medium text-ink-gray-9">{{ app.name }}</span>
                <span class="lucide-arrow-up-right size-3.5 shrink-0 text-ink-gray-4 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <p class="mt-0.5 line-clamp-2 text-sm leading-5 text-ink-gray-5">{{ taglineOf(app) }}</p>
            </div>
          </button>
        </div>
      </section>

      <!-- Frappe core — always present in Desk -->
      <section class="mt-8">
        <h2 class="text-xs font-medium uppercase tracking-wide text-ink-gray-5">Frappe</h2>
        <div class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <button
            v-for="t in systemApps"
            :key="t.name"
            class="flex items-center gap-2.5 rounded-xl border border-outline-gray-2 bg-surface-white p-3 text-left hover:bg-surface-gray-1"
            @click="mock(t.name)"
          >
            <span class="grid size-8 shrink-0 place-items-center rounded-lg" :class="t.tile">
              <span class="size-4" :class="t.icon" />
            </span>
            <span class="truncate text-sm text-ink-gray-8">{{ t.name }}</span>
          </button>
        </div>
      </section>

      <p class="mt-8 text-xs text-ink-gray-4">
        A preview of the Frappe Desk you land on after logging in — your installed apps appear here.
      </p>
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Avatar, Button, Dropdown, toast } from 'frappe-ui'
import AppIcon from '../../components/AppIcon.vue'
import { appByKey } from '../../data/catalog'
import { useCloudStore } from '../../stores/cloud'

const store = useCloudStore()
const router = useRouter()

const ownServer = computed(() => store.serverOfSite(store.currentSiteId) || store.server)
const site = computed(() => store.currentSite || ownServer.value?.sites[0])

const firstName = computed(() => (store.user.name || 'there').split(' ')[0])
const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
})

// Tagline from the catalog; GitHub-installed apps fall back to their version.
function taglineOf(app) {
  return appByKey(app.key)?.tagline || `Custom app · ${app.version}`
}

// Frappe ships these on every site.
const systemApps = [
  { name: 'Settings', icon: 'lucide-settings', tile: 'bg-surface-gray-3 text-ink-gray-7' },
  { name: 'Users', icon: 'lucide-users', tile: 'bg-surface-gray-3 text-ink-gray-7' },
  { name: 'Website', icon: 'lucide-globe', tile: 'bg-surface-gray-3 text-ink-gray-7' },
  { name: 'App Builder', icon: 'lucide-blocks', tile: 'bg-surface-gray-3 text-ink-gray-7' },
  { name: 'Workflow', icon: 'lucide-workflow', tile: 'bg-surface-gray-3 text-ink-gray-7' },
  { name: 'Toolbox', icon: 'lucide-wrench', tile: 'bg-surface-gray-3 text-ink-gray-7' },
]

const siteOptions = computed(() => {
  const sites = ownServer.value?.sites.filter((s) => s.status === 'live') || []
  if (sites.length < 2) return []
  return sites.map((s) => ({
    label: s.subdomain,
    icon: s.id === site.value.id ? 'lucide-check' : 'lucide-globe',
    onClick: () => store.openSite(s.id),
  }))
})

const userOptions = computed(() => [
  { label: 'Manage server', icon: 'lucide-cloud', onClick: goManage },
  { label: 'Account settings', icon: 'lucide-settings', onClick: () => router.push('/settings') },
  {
    label: 'Sign out',
    icon: 'lucide-log-out',
    onClick: () => {
      store.loadScenario('fresh')
      router.push('/setup/account')
    },
  },
])

function goManage() {
  router.push(`/manage/${ownServer.value.id}`)
}

// The launcher is a visual mock — opening an app isn't wired.
function mock(name) {
  toast(`${name} would open here — this Desk view is a preview`)
}
</script>

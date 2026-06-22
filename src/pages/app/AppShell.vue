<template>
  <div v-if="site" class="min-h-screen bg-surface-elevation-1">
    <!-- Minimal Desk top bar: Frappe mark · search · notifications · account -->
    <header class="sticky top-0 z-10 border-b border-outline-gray-2 bg-surface-elevation-1">
      <div class="flex h-14 items-center gap-3 px-4">
        <span class="grid size-8 shrink-0 place-items-center rounded-md bg-[var(--ink-gray-9)] text-base font-bold text-ink-base">F</span>

        <button
          class="mx-auto flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-outline-gray-2 bg-surface-elevation-1 px-3 text-sm text-ink-gray-5 hover:bg-surface-gray-1"
          @click="mock('Search')"
        >
          <span class="lucide-search size-4" />
          <span>Search</span>
          <kbd class="ml-auto text-xs text-ink-gray-4">⌘K</kbd>
        </button>

        <div class="flex shrink-0 items-center gap-1.5">
          <Button variant="ghost" icon="lucide-bell" label="Notifications" @click="mock('Notifications')" />
          <Dropdown :options="userOptions" placement="bottom-end">
            <button class="ml-1 rounded-full outline-none ring-outline-gray-3 focus-visible:ring-2">
              <Avatar :label="store.user.name || 'You'" size="md" />
            </button>
          </Dropdown>
        </div>
      </div>
    </header>

    <!-- The launcher: just the installed apps, logo and name, centered -->
    <main class="mx-auto max-w-5xl px-6 py-16">
      <div class="grid grid-cols-3 gap-x-6 gap-y-10 sm:grid-cols-4 md:grid-cols-6">
        <button
          v-for="app in site.apps"
          :key="app.id"
          class="flex flex-col items-center gap-2.5 rounded-xl p-2 transition-colors hover:bg-surface-gray-1"
          @click="mock(app.name)"
        >
          <AppIcon :app-key="app.key" size="lg" />
          <span class="text-center text-sm font-medium text-ink-gray-8">{{ app.name }}</span>
        </button>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Avatar, Button, Dropdown, toast } from 'frappe-ui'
import AppIcon from '../../components/AppIcon.vue'
import { useCloudStore } from '../../stores/cloud'

const store = useCloudStore()
const router = useRouter()

const ownServer = computed(() => store.serverOfSite(store.currentSiteId) || store.server)
const site = computed(() => store.currentSite || ownServer.value?.sites[0])

const userOptions = computed(() => {
  const opts = []
  // Switch sites from the account menu when there's more than one.
  const liveSites = ownServer.value?.sites.filter((s) => s.status === 'live') || []
  if (liveSites.length > 1) {
    liveSites.forEach((s) =>
      opts.push({
        label: s.subdomain,
        icon: s.id === site.value?.id ? 'lucide-check' : 'lucide-globe',
        onClick: () => store.openSite(s.id),
      }),
    )
  }
  opts.push({ label: 'Manage server', icon: 'lucide-cloud', onClick: goManage })
  opts.push({ label: 'Account settings', icon: 'lucide-settings', onClick: () => window.open('/settings', '_blank', 'noopener') })
  opts.push({
    label: 'Sign out',
    icon: 'lucide-log-out',
    onClick: () => {
      store.loadScenario('fresh')
      router.push('/setup/account')
    },
  })
  return opts
})

function goManage() {
  window.open(`/manage/${ownServer.value.id}`, '_blank', 'noopener')
}

// Opening an app is a visual mock — this Desk view is a preview.
function mock(name) {
  toast(`${name} would open here — this Desk view is a preview`)
}
</script>

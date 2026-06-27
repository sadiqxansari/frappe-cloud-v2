<template>
  <!-- A suspended site can't load its Desk — serve the FC paused interceptor on
       this same URL instead (decision 11). Flips reactively the moment credit
       runs out or comes back. -->
  <SitePausedPage v-if="siteSuspended" />
  <div v-else-if="site" class="min-h-screen bg-surface-elevation-1">
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
          <!-- Frappe Cloud — a settings-gear front door to billing, apps and
               domains, without leaving the Desk. Gated to billing-permitted
               members (decision 10). -->
          <Button
            v-if="store.canManageBilling"
            variant="ghost"
            icon="lucide-settings"
            label="Frappe Cloud"
            @click="openManage('Billing')"
          />
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
      <!-- Fix-now billing problems surface here, in the Desk — not buried in the
           modal (decision 11). The action opens the Frappe Cloud modal. -->
      <Alert
        v-if="deskAlert"
        :theme="deskAlert.theme"
        :title="deskAlert.title"
        :description="deskAlert.description"
        :action="{ label: deskAlert.action, onClick: () => openManage(deskAlert.tab) }"
        class="mb-8"
      />

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

    <FcManageModal v-model:open="manageOpen" :initial-tab="manageTab" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Avatar, Button, Dropdown, toast } from 'frappe-ui'
import Alert from '../../components/Alert.vue'
import AppIcon from '../../components/AppIcon.vue'
import FcManageModal from '../../components/FcManageModal.vue'
import SitePausedPage from './SitePausedPage.vue'
import { LOW_CREDIT_THRESHOLD, useCloudStore } from '../../stores/cloud'

const store = useCloudStore()
const router = useRouter()

const ownServer = computed(() => store.serverOfSite(store.currentSiteId) || store.server)
const site = computed(() => store.currentSite || ownServer.value?.sites[0])

// When the site is paused, the Desk gives way to the FC interceptor (decision 11).
const siteSuspended = computed(() => site.value?.status === 'suspended')

// Server resource pressure, surfaced as a proactive nudge — not a status tab.
const serverHealth = computed(() => store.healthOf(ownServer.value))

// The one fix-now billing problem worth a Desk banner, if any (decision 11).
const deskAlert = computed(() => {
  if (store.paymentMethods.some((p) => p.status === 'declined')) {
    return { theme: 'red', title: "A payment didn't go through", description: 'Update your payment method so your site keeps running.', action: 'Fix payment', tab: 'Billing' }
  }
  if (store.isTrial && store.accountCredit <= LOW_CREDIT_THRESHOLD) {
    return { theme: 'yellow', title: 'Your trial credit is running low', description: "Add a payment method to keep your site running once it's used up.", action: 'Set up billing', tab: 'Billing' }
  }
  if (!serverHealth.value.ok) {
    return { theme: 'yellow', title: 'Your server is filling up', description: "It's close to its plan limits — upgrade to add headroom.", action: 'Review usage', tab: 'Billing' }
  }
  return null
})

// The Frappe Cloud modal — the launcher's destination. The entry point picks
// the tab: the launcher opens Apps; a billing/usage banner opens its own tab.
const manageOpen = ref(false)
const manageTab = ref('Billing')
function openManage(tab = 'Billing') {
  manageTab.value = tab
  manageOpen.value = true
}

// Switching sites and billing now live in the FC modal (the top-bar switcher
// was a prototype artifact — FC doesn't own the Desk chrome in production). The
// avatar menu keeps the deliberate escape hatches to the Server / Central
// shells, return-aware so the user always lands back here (decision 3).
const userOptions = computed(() => [
  { label: 'Account settings', icon: 'lucide-settings', onClick: goAccount },
  {
    label: 'Sign out',
    icon: 'lucide-log-out',
    onClick: () => {
      store.loadScenario('fresh')
      router.push('/setup/account')
    },
  },
])

function goAccount() {
  store.redirectWithReturn(router, '/settings', origin())
}
function origin() {
  return { label: site.value?.subdomain || 'your site', path: '/app' }
}

// Opening an app is a visual mock — this Desk view is a preview.
function mock(name) {
  toast(`${name} would open here — this Desk view is a preview`)
}
</script>

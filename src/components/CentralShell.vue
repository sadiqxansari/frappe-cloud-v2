<template>
  <div class="flex h-screen overflow-hidden bg-surface-white">
    <aside
      class="relative flex shrink-0 flex-col border-r border-outline-gray-1 bg-surface-menu-bar p-2 transition-all duration-300 ease-in-out"
      :class="collapsed ? 'w-14' : 'w-60'"
    >
      <!-- Brand — Frappe Cloud (Central) -->
      <RouterLink
        to="/servers"
        class="mb-2 flex h-10 shrink-0 items-center gap-2 rounded-lg px-1.5 hover:bg-surface-gray-2"
      >
        <img :src="cloudLogo" alt="Frappe Cloud" class="size-7 shrink-0 rounded-md" />
        <span v-if="!collapsed" class="truncate text-base font-semibold text-ink-gray-9">Frappe Cloud</span>
      </RouterLink>

      <!-- Team switcher (issue #7) -->
      <Dropdown :options="teamOptions" placement="bottom-start">
        <button
          class="mb-3 flex w-full shrink-0 items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-surface-gray-2"
          :title="collapsed ? store.team.name : undefined"
        >
          <img v-if="store.team.avatar" :src="store.team.avatar" class="size-6 shrink-0 rounded-md object-cover" />
          <span v-else class="grid size-6 shrink-0 place-items-center rounded-md bg-surface-gray-3 text-xs font-semibold text-ink-gray-7">{{ teamInitial }}</span>
          <template v-if="!collapsed">
            <span class="min-w-0 flex-1 truncate text-left text-sm font-medium text-ink-gray-8">{{ store.team.name }}</span>
            <span class="lucide-chevrons-up-down size-3.5 shrink-0 text-ink-gray-5" />
          </template>
        </button>
      </Dropdown>

      <nav class="flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden">
        <button
          v-for="item in items"
          :key="item.label"
          class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors"
          :class="item.active ? 'bg-surface-selected text-ink-gray-9 shadow-sm' : 'text-ink-gray-7 hover:bg-surface-gray-2'"
          :title="collapsed ? item.label : undefined"
          @click="router.push(item.to)"
        >
          <span class="size-4 shrink-0 text-ink-gray-6" :class="item.icon" />
          <span v-if="!collapsed" class="truncate">{{ item.label }}</span>
        </button>
      </nav>

      <!-- Explicit, remembered collapse toggle (issue #3) -->
      <button
        class="mb-1 flex w-full shrink-0 items-center gap-2 rounded px-2 py-1.5 text-sm text-ink-gray-6 transition-colors hover:bg-surface-gray-2"
        :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        @click="collapsed = !collapsed"
      >
        <span class="size-4 shrink-0" :class="collapsed ? 'lucide-panel-left-open' : 'lucide-panel-left-close'" />
        <span v-if="!collapsed" class="truncate">Collapse</span>
      </button>

      <Dropdown :options="userOptions" placement="top-start">
        <button class="flex w-full shrink-0 items-center gap-2 rounded-lg p-1.5 hover:bg-surface-gray-2">
          <Avatar :label="store.user.name || 'You'" size="sm" />
          <template v-if="!collapsed">
            <span class="min-w-0 flex-1 truncate text-left text-sm text-ink-gray-8">{{ store.user.name || 'You' }}</span>
            <span class="lucide-chevrons-up-down size-3.5 shrink-0 text-ink-gray-5" />
          </template>
        </button>
      </Dropdown>

      <button
        class="absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize transition-colors hover:bg-surface-gray-4"
        :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        @click="collapsed = !collapsed"
      />
    </aside>

    <div class="flex min-w-0 flex-1 flex-col">
      <div class="relative h-0.5 shrink-0 overflow-hidden">
        <div v-if="store.busy > 0" class="console-bar absolute inset-y-0 left-0 bg-[var(--ink-gray-8)]" />
      </div>

      <header class="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-outline-gray-1 bg-surface-white px-4">
        <Breadcrumbs v-if="crumbs?.length" :items="crumbs" class="min-w-0" />
        <div v-else />
        <div class="flex shrink-0 items-center gap-2">
          <button
            v-if="showCredit"
            class="hidden items-center gap-1.5 rounded-full border px-3 py-1 text-sm sm:flex"
            :class="store.creditExpired ? 'border-outline-red-1 text-ink-red-3' : 'border-outline-gray-2 hover:bg-surface-gray-1'"
            @click="router.push('/billing')"
          >
            <span class="lucide-zap size-3.5" :class="store.creditExpired ? 'text-ink-red-3' : 'text-ink-amber-3'" />
            <span class="font-medium" :class="store.creditExpired ? 'text-ink-red-3' : 'text-ink-gray-8'">{{ usd(store.accountCredit) }}</span>
            <span :class="store.creditExpired ? 'text-ink-red-3' : 'text-ink-gray-5'">credit</span>
          </button>
          <!-- Primary action sits right-most. -->
          <slot name="actions" />
        </div>
      </header>

      <main class="flex-1 overflow-y-auto">
        <div :class="wide ? 'h-full w-full' : 'mx-auto w-full max-w-3xl px-4 py-8 sm:px-6'">
          <slot />
        </div>
      </main>
    </div>

    <!-- Create team -->
    <Dialog v-model:open="createTeamOpen" size="sm">
      <template #title><span class="text-xl font-semibold text-ink-gray-9">Create a team</span></template>
      <FormControl v-model="newTeamName" type="text" label="Team name" placeholder="e.g. Acme Innovations" />
      <p class="mt-2 text-sm text-ink-gray-5">You'll switch to the new team right away. Add servers and members from there.</p>
      <template #actions>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" @click="createTeamOpen = false" />
          <Button variant="solid" label="Create team" :disabled="!newTeamName.trim()" @click="doCreateTeam" />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Avatar, Breadcrumbs, Button, Dialog, Dropdown, FormControl, toast } from 'frappe-ui'
import cloudLogo from '../assets/apps/cloud.png'
import { useCloudStore } from '../stores/cloud'
import { usd } from '../utils/format'

defineProps({
  crumbs: { type: Array, default: null },
  // Let map/list pages opt out of the centered max-width container.
  wide: { type: Boolean, default: false },
})

const store = useCloudStore()
const route = useRoute()
const router = useRouter()
// One remembered preference, not a per-page default (issue #3): the rail keeps
// whatever the user last set, across page switches and reloads.
const collapsed = computed({
  get: () => store.sidebarCollapsed,
  set: (v) => store.setSidebarCollapsed(v),
})

// The credit badge is only for trial users (or anyone whose credit ran out).
const showCredit = computed(() => store.isTrial || store.creditExpired)

// Returning to Central drops the pinned server context.
onMounted(() => {
  store.currentServerId = null
})

const items = computed(() => [
  { label: 'Servers', icon: 'lucide-server', to: '/servers', active: route.path === '/servers' || route.path.startsWith('/servers/') },
  { label: 'Billing', icon: 'lucide-wallet', to: '/billing', active: route.path === '/billing' },
  { label: 'Settings', icon: 'lucide-settings', to: '/settings', active: route.path.startsWith('/settings') },
])

const userOptions = computed(() => [
  {
    label: 'Sign out',
    icon: 'lucide-log-out',
    onClick: () => {
      store.loadScenario('fresh')
      router.push('/setup/account')
    },
  },
])

// — Team switcher
const teamInitial = computed(() => (store.team?.name || 'T')[0].toUpperCase())
const teamOptions = computed(() => [
  ...store.teams.map((t) => ({
    label: t.name,
    icon: t.id === store.currentTeamId ? 'lucide-check' : 'lucide-users',
    onClick: () => {
      if (t.id === store.currentTeamId) return
      store.switchTeam(t.id)
      toast.success(`Switched to ${t.name}`)
      router.push('/servers')
    },
  })),
  { label: 'Create team', icon: 'lucide-plus', onClick: () => { newTeamName.value = ''; createTeamOpen.value = true } },
])

const createTeamOpen = ref(false)
const newTeamName = ref('')
function doCreateTeam() {
  const t = store.createTeam(newTeamName.value)
  createTeamOpen.value = false
  toast.success(`Created ${t.name}`)
  router.push('/servers')
}
</script>

<style scoped>
.console-bar { animation: console-bar 1.1s ease-in-out infinite; }
@keyframes console-bar {
  0% { width: 0; opacity: 0.9; }
  50% { width: 70%; opacity: 1; }
  100% { width: 100%; opacity: 0; }
}
</style>

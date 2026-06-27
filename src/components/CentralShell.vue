<template>
  <div class="flex h-screen overflow-hidden bg-surface-elevation-1">
    <aside
      class="relative flex shrink-0 flex-col border-r border-outline-alpha-gray-1 bg-surface-sidebar p-2 transition-all duration-300 ease-in-out"
      :class="collapsed ? 'w-14' : 'w-60'"
    >
      <!-- Brand — Frappe Cloud, with the current team as subtext. The dropdown
           holds account-level switches (change team, theme). -->
      <Dropdown :options="brandOptions" placement="bottom-start">
        <button
          class="mb-3 flex h-12 w-full shrink-0 items-center gap-2 rounded-lg px-1.5 hover:bg-surface-gray-2"
          :class="collapsed && 'justify-center'"
          :title="collapsed ? `Frappe Cloud · ${store.team.name}` : undefined"
        >
          <img :src="cloudLogo" alt="Frappe Cloud" class="size-7 shrink-0 rounded-md" />
          <template v-if="!collapsed">
            <span class="min-w-0 flex-1 text-left">
              <span class="block truncate text-p-sm font-semibold text-ink-gray-9">Frappe Cloud</span>
              <span class="block truncate text-p-xs text-ink-gray-5">{{ store.team.name }}</span>
            </span>
            <span class="lucide-chevrons-up-down size-3.5 shrink-0 text-ink-gray-5" />
          </template>
        </button>
      </Dropdown>

      <nav class="flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
        <!-- Search + notifications sit together as a tight utility group.
             Placeholders for now — not wired up yet. -->
        <div class="flex flex-col gap-0.5">
          <Tooltip v-for="u in utilityItems" :key="u.label" :text="collapsed ? u.label : ''" placement="right" :hover-delay="0">
            <button
              class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-ink-gray-7 transition-colors hover:bg-surface-gray-2"
              :class="collapsed && 'justify-center'"
            >
              <span class="size-4 shrink-0 text-ink-gray-6" :class="u.icon" />
              <span v-if="!collapsed" class="truncate">{{ u.label }}</span>
            </button>
          </Tooltip>
        </div>

        <!-- Gap, then the primary navigation -->
        <div class="my-2 h-px shrink-0 bg-outline-alpha-gray-1" />

        <div class="flex flex-col gap-0.5">
          <template v-for="item in items" :key="item.label">
            <!-- Simple nav item -->
            <Tooltip v-if="!item.children" :text="collapsed ? item.label : ''" placement="right" :hover-delay="0">
              <button
                class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors"
                :class="[item.active ? 'bg-surface-elevation-3 text-ink-gray-9 shadow-sm' : 'text-ink-gray-7 hover:bg-surface-gray-2', collapsed && 'justify-center']"
                @click="router.push(item.to)"
              >
                <span class="size-4 shrink-0 text-ink-gray-6" :class="item.icon" />
                <span v-if="!collapsed" class="truncate">{{ item.label }}</span>
              </button>
            </Tooltip>

            <!-- Collapsible group (e.g. Billing) -->
            <template v-else-if="!collapsed">
              <button
                class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors"
                :class="item.active ? 'text-ink-gray-9' : 'text-ink-gray-7 hover:bg-surface-gray-2'"
                @click="toggleGroup(item.label)"
              >
                <span class="size-4 shrink-0 text-ink-gray-6" :class="item.icon" />
                <span class="flex-1 truncate">{{ item.label }}</span>
                <span class="lucide-chevron-down size-3.5 shrink-0 text-ink-gray-5 transition-transform" :class="isGroupOpen(item) && 'rotate-180'" />
              </button>
              <div v-if="isGroupOpen(item)" class="ml-3 flex flex-col gap-0.5 border-l border-outline-gray-2 pl-2">
                <button
                  v-for="c in item.children"
                  :key="c.label"
                  class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors"
                  :class="c.active ? 'bg-surface-elevation-3 text-ink-gray-9 shadow-sm' : 'text-ink-gray-7 hover:bg-surface-gray-2'"
                  @click="router.push(c.to)"
                >
                  <span class="size-4 shrink-0 text-ink-gray-6" :class="c.icon" />
                  <span class="truncate">{{ c.label }}</span>
                </button>
              </div>
            </template>

            <!-- Collapsed rail: one icon per child (issue #21) -->
            <Tooltip
              v-else
              v-for="c in item.children"
              :key="c.label"
              :text="c.label"
              placement="right"
              :hover-delay="0"
            >
              <button
                class="flex w-full items-center justify-center gap-2 rounded px-2 py-1.5 text-sm transition-colors"
                :class="c.active ? 'bg-surface-elevation-3 text-ink-gray-9 shadow-sm' : 'text-ink-gray-7 hover:bg-surface-gray-2'"
                @click="router.push(c.to)"
              >
                <span class="size-4 shrink-0 text-ink-gray-6" :class="c.icon" />
              </button>
            </Tooltip>
          </template>
        </div>
      </nav>

      <!-- Explicit, remembered collapse toggle (issue #3) -->
      <button
        class="mb-1 flex w-full shrink-0 items-center gap-2 rounded px-2 py-1.5 text-sm text-ink-gray-6 transition-colors hover:bg-surface-gray-2"
        :class="collapsed && 'justify-center'"
        :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        @click="collapsed = !collapsed"
      >
        <span class="size-4 shrink-0" :class="collapsed ? 'lucide-panel-left-open' : 'lucide-panel-left-close'" />
        <span v-if="!collapsed" class="truncate">Collapse</span>
      </button>

      <Dropdown :options="userOptions" placement="top-start">
        <button class="flex w-full shrink-0 items-center gap-2 rounded-lg p-1.5 hover:bg-surface-gray-2" :class="collapsed && 'justify-center'">
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

      <header class="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-outline-alpha-gray-1 bg-surface-elevation-1 px-4">
        <Breadcrumbs v-if="crumbs?.length" :items="crumbs" class="min-w-0" />
        <div v-else />
        <div class="flex shrink-0 items-center gap-2">
          <button
            v-if="showCredit"
            class="hidden items-center gap-1.5 rounded-full border px-3 py-1 text-sm sm:flex"
            :class="store.creditExpired ? 'border-outline-red-1 text-ink-red-8' : 'border-outline-gray-2 hover:bg-surface-gray-1'"
            @click="router.push('/billing')"
          >
            <span class="lucide-zap size-3.5" :class="store.creditExpired ? 'text-ink-red-8' : 'text-ink-amber-8'" />
            <span class="font-medium" :class="store.creditExpired ? 'text-ink-red-8' : 'text-ink-gray-8'">{{ usd(store.accountCredit) }}</span>
            <span :class="store.creditExpired ? 'text-ink-red-8' : 'text-ink-gray-5'">credit</span>
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

    <ProfileDialog v-model:open="profileOpen" />

    <!-- Switch team -->
    <Dialog v-model:open="switchTeamOpen" size="sm">
      <template #title><span class="text-xl font-semibold text-ink-gray-9">Switch team</span></template>
      <div class="space-y-1">
        <button
          v-for="t in store.teams"
          :key="t.id"
          class="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-surface-gray-2"
          @click="chooseTeam(t)"
        >
          <img v-if="t.avatar" :src="t.avatar" class="size-7 shrink-0 rounded-md object-cover" />
          <span v-else class="grid size-7 shrink-0 place-items-center rounded-md bg-surface-gray-3 text-xs font-semibold text-ink-gray-7">{{ t.name[0].toUpperCase() }}</span>
          <span class="min-w-0 flex-1 truncate text-sm font-medium text-ink-gray-8">{{ t.name }}</span>
          <span v-if="t.id === store.currentTeamId" class="lucide-check size-4 shrink-0 text-ink-gray-6" />
        </button>
      </div>
      <template #actions>
        <Button class="w-full" variant="subtle" label="Create team" icon-left="lucide-plus" @click="openCreateTeam" />
      </template>
    </Dialog>

    <!-- Create team -->
    <Dialog v-model:open="createTeamOpen" size="sm">
      <template #title><span class="text-xl font-semibold text-ink-gray-9">Create a team</span></template>
      <FormControl v-model="newTeamName" type="text" label="Team name" placeholder="e.g. Acme Innovations" />
      <p class="mt-2 text-p-sm text-ink-gray-5">You'll switch to the new team right away. Add servers and members from there.</p>
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
import { computed, h, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Avatar, Breadcrumbs, Button, Dialog, Dropdown, FormControl, Tooltip, toast } from 'frappe-ui'
import cloudLogo from '../assets/apps/cloud.png'
import ProfileDialog from './ProfileDialog.vue'
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

// Search + notifications — placeholders, not functional yet.
const utilityItems = [
  { label: 'Search', icon: 'lucide-search' },
  { label: 'Notifications', icon: 'lucide-bell' },
]

const billingActive = computed(() => route.path.startsWith('/billing'))
const items = computed(() => [
  { label: 'Servers', icon: 'lucide-server', to: '/servers', active: route.path === '/servers' || route.path.startsWith('/servers/') },
  {
    label: 'Billing',
    icon: 'lucide-wallet',
    active: billingActive.value,
    children: [
      { label: 'Overview', icon: 'lucide-layout-dashboard', to: '/billing', active: route.path === '/billing' },
      { label: 'Invoices', icon: 'lucide-receipt', to: '/billing/invoices', active: route.path === '/billing/invoices' },
      { label: 'Limit Tiers', icon: 'lucide-layers', to: '/billing/limit-tiers', active: route.path === '/billing/limit-tiers' },
    ],
  },
  { label: 'Team & Permissions', icon: 'lucide-users', to: '/settings', active: route.path.startsWith('/settings') },
])

// A collapsible group auto-opens when you're on one of its routes; `openGroups`
// remembers explicit toggles and overrides that default.
const openGroups = ref({})
function isGroupOpen(item) {
  return openGroups.value[item.label] ?? item.active
}
function toggleGroup(label) {
  const item = items.value.find((i) => i.label === label)
  openGroups.value[label] = !isGroupOpen(item)
}

// Brand dropdown — account-level switches that used to be a standalone team selector.
// Light / dark / system, with a check on the active choice. Theme is an
// account-wide pref applied in App.vue.
const themeOptions = computed(() =>
  [
    { value: 'light', label: 'Light', icon: 'lucide-sun' },
    { value: 'dark', label: 'Dark', icon: 'lucide-moon' },
    { value: 'system', label: 'System', icon: 'lucide-monitor' },
  ].map((t) => ({
    label: t.label,
    icon: t.icon,
    onClick: () => store.setTheme(t.value),
    slots: {
      suffix: () =>
        store.theme === t.value ? h('span', { class: 'lucide-check size-4 text-ink-gray-7' }) : null,
    },
  })),
)

const brandOptions = computed(() => [
  {
    label: 'Change team',
    icon: 'lucide-arrow-left-right',
    description: store.team?.name,
    slots: { label: () => h('span', { class: 'block min-w-[12rem]' }, 'Change team') },
    onClick: () => {
      switchTeamOpen.value = true
    },
  },
  {
    label: 'Theme',
    icon: 'lucide-sun-moon',
    submenu: themeOptions.value,
  },
])

const profileOpen = ref(false)
const userOptions = computed(() => [
  {
    label: 'Profile',
    icon: 'lucide-circle-user',
    onClick: () => { profileOpen.value = true },
  },
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
const switchTeamOpen = ref(false)
function chooseTeam(t) {
  switchTeamOpen.value = false
  if (t.id === store.currentTeamId) return
  store.switchTeam(t.id)
  toast.success(`Switched to ${t.name}`)
  router.push('/servers')
}

const createTeamOpen = ref(false)
const newTeamName = ref('')
function openCreateTeam() {
  switchTeamOpen.value = false
  newTeamName.value = ''
  createTeamOpen.value = true
}
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

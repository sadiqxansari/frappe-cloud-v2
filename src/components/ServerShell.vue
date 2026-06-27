<template>
  <div class="flex h-screen overflow-hidden bg-surface-elevation-1">
    <aside
      class="relative flex shrink-0 flex-col border-r border-outline-alpha-gray-1 bg-surface-sidebar p-2 transition-all duration-300 ease-in-out"
      :class="collapsed ? 'w-14' : 'w-60'"
    >
      <!-- Brand — the server you're managing; the dropdown jumps to Central -->
      <Dropdown :options="serverMenu" placement="bottom-start">
        <button
          class="mb-3 flex h-12 w-full shrink-0 items-center gap-2 rounded-lg px-1.5 hover:bg-surface-gray-2"
          :class="collapsed && 'justify-center'"
          :title="collapsed ? server?.name : undefined"
        >
          <span class="grid size-7 shrink-0 place-items-center rounded-md bg-[var(--ink-gray-9)] text-ink-base">
            <span class="lucide-server size-4" />
          </span>
          <template v-if="!collapsed">
            <span class="min-w-0 flex-1 truncate text-left text-sm font-semibold text-ink-gray-9">{{ server?.name }}</span>
            <span class="lucide-chevrons-up-down size-3.5 shrink-0 text-ink-gray-5" />
          </template>
        </button>
      </Dropdown>

      <nav class="flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden">
        <Tooltip v-for="item in items" :key="item.label" :text="collapsed ? item.label : ''" placement="right" :hover-delay="0">
          <button
            class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors"
            :class="[item.active ? 'bg-surface-elevation-3 text-ink-gray-9 shadow-sm' : 'text-ink-gray-7 hover:bg-surface-gray-2', collapsed && 'justify-center']"
            @click="router.push(item.to)"
          >
            <span class="size-4 shrink-0 text-ink-gray-6" :class="item.icon" />
            <span v-if="!collapsed" class="truncate">{{ item.label }}</span>
          </button>
        </Tooltip>

        <!-- Dev tools — a collapsible group, closed by default -->
        <template v-if="!collapsed">
          <button
            class="mt-0.5 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors"
            :class="devActive ? 'text-ink-gray-9' : 'text-ink-gray-7 hover:bg-surface-gray-2'"
            @click="devOpen = !devOpen"
          >
            <span class="lucide-terminal size-4 shrink-0 text-ink-gray-6" />
            <span class="flex-1 truncate">Dev tools</span>
            <span class="lucide-chevron-down size-3.5 shrink-0 text-ink-gray-5 transition-transform" :class="devOpen && 'rotate-180'" />
          </button>
          <div v-if="devOpen" class="ml-3 flex flex-col gap-0.5 border-l border-outline-gray-2 pl-2">
            <button
              v-for="d in devItems"
              :key="d.label"
              class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors"
              :class="d.active ? 'bg-surface-elevation-3 text-ink-gray-9 shadow-sm' : 'text-ink-gray-7 hover:bg-surface-gray-2'"
              @click="router.push(d.to)"
            >
              <span class="size-4 shrink-0 text-ink-gray-6" :class="d.icon" />
              <span class="truncate">{{ d.label }}</span>
            </button>
          </div>
        </template>
        <!-- Collapsed rail: one icon per dev item (issue #21) -->
        <Tooltip
          v-else
          v-for="d in devItems"
          :key="d.label"
          :text="d.label"
          placement="right"
          :hover-delay="0"
        >
          <button
            class="flex w-full items-center justify-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors"
            :class="d.active ? 'bg-surface-elevation-3 text-ink-gray-9 shadow-sm' : 'text-ink-gray-7 hover:bg-surface-gray-2'"
            @click="router.push(d.to)"
          >
            <span class="size-4 shrink-0 text-ink-gray-6" :class="d.icon" />
          </button>
        </Tooltip>
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
        <button class="flex w-full shrink-0 items-center gap-2 rounded-[8px] p-1.5 hover:bg-surface-gray-2" :class="collapsed && 'justify-center'">
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

      <ProfileDialog v-model:open="profileOpen" />
      <SystemInfoDialog v-model:open="systemInfoOpen" :server="server" />
      <ServerSettingsDialog v-model:open="settingsOpen" :server="server" />
      <UpdateServerDialog v-model:open="updateOpen" :server="server" />
    </aside>

    <div class="flex min-w-0 flex-1 flex-col">
      <div class="relative h-0.5 shrink-0 overflow-hidden">
        <div v-if="store.busy > 0" class="console-bar absolute inset-y-0 left-0 bg-[var(--ink-gray-8)]" />
      </div>

      <header class="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-outline-alpha-gray-1 bg-surface-elevation-1 px-4">
        <Breadcrumbs v-if="crumbs?.length" :items="crumbs" class="min-w-0" />
        <div v-else />
        <div class="flex shrink-0 items-center gap-2">
          <!-- One global update button: Frappe build + every site's apps, in one
               place with two states; primary when there's something to do, quiet
               on the sites pages where rows show their own cues (issue #42). -->
          <Button
            size="sm"
            :variant="updateVariant"
            :label="updateLabel"
            icon-left="lucide-circle-arrow-up"
            @click="updateOpen = true"
          />
          <!-- Primary action sits right-most. -->
          <slot name="actions" />
        </div>
      </header>

      <main class="flex-1 overflow-y-auto">
        <div :class="wide ? 'h-full w-full' : roomy ? 'mx-auto w-full max-w-5xl px-4 py-8 sm:px-6' : 'mx-auto w-full max-w-3xl px-4 py-8 sm:px-6'">
          <slot :server="server" />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, h, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Avatar, Breadcrumbs, Button, Dropdown, Tooltip } from 'frappe-ui'
import cloudLogo from '../assets/apps/cloud.png'
import ProfileDialog from './ProfileDialog.vue'
import SystemInfoDialog from './SystemInfoDialog.vue'
import ServerSettingsDialog from './ServerSettingsDialog.vue'
import UpdateServerDialog from './UpdateServerDialog.vue'
import { useCloudStore } from '../stores/cloud'

const props = defineProps({
  crumbs: { type: Array, default: null },
  server: { type: Object, default: null },
  wide: { type: Boolean, default: false },
  // Wider centred container (~1000px) for pages with side-by-side panels.
  roomy: { type: Boolean, default: false },
})

const store = useCloudStore()
const route = useRoute()
const router = useRouter()
// Shares the one remembered sidebar preference with Central (issue #3).
const collapsed = computed({
  get: () => store.sidebarCollapsed,
  set: (v) => store.setSidebarCollapsed(v),
})

const server = computed(
  () => props.server || store.findServer(route.params.serverId) || store.currentServer,
)
watch(
  server,
  (s) => {
    if (s) store.currentServerId = s.id
  },
  { immediate: true },
)

// Patch update available within the server's current major (issue #24).
const updateOpen = ref(false)
// One global app-updates affordance across every site on the server (#42).
const appUpdateCount = computed(() => {
  let n = 0
  for (const s of server.value?.sites || []) for (const a of s.apps) if (store.appUpdate(a)) n++
  return n
})
const hasUpdates = computed(() => appUpdateCount.value > 0)
const scheduledUpdate = computed(() => server.value?.scheduledUpdate || null)
// On the sites pages the global button stays quiet — site rows carry their own cues.
const siteContext = computed(() => ['server-overview', 'site-detail'].includes(route.name))
const updateLabel = computed(() =>
  scheduledUpdate.value ? 'Update scheduled' : hasUpdates.value ? 'Updates available' : 'Check for updates',
)
const updateVariant = computed(() => {
  if (scheduledUpdate.value) return 'subtle'
  if (hasUpdates.value) return siteContext.value ? 'outline' : 'solid'
  return 'outline'
})

const base = computed(() => `/manage/${server.value?.id}`)
const items = computed(() => {
  const b = base.value
  return [
    { label: 'Sites', icon: 'lucide-layout-grid', to: b, active: route.path === b || route.path.startsWith(`${b}/sites`) },
    { label: 'Marketplace', icon: 'lucide-store', to: `${b}/marketplace`, active: route.path.startsWith(`${b}/marketplace`) },
  ]
})

const devItems = computed(() => {
  const b = base.value
  return [
    { label: 'Insights', icon: 'lucide-chart-line', to: `${b}/analytics`, active: route.path.startsWith(`${b}/analytics`) },
    { label: 'Logs', icon: 'lucide-scroll-text', to: `${b}/developer/logs`, active: route.path.startsWith(`${b}/developer/logs`) },
    { label: 'DB analyzer', icon: 'lucide-database', to: `${b}/developer/database`, active: route.path.startsWith(`${b}/developer/database`) },
    { label: 'SQL playground', icon: 'lucide-terminal', to: `${b}/developer/sql`, active: route.path.startsWith(`${b}/developer/sql`) },
    { label: 'Tasks', icon: 'lucide-list-checks', to: `${b}/developer/tasks`, active: route.path.startsWith(`${b}/developer/tasks`) },
  ]
})
const devActive = computed(() => route.path.startsWith(`${base.value}/developer`) || route.path.startsWith(`${base.value}/analytics`))
const devOpen = ref(devActive.value)
watch(devActive, (on) => {
  if (on) devOpen.value = true
})

// Brand dropdown — the quick, low-stakes menu for this server: jump back to
// Central, open read-only System info, switch theme. Anything that *changes*
// the server (version, firewall, workers) lives on the Settings page, not here.
const systemInfoOpen = ref(false)
const settingsOpen = ref(false)

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

const serverMenu = computed(() => [
  {
    label: 'Central',
    icon: 'lucide-cloud',
    // description: store.team?.name,
    // slots: {
    //   prefix: () => h('img', { src: cloudLogo, alt: '', class: 'size-4 shrink-0 rounded' }),
    //   // Widen the menu to at least the sidebar width (issue: dropdown felt cramped).
    //   label: () => h('span', { class: 'block min-w-[12rem]' }, 'Central'),
    // },
    // Same-window nav so any return context survives (Desk → Server → Central
    // all keep the "← Back" bar). New tabs have no "back" — that stranded
    // single-server owners in the console we were sparing them.
    onClick: () => router.push('/servers'),
  },
  {
    label: 'Settings',
    icon: 'lucide-settings',
    onClick: () => {
      settingsOpen.value = true
    },
  },
  {
    label: 'System info',
    icon: 'lucide-info',
    onClick: () => {
      systemInfoOpen.value = true
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
</script>

<style scoped>
.console-bar { animation: console-bar 1.1s ease-in-out infinite; }
@keyframes console-bar {
  0% { width: 0; opacity: 0.9; }
  50% { width: 70%; opacity: 1; }
  100% { width: 100%; opacity: 0; }
}
</style>

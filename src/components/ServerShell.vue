<template>
  <div class="flex h-screen overflow-hidden bg-surface-white">
    <aside
      class="relative flex shrink-0 flex-col border-r border-outline-gray-1 bg-surface-menu-bar p-2 transition-all duration-300 ease-in-out"
      :class="collapsed ? 'w-14' : 'w-60'"
    >
      <!-- Brand — the server you're managing; the dropdown jumps to Central -->
      <Dropdown :options="serverMenu" placement="bottom-start">
        <button
          class="mb-3 flex h-12 w-full shrink-0 items-center gap-2 rounded-lg px-1.5 hover:bg-surface-gray-2"
          :title="collapsed ? server?.name : undefined"
        >
          <span class="grid size-7 shrink-0 place-items-center rounded-md bg-[var(--ink-gray-9)] text-ink-white">
            <span class="lucide-server size-4" />
          </span>
          <template v-if="!collapsed">
            <span class="min-w-0 flex-1 truncate text-left text-sm font-semibold text-ink-gray-9">{{ server?.name }}</span>
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
              :class="d.active ? 'bg-surface-selected text-ink-gray-9 shadow-sm' : 'text-ink-gray-7 hover:bg-surface-gray-2'"
              @click="router.push(d.to)"
            >
              <span class="size-4 shrink-0 text-ink-gray-6" :class="d.icon" />
              <span class="truncate">{{ d.label }}</span>
            </button>
          </div>
        </template>
        <button
          v-else
          class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors"
          :class="devActive ? 'bg-surface-selected text-ink-gray-9 shadow-sm' : 'text-ink-gray-7 hover:bg-surface-gray-2'"
          title="Dev tools"
          @click="router.push(devItems[0].to)"
        >
          <span class="lucide-terminal size-4 shrink-0 text-ink-gray-6" />
        </button>
      </nav>

      <Dropdown :options="userOptions" placement="top-start">
        <button class="flex w-full shrink-0 items-center gap-2 rounded-[8px] p-1.5 hover:bg-surface-gray-2">
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
          <Button v-if="liveSite" variant="subtle" label="Open site" icon-right="lucide-arrow-up-right" @click="openLiveSite" />
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
import { Avatar, Breadcrumbs, Button, Dropdown } from 'frappe-ui'
import cloudLogo from '../assets/apps/cloud.png'
import { useCloudStore } from '../stores/cloud'
import { usd } from '../utils/format'

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
const collapsed = ref(typeof window !== 'undefined' && window.innerWidth < 640)

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

const showCredit = computed(() => store.isTrial || store.creditExpired)

const base = computed(() => `/manage/${server.value?.id}`)
const items = computed(() => {
  const b = base.value
  return [
    { label: 'Sites', icon: 'lucide-layout-grid', to: b, active: route.path === b || route.path.startsWith(`${b}/sites`) },
    { label: 'Insights', icon: 'lucide-chart-line', to: `${b}/analytics`, active: route.path.startsWith(`${b}/analytics`) },
    { label: 'Settings', icon: 'lucide-settings', to: `${b}/settings`, active: route.path.startsWith(`${b}/settings`) },
    { label: 'Marketplace', icon: 'lucide-store', to: `${b}/marketplace`, active: route.path.startsWith(`${b}/marketplace`) },
  ]
})

const devItems = computed(() => {
  const b = base.value
  return [
    { label: 'Logs', icon: 'lucide-scroll-text', to: `${b}/developer/logs`, active: route.path.startsWith(`${b}/developer/logs`) },
    { label: 'Database', icon: 'lucide-database', to: `${b}/developer/database`, active: route.path.startsWith(`${b}/developer/database`) },
  ]
})
const devActive = computed(() => route.path.startsWith(`${base.value}/developer`))
const devOpen = ref(devActive.value)
watch(devActive, (on) => {
  if (on) devOpen.value = true
})

const liveSite = computed(() => server.value?.sites.find((s) => s.status === 'live') || null)
function openLiveSite() {
  if (!liveSite.value) return
  store.openSite(liveSite.value.id)
  router.push('/app')
}

// Brand dropdown — a single way out, back to the Central account view.
// (No server-switcher list: accounts can have many servers; switch via Central.)
const serverMenu = computed(() => [
  {
    label: 'Central',
    slots: { prefix: () => h('img', { src: cloudLogo, alt: '', class: 'size-4 shrink-0 rounded' }) },
    onClick: () => {
      store.currentServerId = null
      router.push('/servers')
    },
  },
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
</script>

<style scoped>
.console-bar { animation: console-bar 1.1s ease-in-out infinite; }
@keyframes console-bar {
  0% { width: 0; opacity: 0.9; }
  50% { width: 70%; opacity: 1; }
  100% { width: 100%; opacity: 0; }
}
</style>

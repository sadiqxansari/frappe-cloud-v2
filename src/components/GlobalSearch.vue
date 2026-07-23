<template>
  <!-- Account-wide command palette for Central. Empty, it offers the obvious
       places to go — you don't have to know what's searchable. Typing searches
       everything Central holds: pages, servers, sites and invoices. A site names
       the server that hosts it ("on «server»") since from Central you know the
       site's name, not where it lives.

       Built on frappe-ui's `bare` Dialog (a positioned, chromeless panel) rather
       than its CommandPalette, whose inner <Dialog> assumes frappe-ui is globally
       registered — this app imports components individually, so it can't resolve. -->
  <Dialog v-model:open="isOpen" :options="{ size: '2xl', position: 'top' }" bare @after-leave="query = ''">
    <div class="flex flex-col">
      <div class="relative border-b border-outline-gray-2">
        <span class="lucide-search absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-gray-5" />
        <input
          ref="inputEl"
          v-model="query"
          type="text"
          placeholder="Search servers, sites, invoices…"
          autocomplete="off"
          spellcheck="false"
          class="gs-input w-full bg-transparent py-3.5 pl-11 pr-4 text-base text-ink-gray-8 placeholder-ink-gray-4"
          @keydown.down.prevent="move(1)"
          @keydown.up.prevent="move(-1)"
          @keydown.enter.prevent="choose(flatItems[activeIndex])"
        />
      </div>

      <div ref="listEl" class="max-h-[24rem] overflow-y-auto p-2">
        <div v-for="g in groups" :key="g.title" class="pb-1">
          <div class="px-2 pb-1 pt-2 text-xs font-medium text-ink-gray-4">{{ g.title }}</div>
          <button
            v-for="it in g.items"
            :key="it.key"
            :data-idx="it.i"
            class="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors"
            :class="it.i === activeIndex ? 'bg-surface-gray-3' : 'hover:bg-surface-gray-2'"
            @click="choose(it)"
            @mousemove="activeIndex = it.i"
          >
            <span class="size-4 shrink-0 text-ink-gray-6" :class="it.icon" />
            <span class="min-w-0 flex-1 truncate text-sm text-ink-gray-8">{{ it.title }}</span>
            <span v-if="it.description" class="shrink-0 truncate pl-2 text-sm text-ink-gray-5">{{ it.description }}</span>
          </button>
          <div v-if="g.more" class="px-3 pb-1 pt-1.5 text-xs text-ink-gray-4">+{{ g.more }} more — keep typing to narrow</div>
        </div>

        <div v-if="query.trim() && !flatItems.length" class="px-3 py-10 text-center text-sm text-ink-gray-5">
          No pages, servers, sites or invoices match “{{ query.trim() }}”
        </div>
      </div>

      <div class="flex items-center gap-4 border-t border-outline-gray-2 px-4 py-2 text-xs text-ink-gray-5">
        <span class="flex items-center gap-1"><kbd class="gs-kbd">↑</kbd><kbd class="gs-kbd">↓</kbd> navigate</span>
        <span class="flex items-center gap-1"><kbd class="gs-kbd">↵</kbd> open</span>
        <span class="flex items-center gap-1"><kbd class="gs-kbd">esc</kbd> close</span>
      </div>
    </div>
  </Dialog>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Dialog } from 'frappe-ui'
import { useRouter } from 'vue-router'
import { ADDONS } from '../data/addons'
import { useCloudStore } from '../stores/cloud'

const props = defineProps({
  open: { type: Boolean, default: false },
})
const emit = defineEmits(['update:open'])

const store = useCloudStore()
const router = useRouter()
const query = ref('')
const activeIndex = ref(0)
const inputEl = ref(null)
const listEl = ref(null)

const isOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v),
})

// Per entity group, so one big fleet doesn't bury everything else.
const PER_GROUP = 6

// Things you can DO from Central — the palette leads with these (a plain list of
// sidebar destinations wasn't worth the space). Shown upfront when empty, and
// searchable by title/keywords. A `{ query: { action } }` target is caught by
// the owning page/layout on arrival, which opens the matching dialog.
const ACTIONS = [
  { title: 'New server', description: 'Provision a server', icon: 'lucide-plus', to: '/servers/new', keywords: 'new server create provision add' },
  { title: 'Invite team member', description: 'Send an invite', icon: 'lucide-user-plus', to: { path: '/settings', query: { action: 'invite' } }, keywords: 'invite team member add user teammate people colleague' },
  { title: 'Add payment method', description: 'Card or UPI', icon: 'lucide-credit-card', to: { path: '/billing', query: { action: 'add-card' } }, keywords: 'add payment method card upi credit debit mandate billing' },
  { title: 'Add credit', description: 'Top up your wallet', icon: 'lucide-wallet', to: { path: '/billing', query: { action: 'add-credit' } }, keywords: 'add credit top up wallet funds balance recharge money' },
  { title: 'Create team', description: 'Start a new team', icon: 'lucide-users', to: { path: '/settings', query: { action: 'create-team' } }, keywords: 'create team new workspace organisation' },
  { title: 'New role', description: 'Define permissions', icon: 'lucide-shield', to: { path: '/settings', query: { action: 'new-role' } }, keywords: 'new role permissions access control create' },
]

// Central's pages — searchable, so typing still gets you anywhere.
const PAGES = [
  { title: 'Servers', description: 'Your fleet', icon: 'lucide-server', to: '/servers', keywords: 'servers fleet map hosting' },
  { title: 'Billing', description: 'Wallet & spend', icon: 'lucide-wallet', to: '/billing', keywords: 'billing wallet credit spend usage overview' },
  { title: 'Invoices', description: 'Billing history', icon: 'lucide-receipt', to: '/billing/invoices', keywords: 'invoices receipts billing history' },
  { title: 'Add-on services', description: 'Metered services', icon: 'lucide-blocks', to: '/addons', keywords: 'addons add-on services metered' },
  { title: 'Teams', description: 'Members & roles', icon: 'lucide-users', to: '/settings', keywords: 'teams members roles settings permissions' },
  { title: 'Limit Tiers', description: 'Spend limits', icon: 'lucide-layers', to: '/billing/limit-tiers', keywords: 'limit tiers spend cap budget' },
]
const ADDON_PAGES = ADDONS.map((a) => ({
  title: a.name,
  description: 'Add-on service',
  icon: 'lucide-blocks',
  to: `/addons/${a.key}`,
  keywords: `addon add-on service metered ${a.name} ${a.tagline || ''}`,
}))
const ALL_PAGES = [...PAGES, ...ADDON_PAGES]

// Servers and sites open their own workspace (a new tab), matching how a server
// is entered everywhere else. Pages and invoices are Central-level — same tab.
function pageItem(p) {
  return { ...p, key: `page-${p.title}`, newTab: false }
}
function serverItem(srv) {
  return { kind: 'server', key: `srv-${srv.id}`, title: srv.name, description: store.regionOf(srv).name, icon: 'lucide-server', to: `/manage/${srv.id}`, newTab: true }
}
function siteItem(srv, st) {
  return { kind: 'site', key: `site-${st.id}`, title: st.name, description: `on ${srv.name}`, icon: 'lucide-globe', to: `/manage/${srv.id}/sites/${st.id}`, newTab: true }
}
function invoiceItem(inv) {
  return { key: `inv-${inv.number}`, title: inv.number, description: `${inv.period} · ${inv.status}`, icon: 'lucide-receipt', to: { path: '/billing/invoices', query: { invoice: inv.number } }, newTab: false }
}

// A group is { title, items, more }. `more` is how many matches were trimmed —
// shown as a muted "+N more" line, never a selectable row.
function group(title, all, make) {
  const items = all.slice(0, PER_GROUP).map(make)
  return { title, items, more: Math.max(0, all.length - PER_GROUP) }
}

const rawGroups = computed(() => {
  const term = query.value.trim().toLowerCase()
  const out = []

  if (!term) {
    out.push({ title: 'Actions', items: ACTIONS.map(pageItem), more: 0 })
    return out
  }

  const actions = ACTIONS.filter((a) => `${a.title} ${a.keywords}`.toLowerCase().includes(term))
  if (actions.length) out.push(group('Actions', actions, pageItem))

  const pages = ALL_PAGES.filter((p) => `${p.title} ${p.keywords}`.toLowerCase().includes(term))
  if (pages.length) out.push(group('Pages', pages, pageItem))

  const servers = store.allServers.filter((srv) => {
    const region = store.regionOf(srv)
    return `${srv.name} ${region.name} ${region.provider}`.toLowerCase().includes(term)
  })
  if (servers.length) out.push(group('Servers', servers, serverItem))

  const sites = []
  for (const srv of store.allServers) {
    for (const st of srv.sites) {
      if (`${st.subdomain} ${st.name}`.toLowerCase().includes(term)) sites.push({ srv, st })
    }
  }
  if (sites.length) out.push(group('Sites', sites, ({ srv, st }) => siteItem(srv, st)))

  const invoices = store.invoices.filter((inv) => `${inv.number} ${inv.period} ${inv.status}`.toLowerCase().includes(term))
  if (invoices.length) out.push(group('Invoices', invoices, invoiceItem))

  return out
})

// Stamp each selectable item with its flat index (the cursor rides these, in
// display order); the "+N more" lines are display-only and get no index.
const groups = computed(() => {
  let i = 0
  return rawGroups.value.map((g) => ({
    title: g.title,
    more: g.more,
    items: g.items.map((it) => ({ ...it, i: i++ })),
  }))
})
const flatItems = computed(() => groups.value.flatMap((g) => g.items))

watch(flatItems, () => (activeIndex.value = 0))

function move(dir) {
  const n = flatItems.value.length
  if (!n) return
  activeIndex.value = (activeIndex.value + dir + n) % n
  nextTick(() => {
    listEl.value?.querySelector(`[data-idx="${activeIndex.value}"]`)?.scrollIntoView({ block: 'nearest' })
  })
}

function choose(item) {
  if (!item) return
  isOpen.value = false
  if (item.newTab) window.open(item.to, '_blank', 'noopener')
  else router.push(item.to)
}

watch(isOpen, (open) => {
  if (open) nextTick(() => inputEl.value?.focus())
})

// ⌘K / Ctrl-K opens from anywhere in Central.
function onKeydown(e) {
  if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    isOpen.value = true
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
/* A bare palette input: the dialog panel is the visible container, so the input
   itself carries no border or focus ring. frappe-ui styles `input:focus` with a
   blue border + box-shadow ring globally; override it in every state (the ring
   was being clipped by the dialog's rounded top and read as broken). */
.gs-input,
.gs-input:focus,
.gs-input:focus-visible {
  border: none !important;
  box-shadow: none !important;
  outline: none !important;
}

.gs-kbd {
  display: inline-grid;
  place-items: center;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.25rem;
  border-radius: 0.25rem;
  border: 1px solid var(--outline-gray-2);
  background: var(--surface-gray-2);
  font-family: inherit;
  font-size: 0.6875rem;
  line-height: 1;
  color: var(--ink-gray-6);
}
</style>

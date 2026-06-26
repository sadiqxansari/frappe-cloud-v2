<template>
  <!-- No branded header inside the Desk — the owner already knows they're in
       Frappe Cloud. Bare dialog → content runs edge-to-edge with no outer
       padding; we own the close button. Each panel carries its own title. -->
  <Dialog v-model:open="open" size="5xl" bare>
    <!-- A settings-style modal: a left rail of areas, content on the right.
         No Overview — you land on a real task; the rail flags what needs you. -->
    <div class="relative flex h-[40rem] overflow-hidden">
      <button
        class="absolute right-3 top-3 z-20 grid size-7 place-items-center rounded-md text-ink-gray-6 hover:bg-surface-gray-3"
        aria-label="Close"
        @click="open = false"
      >
        <span class="lucide-x size-4" />
      </button>
      <nav class="w-48 shrink-0 space-y-0.5 overflow-y-auto border-r border-outline-gray-2 bg-surface-gray-1 p-4">
        <!-- The modal's name — a calm heading, not a tab. -->
        <div class="mb-3 px-2.5 pt-1 text-sm font-semibold text-ink-gray-9">Cloud settings</div>
        <button
          v-for="t in tabs"
          :key="t.label"
          class="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors"
          :class="active === t.label ? 'bg-surface-elevation-3 font-medium text-ink-gray-9 shadow-sm' : 'text-ink-gray-7 hover:bg-surface-gray-2'"
          @click="active = t.label"
        >
          <span class="size-4 shrink-0 text-ink-gray-6" :class="t.icon" />
          <span class="min-w-0 flex-1 truncate">{{ t.label }}</span>
          <span v-if="t.badge" class="grid h-4 min-w-4 place-items-center rounded-full bg-surface-gray-3 px-1 text-[10px] font-semibold tabular-nums text-ink-gray-7">{{ t.badge }}</span>
          <span v-else-if="t.dot" class="size-1.5 shrink-0 rounded-full bg-[var(--ink-amber-7)]" />
        </button>
      </nav>

      <div class="min-w-0 flex-1 overflow-y-auto">
        <!-- Title (and the Apps search) stay pinned while the panel scrolls. -->
        <div class="sticky top-0 z-10 space-y-3 bg-surface-elevation-1 px-10 pb-4 pt-8">
          <header class="flex items-start justify-between gap-3 pr-8">
            <div class="min-w-0">
              <h2 class="text-lg font-semibold text-ink-gray-9">{{ active }}</h2>
              <p class="text-p-sm text-ink-gray-5">{{ panelMeta[active] }}</p>
            </div>
            <Button
              v-if="active === 'Apps' && siteUpdates.length"
              size="sm"
              variant="solid"
              :loading="updatingAll"
              :label="`Update all (${siteUpdates.length})`"
              class="shrink-0"
              @click="updateAll"
            />
          </header>
          <FormControl v-if="active === 'Apps'" v-model="appSearch" type="text" placeholder="Search apps" autocomplete="off" />
        </div>

        <div class="px-10 pb-8 pt-6">
          <!-- Apps — one grid that both installs and updates (the app-store model):
               an installed app with a newer version shows "Update" in place. -->
          <section v-if="active === 'Apps'" class="space-y-3">
            <div class="grid gap-2 sm:grid-cols-2">
            <div
              v-for="app in marketApps"
              :key="app.key"
              class="flex items-start gap-2.5 rounded-lg border border-outline-gray-2 bg-surface-elevation-1 p-3"
            >
              <AppIcon :app-key="app.key" size="md" />
              <div class="min-w-0 flex-1">
                <div class="truncate text-p-sm font-medium text-ink-gray-8">{{ app.name }}</div>
                <div class="line-clamp-2 text-p-xs text-ink-gray-5">{{ app.tagline }}</div>
              </div>
              <!-- Status (Installed ✓) is text; the button slot is only ever an action. -->
              <template v-if="app.installed">
                <Button v-if="app.hasUpdate" size="sm" variant="solid" :loading="isBusy(app.key)" label="Update" class="shrink-0" @click="updateOne(app.key, app.name, app.latest)" />
                <span v-else class="flex shrink-0 items-center gap-1 text-p-xs text-ink-gray-5"><span class="lucide-check size-3.5 text-ink-green-6" /> Installed</span>
              </template>
              <Tooltip v-else-if="!app.compatible" :text="`Needs ${app.needs} — change your server's version to install it`">
                <Button variant="ghost" size="sm" :label="`Needs ${app.needs}`" disabled class="pointer-events-none shrink-0" />
              </Tooltip>
              <Button v-else size="sm" :loading="isInstalling(app.key)" label="Install" class="shrink-0" @click="installApp(app)" />
            </div>
          </div>
          <p v-if="!marketApps.length" class="text-p-sm text-ink-gray-5">No apps match “{{ appSearch }}”.</p>
        </section>

        <!-- Domains — connect a custom domain end to end, right here. -->
        <section v-else-if="active === 'Domains'" class="space-y-4">
          <div class="flex gap-2">
            <FormControl
              v-model="newDomain"
              type="text"
              class="flex-1"
              placeholder="shop.mycompany.in"
              autocomplete="off"
              @keyup.enter="addDomain"
            />
            <Button variant="solid" label="Add" :disabled="!domainValid" @click="addDomain" />
          </div>

          <div v-if="domains.length" class="space-y-3">
            <div v-for="d in domains" :key="d.id" class="overflow-hidden rounded-lg border border-outline-gray-2">
              <div class="flex items-center justify-between gap-2 p-3">
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="truncate text-p-sm font-medium text-ink-gray-8">{{ d.name }}</span>
                    <span v-if="d.ssl" class="lucide-lock size-3 shrink-0 text-ink-green-6" />
                  </div>
                  <div class="text-p-xs" :class="domainStatusClass(d)">{{ domainStatusText(d) }}</div>
                </div>
                <Button
                  v-if="d.status === 'pending' || d.status === 'failed' || d.status === 'verifying'"
                  size="sm"
                  class="shrink-0"
                  :loading="d.status === 'verifying'"
                  :label="d.status === 'failed' ? 'Retry' : 'Verify'"
                  @click="verify(d)"
                />
                <span v-else-if="d.status === 'active'" class="lucide-circle-check size-5 shrink-0 text-ink-green-6" />
              </div>
              <div v-if="d.status !== 'active'" class="space-y-2 border-t border-outline-gray-2 bg-surface-gray-1 p-3">
                <div class="text-p-xs text-ink-gray-5">Add these at your DNS provider, then verify:</div>
                <div
                  v-for="r in d.dnsRecords"
                  :key="r.type + r.host"
                  class="grid grid-cols-[2.5rem_1fr_auto] items-center gap-2 text-p-xs"
                >
                  <span class="rounded bg-surface-gray-3 px-1.5 py-0.5 text-center font-medium text-ink-gray-7">{{ r.type }}</span>
                  <span class="truncate font-mono text-ink-gray-7">{{ r.host }}</span>
                  <button
                    class="flex items-center gap-1 truncate font-mono text-ink-gray-7 hover:text-ink-gray-9"
                    @click="copyValue(r.value)"
                  >
                    <span class="truncate">{{ r.value }}</span>
                    <span class="lucide-copy size-3 shrink-0 text-ink-gray-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          <p v-else class="text-p-sm text-ink-gray-5">No custom domains yet. Add one above and we'll handle SSL once DNS checks out.</p>
        </section>

        <!-- Billing — plan, cost, balance, payment method; full management in Central. -->
        <section v-else-if="active === 'Billing'" class="space-y-4">
          <!-- Plan + specs + change. "Change plan" opens the server's plan options. -->
          <div class="flex items-center justify-between gap-3 rounded-lg border border-outline-gray-2 bg-surface-gray-1 p-3">
            <div class="min-w-0">
              <div class="text-p-xs text-ink-gray-5">Plan</div>
              <div class="truncate font-medium text-ink-gray-8">{{ planName }}</div>
              <div v-if="planSpecs" class="mt-0.5 truncate text-p-xs text-ink-gray-5">{{ planSpecs.compute }} compute · {{ planSpecs.database }} DB · {{ planSpecs.disk }} disk</div>
            </div>
            <Button variant="subtle" size="sm" label="Change plan" @click="upgrade" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="rounded-lg border border-outline-gray-2 bg-surface-gray-1 p-3">
              <div class="text-p-xs text-ink-gray-5">This month</div>
              <div class="mt-0.5 font-semibold tabular-nums text-ink-gray-9">{{ money(store.estimatedThisCycle) }}</div>
              <div class="mt-0.5 text-p-xs text-ink-gray-5">Covers every site on your server</div>
            </div>
            <div class="rounded-lg border border-outline-gray-2 bg-surface-gray-1 p-3">
              <div class="text-p-xs text-ink-gray-5">{{ balanceLabel }}</div>
              <div class="mt-0.5 font-semibold tabular-nums text-ink-gray-9">{{ money(balanceValue) }}</div>
              <div class="mt-0.5 text-p-xs" :class="covers ? 'text-ink-gray-5' : 'text-ink-amber-8'">{{ coverNote }}</div>
            </div>
          </div>
          <!-- Not set up yet: the payment-method empty state, set up right here
               in the Desk — no trip to Central (decision 2). -->
          <div v-if="!hasMethod" class="rounded-lg border border-dashed border-outline-gray-2 bg-surface-gray-1 p-4">
            <div class="flex items-start gap-3">
              <span class="lucide-credit-card size-5 shrink-0 text-ink-gray-5" />
              <div class="min-w-0 flex-1">
                <div class="text-p-sm font-medium text-ink-gray-8">No payment method yet</div>
                <p class="mt-0.5 text-p-xs text-ink-gray-5">You're on trial credit. Add a payment method to keep {{ site?.subdomain || 'your site' }} running after it.</p>
              </div>
            </div>
            <Button class="mt-3" variant="solid" size="sm" label="Add payment method" icon-left="lucide-plus" @click="pmSetupOpen = true" />
          </div>

          <!-- Set up: a quick top-up at the gateway, then back to the Desk. -->
          <div v-else>
            <Button variant="solid" label="Add credit" icon-left="lucide-plus" @click="addCredit" />
            <p class="mt-2 text-p-xs text-ink-gray-5">{{ primaryMethodLabel }} · opens a secure checkout, then brings you back here.</p>
          </div>

          <!-- A minimal door to the full billing page (payment methods, invoices, email). -->
          <button
            class="flex w-full items-center justify-between gap-3 border-t border-outline-gray-2 pt-3 text-left text-p-xs text-ink-gray-5 transition-colors hover:text-ink-gray-7"
            @click="openAccount"
          >
            <span>Payment methods, invoices &amp; billing email</span>
            <span class="lucide-arrow-up-right size-3.5 shrink-0" />
          </button>
        </section>

        <!-- Advanced — server facts, the escape hatch, and usage only if it's tight. -->
        <section v-else-if="active === 'Advanced'" class="space-y-4">
          <!-- Usage surfaces here only when the server is close to its limits. -->
          <div v-if="!health.ok" class="rounded-lg border border-outline-amber-1 bg-surface-amber-1 p-3">
            <div class="flex items-center justify-between gap-3">
              <span class="flex items-center gap-2 text-p-sm font-medium text-ink-amber-8"><span class="lucide-gauge size-4" /> Server is filling up</span>
              <Button size="sm" variant="subtle" label="Upgrade" class="shrink-0" @click="upgrade" />
            </div>
            <div class="mt-2.5 space-y-2">
              <div v-for="m in meters" :key="m.label">
                <div class="flex items-center justify-between text-p-xs">
                  <span class="text-ink-gray-6">{{ m.label }}</span>
                  <span class="tabular-nums text-ink-gray-7">{{ m.detail }}</span>
                </div>
                <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-gray-3">
                  <div class="h-full rounded-full" :class="barClass(m.pct)" :style="{ width: Math.max(m.pct, 2) + '%' }" />
                </div>
              </div>
            </div>
          </div>

          <div class="space-y-1.5 rounded-lg border border-outline-gray-2 bg-surface-gray-1 p-3 text-p-sm">
            <div class="flex items-center justify-between gap-3"><span class="text-ink-gray-5">Server</span><span class="truncate text-ink-gray-8">{{ server?.name }}</span></div>
            <div class="flex items-center justify-between gap-3"><span class="text-ink-gray-5">Plan</span><span class="truncate text-ink-gray-8">{{ planName }}</span></div>
            <div class="flex items-center justify-between gap-3"><span class="text-ink-gray-5">Region</span><span class="truncate text-ink-gray-8">{{ regionLabel }}</span></div>
            <div class="flex items-center justify-between gap-3"><span class="text-ink-gray-5">Frappe version</span><span class="truncate text-ink-gray-8">{{ versionLabel }}</span></div>
          </div>

          <div class="rounded-lg border border-dashed border-outline-gray-2 bg-surface-gray-1 p-4">
            <div class="text-p-sm font-medium text-ink-gray-8">Open your server</div>
            <p class="mt-0.5 text-p-xs text-ink-gray-5">Deploys, scaling, SSH, backups, and adding or changing sites — the full controls live on your server.</p>
            <Button class="mt-3" variant="subtle" size="sm" label="Open server" icon-right="lucide-arrow-up-right" @click="openServer" />
          </div>

          <button
            v-if="store.centralUnlocked"
            class="flex w-full items-center justify-between rounded-lg border border-outline-gray-2 px-3 py-2.5 text-left text-p-sm transition-colors hover:bg-surface-gray-2"
            @click="openAccount"
          >
            <span class="text-ink-gray-7">Account &amp; billing</span>
            <span class="lucide-arrow-up-right size-4 text-ink-gray-5" />
          </button>
        </section>
        </div>
      </div>
    </div>
  </Dialog>

  <!-- The billing first-time-setup, in-modal (shared with the Central billing
       page). On completion the Billing tab flips to its set-up state. -->
  <PaymentSetupDialog v-model:open="pmSetupOpen" />
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Button, Dialog, FormControl, Tooltip, toast } from 'frappe-ui'
import AppIcon from './AppIcon.vue'
import PaymentSetupDialog from './PaymentSetupDialog.vue'
import { useCloudStore } from '../stores/cloud'
import { money as fmtMoney } from '../utils/format'
import { APP_CATALOG, planById, versionById } from '../data/catalog'

const open = defineModel('open', { type: Boolean, default: false })
const props = defineProps({ initialTab: { type: String, default: 'Apps' } })

const store = useCloudStore()
const router = useRouter()

// The site whose Desk we're in, and the (single) server behind it.
const site = computed(() => store.currentSite || store.server?.sites[0] || null)
const server = computed(() => store.serverOfSite(site.value?.id) || store.server)

// Open to the tab the entry point asked for (launcher → Apps, billing banner →
// Billing). No Overview: you land somewhere you can act.
const active = ref(props.initialTab || 'Apps')
watch(open, (isOpen) => { if (isOpen) active.value = props.initialTab || 'Apps' })

const pmSetupOpen = ref(false) // the in-modal billing first-time-setup dialog

// Everything in the user's one display currency (decision 8).
const money = (n) => fmtMoney(n, store.displayCurrency)

// — Billing. A trial owner (no payment method yet) sees trial credit; a set-up
// owner sees their prepaid wallet. The action gates on whether billing is ready.
const hasMethod = computed(() => store.cardOnFile || store.paymentMethods.length > 0)
const primaryMethodLabel = computed(() => {
  const pm = store.paymentMethods.find((p) => p.primary) || store.paymentMethods[0]
  return pm ? `${pm.label} ${pm.detail}` : 'Card on file'
})
const balanceLabel = computed(() => (hasMethod.value ? 'Credit balance' : 'Trial credit'))
const balanceValue = computed(() => (hasMethod.value ? store.walletBalance : store.creditDisplay))
const covers = computed(() => balanceValue.value >= store.estimatedThisCycle)
const coverNote = computed(() => (covers.value ? 'Covers this month' : "Won't cover this month"))

// — Domains: the whole add → DNS → verify → SSL loop, in the Desk (issue #22).
const domains = computed(() => site.value?.domains || [])
const domainsNeedAttention = computed(() => domains.value.some((d) => d.status === 'pending' || d.status === 'failed'))
const newDomain = ref('')
const domainValid = computed(() => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(newDomain.value.trim()))
function addDomain() {
  if (!domainValid.value || !site.value) return
  store.addDomain(site.value.id, newDomain.value.trim().toLowerCase())
  newDomain.value = ''
  toast.success('Domain added — add the DNS records below, then verify')
}
function verify(d) {
  store.verifyDomain(site.value.id, d.id)
}
function domainStatusText(d) {
  if (d.status === 'active') return d.ssl ? 'Connected · SSL active' : 'Connected'
  if (d.status === 'verifying') return 'Checking DNS…'
  if (d.status === 'failed') return 'DNS check failed — re-check the records and retry'
  return 'Awaiting DNS'
}
function domainStatusClass(d) {
  if (d.status === 'active') return 'text-ink-green-7'
  if (d.status === 'failed') return 'text-ink-red-7'
  return 'text-ink-gray-5'
}
function copyValue(v) {
  navigator.clipboard?.writeText(v)
  toast.success('Copied')
}

// — Apps. One grid installs and updates. Updates to an installed app are always
// same-line minor bumps (a v16-only app can't be installed on a v15 server in
// the first place), so "Update all" is safe to batch; major version moves are a
// deliberate server upgrade, not an app button.
const appSearch = ref('')
const siteUpdates = computed(() => {
  const out = []
  for (const a of site.value?.apps || []) {
    const latest = store.appUpdate(a)
    if (latest) out.push({ appKey: a.key, name: a.name, latest })
  }
  return out
})
const marketApps = computed(() => {
  const q = appSearch.value.trim().toLowerCase()
  const ver = server.value?.version
  const installed = new Map((site.value?.apps || []).map((a) => [a.key, a]))
  const list = APP_CATALOG
    .filter((a) => !q || a.name.toLowerCase().includes(q) || a.tagline.toLowerCase().includes(q))
    .map((a) => {
      const inst = installed.get(a.key)
      const latest = inst ? store.appUpdate(inst) : null
      return {
        ...a,
        installed: !!inst,
        hasUpdate: !!latest,
        latest,
        compatible: a.compat.includes(ver),
        needs: versionById(a.compat[0]).label,
      }
    })
  // Your apps first (updates at the very top), then installable, then locked.
  const rank = (x) => (x.installed ? (x.hasUpdate ? 0 : 1) : x.compatible ? 2 : 3)
  return list.sort((a, b) => rank(a) - rank(b))
})
const installingKeys = reactive(new Set())
const isInstalling = (key) => installingKeys.has(key)
function installApp(app) {
  if (!site.value) return
  installingKeys.add(app.key)
  toast.promise(store.addApp(site.value.id, app.key), {
    loading: `Installing ${app.name} on ${site.value.subdomain}…`,
    success: () => { installingKeys.delete(app.key); return `${app.name} installed on ${site.value.subdomain}` },
    error: () => { installingKeys.delete(app.key); return `Couldn't install ${app.name} — try again` },
  })
}
const busyKeys = reactive(new Set())
const isBusy = (key) => busyKeys.has(key)
function updateOne(appKey, name, latest) {
  busyKeys.add(appKey)
  toast.promise(store.updateApp(site.value.id, appKey), {
    loading: `Updating ${name}…`,
    success: () => { busyKeys.delete(appKey); return `${name} updated${latest ? ` to ${latest}` : ''}` },
    error: () => { busyKeys.delete(appKey); return `Couldn't update ${name} — try again` },
  })
}
const updatingAll = ref(false)
function updateAll() {
  const items = siteUpdates.value.slice()
  if (!items.length) return
  updatingAll.value = true
  items.forEach((u) => busyKeys.add(u.appKey))
  toast.promise(Promise.all(items.map((u) => store.updateApp(site.value.id, u.appKey))), {
    loading: `Updating ${items.length} apps…`,
    success: () => { items.forEach((u) => busyKeys.delete(u.appKey)); updatingAll.value = false; return 'All apps updated' },
    error: () => { items.forEach((u) => busyKeys.delete(u.appKey)); updatingAll.value = false; return "Some updates didn't finish — try again" },
  })
}

// — Server health: surfaced in Advanced only when it's close to its limits.
const health = computed(() => store.healthOf(server.value))
const planName = computed(() => planById(server.value?.planId)?.name || '')
const planSpecs = computed(() => planById(server.value?.planId)?.specs || null)
const meters = computed(() => {
  const h = health.value
  return [
    { label: 'CPU', pct: h.cpuPct, detail: `${h.cpuPct}%` },
    { label: 'Memory', pct: h.memPct, detail: `${h.memUsed} / ${h.memTotal} GB` },
    { label: 'Storage', pct: h.diskPct, detail: `${h.diskUsed} / ${h.diskTotal} GB` },
  ]
})
function barClass(pct) {
  if (pct >= 90) return 'bg-[var(--ink-red-7)]'
  if (pct >= 75) return 'bg-[var(--ink-amber-7)]'
  return 'bg-[var(--ink-gray-8)]'
}

// — Advanced facts.
const regionLabel = computed(() => store.regionOf(server.value)?.name || '')
const versionLabel = computed(() => versionById(server.value?.version)?.label || '')

const tabs = computed(() => [
  { label: 'Apps', icon: 'lucide-layout-grid', badge: siteUpdates.value.length || null },
  { label: 'Domains', icon: 'lucide-globe', dot: domainsNeedAttention.value },
  { label: 'Billing', icon: 'lucide-wallet', dot: !hasMethod.value },
  { label: 'Advanced', icon: 'lucide-settings-2' },
])

// A one-line "what is this" under each panel title (the modal has no header).
const panelMeta = {
  Apps: 'Install apps and keep them up to date.',
  Domains: 'Connect your own domain to this site.',
  Billing: 'Your credit and payment method.',
  Advanced: 'Server details and deeper controls.',
}

// — Round-trips out of the Desk that must bring the user back (return-to-origin).
function origin() {
  return { label: site.value?.subdomain || 'your site', path: '/app' }
}
function addCredit() {
  // Only reachable once billing is set up. A quick top-up at the gateway, or the
  // combined Central view post-graduation (decision 9).
  open.value = false
  store.redirectWithReturn(router, store.centralUnlocked ? '/billing' : '/pay', origin())
}
function upgrade() {
  open.value = false
  store.redirectWithReturn(router, `/manage/${server.value.id}`, origin())
}
function openServer() {
  open.value = false
  store.redirectWithReturn(router, `/manage/${server.value.id}`, origin())
}
function openAccount() {
  open.value = false
  store.redirectWithReturn(router, '/billing', origin())
}
</script>

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
        <!-- Title (and the Marketplace search) stay pinned while the panel scrolls. -->
        <div class="sticky top-0 z-10 space-y-3 bg-surface-elevation-1 px-10 pb-4 pt-8">
          <header class="flex items-start justify-between gap-3 pr-8">
            <div class="min-w-0">
              <h2 class="text-lg font-semibold leading-tight text-ink-gray-9">{{ active }}</h2>
              <p class="mt-0.5 text-p-sm text-ink-gray-5">{{ panelMeta[active] }}</p>
            </div>
            <!-- Update all opens the same Updates dialog the server shell uses —
                 select which, schedule, or skip failing patches. -->
            <Button
              v-if="active === 'Marketplace' && siteUpdates.length"
              size="sm"
              variant="solid"
              :label="`Update all (${siteUpdates.length})`"
              class="shrink-0"
              @click="updatesOpen = true"
            />
          </header>
          <div v-if="active === 'Marketplace'" class="flex gap-2">
            <div class="min-w-0 flex-1">
              <FormControl v-model="appSearch" type="text" placeholder="Search apps" autocomplete="off" />
            </div>
            <div class="w-1/4 shrink-0">
              <FormControl v-model="category" type="select" :options="categoryOptions" />
            </div>
          </div>
        </div>

        <div class="px-10 pb-8 pt-2">
          <!-- Marketplace — one grid that both installs and manages: an installed
               app shows Update (when there's one) or Uninstall; a fresh one shows
               Install, which runs a real-feeling progress ring you can cancel. -->
          <section v-if="active === 'Marketplace'">
            <!-- No cards — compact rows divided by a rule that runs under the
                 text only (not the logo), like a list. -->
            <div class="grid gap-x-8 sm:grid-cols-2">
            <div
              v-for="app in marketApps"
              :key="app.key"
              class="flex items-center gap-2.5"
            >
              <AppIcon :app-key="app.key" size="md" class="shrink-0" />
              <div class="flex min-w-0 flex-1 items-center justify-between gap-2 border-b border-outline-gray-2 py-4">
              <div class="min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="truncate text-base font-medium text-ink-gray-8">{{ app.name }}</span>
                  <span class="shrink-0 text-p-xs text-ink-gray-5">{{ app.version }}</span>
                  <!-- Update is read off the version diff; the target is green. -->
                  <template v-if="app.hasUpdate">
                    <span class="lucide-arrow-right size-3 shrink-0 text-ink-gray-4" />
                    <span class="shrink-0 text-p-xs font-medium text-ink-green-6">{{ app.latest }}</span>
                  </template>
                </div>
                <div v-if="isFailed(app.key)" class="truncate text-p-sm text-ink-red-6">Install failed — couldn't build on this server</div>
                <div v-else class="truncate text-p-sm text-ink-gray-5">{{ app.tagline }}</div>
              </div>

              <!-- Installing: a determinate ring that fills over ~30s, with a
                   stop control in the center to cancel mid-flight. -->
              <div v-if="isInstalling(app.key)" class="relative grid size-7 shrink-0 place-items-center">
                <svg class="size-7 -rotate-90" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" stroke="var(--surface-gray-3)" stroke-width="2.5" />
                  <circle
                    cx="12" cy="12" r="9"
                    stroke="var(--ink-gray-8)" stroke-width="2.5" stroke-linecap="round"
                    :stroke-dasharray="RING_C"
                    :stroke-dashoffset="RING_C * (1 - (installProgress[app.key] || 0) / 100)"
                    class="transition-[stroke-dashoffset] duration-200 ease-linear"
                  />
                </svg>
                <Tooltip text="Cancel install">
                  <button class="absolute inset-0 grid place-items-center text-ink-gray-6 hover:text-ink-gray-9" aria-label="Cancel install" @click="cancelInstall(app.key)">
                    <span class="lucide-x size-3" />
                  </button>
                </Tooltip>
              </div>

              <!-- Failed: name turns red above; offer a retry and the log. -->
              <div v-else-if="isFailed(app.key)" class="flex shrink-0 items-center gap-1">
                <Button size="xs" variant="ghost" label="View log" @click="viewLog" />
                <Button size="sm" variant="subtle" label="Retry" @click="startInstall(app)" />
              </div>

              <!-- Installed with an update: Update is primary; Uninstall tucks
                   into the overflow so it's there but not easy to hit. -->
              <div v-else-if="app.installed && app.hasUpdate" class="flex shrink-0 items-center gap-1">
                <Button size="sm" variant="solid" :loading="isBusy(app.key)" label="Update" @click="updateOne(app.key, app.name, app.latest)" />
                <Dropdown :options="[{ label: 'Uninstall', icon: 'lucide-trash-2', onClick: () => askUninstall(app) }]" placement="bottom-end">
                  <Button size="sm" variant="ghost" icon="lucide-more-vertical" aria-label="More" />
                </Dropdown>
              </div>

              <!-- Installed and up to date: the manage action is Uninstall. -->
              <Button v-else-if="app.installed" size="sm" variant="ghost" label="Uninstall" class="shrink-0" @click="askUninstall(app)" />

              <!-- Not installed, version-locked: explain what it needs. The span
                   stays hoverable so the tooltip fires over the disabled button. -->
              <Tooltip v-else-if="!app.compatible" :text="`Needs ${app.needs} — change your server's version to install it`">
                <span class="inline-flex shrink-0">
                  <Button variant="ghost" size="xs" :label="`Needs ${app.needs}`" disabled class="pointer-events-none" />
                </span>
              </Tooltip>

              <!-- Not installed, installable. -->
              <Button v-else size="sm" label="Install" class="shrink-0" @click="startInstall(app)" />
              </div>
            </div>
          </div>
          <p v-if="!marketApps.length" class="py-3 text-p-sm text-ink-gray-5">No apps {{ category ? 'in this category' : 'match' }}{{ appSearch ? ` “${appSearch}”` : '' }}.</p>
        </section>

        <!-- Domains — the default address plus any custom domains, connected
             end to end (add → DNS → verify → SSL) right here. -->
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

          <div class="space-y-3">
            <!-- The Frappe-managed address — always there, never removable. It's
                 primary until the owner promotes a custom domain. -->
            <div class="flex items-center justify-between gap-2 rounded-lg border border-outline-gray-2 p-3">
              <div class="min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="truncate text-base font-medium text-ink-gray-8">{{ site?.name }}</span>
                  <span class="lucide-lock size-3 shrink-0 text-ink-green-6" />
                </div>
                <div class="text-p-sm text-ink-gray-5">Default address · managed SSL</div>
              </div>
              <Badge v-if="defaultIsPrimary" variant="subtle" theme="green" label="Primary" />
              <Dropdown v-else :options="[{ label: 'Make primary', icon: 'lucide-star', onClick: () => makePrimary(null) }]" placement="bottom-end">
                <Button size="sm" variant="ghost" icon="lucide-more-vertical" aria-label="More" />
              </Dropdown>
            </div>

            <!-- Custom domains the owner added. -->
            <div v-for="d in domains" :key="d.id" class="overflow-hidden rounded-lg border border-outline-gray-2">
              <div class="flex items-center justify-between gap-2 p-3">
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="truncate text-base font-medium text-ink-gray-8">{{ d.name }}</span>
                    <span v-if="d.ssl" class="lucide-lock size-3 shrink-0 text-ink-green-6" />
                  </div>
                  <div class="text-p-sm" :class="domainStatusClass(d)">{{ domainStatusText(d) }}</div>
                </div>
                <div class="flex shrink-0 items-center gap-1">
                  <Button
                    v-if="d.status === 'pending' || d.status === 'failed' || d.status === 'verifying'"
                    size="sm"
                    :loading="d.status === 'verifying'"
                    :label="d.status === 'failed' ? 'Retry' : 'Verify'"
                    @click="verify(d)"
                  />
                  <Badge v-else-if="isPrimary(d)" variant="subtle" theme="green" label="Primary" />
                  <span v-else-if="d.status === 'active'" class="lucide-circle-check size-5 text-ink-green-6" />
                  <Dropdown :options="domainMenu(d)" placement="bottom-end">
                    <Button size="sm" variant="ghost" icon="lucide-more-vertical" aria-label="More" />
                  </Dropdown>
                </div>
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

            <p v-if="!domains.length" class="text-p-sm text-ink-gray-5">No custom domains yet. Add one above and we'll handle SSL once DNS checks out.</p>
          </div>
        </section>

        <!-- Billing — plan, what it's using, cost, balance, payment method. -->
        <section v-else-if="active === 'Billing'" class="space-y-4">
          <!-- Plan + specs + live consumption. "Change plan" opens plan options. -->
          <div class="space-y-3 rounded-lg border border-outline-gray-2 p-3">
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0">
                <div class="text-p-xs text-ink-gray-5">Plan</div>
                <div class="truncate font-medium text-ink-gray-8">{{ planName }}</div>
                <div v-if="planSpecs" class="mt-0.5 truncate text-p-xs text-ink-gray-5">{{ planSpecs.compute }} compute · {{ planSpecs.database }} DB · {{ planSpecs.disk }} disk</div>
              </div>
              <Button variant="subtle" size="sm" label="Change plan" @click="upgrade" />
            </div>
            <div class="grid grid-cols-3 gap-3 border-t border-outline-gray-2 pt-3">
              <div v-for="m in meters" :key="m.label">
                <div class="flex items-center justify-between text-p-xs">
                  <span class="text-ink-gray-6">{{ m.label }}</span>
                  <span class="tabular-nums text-ink-gray-7">{{ m.pct }}%</span>
                </div>
                <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-gray-3">
                  <div class="h-full rounded-full" :class="barClass(m.pct)" :style="{ width: Math.max(m.pct, 2) + '%' }" />
                </div>
              </div>
            </div>
          </div>

          <!-- Resource pressure surfaces here, next to consumption, with the fix. -->
          <Alert
            v-if="!health.ok"
            theme="yellow"
            title="Your server is filling up"
            :action="{ label: 'Upgrade', onClick: upgrade }"
          />

          <div class="grid grid-cols-2 gap-3">
            <div class="rounded-lg border border-outline-gray-2 p-3">
              <div class="text-p-xs text-ink-gray-5">This month</div>
              <div class="mt-0.5 font-semibold tabular-nums text-ink-gray-9">{{ money(store.estimatedThisCycle) }}</div>
              <div class="mt-0.5 text-p-xs text-ink-gray-5">Covers every site on your server</div>
            </div>
            <div class="rounded-lg border border-outline-gray-2 p-3">
              <div class="text-p-xs text-ink-gray-5">{{ balanceLabel }}</div>
              <div class="mt-0.5 font-semibold tabular-nums text-ink-gray-9">{{ money(balanceValue) }}</div>
              <div class="mt-0.5 text-p-xs" :class="covers ? 'text-ink-gray-5' : 'text-ink-amber-8'">{{ coverNote }}</div>
            </div>
          </div>
          <!-- Not set up yet: the payment-method empty state, set up right here
               in the Desk — no trip to Central (decision 2). -->
          <div v-if="!hasMethod" class="rounded-lg border border-dashed border-outline-gray-2 bg-surface-base p-4">
            <div class="flex items-start gap-3">
              <span class="lucide-credit-card size-5 shrink-0 text-ink-gray-5" />
              <div class="min-w-0 flex-1">
                <div class="text-base font-medium text-ink-gray-8">No payment method yet</div>
                <p class="mt-0.5 text-p-sm text-ink-gray-5">You're on trial credit. Add a payment method to keep {{ site?.subdomain || 'your site' }} running after it.</p>
              </div>
            </div>
            <Button class="mt-3" variant="solid" size="sm" label="Add payment method" icon-left="lucide-plus" @click="pmSetupOpen = true" />
          </div>

          <!-- Set up: a quick top-up at the gateway, then back to the Desk. -->
          <div v-else class="space-y-4">
            <div>
              <Button variant="solid" label="Add credit" icon-left="lucide-plus" @click="addCredit" />
              <p class="mt-2 text-p-xs text-ink-gray-5">{{ primaryMethodLabel }} · opens a secure checkout, then brings you back here.</p>
            </div>

            <!-- Auto-recharge — keep credit topped up so the site never pauses. -->
            <div class="flex items-center justify-between gap-3 rounded-lg border border-outline-gray-2 p-3">
              <div class="min-w-0">
                <div class="text-base font-medium text-ink-gray-8">Auto-recharge</div>
                <p class="mt-0.5 text-p-sm text-ink-gray-5">
                  <template v-if="store.autoRecharge">Below {{ money(store.rechargeThreshold) }}, we add {{ money(store.rechargeAmount) }} from {{ primaryMethodLabel }}.</template>
                  <template v-else>Top up credit automatically so your site never pauses.</template>
                </p>
              </div>
              <Switch :model-value="store.autoRecharge" class="shrink-0" @update:model-value="store.setAutoRecharge" />
            </div>
          </div>
        </section>

        <!-- Advanced — the escape hatches out of the Desk: the full server, and
             the account. No cards; the action sits at the far right of each. -->
        <section v-else-if="active === 'Advanced'">
          <div class="divide-y divide-outline-gray-2">
            <div class="flex items-start justify-between gap-3 py-3">
              <div class="min-w-0">
                <div class="text-base font-medium text-ink-gray-8">Open your server</div>
                <p class="mt-0.5 text-p-sm text-ink-gray-5">Deploys, scaling, SSH, backups, and adding or changing sites — the full controls live on your server.</p>
              </div>
              <Button class="shrink-0" variant="subtle" size="sm" label="Open server" icon-right="lucide-arrow-up-right" @click="openServer" />
            </div>

            <div class="flex items-start justify-between gap-3 py-3">
              <div class="min-w-0">
                <div class="text-base font-medium text-ink-gray-8">Account &amp; billing</div>
                <p class="mt-0.5 text-p-sm text-ink-gray-5">Payment methods, invoices, billing email and your account settings — manage it all in one place.</p>
              </div>
              <Button class="shrink-0" variant="subtle" size="sm" label="Manage account" icon-right="lucide-arrow-up-right" @click="openAccount" />
            </div>
          </div>
        </section>
        </div>
      </div>
    </div>
  </Dialog>

  <!-- The batch Updates dialog, shared with the server shell (select / schedule
       / skip failing patches). Scoped to this owner's single server. -->
  <UpdateServerDialog v-model:open="updatesOpen" :server="server" />

  <!-- The billing first-time-setup, in-modal (shared with the Central billing
       page). On completion the Billing tab flips to its set-up state. -->
  <PaymentSetupDialog v-model:open="pmSetupOpen" />

  <!-- Danger confirms — uninstalling an app and unlinking a custom domain. -->
  <ConfirmDialog
    v-model:open="uninstallOpen"
    theme="red"
    :title="`Uninstall ${pendingApp?.name}?`"
    :message="`It comes off ${site?.name}. Its data stays in your backups for 30 days.`"
    confirm-label="Uninstall"
    @confirm="doUninstall"
  />
  <ConfirmDialog
    v-model:open="unlinkOpen"
    theme="red"
    :title="`Unlink ${pendingDomain?.name}?`"
    :message="`${site?.name} will stop loading at ${pendingDomain?.name} and its SSL certificate is dropped. Remember to remove the DNS records at your provider too. You can re-add it anytime.`"
    confirm-label="Unlink domain"
    @confirm="doUnlink"
  />
</template>

<script setup>
import { computed, onUnmounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Badge, Button, Dialog, Dropdown, FormControl, Switch, Tooltip, toast } from 'frappe-ui'
import Alert from './Alert.vue'
import AppIcon from './AppIcon.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import PaymentSetupDialog from './PaymentSetupDialog.vue'
import UpdateServerDialog from './UpdateServerDialog.vue'
import { useCloudStore } from '../stores/cloud'
import { money as fmtMoney } from '../utils/format'
import { APP_CATALOG, APP_CATEGORIES, categoryOf, planById, versionById } from '../data/catalog'

const open = defineModel('open', { type: Boolean, default: false })
const props = defineProps({ initialTab: { type: String, default: 'Billing' } })

const store = useCloudStore()
const router = useRouter()

// The site whose Desk we're in, and the (single) server behind it.
const site = computed(() => store.currentSite || store.server?.sites[0] || null)
const server = computed(() => store.serverOfSite(site.value?.id) || store.server)

// Open to the tab the entry point asked for (gear / banner → Billing, etc.).
// No Overview: you land somewhere you can act.
const active = ref(props.initialTab || 'Billing')
watch(open, (isOpen) => { if (isOpen) active.value = props.initialTab || 'Billing' })

const pmSetupOpen = ref(false) // the in-modal billing first-time-setup dialog
const updatesOpen = ref(false) // the batch Updates dialog (reused from the server shell)

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
// The default `*.frappe.cloud` host is `site.name`, not a domain entry, so it's
// shown separately and can't be unlinked — these are the custom ones.
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

// Primary domain — the one shown in the address bar; the rest redirect to it.
// `null` means the default `*.frappe.cloud` host is primary.
const defaultIsPrimary = computed(() => !site.value?.primaryDomain)
function isPrimary(d) {
  return site.value?.primaryDomain === d.id
}
function makePrimary(domainId) {
  if (!site.value) return
  store.setPrimaryDomain(site.value.id, domainId)
  toast.success(domainId ? 'Primary domain updated' : `${site.value.name} is primary again`)
}
// Only a connected domain can be promoted; unlink is always available.
function domainMenu(d) {
  const items = []
  if (d.status === 'active' && !isPrimary(d)) items.push({ label: 'Make primary', icon: 'lucide-star', onClick: () => makePrimary(d.id) })
  items.push({ label: 'Unlink domain', icon: 'lucide-unlink', onClick: () => askUnlink(d) })
  return items
}

// Unlink a custom domain — a danger action, gated behind a confirm.
const unlinkOpen = ref(false)
const pendingDomain = ref(null)
function askUnlink(d) {
  pendingDomain.value = d
  unlinkOpen.value = true
}
function doUnlink() {
  if (!pendingDomain.value || !site.value) return
  const name = pendingDomain.value.name
  store.unlinkDomain(site.value.id, pendingDomain.value.id)
  pendingDomain.value = null
  toast.success(`Unlinked ${name}`)
}

// — Marketplace. One grid installs and updates. Updates to an installed app are
// always same-line minor bumps (a v16-only app can't be installed on a v15
// server in the first place), so "Update all" is safe to batch; major version
// moves are a deliberate server upgrade, not an app button.
const appSearch = ref('')
const category = ref('') // marketplace category filter ('' = all)
const categoryOptions = [{ label: 'All categories', value: '' }, ...APP_CATEGORIES]
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
  const cat = category.value
  const ver = server.value?.version
  const installed = new Map((site.value?.apps || []).map((a) => [a.key, a]))
  const list = APP_CATALOG
    .filter((a) => (!q || a.name.toLowerCase().includes(q) || a.tagline.toLowerCase().includes(q)) && (!cat || categoryOf(a.key) === cat))
    .map((a) => {
      const inst = installed.get(a.key)
      const latest = inst ? store.appUpdate(inst) : null
      return {
        ...a,
        version: inst ? inst.version : a.version,
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

// — Install. A real-feeling determinate ring that fills over ~30s, then commits
// through the store (which fails in edge mode, surfacing the failed state). The
// ring is cancellable mid-flight.
const RING_C = 2 * Math.PI * 9 // circumference of the r=9 progress ring
const INSTALL_MS = 30000
const TICK_MS = 200
const installProgress = reactive({}) // appKey -> 0..100 while installing
const installTimers = {} // appKey -> interval id
const failedKeys = reactive(new Set())
const isInstalling = (key) => key in installProgress
const isFailed = (key) => failedKeys.has(key)

function startInstall(app) {
  if (!site.value) return
  failedKeys.delete(app.key)
  installProgress[app.key] = 0
  const step = (TICK_MS / INSTALL_MS) * 100
  installTimers[app.key] = setInterval(() => {
    const next = (installProgress[app.key] || 0) + step
    if (next >= 100) {
      installProgress[app.key] = 100
      stopTimer(app.key)
      commitInstall(app)
    } else {
      installProgress[app.key] = next
    }
  }, TICK_MS)
}
function commitInstall(app) {
  // Hold the ring at 100% until the store settles, so the row doesn't flash
  // back to "Install" before the app appears as installed.
  store
    .addApp(site.value.id, app.key)
    .then(() => {
      delete installProgress[app.key]
      toast.success(`${app.name} installed on ${site.value.subdomain}`)
    })
    .catch(() => {
      delete installProgress[app.key]
      failedKeys.add(app.key)
      // Record the failed run so "View log" has a real task to open.
      store.logTask('Install App', {
        site: site.value.name,
        status: 'failed',
        duration: '1m 12s',
        steps: [
          { name: 'Resolve app dependencies', status: 'success', duration: '3s' },
          { name: 'Build assets', status: 'success', duration: '58s' },
          { name: 'Run migrations', status: 'failed', duration: '11s' },
        ],
      })
      toast.error(`Couldn't install ${app.name} — try again`)
    })
}
function cancelInstall(key) {
  stopTimer(key)
  delete installProgress[key]
  toast('Install cancelled')
}
function stopTimer(key) {
  clearInterval(installTimers[key])
  delete installTimers[key]
}
// "View log" leaves the Desk for the server's Tasks page — return-aware, so the
// owner lands back here. The failed run is at the top of the list.
function viewLog() {
  open.value = false
  store.redirectWithReturn(router, `/manage/${server.value.id}/developer/tasks`, origin())
}
onUnmounted(() => Object.keys(installTimers).forEach(stopTimer))

// Per-app one-tap update (the batch lives in the Updates dialog).
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

// Uninstall — a danger action, gated behind a confirm.
const uninstallOpen = ref(false)
const pendingApp = ref(null)
function askUninstall(app) {
  pendingApp.value = app
  uninstallOpen.value = true
}
function doUninstall() {
  if (!pendingApp.value || !site.value) return
  const name = pendingApp.value.name
  store.uninstallApp(site.value.id, pendingApp.value.key)
  pendingApp.value = null
  toast.success(`Uninstalled ${name}`)
}

// — Server health: the meters render in Billing; "ok" gates the amber nudge.
const health = computed(() => store.healthOf(server.value))
const planName = computed(() => planById(server.value?.planId)?.name || '')
const planSpecs = computed(() => planById(server.value?.planId)?.specs || null)
const meters = computed(() => {
  const h = health.value
  return [
    { label: 'CPU', pct: h.cpuPct },
    { label: 'Memory', pct: h.memPct },
    { label: 'Storage', pct: h.diskPct },
  ]
})
function barClass(pct) {
  if (pct >= 90) return 'bg-[var(--ink-red-7)]'
  if (pct >= 75) return 'bg-[var(--ink-amber-7)]'
  return 'bg-[var(--ink-gray-8)]'
}

const tabs = computed(() => [
  { label: 'Billing', icon: 'lucide-wallet', dot: !hasMethod.value },
  { label: 'Marketplace', icon: 'lucide-layout-grid', badge: siteUpdates.value.length || null },
  { label: 'Domains', icon: 'lucide-globe', dot: domainsNeedAttention.value },
  { label: 'Advanced', icon: 'lucide-settings-2' },
])

// A one-line "what is this" under each panel title (the modal has no header).
const panelMeta = {
  Billing: 'Your plan, usage, credit and payment method.',
  Marketplace: 'Install apps and keep them up to date.',
  Domains: 'The addresses this site answers on.',
  Advanced: 'Deeper controls for your server.',
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

<template>
  <CentralShell :crumbs="crumbs">
    <!-- Identity — same header whether or not it's activated, so turning it on
         doesn't feel like landing on a different page. -->
    <div class="flex items-start justify-between gap-4">
      <div class="flex min-w-0 items-start gap-3">
        <span class="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-gray-2 text-ink-gray-7">
          <span class="size-5" :class="addon.icon" />
        </span>
        <div class="min-w-0">
          <h1 class="text-xl font-semibold text-ink-gray-9">{{ addon.name }}</h1>
          <p class="mt-0.5 text-p-base text-ink-gray-5">{{ addon.tagline }}</p>
        </div>
      </div>
      <Dropdown v-if="activated" :options="menu" placement="bottom-end">
        <button class="mt-1 shrink-0 rounded p-1 text-ink-gray-5 hover:bg-surface-gray-2" aria-label="AI inference actions">
          <span class="lucide-ellipsis size-4" />
        </button>
      </Dropdown>
    </div>

    <!-- ── Not activated: the pitch, the two ways to consume, and the price ──
         Activation is a team-level, billing-gated step (mirrors "Enable for the
         team"): after it, sites and keys can draw on the plan. -->
    <template v-if="!activated">
      <p class="mt-6 max-w-prose text-p-base text-ink-gray-7">{{ addon.blurb }}</p>

      <!-- Two paths, one meter — the shape of the whole feature. -->
      <div class="mt-6 grid gap-4 sm:grid-cols-2">
        <div class="rounded-lg border border-outline-gray-2 bg-surface-base p-4">
          <span class="lucide-globe size-4.5 text-ink-gray-6" />
          <h3 class="mt-2 text-sm font-semibold text-ink-gray-8">On your sites</h3>
          <p class="mt-1 text-p-sm text-ink-gray-5">Enable AI on a site and its apps — Builder, Studio, HD — work out of the box.</p>
        </div>
        <div class="rounded-lg border border-outline-gray-2 bg-surface-base p-4">
          <span class="lucide-key-round size-4.5 text-ink-gray-6" />
          <h3 class="mt-2 text-sm font-semibold text-ink-gray-8">In your own apps</h3>
          <p class="mt-1 text-p-sm text-ink-gray-5">Generate a key and call the same models from anywhere, over an OpenAI-compatible API.</p>
        </div>
      </div>

      <section class="mt-4 rounded-lg border border-outline-gray-2 bg-surface-base p-5 pt-4">
        <h2 class="text-base font-semibold text-ink-gray-8">What you pay</h2>
        <div class="mt-2 divide-y divide-outline-alpha-gray-1">
          <div v-for="meter in addon.meters" :key="meter.key" class="flex items-baseline justify-between gap-3 py-2.5">
            <span class="min-w-0 truncate text-sm text-ink-gray-8">{{ meter.label }}</span>
            <span class="shrink-0 text-p-sm text-ink-gray-5">
              <span class="tabular-nums text-ink-gray-7">{{ qty(meter.included) }} {{ meter.unit }}</span> free, then
              <span class="tabular-nums text-ink-gray-7">{{ rate(meter.rate) }}</span> per {{ rateUnitOf(meter) }}
            </span>
          </div>
        </div>
      </section>

      <!-- Managers activate; everyone else is told who can. One button — if
           billing isn't set up yet, enabling opens the billing details modal
           first, then turns the service on once it's saved. -->
      <div v-if="store.canManageServices" class="mt-5 flex flex-wrap items-center gap-3">
        <Button variant="solid" label="Enable for team" icon-left="lucide-zap" :loading="activating" @click="onEnable" />
        <span class="text-p-sm text-ink-gray-5">Nothing to pay until you go over.</span>
      </div>
      <p v-else class="mt-5 text-p-sm text-ink-gray-5">Ask an account admin to enable AI inference for your team.</p>
    </template>

    <!-- ── Activated: Overview + API keys ── -->
    <template v-else>
      <div class="mt-6">
        <TabButtons v-model="tab" :options="tabs" />

        <!-- Overview: plan + status, which sites have AI on (read-only — the site
             page owns the toggle), and the models the plan grants. -->
        <template v-if="tab === 'overview'">
          <section class="mt-5 rounded-lg border border-outline-gray-2 bg-surface-base p-5">
            <div class="flex h-6 items-center justify-between gap-3">
              <span class="text-p-sm text-ink-gray-5">Plan</span>
              <Badge :label="statusLabel" :theme="statusLabel === 'Active' ? 'green' : 'orange'" variant="subtle" />
            </div>
            <!-- Plan identity on the left, the one headline number (tokens) pushed
                 to the far right so the card reads as a single clean line. -->
            <div class="mt-1.5 flex items-end justify-between gap-4">
              <div class="min-w-0">
                <p class="truncate text-sm font-semibold text-ink-gray-9">{{ planTitle }}</p>
                <p class="mt-1 text-p-sm text-ink-gray-5">{{ settlementLine }}</p>
              </div>
              <div class="shrink-0 text-right">
                <div class="text-lg font-semibold tabular-nums text-ink-gray-9">{{ tokensLabel(tokensThisCycle) }}</div>
                <div class="text-p-xs text-ink-gray-5">tokens this cycle</div>
              </div>
            </div>
          </section>

          <section class="mt-8">
            <h2 class="text-base font-semibold text-ink-gray-8">
              Sites with AI enabled<span v-if="enabledSites.length" class="font-normal text-ink-gray-5"> · {{ enabledSites.length }}</span>
            </h2>
            <ul v-if="enabledSites.length" class="mt-3 divide-y divide-outline-alpha-gray-1 border-t border-outline-alpha-gray-1">
              <li v-for="s in enabledSites" :key="s.siteId" class="flex items-center gap-2.5 py-2.5">
                <span class="size-2 shrink-0 rounded-full bg-surface-green-3" />
                <span class="min-w-0 flex-1 truncate text-sm text-ink-gray-8">{{ s.name }}</span>
                <span v-if="s.server" class="shrink-0 text-p-xs text-ink-gray-5">{{ s.server.name }}</span>
              </li>
            </ul>
            <p v-else class="mt-1 text-p-sm text-ink-gray-5">No sites have AI enabled yet. Turn it on from a site's own page.</p>
            <Button class="mt-3 -ml-2" variant="ghost" size="sm" label="Manage on your servers" icon-right="lucide-arrow-up-right" @click="router.push('/servers')" />
          </section>

          <section class="mt-8 border-t border-outline-gray-2 pt-8">
            <h2 class="text-base font-semibold text-ink-gray-8">Included models</h2>
            <p class="mt-0.5 text-p-sm text-ink-gray-5">Granted by your plan's tiers. Rates are ₹ per million tokens.</p>
            <div class="mt-3 divide-y divide-outline-alpha-gray-1 border-t border-outline-alpha-gray-1">
              <div v-for="model in models" :key="model.id" class="flex items-start justify-between gap-3 py-3">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="break-all font-mono text-sm font-medium text-ink-gray-9">{{ model.name }}</span>
                    <Badge theme="gray" variant="subtle" :label="model.kind" />
                  </div>
                  <p class="mt-0.5 text-p-xs text-ink-gray-5">{{ model.tier }} tier · {{ model.context }} context</p>
                </div>
                <div class="shrink-0 text-right text-p-sm tabular-nums text-ink-gray-7">
                  {{ rate(model.in) }}<span class="text-ink-gray-5">{{ model.out ? ' in' : '' }}</span>
                  <template v-if="model.out"> · {{ rate(model.out) }}<span class="text-ink-gray-5"> out</span></template>
                </div>
              </div>
            </div>
          </section>
        </template>

        <!-- API keys: keys Central issues for the team's own apps. Generate shows
             the key once; Reveal re-opens it (we store it); Revoke kills it. -->
        <template v-else>
          <section class="mt-6">
            <!-- No "API keys" heading — the tab names it. The context the tooltip
                 used to hold now reads plainly beside the action. -->
            <div class="flex items-start justify-between gap-4">
              <p class="max-w-prose text-p-sm text-ink-gray-5">Central-issued keys for use in your own apps. Usage bills to your team, same as on-site AI.</p>
              <Button v-if="store.canManageServices" variant="subtle" size="sm" label="Generate key" icon-left="lucide-plus" class="shrink-0" @click="openGenerate" />
            </div>

            <div v-if="apiKeys.length" class="mt-3 divide-y divide-outline-alpha-gray-1 border-t border-outline-alpha-gray-1">
              <div
                v-for="k in apiKeys"
                :key="k.id"
                class="flex items-center gap-3 py-2.5"
                :class="k.status === 'Active' && store.canManageServices && 'cursor-pointer'"
                @click="k.status === 'Active' && store.canManageServices ? reveal(k) : null"
              >
                <span class="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-gray-2 text-ink-gray-6">
                  <span class="lucide-key-round size-4" />
                </span>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="truncate text-sm font-medium text-ink-gray-9">{{ k.label }}</span>
                    <Badge :theme="k.status === 'Active' ? 'green' : 'gray'" variant="subtle" size="sm" :label="k.status" />
                  </div>
                  <div class="truncate font-mono text-p-sm text-ink-gray-5">sk-fc-••••{{ k.tail }}</div>
                </div>
                <div class="shrink-0 text-right">
                  <div class="text-p-sm tabular-nums text-ink-gray-8">{{ tokensLabel(k.usageTokens) }}</div>
                  <div class="text-p-xs text-ink-gray-5">tokens</div>
                </div>
                <Dropdown v-if="store.canManageServices && k.status === 'Active'" :options="keyMenu(k)" placement="bottom-end" @click.stop>
                  <button class="rounded p-1 text-ink-gray-5 hover:bg-surface-gray-2" :aria-label="`Actions for ${k.label}`"><span class="lucide-ellipsis size-4" /></button>
                </Dropdown>
                <span v-else class="w-6 shrink-0"></span>
              </div>
            </div>
            <EmptyState
              v-else
              class="mt-3"
              icon="lucide-key-round"
              title="No API keys yet"
              description="Generate a key to call our models from your own apps."
            >
              <Button v-if="store.canManageServices" variant="subtle" size="sm" label="Generate key" icon-left="lucide-plus" @click="openGenerate" />
            </EmptyState>
          </section>
        </template>
      </div>
    </template>

    <!-- Generate: name the key. -->
    <Dialog v-model:open="generateOpen" title="Generate API key" size="sm">
      <FormControl v-model="newLabel" type="text" label="Label" placeholder="e.g. n8n prod" @keyup.enter="generate" />
      <p class="mt-2 text-p-sm text-ink-gray-5">A name to recognise this key by. You can revoke it on its own.</p>
      <template #actions>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" @click="generateOpen = false" />
          <Button variant="solid" label="Generate" :loading="generating" :disabled="!newLabel.trim()" @click="generate" />
        </div>
      </template>
    </Dialog>

    <!-- Details: the key + curl, on generate and on reveal. -->
    <Dialog :open="!!details" :title="details ? `API key · ${details.label}` : ''" size="2xl" @update:open="(v) => { if (!v) details = null }">
      <AiConnectionDetails v-if="details" :gateway-url="details.gatewayUrl" :api-key="details.apiKey" :models="models" />
    </Dialog>

    <ConfirmDialog
      v-model:open="revokeOpen"
      title="Revoke this key?"
      :message="`${pendingRevoke?.label} stops working immediately for anything still using it. Other keys are unaffected.`"
      confirm-label="Revoke"
      theme="red"
      @confirm="confirmRevoke"
    />

    <ConfirmDialog
      v-model:open="offOpen"
      :title="`Turn off ${addon.name}?`"
      message="Site keys and API keys stop working right away. Your keys and settings are kept — turn it back on anytime."
      confirm-label="Turn off"
      theme="red"
      @confirm="deactivate"
    />

    <!-- Billing details, opened from "Enable for team" when billing isn't set
         up yet; enabling proceeds once it's saved. -->
    <PaymentSetupDialog v-model:open="billingSetupOpen" @added="activate" />
  </CentralShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Badge, Button, Dialog, Dropdown, FormControl, TabButtons, toast } from 'frappe-ui'
import CentralShell from '../../../components/CentralShell.vue'
import ConfirmDialog from '../../../components/ConfirmDialog.vue'
import EmptyState from '../../../components/EmptyState.vue'
import AiConnectionDetails from '../../../components/AiConnectionDetails.vue'
import PaymentSetupDialog from '../../../components/PaymentSetupDialog.vue'
import { AI_PLAN, addonByKey, includedAiModels, rateUnitOf } from '../../../data/addons'
import { useCloudStore } from '../../../stores/cloud'
import { qty, rate } from '../../../utils/format'

const store = useCloudStore()
const router = useRouter()

const addon = computed(() => addonByKey('ai'))
const activated = computed(() => store.aiActivated)
const crumbs = computed(() => [{ label: 'Add-on services', route: '/addons' }, { label: addon.value.name }])

// Models the plan grants — shown on Overview and offered in the connection curl.
const models = computed(() => includedAiModels())

const tab = ref('overview')
const tabs = [
  { label: 'Overview', value: 'overview' },
  { label: 'API keys', value: 'keys' },
]

// — Overview
const planTitle = computed(() => store.addonState('ai').plan || AI_PLAN.title)
const statusLabel = computed(() => (activated.value ? 'Active' : 'Inactive'))
const enabledSites = computed(() => store.aiEnabledSites)
const tokensThisCycle = computed(() => store.aiTokensThisCycle)
const settlementLine = computed(() => {
  const mode = store.addonState('ai').settlement || AI_PLAN.settlement
  if (mode === 'prepaid') {
    return AI_PLAN.prepaidTokens
      ? `Prepaid pack · ${AI_PLAN.prepaidTokens}M tokens included, then capped`
      : 'Prepaid pack · capped at your bundle'
  }
  return 'Postpaid overage · metered, no cap'
})

// A compact token count: 4.2M, 610K, 0.
function tokensLabel(n) {
  if (!n) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return String(n)
}

// — Activation. Enabling needs billing in place first: no billing yet → open
// the details modal, and its `added` event calls activate() to finish the job.
const billingSetupOpen = ref(false)
function onEnable() {
  if (!store.billingReady) {
    billingSetupOpen.value = true
    return
  }
  activate()
}

const activating = ref(false)
function activate() {
  activating.value = true
  toast.promise(store.activateAiService().finally(() => { activating.value = false }), {
    loading: 'Enabling AI inference…',
    success: () => 'AI inference is on for your team',
    error: (e) => e.message,
  })
}

// — Deactivate (⋯ menu)
const offOpen = ref(false)
const menu = [{ label: 'Turn off', icon: 'lucide-power', onClick: () => { offOpen.value = true } }]
function deactivate() {
  toast.promise(store.disableAddon('ai'), {
    loading: `Turning off ${addon.value.name}…`,
    success: () => `${addon.value.name} is off`,
    error: (e) => e.message,
  })
}

// — API keys
const apiKeys = computed(() => store.aiApiKeys)

const generateOpen = ref(false)
const newLabel = ref('')
const generating = ref(false)
function openGenerate() {
  newLabel.value = ''
  generateOpen.value = true
}
async function generate() {
  const label = newLabel.value.trim()
  if (!label) return
  generating.value = true
  try {
    const key = await store.generateAiKey(label)
    generateOpen.value = false
    // The full secret exists here for the first (and re-revealable) time.
    details.value = { label: key.label, gatewayUrl: key.gatewayUrl, apiKey: key.secret }
  } catch (e) {
    toast.error(e.message)
  } finally {
    generating.value = false
  }
}

// Reveal re-opens a stored key anytime; the list itself only ever holds the tail.
const details = ref(null)
function reveal(key) {
  if (key.status !== 'Active') return
  details.value = { label: key.label, gatewayUrl: key.gatewayUrl, apiKey: key.secret }
}

const revokeOpen = ref(false)
const pendingRevoke = ref(null)
function keyMenu(key) {
  return [
    { label: 'Reveal key', icon: 'lucide-eye', onClick: () => reveal(key) },
    { label: 'Revoke', icon: 'lucide-trash-2', onClick: () => { pendingRevoke.value = key; revokeOpen.value = true } },
  ]
}
function confirmRevoke() {
  const key = pendingRevoke.value
  if (!key) return
  toast.promise(store.revokeAiKey(key.id), {
    loading: 'Revoking…',
    success: () => `Revoked ${key.label}`,
    error: (e) => e.message,
  })
  pendingRevoke.value = null
}
</script>

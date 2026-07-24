<template>
  <AddonShell addon-key="email">
    <div class="mt-8">
      <TabButtons v-model="tab" :options="tabs" />

      <!-- ── Domains ────────────────────────────────────────────────────
           Verification is the whole job here. Each record carries its own
           status, because "pending" on a domain tells you nothing about which
           of the three lines you typed wrong. -->
      <template v-if="tab === 'domains'">
        <section class="mt-6">
          <!-- No "Sending domains" heading — the active tab already names this. -->
          <div class="flex justify-end">
            <Button variant="subtle" size="sm" label="Add domain" icon-left="lucide-plus" @click="addOpen = true" />
          </div>

          <div v-if="domains.length" class="mt-3 divide-y divide-outline-alpha-gray-1 border-t border-outline-alpha-gray-1">
            <div v-for="d in domains" :key="d.id" class="py-3">
              <div class="flex items-center gap-3">
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="truncate text-sm font-medium text-ink-gray-9">{{ d.name }}</span>
                    <Badge theme="gray" variant="subtle" :label="domainBadge(d).label" />
                  </div>
                  <div class="text-p-sm text-ink-gray-5">Added {{ d.added }}</div>
                </div>
                <Button
                  v-if="!isVerified(d)"
                  variant="subtle"
                  size="sm"
                  label="Check records"
                  :loading="checking === d.id"
                  @click="check(d)"
                />
                <Dropdown :options="domainMenu(d)" placement="bottom-end">
                  <button class="rounded p-1 text-ink-gray-5 hover:bg-surface-gray-2" :aria-label="`Actions for ${d.name}`"><span class="lucide-ellipsis size-4" /></button>
                </Dropdown>
              </div>

              <!-- The records themselves, only while something's still missing.
                   Once a domain is fully verified this table is noise — it
                   collapses behind the disclosure instead. -->
              <Disclosure v-if="!isVerified(d)" class="mt-3" flat :title="`DNS records for ${d.name}`" :default-open="true">
                <div class="overflow-x-auto">
                  <table class="w-full min-w-[34rem] text-left">
                    <thead>
                      <tr class="border-b border-outline-alpha-gray-1">
                        <th class="pb-1.5 pr-3 text-p-xs font-medium text-ink-gray-5">Type</th>
                        <th class="pb-1.5 pr-3 text-p-xs font-medium text-ink-gray-5">Name</th>
                        <th class="pb-1.5 pr-3 text-p-xs font-medium text-ink-gray-5">Value</th>
                        <th class="pb-1.5 text-p-xs font-medium text-ink-gray-5">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="r in recordsFor(d)" :key="r.key" class="border-b border-outline-alpha-gray-1 last:border-0 align-top">
                        <td class="py-2 pr-3 font-mono text-p-xs text-ink-gray-7">{{ r.type }}</td>
                        <td class="py-2 pr-3 font-mono text-p-xs text-ink-gray-7">{{ r.name }}</td>
                        <td class="max-w-[16rem] py-2 pr-3">
                          <button class="group flex w-full items-start gap-1.5 text-left" @click="copy(r.value)">
                            <span class="min-w-0 flex-1 truncate font-mono text-p-xs text-ink-gray-7">{{ r.value }}</span>
                            <span class="lucide-copy mt-0.5 size-3 shrink-0 text-ink-gray-4 transition-colors group-hover:text-ink-gray-7" />
                          </button>
                        </td>
                        <!-- Found vs not is carried by the words and the icon
                             weight, not by colour — three green ticks in a
                             three-row table is decoration, not information. -->
                        <td class="py-2">
                          <span v-if="d.records[r.key]" class="inline-flex items-center gap-1 text-p-xs text-ink-gray-7">
                            <span class="lucide-check size-3" /> Found
                          </span>
                          <span v-else class="inline-flex items-center gap-1 text-p-xs text-ink-gray-4">
                            <span class="lucide-minus size-3" /> Not found
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p class="mt-2 text-p-xs text-ink-gray-5">
                  DNS usually updates within an hour. Can take up to 48.
                </p>
              </Disclosure>
            </div>
          </div>
          <EmptyState
            v-else
            class="mt-3"
            icon="lucide-globe"
            title="No domains"
            description="Add the domain you send from, then three DNS records to prove it's yours."
          >
            <Button variant="subtle" size="sm" label="Add domain" icon-left="lucide-plus" @click="addOpen = true" />
          </EmptyState>
        </section>
      </template>

      <!-- ── Reputation ─────────────────────────────────────────────────
           Whether mail lands is decided by these two rates, so they get their
           own surface with the thresholds spelled out rather than a number the
           reader has to judge alone. -->
      <template v-else-if="tab === 'reputation'">
        <section class="mt-6">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="text-base font-semibold text-ink-gray-8">Sending status</h2>
              <p class="mt-0.5 text-p-sm text-ink-gray-5">{{ healthCopy.description }}</p>
            </div>
            <Badge :theme="healthCopy.theme" :label="healthCopy.label" />
          </div>

          <div class="mt-5 grid gap-5 sm:grid-cols-2">
            <div v-for="m in reputationMeters" :key="m.label">
              <div class="flex items-baseline justify-between gap-3">
                <span class="text-sm text-ink-gray-7">{{ m.label }}</span>
                <span class="text-base font-semibold tabular-nums text-ink-gray-9">{{ m.value }}%</span>
              </div>
              <div class="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-gray-3">
                <div class="h-full rounded-full bg-[var(--ink-gray-6)]" :style="{ width: m.width }" />
              </div>
              <p class="mt-1 text-p-xs text-ink-gray-5">
                Under {{ m.review }}% is fine · {{ m.paused }}% pauses sending
              </p>
            </div>
          </div>
        </section>

        <section class="mt-8 border-t border-outline-gray-2 pt-8">
          <div class="flex items-center gap-1.5">
            <h2 class="text-base font-semibold text-ink-gray-8">Suppressed addresses</h2>
            <Tooltip text="Addresses that bounced or complained. We stop sending to them so your rates stay healthy.">
              <span class="lucide-info size-3.5 text-ink-gray-4" />
            </Tooltip>
          </div>

          <div v-if="suppressions.length" class="mt-2 divide-y divide-outline-alpha-gray-1">
            <div v-for="s in suppressions" :key="s.id" class="flex items-center gap-3 py-2.5">
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm text-ink-gray-8">{{ s.email }}</div>
                <div class="text-p-sm text-ink-gray-5">{{ s.reason }} · {{ s.at }}</div>
              </div>
              <Button variant="ghost" size="sm" label="Remove" @click="unsuppress(s)" />
            </div>
          </div>
          <p v-else class="mt-2 text-p-sm text-ink-gray-5">Nothing suppressed.</p>
        </section>
      </template>

      <!-- ── Settings ───────────────────────────────────────────────── -->
      <template v-else>
        <section class="mt-6">
          <h2 class="text-base font-semibold text-ink-gray-8">Webhook</h2>
          <p class="mt-0.5 text-p-sm text-ink-gray-5">
            We POST delivery, bounce and complaint events here. Retried for a few hours if it fails.
          </p>
          <div class="mt-3 flex flex-wrap items-end gap-3">
            <FormControl v-model="webhookDraft" class="min-w-0 flex-1" type="text" placeholder="https://example.com/webhook" />
            <Button variant="subtle" label="Save" :disabled="webhookDraft === (state.webhook || '')" @click="saveWebhook" />
          </div>
          <p v-if="urlError" class="mt-2 text-p-sm text-ink-red-8">{{ urlError }}</p>
        </section>
      </template>
    </div>

    <Dialog v-model:open="addOpen" title="Add domain" size="sm">
      <FormControl v-model="newDomain" type="text" label="Domain" placeholder="e.g. mycompany.in" />
      <p class="mt-2 text-p-sm text-ink-gray-5">You'll get three DNS records to add. Sending starts once they're found.</p>
      <template #actions>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" @click="addOpen = false" />
          <Button variant="solid" label="Add" :disabled="!newDomain.trim()" @click="addDomain" />
        </div>
      </template>
    </Dialog>

    <ConfirmDialog
      v-model:open="removeOpen"
      title="Remove this domain?"
      message="Mail from this domain stops immediately. You can add it back — you'll just re-verify the records."
      confirm-label="Remove"
      theme="red"
      @confirm="removeDomain"
    />
  </AddonShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Badge, Button, Dialog, Dropdown, FormControl, TabButtons, Tooltip, toast } from 'frappe-ui'
import AddonShell from '../../../components/AddonShell.vue'
import ConfirmDialog from '../../../components/ConfirmDialog.vue'
import Disclosure from '../../../components/Disclosure.vue'
import EmptyState from '../../../components/EmptyState.vue'
import { EMAIL_THRESHOLDS, dnsRecordsFor, emailHealth } from '../../../data/addons'
import { useCloudStore } from '../../../stores/cloud'
import { validateUrl } from '../../../utils/validate'

const store = useCloudStore()

const tab = ref('domains')
const tabs = [
  { label: 'Domains', value: 'domains' },
  { label: 'Reputation', value: 'reputation' },
  { label: 'Settings', value: 'settings' },
]

const state = computed(() => store.addonState('email'))
const domains = computed(() => state.value.domains || [])
const suppressions = computed(() => state.value.suppressions || [])

function patch(changes) {
  store.addons.email = { ...state.value, ...changes }
}

function copy(text) {
  navigator.clipboard?.writeText(text)
  toast.success('Copied')
}

// — Domains
const recordsFor = dnsRecordsFor

function isVerified(d) {
  return Object.values(d.records || {}).every(Boolean)
}

// Three states, not two: "partly there" is the most common real state and the
// one where a single "pending" badge is least helpful. All neutral — the labels
// already say exactly where each domain stands, so colour would only repeat them.
function domainBadge(d) {
  const found = Object.values(d.records || {}).filter(Boolean).length
  const total = Object.keys(d.records || {}).length
  if (found === total) return { label: 'Sending' }
  if (found === 0) return { label: 'Not started' }
  return { label: `${found} of ${total} records` }
}

const checking = ref(null)

// Finds one more record each time — enough to show the flow without pretending
// to do real DNS.
function check(d) {
  checking.value = d.id
  store
    ._work(() => {
      const next = { ...d.records }
      const missing = Object.keys(next).find((k) => !next[k])
      if (missing) next[missing] = true
      patch({ domains: domains.value.map((x) => (x.id === d.id ? { ...x, records: next } : x)) })
      return Object.values(next).every(Boolean)
    }, 1400)
    .then((done) => toast.success(done ? `${d.name} is verified` : 'Found one more record'))
    .catch((e) => toast.error(e.message))
    .finally(() => { checking.value = null })
}

const addOpen = ref(false)
const newDomain = ref('')

function addDomain() {
  const name = newDomain.value.trim().toLowerCase()
  addOpen.value = false
  newDomain.value = ''
  patch({
    domains: [...domains.value, { id: `dom-${name}`, name, added: 'just now', records: { spf: false, dkim: false, returnPath: false } }],
  })
  toast.success(`Added ${name}`)
}

const removeOpen = ref(false)
const removing = ref(null)

function domainMenu(d) {
  return [{ label: 'Remove', icon: 'lucide-trash-2', onClick: () => { removing.value = d; removeOpen.value = true } }]
}

function removeDomain() {
  const d = removing.value
  if (!d) return
  patch({ domains: domains.value.filter((x) => x.id !== d.id) })
  toast.success(`Removed ${d.name}`)
  removing.value = null
}

// — Reputation
const health = computed(() => emailHealth(state.value))

// The one place on these pages colour is allowed to appear, because it's the one
// place something is actually wrong. Healthy stays neutral — a green badge for
// "nothing is happening" is the kind of decoration that makes real warnings
// easier to miss.
const HEALTH_COPY = {
  healthy: { theme: 'gray', label: 'Healthy', description: 'Mail is being delivered normally.' },
  review: { theme: 'orange', label: 'Under review', description: 'Bounces or complaints are high. Clean your lists to avoid a pause.' },
  paused: { theme: 'red', label: 'Paused', description: 'Sending is stopped until your rates come down. Contact support to resume.' },
}
const healthCopy = computed(() => HEALTH_COPY[health.value])

function meterOf(label, value, thresholds) {
  return {
    label,
    value,
    review: thresholds.review,
    paused: thresholds.paused,
    // Scaled against the pause threshold, so the bar answers "how close am I to
    // being cut off" rather than "what fraction of 100% is this".
    width: `${Math.min(100, Math.round((value / thresholds.paused) * 100))}%`,
  }
}

const reputationMeters = computed(() => [
  meterOf('Bounce rate', state.value.bounceRate || 0, EMAIL_THRESHOLDS.bounce),
  meterOf('Complaint rate', state.value.complaintRate || 0, EMAIL_THRESHOLDS.complaint),
])

function unsuppress(s) {
  patch({ suppressions: suppressions.value.filter((x) => x.id !== s.id) })
  toast.success(`Removed ${s.email}`)
}

// — Settings
const webhookDraft = ref(store.addonState('email').webhook || '')
// Clearing the field is a valid edit (it removes the webhook), so only a
// non-empty value that fails validation is an error.
const urlError = computed(() => (webhookDraft.value ? validateUrl(webhookDraft.value) : ''))

function saveWebhook() {
  if (urlError.value) return
  patch({ webhook: webhookDraft.value })
  toast.success(webhookDraft.value ? 'Webhook saved' : 'Webhook removed')
}
</script>

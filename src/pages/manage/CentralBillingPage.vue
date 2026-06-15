<template>
  <CentralShell :crumbs="[{ label: 'Billing', route: '/billing' }]" wide>
    <div class="flex h-full overflow-hidden">
      <!-- Billing content — centered in whatever space the panel leaves it -->
      <div class="min-w-0 flex-1 overflow-y-auto">
        <div class="mx-auto max-w-3xl px-6 py-8">
          <h1 class="text-xl font-semibold text-ink-gray-9">Billing</h1>
          <p class="mt-1 text-base leading-6 text-ink-gray-5">One balance funds all your servers.</p>

          <div class="mt-5 space-y-5">
            <Alert v-if="store.creditExpired" theme="red" title="Your credit ran out, so your sites are paused" :dismissible="false">
              <template #description>Nothing is deleted — add a card and they're back in seconds, exactly as they were.</template>
              <template #footer><Button variant="solid" size="sm" label="Add a card" @click="addCardOpen = true" /></template>
            </Alert>
            <Alert
              v-else-if="lowBalance && !store.cardOnFile"
              theme="yellow"
              title="Your credit is running low"
              description="Add a card to keep everything running when it's gone."
              :dismissible="false"
            >
              <template #footer><Button variant="solid" size="sm" label="Add a card" @click="addCardOpen = true" /></template>
            </Alert>

            <!-- Balance + payment methods -->
            <section class="rounded-xl border border-outline-gray-2 bg-surface-white p-5">
              <div class="flex items-center justify-between text-sm">
                <span class="text-ink-gray-6">Credit balance</span>
                <span class="font-medium text-ink-gray-8">{{ usd(store.accountCredit) }} of {{ usd(store.accountCreditTotal) }}</span>
              </div>
              <Progress :value="creditPct" size="sm" class="mt-2" />

              <div class="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-outline-gray-1 pt-3">
                <span v-if="store.cardOnFile" class="flex items-center gap-2 text-sm text-ink-gray-7">
                  <span class="lucide-credit-card size-4 text-ink-gray-5" />
                  Visa ending 4242
                  <Badge theme="green" variant="subtle" label="Active" />
                </span>
                <span v-else class="text-sm text-ink-gray-5">No card on file yet.</span>
                <div class="flex items-center gap-2">
                  <Button variant="subtle" size="sm" label="Add credit" icon-left="lucide-plus" @click="creditOpen = true" />
                  <Button v-if="!store.cardOnFile" variant="subtle" size="sm" label="Add a card" @click="addCardOpen = true" />
                </div>
              </div>

              <!-- UPI autopay -->
              <div class="mt-3 flex items-center justify-between gap-3 border-t border-outline-gray-1 pt-3">
                <div class="flex items-center gap-2">
                  <span class="lucide-smartphone size-4 text-ink-gray-5" />
                  <div>
                    <div class="flex items-center gap-2 text-sm font-medium text-ink-gray-8">
                      UPI Autopay
                      <Badge v-if="store.upiAutopay" theme="green" variant="subtle" label="Active" />
                    </div>
                    <div class="text-xs text-ink-gray-5">Let us auto-debit your UPI app when the balance runs low.</div>
                  </div>
                </div>
                <Switch :modelValue="store.upiAutopay" @update:modelValue="setUpi" />
              </div>

              <!-- Auto-recharge -->
              <div class="mt-3 flex items-center justify-between border-t border-outline-gray-1 pt-3">
                <div>
                  <div class="text-sm font-medium text-ink-gray-8">Auto-recharge</div>
                  <div class="text-xs text-ink-gray-5">Top up automatically when the balance runs low.</div>
                </div>
                <Switch :modelValue="store.autoRecharge" @update:modelValue="store.setAutoRecharge" />
              </div>
            </section>

            <!-- Invoices — front and centre -->
            <section class="rounded-xl border border-outline-gray-2 bg-surface-white p-5">
              <div class="flex items-center justify-between">
                <h2 class="text-base font-semibold text-ink-gray-8">Invoices</h2>
                <span class="text-xs text-ink-gray-5">Sent to {{ store.billingProfile.invoiceRecipient || store.billingProfile.billingEmail || store.user.email }}</span>
              </div>
              <div class="mt-2 divide-y divide-outline-gray-1">
                <button
                  v-for="inv in invoices"
                  :key="inv.number"
                  class="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-left text-sm transition-colors"
                  :class="openInvoice?.number === inv.number ? 'bg-surface-gray-2' : 'hover:bg-surface-gray-1'"
                  @click="openInvoice = inv"
                >
                  <div class="min-w-0">
                    <div class="font-medium text-ink-gray-8">{{ inv.period }}</div>
                    <div class="truncate text-xs text-ink-gray-5">{{ inv.number }} · Issued {{ inv.issued }}</div>
                  </div>
                  <div class="flex shrink-0 items-center gap-3">
                    <span class="tabular-nums text-ink-gray-8">{{ inr(total(inv)) }}</span>
                    <Badge theme="green" variant="subtle" :label="inv.status" />
                    <span class="lucide-chevron-right size-4 text-ink-gray-4" />
                  </div>
                </button>
              </div>
            </section>

            <!-- What each server costs -->
            <section class="rounded-xl border border-outline-gray-2 bg-surface-white p-5">
              <h2 class="text-base font-semibold text-ink-gray-8">Your servers</h2>
              <div class="mt-3 divide-y divide-outline-gray-1">
                <div v-for="srv in store.allServers" :key="srv.id" class="flex items-center justify-between gap-3 py-3">
                  <div class="flex min-w-0 items-center gap-2.5">
                    <span class="lucide-server size-4 shrink-0 text-ink-gray-5" />
                    <div class="min-w-0">
                      <div class="truncate text-sm font-medium text-ink-gray-9">{{ srv.name }}</div>
                      <div class="text-xs text-ink-gray-5">{{ store.planOf(srv).name }} · {{ store.regionOf(srv).name }} ({{ store.regionOf(srv).provider }})</div>
                    </div>
                  </div>
                  <div class="flex shrink-0 items-center gap-3">
                    <span v-if="srv.status === 'suspended'" class="text-xs font-medium text-ink-amber-3">Stopped</span>
                    <span class="text-sm tabular-nums" :class="srv.status === 'suspended' ? 'text-ink-gray-4 line-through' : 'text-ink-gray-7'">{{ inr(store.monthlyPriceOf(srv)) }}/mo</span>
                    <Button v-if="srv.status === 'suspended'" variant="ghost" size="sm" label="Resume" @click="resume(srv)" />
                    <Button v-else variant="ghost" size="sm" label="Stop billing" @click="askStop(srv)" />
                  </div>
                </div>
              </div>
              <div class="mt-3 flex items-center justify-between border-t border-outline-gray-1 pt-3">
                <span class="text-sm font-medium text-ink-gray-8">Total</span>
                <span class="text-sm font-semibold tabular-nums text-ink-gray-9">{{ inr(totalMonthly) }}/mo</span>
              </div>
            </section>

            <!-- Billing details -->
            <section class="rounded-xl border border-outline-gray-2 bg-surface-white p-5">
              <div class="flex items-center justify-between">
                <h2 class="text-base font-semibold text-ink-gray-8">Billing details</h2>
                <Button variant="ghost" size="sm" label="Edit" icon-left="lucide-pencil" @click="openDetails" />
              </div>
              <dl class="mt-3 space-y-1.5 text-sm">
                <div class="flex justify-between gap-3"><dt class="text-ink-gray-5">Tax ID</dt><dd class="text-ink-gray-8">{{ store.billingProfile.taxId || 'Not added' }}</dd></div>
                <div class="flex justify-between gap-3"><dt class="text-ink-gray-5">GSTIN</dt><dd class="text-ink-gray-8">{{ store.billingProfile.gstin || 'Not added' }}</dd></div>
                <div class="flex justify-between gap-3"><dt class="text-ink-gray-5">Billing email</dt><dd class="text-ink-gray-8">{{ store.billingProfile.billingEmail || 'Not added' }}</dd></div>
                <div class="flex justify-between gap-3"><dt class="text-ink-gray-5">Invoice recipient</dt><dd class="text-ink-gray-8">{{ store.billingProfile.invoiceRecipient || 'Not added' }}</dd></div>
                <div class="flex justify-between gap-3"><dt class="text-ink-gray-5">Invoice language</dt><dd class="text-ink-gray-8">{{ langLabel(store.billingProfile.invoiceLanguage) }}</dd></div>
                <div class="flex justify-between gap-3"><dt class="text-ink-gray-5">Billing address</dt><dd class="max-w-[60%] truncate text-ink-gray-8">{{ store.billingProfile.address || 'Not added' }}</dd></div>
              </dl>
            </section>
          </div>
        </div>
      </div>

      <!-- Invoice detail — docked panel inside the page -->
      <Transition name="slide">
        <aside v-if="openInvoice" class="flex w-[24rem] shrink-0 flex-col border-l border-outline-gray-2 bg-surface-white">
          <div class="flex items-start justify-between gap-3 border-b border-outline-gray-2 p-4">
            <div class="min-w-0">
              <div class="truncate text-base font-semibold text-ink-gray-9">{{ openInvoice.number }}</div>
              <div class="text-sm text-ink-gray-5">{{ openInvoice.period }} · Issued {{ openInvoice.issued }}</div>
            </div>
            <button class="grid size-7 shrink-0 place-items-center rounded text-ink-gray-5 hover:bg-surface-gray-2" aria-label="Close" @click="openInvoice = null">
              <span class="lucide-x size-4" />
            </button>
          </div>

          <div class="flex-1 space-y-4 overflow-y-auto p-4">
            <div class="flex items-center justify-between text-sm">
              <span class="text-ink-gray-5">Status</span>
              <Badge theme="green" variant="subtle" :label="openInvoice.status" />
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-ink-gray-5">Billed to</span>
              <span class="text-ink-gray-8">{{ store.billingProfile.billingEmail || store.user.email }}</span>
            </div>

            <div class="overflow-hidden rounded-lg border border-outline-gray-2">
              <div class="flex items-center justify-between gap-3 border-b border-outline-gray-1 bg-surface-gray-1 px-3 py-2 text-xs font-medium text-ink-gray-5">
                <span>Item</span><span>Amount</span>
              </div>
              <div v-for="(it, i) in openInvoice.items" :key="i" class="flex items-center justify-between gap-3 border-b border-outline-gray-1 px-3 py-2.5 text-sm last:border-b-0">
                <span class="min-w-0 truncate text-ink-gray-7">{{ it.label }}</span>
                <span class="shrink-0 tabular-nums text-ink-gray-8">{{ inr(it.amount) }}</span>
              </div>
            </div>

            <dl class="space-y-1.5 text-sm">
              <div class="flex justify-between"><dt class="text-ink-gray-5">Subtotal</dt><dd class="tabular-nums text-ink-gray-8">{{ inr(subtotal(openInvoice)) }}</dd></div>
              <div class="flex justify-between"><dt class="text-ink-gray-5">GST (18%)</dt><dd class="tabular-nums text-ink-gray-8">{{ inr(tax(openInvoice)) }}</dd></div>
              <div class="flex justify-between border-t border-outline-gray-1 pt-1.5 font-semibold"><dt class="text-ink-gray-8">Total</dt><dd class="tabular-nums text-ink-gray-9">{{ inr(total(openInvoice)) }}</dd></div>
            </dl>
          </div>

          <div class="flex gap-2 border-t border-outline-gray-2 p-4">
            <Button variant="subtle" class="flex-1" label="Email invoice" icon-left="lucide-mail" @click="emailInvoice" />
            <Button variant="solid" class="flex-1" label="Download PDF" icon-left="lucide-download" @click="download" />
          </div>
        </aside>
      </Transition>
    </div>

    <!-- Add credit -->
    <Dialog v-model:open="creditOpen" size="sm">
      <template #title><span class="text-xl font-semibold text-ink-gray-9">Add credit</span></template>
      <div class="space-y-3">
        <div class="flex gap-2">
          <Button v-for="amt in [25, 50, 100]" :key="amt" :variant="creditAmount === String(amt) ? 'solid' : 'subtle'" :label="`$${amt}`" @click="creditAmount = String(amt)" />
        </div>
        <FormControl v-model="creditAmount" type="number" label="Amount (USD)" placeholder="50" />
      </div>
      <template #actions>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" @click="creditOpen = false" />
          <Button variant="solid" label="Add credit" :disabled="!(Number(creditAmount) > 0)" @click="addCredit" />
        </div>
      </template>
    </Dialog>

    <!-- Billing details -->
    <Dialog v-model:open="detailsOpen" size="md">
      <template #title><span class="text-xl font-semibold text-ink-gray-9">Billing details</span></template>
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <FormControl v-model="details.taxId" type="text" label="Tax ID" placeholder="AABCU9603R" />
          <FormControl v-model="details.gstin" type="text" label="GSTIN" placeholder="29ABCDE1234F1Z5" />
        </div>
        <FormControl v-model="details.billingEmail" type="text" label="Billing email" placeholder="billing@company.com" />
        <FormControl v-model="details.invoiceRecipient" type="text" label="Invoice email recipient" placeholder="accounts@company.com" />
        <FormControl v-model="details.invoiceLanguage" type="select" label="Invoice language" :options="LANGUAGES" />
        <FormControl v-model="details.address" type="textarea" label="Billing address" placeholder="Street, City, State, PIN" />
      </div>
      <template #actions>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" @click="detailsOpen = false" />
          <Button variant="solid" label="Save" @click="saveDetails" />
        </div>
      </template>
    </Dialog>

    <ConfirmDialog
      v-model:open="stopOpen"
      theme="red"
      :title="`Stop billing for ${stopServer?.name}?`"
      :message="`${stopServer?.name} is suspended and its sites go offline until you resume. You won't be charged while it's stopped — nothing is deleted.`"
      confirm-label="Stop billing"
      @confirm="confirmStop"
    />

    <AddCardDialog v-model:open="addCardOpen" />
  </CentralShell>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { Alert, Badge, Button, Dialog, FormControl, Progress, Switch, toast } from 'frappe-ui'
import AddCardDialog from '../../components/AddCardDialog.vue'
import CentralShell from '../../components/CentralShell.vue'
import ConfirmDialog from '../../components/ConfirmDialog.vue'
import { LOW_CREDIT_THRESHOLD, useCloudStore } from '../../stores/cloud'
import { inr, usd } from '../../utils/format'

const store = useCloudStore()

const LANGUAGES = [
  { label: 'English', value: 'en' },
  { label: 'Hindi', value: 'hi' },
  { label: 'German', value: 'de' },
  { label: 'Arabic', value: 'ar' },
]
function langLabel(v) {
  return LANGUAGES.find((l) => l.value === v)?.label || 'English'
}

const creditPct = computed(() =>
  store.accountCreditTotal ? Math.round((store.accountCredit / store.accountCreditTotal) * 100) : 0,
)
const lowBalance = computed(() => store.accountCredit <= LOW_CREDIT_THRESHOLD)
// Suspended servers don't bill, so they drop out of the running total.
const totalMonthly = computed(() =>
  store.allServers.reduce((sum, srv) => (srv.status === 'suspended' ? sum : sum + store.monthlyPriceOf(srv)), 0),
)

// — Invoices (with line items so the detail panel has something to show)
const GST_RATE = 0.18
const invoices = [
  {
    number: 'INV-2026-0005',
    period: 'May 2026',
    issued: '1 Jun 2026',
    status: 'Paid',
    items: [
      { label: 'atlas-web-01 · Business', amount: 4100 },
      { label: 'atlas-eu-01 · Standard', amount: 1650 },
    ],
  },
  {
    number: 'INV-2026-0004',
    period: 'April 2026',
    issued: '1 May 2026',
    status: 'Paid',
    items: [{ label: 'atlas-web-01 · Business', amount: 4100 }],
  },
  {
    number: 'INV-2026-0003',
    period: 'March 2026',
    issued: '1 Apr 2026',
    status: 'Paid',
    items: [{ label: 'atlas-web-01 · Standard', amount: 2050 }],
  },
]
function subtotal(inv) {
  return inv.items.reduce((s, i) => s + i.amount, 0)
}
function tax(inv) {
  return Math.round(subtotal(inv) * GST_RATE)
}
function total(inv) {
  return subtotal(inv) + tax(inv)
}
const openInvoice = ref(null)

const addCardOpen = ref(false)

// — Stop / resume billing for a server (suspends it)
const stopOpen = ref(false)
const stopServer = ref(null)
function askStop(srv) {
  stopServer.value = srv
  stopOpen.value = true
}
function confirmStop() {
  store.setServerSuspended(stopServer.value.id, true)
  toast.success(`Billing stopped for ${stopServer.value.name}`)
}
function resume(srv) {
  store.setServerSuspended(srv.id, false)
  toast.success(`Billing resumed for ${srv.name}`)
}

function setUpi(on) {
  store.setUpiAutopay(on)
  toast.success(on ? 'UPI autopay is on' : 'UPI autopay turned off')
}

const creditOpen = ref(false)
const creditAmount = ref('50')
function addCredit() {
  store.addCredit(creditAmount.value)
  toast.success(`Added $${Number(creditAmount.value)} credit`)
  creditOpen.value = false
}

const detailsOpen = ref(false)
const details = reactive({ taxId: '', gstin: '', address: '', billingEmail: '', invoiceRecipient: '', invoiceLanguage: 'en' })
function openDetails() {
  Object.assign(details, store.billingProfile)
  detailsOpen.value = true
}
function saveDetails() {
  store.setBillingProfile({ ...details })
  toast.success('Billing details saved')
  detailsOpen.value = false
}

function download() {
  toast('In the real thing, this downloads the invoice PDF')
}
function emailInvoice() {
  toast.success(`Invoice emailed to ${store.billingProfile.invoiceRecipient || store.billingProfile.billingEmail || store.user.email}`)
}
</script>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}
</style>

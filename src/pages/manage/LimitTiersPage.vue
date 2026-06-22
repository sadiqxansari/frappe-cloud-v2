<template>
  <CentralShell :crumbs="crumbs" wide>
    <div class="flex h-full overflow-hidden">
      <div class="min-w-0 flex-1 overflow-y-auto">
        <div class="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
          <!-- Header -->
          <div class="flex flex-col gap-1">
            <h1 class="text-xl font-semibold text-ink-gray-9">Spending Limits</h1>
            <p class="text-p-base text-ink-gray-5">
              These determine your monthly spending limit on Frappe Cloud. You are
              automatically moved to a higher tier once your usage and payment history
              meet the qualifying conditions.
            </p>
          </div>

          <!-- Current standing -->
          <div class="rounded-lg border border-outline-gray-2 bg-surface-gray-1 p-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="flex flex-col gap-1">
                <div class="text-sm text-ink-gray-6">Current subscribed amount</div>
                <span class="text-xl font-semibold text-ink-gray-9">
                  {{ formatAmount(totalSubscribed) }}
                </span>
              </div>
              <div class="flex flex-col gap-1 text-right">
                <div class="text-sm text-ink-gray-6">
                  Paying since
                  <span class="font-medium text-ink-gray-9">{{ payingSinceLabel }}</span>
                </div>
                <div class="text-sm text-ink-gray-6">
                  Last paid invoice
                  <span class="font-medium text-ink-gray-9">
                    {{ formatAmount(metrics.last_invoice_amount) }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Tiers table -->
          <div class="overflow-hidden rounded-lg border border-outline-gray-2 bg-surface-elevation-1">
            <table class="w-full text-left">
              <thead>
                <tr class="border-b border-outline-gray-2 bg-surface-gray-1">
                  <th class="px-4 py-3 text-base font-medium tracking-wide text-ink-gray-5">Tier</th>
                  <th class="px-4 py-3 text-base font-medium tracking-wide text-ink-gray-5">Requirements</th>
                  <th class="px-4 py-3 text-right text-base font-medium tracking-wide text-ink-gray-5">Spending Limit</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-outline-gray-2">
                <tr
                  v-for="(tier, idx) in TIERS"
                  :key="tier.name"
                  class="transition-colors hover:bg-surface-gray-1"
                >
                  <td class="px-4 py-4 align-middle">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="text-sm font-semibold text-ink-gray-9">{{ tier.tier }}</span>
                      <Badge v-if="isCurrentTier(tier)" theme="blue" label="Current" />
                    </div>
                  </td>
                  <td class="px-4 py-4 align-top">
                    <ul class="flex flex-col gap-1.5">
                      <li
                        v-for="(req, i) in requirementsFor(tier, idx)"
                        :key="i"
                        class="flex items-center gap-2"
                      >
                        <span
                          class="size-3.5 shrink-0"
                          :class="req.met ? 'lucide-check-circle-2 text-ink-green-6' : 'lucide-circle-dashed text-ink-gray-4'"
                        />
                        <span class="text-sm" :class="req.met ? 'text-ink-gray-9' : 'text-ink-gray-6'">
                          {{ req.text }}
                        </span>
                        <RouterLink
                          v-if="req.nudge"
                          :to="req.nudge"
                          class="text-sm text-ink-blue-8 transition-opacity hover:opacity-80"
                        >
                          Go to Billing →
                        </RouterLink>
                      </li>
                    </ul>
                  </td>
                  <td class="px-4 py-4 text-right align-middle">
                    <span class="text-sm font-semibold text-ink-gray-9">{{ formatAmount(tier.amount) }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- How tiers work -->
          <div class="rounded-lg border border-outline-gray-2 bg-surface-elevation-1 p-5">
            <div class="flex flex-col gap-2">
              <div class="flex items-center gap-2">
                <span class="lucide-info size-5 shrink-0 text-ink-gray-5" />
                <div class="text-base font-medium text-ink-gray-9">How tier upgrades work</div>
              </div>
              <ul class="flex list-disc flex-col gap-1.5 pl-5 text-sm text-ink-gray-7">
                <li>Tiers control the maximum amount your team can spend in a billing cycle.</li>
                <li>
                  You are automatically upgraded to a higher tier when your last paid
                  subscription invoice meets that tier's threshold and you have at least
                  three consecutive paid invoices.
                </li>
                <li>
                  New teams start at the base tier with a default spending limit. Adding a
                  payment method or buying prepaid credits is required to remain at or above
                  the base tier.
                </li>
                <li>
                  Need a higher limit immediately? Reach out to
                  <a
                    href="https://support.frappe.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-ink-blue-8 underline underline-offset-2 transition-opacity hover:opacity-80"
                  >support</a>
                  and we will review your account.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </CentralShell>
</template>

<script setup>
import { computed } from 'vue'
import { Badge } from 'frappe-ui'
import CentralShell from '../../components/CentralShell.vue'
import { useCloudStore } from '../../stores/cloud'

const store = useCloudStore()

const crumbs = [{ label: 'Billing', route: '/billing' }, { label: 'Limit Tiers' }]

// Static tier definitions — amounts in ₹.
const TIERS = [
  { name: 'base',   tier: 'Base',   amount: 5000,   paying_user_since: null, last_invoice_amount: null },
  { name: 'tier-1', tier: 'Tier 1', amount: 25000,  paying_user_since: 1,    last_invoice_amount: 1000 },
  { name: 'tier-2', tier: 'Tier 2', amount: 100000, paying_user_since: 3,    last_invoice_amount: 5000 },
  { name: 'tier-3', tier: 'Tier 3', amount: 500000, paying_user_since: 6,    last_invoice_amount: 20000 },
]

// Metrics derived from the store's demo billing data.
const metrics = computed(() => {
  const paid = store.invoices.filter((i) => i.status === 'Paid')
  const last = paid[0]
  const lastAmount = last ? last.items.reduce((s, i) => s + i.amount, 0) : 0
  return {
    has_payment_method: store.paymentMethods.some((p) => p.status !== 'declined'),
    last_invoice_amount: lastAmount,
    paying_since_months: paid.length,
  }
})

const totalSubscribed = computed(() => store.estimatedThisCycle)

// Current tier = the highest tier whose requirements are all met; null if none qualify.
const currentTierName = computed(() => {
  let current = null
  TIERS.forEach((tier, idx) => {
    if (requirementsFor(tier, idx).every((r) => r.met)) current = tier.name
  })
  return current
})

function isCurrentTier(tier) {
  return currentTierName.value === tier.name
}

function requirementsFor(tier) {
  const m = metrics.value
  if (!tier.paying_user_since && !tier.last_invoice_amount) {
    const met = !!m.has_payment_method
    return [{ text: 'Payment method added or prepaid credits available', met, nudge: met ? null : '/billing' }]
  }
  return [
    {
      text: `Paying user for at least ${tier.paying_user_since} months`,
      met: (m.paying_since_months ?? 0) >= tier.paying_user_since,
    },
    {
      text: `Last paid invoice ≥ ${formatAmount(tier.last_invoice_amount)}`,
      met: (m.last_invoice_amount ?? 0) >= tier.last_invoice_amount,
    },
  ]
}

const payingSinceLabel = computed(() => {
  const months = metrics.value.paying_since_months
  if (!months) return '—'
  return months === 1 ? '1 month' : `${months} months`
})

function formatAmount(value) {
  if (value == null) return '—'
  return `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}
</script>

<template>
  <CentralShell :crumbs="crumbs" wide>
    <div class="flex h-full overflow-hidden">
      <div class="min-w-0 flex-1 overflow-y-auto">
        <div class="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-8">
          <!-- Header -->
          <div class="flex flex-col gap-1">
            <h1 class="text-xl font-semibold text-ink-gray-9">Spending limits</h1>
            <p class="text-p-base text-ink-gray-5">
              Your monthly spending limit. You move to a higher tier automatically as
              your usage and payment history grow.
            </p>
          </div>

          <!-- Current standing — a flat stat strip, no box. Three figures with
               the same quiet label-over-value rhythm; whitespace separates. -->
          <div class="flex flex-wrap gap-x-12 gap-y-4">
            <div class="flex flex-col gap-1">
              <div class="text-sm text-ink-gray-5">Monthly spend</div>
              <span class="text-xl font-semibold tabular-nums text-ink-gray-9">{{ formatAmount(totalSubscribed) }}</span>
            </div>
            <div class="flex flex-col gap-1">
              <div class="text-sm text-ink-gray-5">Paying since</div>
              <span class="text-xl font-semibold text-ink-gray-9">{{ payingSinceLabel }}</span>
            </div>
            <div class="flex flex-col gap-1">
              <div class="text-sm text-ink-gray-5">Last paid invoice</div>
              <span class="text-xl font-semibold tabular-nums text-ink-gray-9">{{ formatAmount(metrics.last_invoice_amount) }}</span>
            </div>
          </div>

          <!-- Tiers — same list family as the invoice panel: hairline header
               and row rules on the bare surface, no outer box, no header fill,
               no hover (rows aren't clickable). -->
          <List :columns="['7rem', 'minmax(0,1fr)', 'auto']" divider="full">
            <ListHeader>
              <ListHeaderCell>Tier</ListHeaderCell>
              <ListHeaderCell>Requirements</ListHeaderCell>
              <ListHeaderCell class="justify-end">Spending limit</ListHeaderCell>
            </ListHeader>
            <ListRows :items="TIERS" row-key="name" v-slot="{ item: tier, index: idx }">
              <ListRow class="py-3.5">
                <ListCell class="self-start pt-0.5">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-sm font-semibold text-ink-gray-9">{{ tier.tier }}</span>
                    <Badge v-if="isCurrentTier(tier)" theme="blue" label="Current" />
                  </div>
                </ListCell>
                <ListCell>
                  <ul class="flex min-w-0 flex-col gap-1.5">
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
                </ListCell>
                <ListCell class="justify-end self-start pt-0.5">
                  <span class="text-sm font-semibold tabular-nums text-ink-gray-9">{{ formatAmount(tier.amount) }}</span>
                </ListCell>
              </ListRow>
            </ListRows>
          </List>

          <!-- How tiers work — plain prose under a single rule, not a card.
               The icon was decoration; the heading carries it. -->
          <section class="border-t border-outline-gray-1 pt-6">
            <h2 class="text-base font-medium text-ink-gray-9">How tier upgrades work</h2>
            <ul class="mt-2.5 flex list-disc flex-col gap-1.5 pl-4 text-p-sm text-ink-gray-6">
              <li>Tiers control the maximum amount your team can spend in a billing cycle.</li>
              <li>
                You are automatically upgraded to a higher tier when your last paid
                subscription invoice meets that tier's threshold and you have at least
                three consecutive paid invoices.
              </li>
              <li>
                New teams start at the base tier. Add a payment method or prepaid
                credits to stay there.
              </li>
              <li>
                Need a higher limit now? Contact
                <a
                  href="https://support.frappe.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-ink-blue-8 underline underline-offset-2 transition-opacity hover:opacity-80"
                >support</a>
                and we'll review your account.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  </CentralShell>
</template>

<script setup>
import { computed } from 'vue'
import { Badge } from 'frappe-ui'
import { List, ListCell, ListHeader, ListHeaderCell, ListRow, ListRows } from 'frappe-ui/list'
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
      text: `Paying user for at least ${tier.paying_user_since} month${tier.paying_user_since === 1 ? '' : 's'}`,
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

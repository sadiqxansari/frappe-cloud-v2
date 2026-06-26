<template>
  <div class="flex min-h-screen items-center justify-center bg-surface-gray-2 px-4 py-10">
    <div class="w-full max-w-md">
      <!-- A stand-in for the real payment gateway. Stripe/PayPal are cross-domain
           redirects in production; here they're an in-app route. Razorpay (a
           modal) never lands here. Serves two intents: top up credit, or add a
           payment method through the chosen gateway. -->
      <div class="overflow-hidden rounded-2xl border border-outline-gray-2 bg-surface-elevation-1 shadow-xl">
        <div class="flex items-center gap-2.5 border-b border-outline-gray-2 px-5 py-4">
          <span v-if="intent === 'method'" class="grid size-7 shrink-0 place-items-center rounded-md text-xs font-bold text-white" :style="{ backgroundColor: gatewayColor }">{{ gatewayMark }}</span>
          <img v-else :src="cloudLogo" alt="" class="size-7 shrink-0 rounded-md" />
          <div class="min-w-0 flex-1">
            <div class="text-sm font-semibold text-ink-gray-9">{{ intent === 'method' ? gateway : 'Frappe Cloud' }}</div>
            <div class="truncate text-p-xs text-ink-gray-5">
              {{ intent === 'method' ? `Add your ${kind === 'upi' ? 'UPI' : 'card'}` : `Add credit${originLabel ? ` to ${originLabel}` : ''}` }}
            </div>
          </div>
          <span class="flex items-center gap-1 text-p-xs text-ink-gray-5"><span class="lucide-lock size-3.5" /> Secure</span>
        </div>

        <!-- Add a payment method — the gateway collects the details, not us. -->
        <div v-if="intent === 'method'" class="p-5">
          <div class="rounded-lg border border-dashed border-outline-gray-2 bg-surface-gray-1 p-6 text-center text-p-sm text-ink-gray-5">
            {{ gateway }}'s secure {{ kind === 'upi' ? 'UPI' : 'card' }} form would load here.
          </div>
          <Button class="mt-4 w-full" variant="solid" size="lg" :loading="paying" :label="`Authorize with ${gateway}`" @click="authorizeMethod" />
          <p class="mt-3 text-center text-p-xs text-ink-gray-5">You'll come straight back to Frappe Cloud once it's saved.</p>
        </div>

        <!-- Top up credit. -->
        <div v-else class="p-5">
          <div class="text-p-sm text-ink-gray-6">Choose an amount to add</div>
          <div class="mt-2 grid grid-cols-3 gap-2">
            <button
              v-for="a in presets"
              :key="a"
              class="rounded-lg border px-3 py-2.5 text-sm font-medium tabular-nums transition-colors"
              :class="a === amount ? 'border-outline-gray-4 bg-surface-gray-2 text-ink-gray-9' : 'border-outline-gray-2 text-ink-gray-7 hover:bg-surface-gray-1'"
              @click="amount = a"
            >
              {{ money(a) }}
            </button>
          </div>

          <!-- A representative payment method, mocked. -->
          <div class="mt-4 rounded-lg border border-outline-gray-2 bg-surface-gray-1 px-3 py-2.5">
            <div class="flex items-center gap-2.5">
              <span class="lucide-credit-card size-4 text-ink-gray-6" />
              <span class="flex-1 text-p-sm text-ink-gray-8">{{ methodLabel }}</span>
              <span class="lucide-check size-4 text-ink-green-6" />
            </div>
          </div>

          <Button class="mt-4 w-full" variant="solid" size="lg" :loading="paying" :label="`Pay ${money(amount)}`" @click="pay" />
          <p class="mt-3 text-center text-p-xs text-ink-gray-5">
            You can cancel anytime — you won't be charged until you confirm.
          </p>
        </div>

        <button
          class="flex w-full items-center justify-center gap-1.5 border-t border-outline-gray-2 py-3 text-p-sm font-medium text-ink-gray-6 transition-colors hover:bg-surface-gray-1 hover:text-ink-gray-8"
          @click="cancel"
        >
          <span class="lucide-arrow-left size-4" />
          Back to {{ originLabel || 'your site' }} without {{ intent === 'method' ? 'adding it' : 'paying' }}
        </button>
      </div>

      <p class="mt-4 text-center text-p-xs text-ink-gray-5">Payments processed securely by Razorpay, Stripe &amp; PayPal</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from 'frappe-ui'
import cloudLogo from '../assets/apps/cloud.png'
import { useCloudStore } from '../stores/cloud'
import { money as fmtMoney } from '../utils/format'

const store = useCloudStore()
const router = useRouter()

const money = (n) => fmtMoney(n, store.displayCurrency)
const presets = [1000, 2500, 5000]
const amount = ref(2500)
const paying = ref(false)

// What brought us here — a credit top-up (default) or adding a payment method.
const ctx = computed(() => store.returnContext || {})
const intent = computed(() => ctx.value.intent || 'credit')
const gateway = computed(() => ctx.value.gateway || 'Stripe')
const kind = computed(() => ctx.value.kind || 'card')
const editingId = computed(() => ctx.value.editingId || null)
const gatewayColor = computed(() => ({ Stripe: '#635bff', PayPal: '#003087', Razorpay: '#3395ff' }[gateway.value] || '#635bff'))
const gatewayMark = computed(() => gateway.value.charAt(0))

const originLabel = computed(() => ctx.value.label || '')
const methodLabel = computed(() => {
  const pm = store.paymentMethods.find((p) => p.primary) || store.paymentMethods[0]
  return pm ? `${pm.label} ${pm.detail}` : 'Default payment method'
})

// Confirm the top-up, then auto-return with a toast (carry origin → visible
// exit → auto-return + confirm).
function pay() {
  paying.value = true
  const wasPaused = store.creditExpired
  store.addToWallet(amount.value)
  setTimeout(() => {
    paying.value = false
    if (wasPaused) store.setCreditExpired(false)
    store.completeAndReturn(
      router,
      wasPaused ? 'Payment received — your site is back' : `Added ${money(amount.value)} — your sites keep running`,
    )
  }, 700)
}

// Authorize a new method through the gateway, then auto-return.
function authorizeMethod() {
  paying.value = true
  setTimeout(() => {
    paying.value = false
    store.addPaymentMethodViaGateway({ kind: kind.value, gateway: gateway.value, editingId: editingId.value })
    store.completeAndReturn(router, editingId.value ? 'Payment method updated' : 'Payment method added')
  }, 800)
}

function cancel() {
  const ctxPath = store.returnContext?.path
  store.clearReturnContext()
  router.push(ctxPath || '/app')
}
</script>

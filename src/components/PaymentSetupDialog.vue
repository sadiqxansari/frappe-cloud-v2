<template>
  <!-- The billing first-time-setup, in two steps: billing details (only when we
       don't have them yet), then choosing how to pay. We never collect the card
       or UPI ourselves — a gateway does. Shared by the Central billing page and
       the Desk's Frappe Cloud modal so there's one FTU, not two. -->
  <Dialog v-model:open="open" :title="pmStep === 1 ? 'Add billing details' : editingPm ? 'Update payment method' : 'Add payment method'" size="md">
    <!-- Step 1: billing details (only when we don't have them yet) -->
    <div v-if="pmStep === 1" class="space-y-3">
      <p class="text-p-sm text-ink-gray-6">These go on every invoice — we'll need them before adding a payment method.</p>
      <div>
        <FormControl v-model="pmForm.email" type="text" label="Billing email" placeholder="billing@company.com" />
        <p v-if="pmForm.email && pmContactEmailError" class="mt-1 text-p-xs text-ink-red-8">{{ pmContactEmailError }}</p>
      </div>
      <FormControl v-model="pmForm.address" type="textarea" :rows="2" label="Billing address" placeholder="Street, City, State, PIN" />
      <div class="grid grid-cols-2 gap-3">
        <FormControl v-model="pmForm.taxRegion" type="select" label="Tax region" :options="TAX_REGION_OPTIONS" />
        <div>
          <FormControl v-model="pmForm.taxNumber" type="text" :label="pmTaxRegion.idLabel" :placeholder="pmTaxRegion.placeholder" />
          <p v-if="pmForm.taxNumber && pmTaxError" class="mt-1 text-p-xs text-ink-red-8">{{ pmTaxError }}</p>
        </div>
      </div>
    </div>

    <!-- Step 2: how to pay, then which gateway collects it -->
    <div v-else class="space-y-4">
      <!-- Payment type — Card everywhere; UPI only in India. -->
      <div v-if="kinds.length > 1">
        <div class="mb-1.5 text-p-sm font-medium text-ink-gray-7">How do you want to pay?</div>
        <div class="grid grid-cols-2 gap-3">
          <button
            v-for="opt in kinds"
            :key="opt.value"
            type="button"
            class="flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors"
            :class="pmForm.kind === opt.value ? 'border-outline-gray-4 bg-surface-gray-1 ring-1 ring-outline-gray-4' : 'border-outline-gray-2 hover:bg-surface-gray-1'"
            @click="pmForm.kind = opt.value"
          >
            <span class="mt-0.5 size-4 shrink-0 text-ink-gray-6" :class="opt.icon" />
            <span class="min-w-0">
              <span class="block text-sm font-medium text-ink-gray-9">{{ opt.label }}</span>
              <span class="block text-p-xs text-ink-gray-5">{{ opt.detail }}</span>
            </span>
          </button>
        </div>
      </div>

      <!-- Gateway — options depend on the type and region. -->
      <div>
        <div class="mb-1.5 text-p-sm font-medium text-ink-gray-7">Pay through</div>
        <div class="space-y-2">
          <button
            v-for="g in gateways"
            :key="g.id"
            type="button"
            class="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors"
            :class="pmForm.gateway === g.id ? 'border-outline-gray-4 bg-surface-gray-1 ring-1 ring-outline-gray-4' : 'border-outline-gray-2 hover:bg-surface-gray-1'"
            @click="pmForm.gateway = g.id"
          >
            <span class="grid size-7 shrink-0 place-items-center rounded-md text-xs font-bold text-white" :style="{ backgroundColor: g.color }">{{ g.mark }}</span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-medium text-ink-gray-9">{{ g.label }}</span>
              <span class="block text-p-xs text-ink-gray-5">{{ g.note }}</span>
            </span>
            <span v-if="pmForm.gateway === g.id" class="lucide-check size-4 shrink-0 text-ink-gray-7" />
          </button>
        </div>
      </div>

      <p class="flex items-center gap-1.5 text-p-xs text-ink-gray-5">
        <span class="lucide-lock size-3 shrink-0" />
        {{ currentGateway?.label || 'The gateway' }} collects your {{ pmForm.kind === 'upi' ? 'UPI details' : 'card' }} securely — Frappe Cloud never sees them.
      </p>
    </div>

    <template #actions>
      <div class="flex justify-end gap-2">
        <template v-if="pmStep === 1">
          <Button label="Cancel" @click="open = false" />
          <Button variant="solid" label="Next" :disabled="!pmContactValid" @click="pmStep = 2" />
        </template>
        <template v-else>
          <Button :label="pmNeedsContact ? 'Back' : 'Cancel'" @click="pmNeedsContact ? (pmStep = 1) : (open = false)" />
          <Button variant="solid" :label="continueLabel" :disabled="!currentGateway" @click="launch" />
        </template>
      </div>
    </template>
  </Dialog>

  <!-- Razorpay opens its checkout right here (no redirect). -->
  <RazorpayCheckout v-model:open="razorpayOpen" :kind="pmForm.kind" @done="onRazorpayDone" />
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Button, Dialog, FormControl, toast } from 'frappe-ui'
import RazorpayCheckout from './RazorpayCheckout.vue'
import { useCloudStore } from '../stores/cloud'
import { TAX_REGION_OPTIONS, taxRegionByCode } from '../data/tax'
import { validateEmail, validateTaxId } from '../utils/validate'

const open = defineModel('open', { type: Boolean, default: false })
const props = defineProps({
  // The method being edited, or null to add a new one.
  editingPm: { type: Object, default: null },
})
const emit = defineEmits(['added'])

const store = useCloudStore()
const router = useRouter()

// Gateway catalog (mock). `mode` decides the experience: Razorpay opens a modal
// on the page; Stripe/PayPal redirect to the partner and come back.
const GATEWAYS = {
  stripe: { id: 'stripe', label: 'Stripe', note: 'Secure redirect', mode: 'redirect', mark: 'S', color: '#635bff' },
  razorpay: { id: 'razorpay', label: 'Razorpay', note: 'Opens here', mode: 'modal', mark: 'R', color: '#3395ff' },
  paypal: { id: 'paypal', label: 'PayPal', note: 'Secure redirect', mode: 'redirect', mark: 'P', color: '#003087' },
}

const pmForm = reactive({ kind: 'card', gateway: 'stripe', email: '', address: '', taxRegion: 'IN', taxNumber: '' })
const pmNeedsContact = ref(false)
const pmStep = ref(1) // 1 = billing details, 2 = how to pay
const razorpayOpen = ref(false)

// India drives the payment options — derived from the form so step 2 reflects
// the tax region picked in step 1, before it's saved to the profile.
const formIndia = computed(() => pmForm.taxRegion === 'IN')

// Card always; UPI only in India.
const kinds = computed(() => {
  const card = { value: 'card', label: 'Card', detail: 'Visa, Mastercard, RuPay, Amex', icon: 'lucide-credit-card' }
  const upi = { value: 'upi', label: 'UPI', detail: 'Pay from any UPI app', icon: 'lucide-smartphone' }
  return formIndia.value ? [card, upi] : [card]
})

// Gateways for the chosen type + region.
const gateways = computed(() => {
  const ids = formIndia.value
    ? pmForm.kind === 'upi'
      ? ['razorpay']
      : ['stripe', 'razorpay']
    : ['stripe', 'paypal'] // non-India: card only
  return ids.map((id) => GATEWAYS[id])
})
const currentGateway = computed(() => gateways.value.find((g) => g.id === pmForm.gateway) || null)
const continueLabel = computed(() => (currentGateway.value ? `Continue with ${currentGateway.value.label}` : 'Continue'))

function defaultGateway() {
  return gateways.value[0]?.id || 'stripe'
}
function resetForm() {
  pmForm.kind = props.editingPm?.kind || 'card'
  pmForm.email = store.billingProfile.billingEmail || ''
  pmForm.address = store.billingProfile.address || ''
  pmForm.taxRegion = store.billingProfile.taxRegion || 'IN'
  pmForm.taxNumber = store.billingProfile.taxValue || ''
  pmForm.gateway = defaultGateway()
}

// Set up the right starting step whenever the dialog opens.
watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    resetForm()
    // Editing an existing method never blocks on contact details.
    pmNeedsContact.value = !props.editingPm && (!store.billingProfile.billingEmail || !store.billingProfile.address)
    pmStep.value = pmNeedsContact.value ? 1 : 2
  },
  { immediate: true },
)

// Switching region can remove UPI (non-India) — keep the type valid.
watch(
  () => pmForm.taxRegion,
  () => {
    if (!kinds.value.some((k) => k.value === pmForm.kind)) pmForm.kind = 'card'
  },
)
// Keep the selected gateway valid for the current type + region.
watch(
  () => [pmForm.kind, pmForm.taxRegion],
  () => {
    if (!gateways.value.some((g) => g.id === pmForm.gateway)) pmForm.gateway = defaultGateway()
  },
)

const pmContactEmailError = computed(() => validateEmail(pmForm.email, { required: true }))
const pmTaxRegion = computed(() => taxRegionByCode(pmForm.taxRegion))
const pmTaxError = computed(() => validateTaxId(pmForm.taxRegion, pmForm.taxNumber, { required: pmForm.taxRegion !== 'US' }))
const pmContactValid = computed(
  () => !pmNeedsContact.value || (!pmContactEmailError.value && !!pmForm.address.trim() && !pmTaxError.value),
)

function saveContactIfNeeded() {
  if (pmNeedsContact.value) {
    store.setBillingProfile({
      billingEmail: pmForm.email.trim(),
      address: pmForm.address.trim(),
      taxRegion: pmForm.taxRegion,
      taxValue: pmForm.taxNumber.trim(),
      emailBounced: false,
    })
  }
}

function launch() {
  const gw = currentGateway.value
  if (!gw) return
  saveContactIfNeeded()
  if (gw.mode === 'modal') {
    razorpayOpen.value = true // Razorpay opens on the page
    return
  }
  // Stripe/PayPal: a real redirect to the partner, then back to where we are.
  open.value = false
  store.redirectWithReturn(router, '/pay', {
    label: store.currentSite?.subdomain || 'your account',
    path: router.currentRoute.value.fullPath,
    intent: 'method',
    gateway: gw.label,
    kind: pmForm.kind,
    editingId: props.editingPm?.id || null,
  })
}

function onRazorpayDone() {
  store.addPaymentMethodViaGateway({ kind: pmForm.kind, gateway: 'Razorpay', editingId: props.editingPm?.id || null })
  toast.success(props.editingPm ? 'Payment method updated' : 'Payment method added')
  open.value = false
  emit('added')
}
</script>

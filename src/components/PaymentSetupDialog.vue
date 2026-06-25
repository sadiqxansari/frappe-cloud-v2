<template>
  <!-- The billing first-time-setup, in two steps: billing details (only when we
       don't have them yet), then the payment method. Shared by the Central
       billing page and the Desk's Frappe Cloud modal so there's one FTU, not
       two. `editingPm` switches it to "update an existing method". -->
  <Dialog v-model:open="open" size="md">
    <template #title>
      <span class="text-xl font-semibold text-ink-gray-9">{{ pmStep === 1 ? 'Add billing details' : editingPm ? 'Update payment method' : 'Add payment method' }}</span>
    </template>

    <!-- Step 1: billing details (only when we don't have them yet) -->
    <div v-if="pmStep === 1" class="space-y-3">
      <p class="text-p-sm text-ink-gray-6">These go on every invoice — we'll need them before adding a payment method.</p>
      <div>
        <FormControl v-model="pmForm.email" type="text" label="Billing email" placeholder="billing@company.com" />
        <p v-if="pmForm.email && pmContactEmailError" class="mt-1 text-p-xs text-ink-red-8">{{ pmContactEmailError }}</p>
      </div>
      <FormControl v-model="pmForm.address" type="textarea" :rows="2" label="Billing address" placeholder="Street, City, State, PIN" />
    </div>

    <!-- Step 2: the payment method -->
    <div v-else class="space-y-4">
      <div v-if="!editingPm" class="grid grid-cols-2 gap-3">
        <button
          v-for="opt in methodTypes"
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

      <!-- Card details -->
      <div v-if="pmForm.kind === 'card'" class="space-y-3">
        <FormControl
          :modelValue="pmForm.number"
          type="text"
          label="Card number"
          placeholder="1234 1234 1234 1234"
          inputmode="numeric"
          autocomplete="cc-number"
          @update:modelValue="(v) => (pmForm.number = formatCardNumber(v))"
        >
          <template v-if="pmCardBrand" #suffix><span class="text-xs font-medium text-ink-gray-5">{{ pmCardBrand }}</span></template>
        </FormControl>
        <div class="grid grid-cols-2 gap-3">
          <FormControl
            :modelValue="pmForm.expiry"
            type="text"
            label="Expiry"
            placeholder="MM / YY"
            inputmode="numeric"
            autocomplete="cc-exp"
            @update:modelValue="(v) => (pmForm.expiry = formatExpiry(v))"
          />
          <FormControl
            :modelValue="pmForm.cvc"
            type="text"
            label="CVC"
            placeholder="123"
            inputmode="numeric"
            autocomplete="cc-csc"
            @update:modelValue="(v) => (pmForm.cvc = v.replace(/\D/g, '').slice(0, 4))"
          />
        </div>
      </div>

      <!-- UPI details -->
      <div v-else>
        <FormControl v-model="pmForm.upi" type="text" label="UPI ID" placeholder="yourname@okhdfc" autocomplete="off" />
        <p class="mt-1.5 text-p-xs text-ink-gray-5">We'll send a collect request to approve in your UPI app.</p>
      </div>

      <p class="flex items-center gap-1.5 text-p-xs text-ink-gray-5">
        <span class="lucide-lock size-3 shrink-0" />
        Details are encrypted and handled by our payments partner — we never store your full {{ pmForm.kind === 'upi' ? 'UPI ID' : 'card number' }}.
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
          <Button variant="solid" :label="editingPm ? 'Save' : 'Add payment method'" :disabled="!pmMethodValid" @click="submit" />
        </template>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { Button, Dialog, FormControl, toast } from 'frappe-ui'
import { useCloudStore } from '../stores/cloud'
import { validateEmail } from '../utils/validate'

const open = defineModel('open', { type: Boolean, default: false })
const props = defineProps({
  // The method being edited, or null to add a new one.
  editingPm: { type: Object, default: null },
})
const emit = defineEmits(['added'])

const store = useCloudStore()

const methodTypes = [
  { value: 'card', label: 'Card', detail: 'Visa, Mastercard, RuPay, Amex', icon: 'lucide-credit-card' },
  { value: 'upi', label: 'UPI', detail: 'Pay from any UPI app', icon: 'lucide-smartphone' },
]

const pmForm = reactive({ kind: 'card', number: '', expiry: '', cvc: '', upi: '', email: '', address: '' })
// We can't issue invoices without billing details, so when they're missing the
// dialog opens on a first step that collects them before the payment method.
const pmNeedsContact = ref(false)
const pmStep = ref(1) // 1 = billing details, 2 = payment method

function resetForm() {
  pmForm.kind = props.editingPm?.kind || 'card'
  pmForm.number = ''
  pmForm.expiry = ''
  pmForm.cvc = ''
  pmForm.upi = ''
  pmForm.email = store.billingProfile.billingEmail || ''
  pmForm.address = store.billingProfile.address || ''
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

// Card formatting & brand — light, realistic touches.
function formatCardNumber(v) {
  return v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
}
function formatExpiry(v) {
  const d = v.replace(/\D/g, '').slice(0, 4)
  return d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d
}
const pmCardDigits = computed(() => pmForm.number.replace(/\D/g, ''))
const pmCardBrand = computed(() => {
  const n = pmCardDigits.value
  if (/^4/.test(n)) return 'Visa'
  if (/^(5[1-5]|2[2-7])/.test(n)) return 'Mastercard'
  if (/^3[47]/.test(n)) return 'Amex'
  if (/^(60|65|81|82|508)/.test(n)) return 'RuPay'
  return ''
})

// Validity — enough to feel real without faking a real gateway.
const pmContactEmailError = computed(() => validateEmail(pmForm.email, { required: true }))
const pmContactValid = computed(() => !pmNeedsContact.value || (!pmContactEmailError.value && !!pmForm.address.trim()))
const pmMethodValid = computed(() => {
  if (pmForm.kind === 'upi') return /^[\w.-]+@[a-z]{2,}$/i.test(pmForm.upi.trim())
  const expOk = /^\d{2}\/\d{2}$/.test(pmForm.expiry) && Number(pmForm.expiry.slice(0, 2)) >= 1 && Number(pmForm.expiry.slice(0, 2)) <= 12
  return pmCardDigits.value.length >= 13 && expOk && pmForm.cvc.length >= 3
})
const pmValid = computed(() => pmMethodValid.value && pmContactValid.value)

function submit() {
  if (!pmValid.value) return
  // Save any newly-collected billing details alongside the method.
  if (pmNeedsContact.value) {
    store.setBillingProfile({ billingEmail: pmForm.email.trim(), address: pmForm.address.trim(), emailBounced: false })
  }
  const isUpi = pmForm.kind === 'upi'
  const detail = isUpi ? pmForm.upi.trim() : `•••• ${pmCardDigits.value.slice(-4)}`
  if (props.editingPm) {
    store.updatePaymentMethod(props.editingPm.id, { detail, status: null, ...(isUpi ? {} : { expiry: pmForm.expiry }) })
    toast.success('Payment method updated')
  } else {
    const label = isUpi ? 'UPI' : pmCardBrand.value || 'Card'
    store.addPaymentMethod({ kind: pmForm.kind, label, detail, ...(isUpi ? {} : { expiry: pmForm.expiry }) })
    toast.success('Payment method added')
  }
  open.value = false
  emit('added')
}
</script>

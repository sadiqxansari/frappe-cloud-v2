<template>
  <!-- A stand-in for Razorpay's on-page checkout: a modal over the current
       screen (the thing that distinguishes it from Stripe's redirect). The real
       card/UPI form lives inside the gateway — Frappe Cloud never sees it. -->
  <Dialog v-model:open="open" size="sm">
    <template #title>
      <div class="flex items-center gap-2.5">
        <span class="grid size-7 shrink-0 place-items-center rounded-md text-xs font-bold text-white" style="background-color: #3395ff">R</span>
        <div class="min-w-0">
          <div class="text-base font-semibold text-ink-gray-9">Razorpay</div>
          <div class="truncate text-p-xs text-ink-gray-5">Secure checkout</div>
        </div>
      </div>
    </template>

    <div class="space-y-3">
      <p class="text-p-sm text-ink-gray-6">
        {{ kind === 'upi' ? "We'll send a collect request to your UPI app to approve." : "Enter your card details in Razorpay's secure window." }}
      </p>
      <div class="rounded-lg border border-dashed border-outline-gray-2 bg-surface-gray-1 p-5 text-center text-p-xs text-ink-gray-5">
        Razorpay's {{ kind === 'upi' ? 'UPI' : 'card' }} form would appear here.
      </div>
    </div>

    <template #actions>
      <div class="flex justify-end gap-2">
        <Button label="Cancel" @click="open = false" />
        <Button variant="solid" :loading="busy" :label="kind === 'upi' ? 'Send collect request' : 'Authorize'" @click="authorize" />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { ref } from 'vue'
import { Button, Dialog } from 'frappe-ui'

const open = defineModel('open', { type: Boolean, default: false })
defineProps({ kind: { type: String, default: 'card' } })
const emit = defineEmits(['done'])

const busy = ref(false)
function authorize() {
  busy.value = true
  // A beat so it reads as a real gateway round-trip, not an instant toggle.
  setTimeout(() => {
    busy.value = false
    open.value = false
    emit('done')
  }, 800)
}
</script>

<template>
  <Dialog v-model:open="open" size="sm">
    <template #title>
      <span class="text-xl font-semibold text-ink-gray-9">{{ stepTitle }}</span>
    </template>

    <!-- Step 1 — what happens -->
    <div v-if="step === 1" class="space-y-4">
      <div class="flex items-start gap-3 rounded-lg border border-outline-gray-2 bg-surface-gray-1 p-3">
        <span class="lucide-info mt-0.5 size-4 shrink-0 text-ink-gray-5" />
        <p class="text-sm text-ink-gray-7">
          This suspends every server at once. Your sites go offline until you resume — <span class="font-medium">nothing is deleted</span>.
        </p>
      </div>

      <div>
        <div class="text-sm font-medium text-ink-gray-8">Here's exactly what happens</div>
        <ul class="mt-2 space-y-2.5">
          <li v-for="item in whatHappens" :key="item.text" class="flex items-start gap-2.5 text-sm text-ink-gray-6">
            <span class="mt-0.5 size-4 shrink-0 text-ink-gray-5" :class="item.icon" />
            <span>{{ item.text }}</span>
          </li>
        </ul>
      </div>
    </div>

    <!-- Step 2 — done -->
    <div v-else class="py-2 text-center">
      <span class="mx-auto grid size-12 place-items-center rounded-full bg-surface-amber-1 text-ink-amber-3">
        <span class="lucide-pause size-6" />
      </span>
      <p class="mx-auto mt-3 max-w-sm text-sm text-ink-gray-6">
        {{ result.suspended.length }} server{{ result.suspended.length === 1 ? '' : 's' }} and their sites were suspended. You won't be charged while they're stopped.
      </p>
      <p class="mx-auto mt-2 max-w-sm text-p-sm text-ink-gray-5">
        Resume them anytime from Billing. Backups are kept for up to 30 days.
      </p>
    </div>

    <template #actions>
      <div class="flex justify-end gap-2">
        <template v-if="step === 1">
          <Button label="Back" @click="open = false" />
          <Button variant="solid" theme="red" label="Stop billing" @click="confirm" />
        </template>
        <Button v-else variant="solid" label="Done" @click="open = false" />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { Button, Dialog, toast } from 'frappe-ui'
import { useCloudStore } from '../stores/cloud'

const open = defineModel('open', { type: Boolean, default: false })
const store = useCloudStore()

const step = ref(1)
const result = reactive({ suspended: [] })

const whatHappens = [
  { icon: 'lucide-power', text: 'Your sites go offline immediately and show a maintenance page.' },
  { icon: 'lucide-receipt', text: 'Usage up to today is billed in your next invoice.' },
  { icon: 'lucide-rotate-ccw', text: 'Resume anytime to bring everything back exactly as it was.' },
  { icon: 'lucide-clock', text: 'Backups are kept for up to 30 days. Resume within that window or they may be removed.' },
]

const stepTitle = computed(() => (step.value === 1 ? 'Stop billing' : 'Billing stopped'))

function confirm() {
  result.suspended = store.stopBilling().suspended
  step.value = 2
  toast.success('Billing stopped')
}

// Reset to a clean step-1 state every time the dialog opens.
watch(open, (isOpen) => {
  if (isOpen) step.value = 1
})
</script>

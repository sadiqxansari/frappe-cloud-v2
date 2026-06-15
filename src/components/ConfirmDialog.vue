<template>
  <Dialog v-model:open="open" size="sm">
    <template #title>
      <span class="text-xl font-semibold text-ink-gray-9">{{ title }}</span>
    </template>

    <p class="text-base text-ink-gray-6">{{ message }}</p>

    <template #actions>
      <div class="flex justify-end gap-2">
        <Button label="Cancel" @click="open = false" />
        <Button variant="solid" :theme="theme" :label="confirmLabel" @click="confirm" />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { Button, Dialog } from 'frappe-ui'

defineProps({
  title: { type: String, required: true },
  message: { type: String, required: true },
  confirmLabel: { type: String, default: 'Confirm' },
  theme: { type: String, default: 'gray' }, // gray | red
})

const open = defineModel('open', { type: Boolean, default: false })
const emit = defineEmits(['confirm'])

function confirm() {
  open.value = false
  emit('confirm')
}
</script>

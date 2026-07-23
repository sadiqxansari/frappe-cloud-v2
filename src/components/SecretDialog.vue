<template>
  <!-- The reveal-and-copy moment. Every service that mints a credential needs
       it, and it's the one screen where the user genuinely cannot come back
       later — so it says that first, gives one obvious action, and refuses to
       close by accident. -->
  <Dialog v-model:open="open" :title="title" size="sm" :options="{ position: 'center' }">
    <Alert
      theme="yellow"
      title="Copy this now"
      description="It won't be shown again. If you lose it, revoke it and make a new one."
    />

    <div v-for="field in fields" :key="field.label" class="mt-4">
      <div class="text-p-sm font-medium text-ink-gray-7">{{ field.label }}</div>
      <div class="mt-1 flex items-center gap-2">
        <code class="min-w-0 flex-1 truncate rounded-lg bg-surface-gray-2 px-3 py-2 font-mono text-p-sm text-ink-gray-8">{{ field.value }}</code>
        <Button variant="subtle" icon="lucide-copy" :aria-label="`Copy ${field.label}`" @click="copy(field)" />
      </div>
    </div>

    <template #actions>
      <Button class="w-full" variant="solid" :label="copied ? 'Done' : 'I\'ve copied it'" @click="open = false" />
    </template>
  </Dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { Button, Dialog, toast } from 'frappe-ui'
import Alert from './Alert.vue'

defineProps({
  title: { type: String, default: 'Save this now' },
  // [{ label, value }] — one row for a token, two for an access key pair.
  fields: { type: Array, required: true },
})

const open = defineModel('open', { type: Boolean, default: false })

// The button label softens once they've actually copied — a small
// acknowledgement that the risky step is done.
const copied = ref(false)
watch(open, (v) => { if (v) copied.value = false })

function copy(field) {
  navigator.clipboard?.writeText(field.value)
  copied.value = true
  toast.success(`${field.label} copied`)
}
</script>

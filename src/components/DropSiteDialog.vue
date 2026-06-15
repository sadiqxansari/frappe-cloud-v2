<template>
  <Dialog v-model:open="open" size="sm">
    <template #title>
      <span class="text-xl font-semibold text-ink-gray-9">Delete this site</span>
    </template>

    <p class="text-base text-ink-gray-6">
      This permanently deletes <span class="font-medium text-ink-gray-8">{{ site.name }}</span> and everything on
      it. Backups are kept for 30 days, just in case.
    </p>

    <FormControl
      v-model="typed"
      type="text"
      class="mt-4"
      :label="`Type ${site.subdomain} to confirm`"
      :placeholder="site.subdomain"
    />

    <template #actions>
      <div class="flex justify-end gap-2">
        <Button label="Cancel" @click="open = false" />
        <Button variant="solid" theme="red" label="Delete site" :disabled="!matches" @click="confirm" />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Button, Dialog, FormControl } from 'frappe-ui'

const props = defineProps({
  site: { type: Object, required: true },
})

const open = defineModel('open', { type: Boolean, default: false })
const emit = defineEmits(['confirm'])

const typed = ref('')
watch(open, (isOpen) => {
  if (isOpen) typed.value = ''
})

const matches = computed(() => typed.value.trim().toLowerCase() === props.site.subdomain.toLowerCase())

function confirm() {
  open.value = false
  emit('confirm')
}
</script>

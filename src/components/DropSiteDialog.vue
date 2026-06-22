<template>
  <Dialog v-model:open="open" size="sm">
    <template #title>
      <span class="text-xl font-semibold text-ink-gray-9">Delete this site</span>
    </template>

    <p class="text-p-base text-ink-gray-6">
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

    <label class="mt-4 flex items-start gap-2.5">
      <input v-model="takeBackup" type="checkbox" class="mt-0.5 size-4 shrink-0 rounded border-outline-gray-3 text-ink-gray-9 focus:ring-outline-gray-4" />
      <span class="text-sm text-ink-gray-7">Take a final backup before deleting <span class="text-ink-gray-5">— recommended, in case you need anything back.</span></span>
    </label>

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
const takeBackup = ref(true)
watch(open, (isOpen) => {
  if (isOpen) {
    typed.value = ''
    takeBackup.value = true
  }
})

const matches = computed(() => typed.value.trim().toLowerCase() === props.site.subdomain.toLowerCase())

function confirm() {
  open.value = false
  emit('confirm', { backup: takeBackup.value })
}
</script>

<template>
  <Dialog v-model:open="open" size="sm">
    <template #title>
      <span class="text-xl font-semibold text-ink-gray-9">Use your own domain</span>
    </template>

    <FormControl v-model="domain" type="text" label="Domain" placeholder="shop.mycompany.in" />
    <p class="mt-2 text-sm text-ink-gray-5">
      Point a CNAME record at <span class="font-medium text-ink-gray-7">{{ site.name }}</span> first. We'll check
      it and set up SSL automatically.
    </p>

    <template #actions>
      <div class="flex justify-end gap-2">
        <Button label="Cancel" @click="open = false" />
        <Button variant="solid" label="Connect domain" :disabled="!valid" @click="add" />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Button, Dialog, FormControl, toast } from 'frappe-ui'
import { useCloudStore } from '../stores/cloud'

const props = defineProps({
  site: { type: Object, required: true },
})

const open = defineModel('open', { type: Boolean, default: false })

const store = useCloudStore()
const domain = ref('')

watch(open, (isOpen) => {
  if (isOpen) domain.value = ''
})

const valid = computed(() => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain.value.trim()))

function add() {
  store.addDomain(props.site.id, domain.value.trim().toLowerCase())
  open.value = false
  toast.success('Checking DNS — this takes a moment')
}
</script>

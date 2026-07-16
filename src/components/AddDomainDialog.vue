<template>
  <Dialog v-model:open="open" title="Use your own domain" size="sm">
    <FormControl v-model="domain" type="text" label="Domain" placeholder="shop.mycompany.in" />
    <p class="mt-2 text-p-sm text-ink-gray-5">
      We'll show the DNS records to add at your provider. Add them, then verify — we set up SSL once DNS checks out.
    </p>

    <template #actions>
      <div class="flex justify-end gap-2">
        <Button label="Cancel" @click="open = false" />
        <Button variant="solid" label="Add domain" :disabled="!valid" @click="add" />
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
  toast.success('Domain added — add the DNS records, then verify')
}
</script>

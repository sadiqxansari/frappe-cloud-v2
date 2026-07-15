<template>
  <Dialog v-model:open="open" title="Add a card" size="md">
    <div class="space-y-4">
      <FormControl v-model="form.name" type="text" label="Name on card" placeholder="Rahul Mehta" />
      <FormControl v-model="form.number" type="text" label="Card number" placeholder="4242 4242 4242 4242" />
      <div class="grid grid-cols-2 gap-4">
        <FormControl v-model="form.expiry" type="text" label="Expiry" placeholder="12/29" />
        <FormControl v-model="form.cvc" type="text" label="CVC" placeholder="123" />
      </div>
      <p class="text-p-sm text-ink-gray-5">This is a prototype — nothing is charged.</p>
    </div>

    <template #actions>
      <div class="flex justify-end gap-2">
        <Button label="Cancel" @click="open = false" />
        <Button variant="solid" label="Add card" @click="add" />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { reactive } from 'vue'
import { Button, Dialog, FormControl, toast } from 'frappe-ui'
import { useCloudStore } from '../stores/cloud'

const open = defineModel('open', { type: Boolean, default: false })

const store = useCloudStore()
const form = reactive({ name: '', number: '', expiry: '', cvc: '' })

function add() {
  const p = store.addCard()
  open.value = false
  toast.promise(p, {
    loading: 'Adding card…',
    success: 'Card added',
    error: 'Could not add card',
  })
}
</script>

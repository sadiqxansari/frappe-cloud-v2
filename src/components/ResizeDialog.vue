<template>
  <Dialog v-model:open="open" size="lg">
    <template #title>
      <div class="flex w-full items-center justify-between gap-4 pr-6">
        <span class="text-xl font-semibold text-ink-gray-9">Resize your server</span>
        <Switch v-model="rawSpecs" label="Show raw specs" size="sm" />
      </div>
    </template>

    <div class="grid auto-rows-fr grid-cols-2 gap-2.5">
      <button
        v-for="p in PLANS"
        :key="p.id"
        class="flex h-full flex-col rounded-lg border p-3 text-left transition-colors"
        :class="p.id === selectedId ? 'border-outline-gray-4 ring-1 ring-outline-gray-4' : 'border-outline-gray-2 hover:bg-surface-gray-1'"
        @click="selectedId = p.id"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="flex min-w-0 items-center gap-1.5">
            <span class="truncate font-semibold text-ink-gray-9">{{ p.name }}</span>
            <Badge v-if="p.id === server?.planId" theme="gray" variant="outline" label="Current" />
          </span>
          <span class="shrink-0 text-sm text-ink-gray-7">
            <span class="font-semibold text-ink-gray-9">{{ inr(priceFor(p.id, server?.regionId)) }}</span>/mo
          </span>
        </div>
        <p class="mt-1 text-sm text-ink-gray-6">{{ p.blurb }}</p>
        <p v-if="rawSpecs" class="mt-1.5 text-xs text-ink-gray-5">
          {{ p.specs.compute }} compute · {{ p.specs.database }} database · {{ p.specs.disk }} disk
        </p>
      </button>
    </div>

    <p class="mt-4 text-sm text-ink-gray-5">
      Takes effect right away — and you can resize again anytime.
    </p>

    <template #actions>
      <div class="flex justify-end gap-2">
        <Button label="Cancel" @click="open = false" />
        <Button
          variant="solid"
          :label="selected && selectedId !== server?.planId ? `Resize to ${selected.name}` : 'Resize'"
          :disabled="!selected || selectedId === server?.planId"
          @click="resize"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Badge, Button, Dialog, Switch, toast } from 'frappe-ui'
import { PLANS, planById, priceFor } from '../data/catalog'
import { useCloudStore } from '../stores/cloud'
import { inr } from '../utils/format'

const props = defineProps({
  server: { type: Object, default: null },
})

const open = defineModel('open', { type: Boolean, default: false })

const store = useCloudStore()
const selectedId = ref(null)
const rawSpecs = ref(false)

watch(open, (isOpen) => {
  if (isOpen) {
    selectedId.value = props.server?.planId
    rawSpecs.value = false
  }
})

const selected = computed(() => planById(selectedId.value))

function resize() {
  const name = selected.value.name
  const p = store.resizeServer(props.server.id, selectedId.value)
  open.value = false
  toast.promise(p, { loading: `Resizing to ${name}…`, success: `Resized to ${name}`, error: 'Could not resize' })
}
</script>

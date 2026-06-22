<template>
  <ServerShell v-if="server" :server="server" :crumbs="crumbs" roomy>
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold text-ink-gray-9">Analytics / insights</h1>
        <p class="mt-1 text-p-base text-ink-gray-5">How {{ server.name }} is doing over time.</p>
      </div>
      <div class="flex items-center gap-2">
        <FormControl v-model="range" type="select" :options="rangeOptions" />
        <Button variant="subtle" size="sm" label="Export CSV" icon-left="lucide-download" @click="exportCsv" />
        <Button variant="subtle" size="sm" label="Set alert" icon-left="lucide-bell" @click="alertOpen = true" />
      </div>
    </div>

    <div class="mt-5 grid gap-4 sm:grid-cols-3">
      <div v-for="m in metrics" :key="m.label" class="rounded-xl border border-outline-gray-2 bg-surface-elevation-1 p-4">
        <div class="text-sm text-ink-gray-5">{{ m.label }}</div>
        <div class="mt-1 text-2xl font-semibold text-ink-gray-9">{{ m.value }}</div>
        <svg viewBox="0 0 200 40" class="mt-3 w-full text-ink-blue-8">
          <polyline :points="m.spark" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
        <div class="mt-1 text-xs text-ink-gray-5">over the {{ rangeLabel }}</div>
      </div>
    </div>

    <Dialog v-model:open="alertOpen" size="sm">
      <template #title><span class="text-xl font-semibold text-ink-gray-9">Set a threshold alert</span></template>
      <div class="space-y-3">
        <FormControl v-model="alert.metric" type="select" label="Metric" :options="['CPU', 'Memory', 'Disk']" />
        <FormControl v-model="alert.threshold" type="number" label="Alert when above (%)" placeholder="85" />
      </div>
      <template #actions>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" @click="alertOpen = false" />
          <Button variant="solid" label="Set alert" :disabled="!(Number(alert.threshold) > 0)" @click="setAlert" />
        </div>
      </template>
    </Dialog>
  </ServerShell>
</template>

<script setup>
import { computed, reactive, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button, Dialog, FormControl, toast } from 'frappe-ui'
import ServerShell from '../../components/ServerShell.vue'
import { useCloudStore } from '../../stores/cloud'

const store = useCloudStore()
const route = useRoute()
const router = useRouter()

const server = computed(() => store.findServer(route.params.serverId) || store.server)
watchEffect(() => {
  if (!server.value) router.replace('/')
})
const crumbs = computed(() => [{ label: 'Insights' }])

const rangeOptions = [
  { label: 'Last 24 hours', value: '24h' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
]
const range = ref('7d')
const rangeLabel = computed(() => rangeOptions.find((r) => r.value === range.value).label.toLowerCase())

const metrics = computed(() => {
  const h = store.healthOf(server.value)
  return [
    { label: 'CPU', value: `${h.cpuPct}%`, spark: '0,30 40,28 80,32 120,20 160,24 200,14' },
    { label: 'Memory', value: `${h.memPct}%`, spark: '0,26 40,24 80,28 120,22 160,20 200,18' },
    { label: 'Disk', value: `${h.diskPct}%`, spark: '0,34 40,33 80,32 120,30 160,29 200,28' },
  ]
})

function exportCsv() {
  toast.success(`Exporting ${rangeLabel.value} metrics as CSV…`)
}

const alertOpen = ref(false)
const alert = reactive({ metric: 'CPU', threshold: '85' })
function setAlert() {
  store.setMetricAlert(server.value.id, { metric: alert.metric, threshold: alert.threshold })
  toast.success(`Alert set: ${alert.metric} above ${alert.threshold}%`)
  alertOpen.value = false
}
</script>

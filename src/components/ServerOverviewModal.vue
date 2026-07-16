<template>
  <Dialog v-model:open="open" size="3xl">
    <template v-if="server" #title>
      <div class="flex min-w-0 items-center gap-3">
        <ProviderIcon :provider="provider" :size="32" class="rounded-md" />
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <span class="truncate text-xl font-semibold text-ink-gray-9">{{ server.name }}</span>
            <Badge :theme="statusBadge.theme" variant="subtle" :label="statusBadge.label" />
          </div>
          <div class="truncate text-sm font-normal text-ink-gray-5">{{ region.name }} · {{ provider.short }}</div>
        </div>
      </div>
    </template>

    <div v-if="server" class="space-y-4">
      <!-- Resource usage -->
      <section class="rounded-lg border border-outline-gray-2 bg-surface-base p-4">
        <div class="mb-3 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-ink-gray-8">Resource usage</h3>
          <span class="inline-flex items-center gap-1.5 text-xs text-ink-gray-5">
            <span class="size-1.5 rounded-full bg-[var(--ink-green-7)]" />Last 24 hours
          </span>
        </div>

        <div class="space-y-4">
          <!-- CPU -->
          <div>
            <div class="flex items-baseline justify-between text-sm">
              <span class="text-ink-gray-6">CPU</span>
              <span class="font-medium tabular-nums text-ink-gray-8">{{ health.cpuPct }}% of {{ fmtVcpu(specs.vcpu) }} vCPU</span>
            </div>
            <Progress :value="health.cpuPct" size="sm" class="mt-2" />
          </div>

          <!-- Memory -->
          <div>
            <div class="flex items-baseline justify-between text-sm">
              <span class="text-ink-gray-6">Memory</span>
              <span class="font-medium tabular-nums text-ink-gray-8">{{ health.memUsed }} GB of {{ health.memTotal }} GB</span>
            </div>
            <Progress :value="health.memPct" size="sm" class="mt-2" />
          </div>

          <!-- Storage — with add affordance -->
          <div>
            <div class="flex items-baseline justify-between text-sm">
              <span class="flex items-center gap-2 text-ink-gray-6">
                Storage
                <Tooltip text="Add storage">
                  <Button variant="ghost" size="sm" icon="lucide-plus" aria-label="Add storage" @click="openAddStorage" />
                </Tooltip>
              </span>
              <span class="font-medium tabular-nums text-ink-gray-8">{{ health.diskUsed }} GB of {{ health.diskTotal }} GB</span>
            </div>
            <Progress :value="health.diskPct" size="sm" class="mt-2" />
            <p v-if="server.diskAddonGb" class="mt-1.5 text-xs text-ink-gray-5">
              Includes {{ server.diskAddonGb }} GB added on top of the {{ baseDisk }} GB plan storage.
            </p>
          </div>
        </div>
      </section>

      <div class="grid gap-4 lg:grid-cols-2">
        <!-- Server information -->
        <section class="rounded-lg border border-outline-gray-2 bg-surface-base p-4">
          <h3 class="mb-3 text-sm font-semibold text-ink-gray-8">Server information</h3>
          <dl class="space-y-2.5 text-sm">
            <div class="flex items-center justify-between gap-3">
              <dt class="text-ink-gray-5">Hosted on</dt>
              <dd class="flex min-w-0 items-center gap-1.5 text-ink-gray-8">
                <ProviderIcon :provider="provider" :size="16" class="rounded" />
                <span class="truncate">{{ region.name }}</span>
              </dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-ink-gray-5">Plan</dt>
              <dd class="tabular-nums text-ink-gray-8">{{ planName }} · {{ inr(monthly) }}/mo</dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-ink-gray-5">Inbound IP</dt>
              <dd class="tabular-nums text-ink-gray-8">{{ server.inboundIp }}</dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-ink-gray-5">Frappe version</dt>
              <dd class="text-ink-gray-8">{{ server.version }}</dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-ink-gray-5">Created on</dt>
              <dd class="text-ink-gray-8">{{ fmtDateTime(server.createdAt) }}</dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-ink-gray-5">Owned by</dt>
              <dd class="min-w-0 truncate text-ink-gray-8">{{ store.team.name }}</dd>
            </div>
          </dl>
        </section>

        <!-- Load average -->
        <section class="rounded-lg border border-outline-gray-2 bg-surface-base p-4">
          <div class="mb-3 flex items-center justify-between">
            <h3 class="text-sm font-semibold text-ink-gray-8">Load average</h3>
            <span class="text-xs tabular-nums text-ink-gray-5">peak {{ chart.peak.toFixed(2) }}</span>
          </div>
          <svg :viewBox="`0 0 ${CHART_W} ${CHART_H}`" class="h-28 w-full" preserveAspectRatio="none">
            <!-- baseline gridlines -->
            <line v-for="g in 3" :key="g" :x1="0" :x2="CHART_W" :y1="(CHART_H / 3) * g - CHART_H / 3" :y2="(CHART_H / 3) * g - CHART_H / 3" stroke="var(--outline-gray-2)" stroke-width="1" />
            <path v-for="s in chart.series" :key="`a-${s.key}`" :d="s.area" :fill="s.color" :opacity="0.07" />
            <path v-for="s in chart.series" :key="`l-${s.key}`" :d="s.line" fill="none" :stroke="s.color" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
          </svg>
          <div class="mt-3 flex items-center gap-4">
            <span v-for="s in chart.series" :key="`lg-${s.key}`" class="inline-flex items-center gap-1.5 text-xs text-ink-gray-6">
              <span class="size-2 rounded-full" :style="{ backgroundColor: s.color }" />{{ s.label }}
            </span>
          </div>
        </section>
      </div>
    </div>

    <template #actions>
      <div class="flex w-full justify-end gap-2">
        <Button label="Close" @click="open = false" />
        <Button variant="subtle" label="Open server" icon-right="lucide-arrow-up-right" @click="openServerTab" />
      </div>
    </template>

    <!-- Add storage — nested -->
    <Dialog v-if="server" v-model:open="addStorageOpen" title="Add storage" size="sm">
      <div class="space-y-4">
        <p class="text-p-sm text-ink-gray-6">
          Increase the disk on <span class="font-medium text-ink-gray-8">{{ server.name }}</span>. Storage can only grow — it's never shrunk automatically.
        </p>
        <div class="flex items-center gap-2 rounded-lg bg-surface-gray-2 px-3 py-2.5 text-p-sm text-ink-gray-6">
          <span class="lucide-info size-4 shrink-0 text-ink-gray-5" />
          Billed at {{ inr(UNIT_PRICING.disk) }}/mo for each additional GB.
        </div>
        <FormControl
          type="select"
          label="New total storage"
          :modelValue="String(newTotal)"
          :options="storageOptions"
          @update:modelValue="(v) => (newTotal = Number(v))"
        />
        <p v-if="newTotal > totalDisk" class="text-p-sm text-ink-gray-6">
          Adds <span class="font-medium text-ink-gray-8">{{ newTotal - totalDisk }} GB</span> for about
          <span class="font-medium tabular-nums text-ink-gray-8">{{ inr((newTotal - totalDisk) * UNIT_PRICING.disk) }}/mo</span> more.
        </p>
      </div>
      <template #actions>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" @click="addStorageOpen = false" />
          <Button variant="solid" label="Add storage" :disabled="newTotal <= totalDisk" @click="confirmAddStorage" />
        </div>
      </template>
    </Dialog>
  </Dialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Badge, Button, Dialog, FormControl, Progress, Tooltip, toast } from 'frappe-ui'
import ProviderIcon from './ProviderIcon.vue'
import { useCloudStore } from '../stores/cloud'
import { UNIT_PRICING, fmtVcpu, providerById } from '../data/catalog'
import { fmtDateTime, inr } from '../utils/format'

const props = defineProps({
  server: { type: Object, default: null },
})
const open = defineModel('open', { type: Boolean, default: false })

const store = useCloudStore()

const region = computed(() => store.regionOf(props.server))
const provider = computed(() => providerById(region.value?.providerId))
const health = computed(() => store.healthOf(props.server))
const specs = computed(() => store.specsOf(props.server) || { vcpu: 1, memory: 1, disk: 50 })
const baseDisk = computed(() => specs.value.disk || 50)
const totalDisk = computed(() => health.value.diskTotal)
const monthly = computed(() => store.monthlyPriceOf(props.server))
const planName = computed(() =>
  props.server?.planId === 'custom' ? 'Custom' : store.planOf(props.server)?.name || 'Custom',
)

const statusBadge = computed(() => {
  const map = {
    active: { theme: 'green', label: 'Active' },
    provisioning: { theme: 'orange', label: 'Setting up' },
    suspended: { theme: 'orange', label: 'Suspended' },
    broken: { theme: 'red', label: 'Broken' },
    migrating: { theme: 'blue', label: 'Migrating' },
    'migration-scheduled': { theme: 'green', label: 'Active' },
  }
  return map[props.server?.status] || { theme: 'gray', label: props.server?.status || '—' }
})

// — Load average chart (deterministic mock per server) —
const CHART_W = 600
const CHART_H = 150
const N = 30

function hashStr(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
function makeSeries(seed, base, amp) {
  let x = (hashStr(props.server?.id || 'srv') + seed * 7919) >>> 0
  const out = []
  for (let i = 0; i < N; i++) {
    x = (Math.imul(x, 1103515245) + 12345) >>> 0
    const r = x / 4294967295
    out.push(Math.max(0, base + (r - 0.35) * amp))
  }
  return out
}

const SERIES_DEFS = [
  { key: '1', label: 'Load 1m', color: 'var(--ink-green-7)', base: 0.09, amp: 0.18 },
  { key: '5', label: 'Load 5m', color: 'var(--ink-amber-7)', base: 0.06, amp: 0.11 },
  { key: '15', label: 'Load 15m', color: 'var(--ink-red-7)', base: 0.03, amp: 0.06 },
]

const chart = computed(() => {
  const built = SERIES_DEFS.map((d, idx) => ({ ...d, data: makeSeries(idx + 1, d.base, d.amp) }))
  const peak = Math.max(...built.flatMap((s) => s.data))
  const max = Math.max(0.25, peak)
  const stepX = CHART_W / (N - 1)
  const yOf = (v) => 6 + (1 - v / max) * (CHART_H - 12)
  const series = built.map((s) => {
    const pts = s.data.map((v, i) => `${(i * stepX).toFixed(1)},${yOf(v).toFixed(1)}`)
    const line = 'M' + pts.join(' L')
    const area = `${line} L${CHART_W},${CHART_H} L0,${CHART_H} Z`
    return { ...s, line, area }
  })
  return { series, peak }
})

// — Add storage —
const addStorageOpen = ref(false)
const newTotal = ref(0)
const storageOptions = computed(() => {
  const current = totalDisk.value
  const steps = [current, current + 50, current + 100, current + 250, current + 500, current + 1000]
  return [...new Set(steps)]
    .filter((g) => g >= current)
    .sort((a, b) => a - b)
    .map((g) => ({ label: g === current ? `${g} GB (current)` : `${g} GB`, value: String(g) }))
})
function openAddStorage() {
  newTotal.value = totalDisk.value
  addStorageOpen.value = true
}
function confirmAddStorage() {
  const target = newTotal.value
  const p = store.addServerStorage(props.server.id, target)
  addStorageOpen.value = false
  toast.promise(Promise.resolve(p), {
    loading: 'Adding storage…',
    success: `Storage increased to ${target} GB`,
    error: 'Could not add storage',
  })
}

function openServerTab() {
  open.value = false
  window.open(`/manage/${props.server.id}`, '_blank', 'noopener')
}
</script>

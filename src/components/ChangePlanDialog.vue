<template>
  <Dialog v-model:open="open" :size="step === 'choose' ? '3xl' : 'lg'">
    <template #title>
      <div class="flex w-full items-center justify-between gap-4 pr-6">
        <span class="text-xl font-semibold text-ink-gray-9">{{ step === 'review' ? 'Migrate your server' : 'Change plan' }}</span>
        <Switch v-if="step === 'choose'" v-model="rawSpecs" label="Show raw specs" size="sm" />
      </div>
    </template>

    <!-- Step 1 — choose a plan, anywhere -->
    <div v-if="step === 'choose'">
      <!-- Plans aren't tied to one place — browse other providers and regions too -->
      <div class="mb-4 rounded-lg border border-outline-gray-2 p-3">
        <ProviderRegionPicker v-model="regionId" />
        <p class="mt-2 text-xs text-ink-gray-5">Prices below follow the provider and region you pick.</p>
      </div>

      <div class="grid auto-rows-fr grid-cols-1 gap-2.5 sm:grid-cols-3">
        <button
          v-for="p in PLANS"
          :key="p.id"
          class="flex h-full flex-col rounded-lg border p-3 text-left transition-colors"
          :class="isSelected(p) ? 'border-outline-gray-4 ring-1 ring-outline-gray-4' : 'border-outline-gray-2 hover:bg-surface-gray-1'"
          @click="selectedId = p.id"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="flex min-w-0 items-center gap-1.5">
              <span class="truncate font-semibold text-ink-gray-9">{{ p.name }}</span>
              <Badge v-if="isCurrent(p)" theme="gray" variant="outline" label="Current" />
            </span>
            <span class="shrink-0 text-sm text-ink-gray-7">
              <span class="font-semibold text-ink-gray-9">{{ inr(priceFor(p.id, regionId)) }}</span>/mo
            </span>
          </div>
          <p class="mt-1 text-p-sm text-ink-gray-6">{{ p.blurb }}</p>
          <p v-if="rawSpecs" class="mt-1.5 text-xs text-ink-gray-5">
            {{ p.specs.compute }} compute · {{ p.specs.database }} database · {{ p.specs.disk }} disk
          </p>
        </button>
      </div>

      <!-- A region change can't happen in place — flag the migration up front -->
      <div
        v-if="regionChanged"
        class="mt-4 flex items-start gap-2.5 rounded-lg border border-outline-blue-1 bg-surface-blue-1 px-3 py-2.5"
      >
        <span class="lucide-route mt-0.5 size-4 shrink-0 text-ink-blue-3" />
        <p class="text-p-sm text-ink-blue-3">
          {{ region.name }} is a different {{ providerChanged ? 'provider' : 'region' }} from where {{ server?.name }} runs today
          ({{ currentRegion.name }}). We'll <span class="font-medium">migrate</span> your server — review the steps next.
        </p>
      </div>
      <p v-else class="mt-4 text-sm text-ink-gray-5">
        Takes effect right away — and you can change again anytime.
      </p>
    </div>

    <!-- Step 2 — review the migration -->
    <div v-else>
      <p class="text-p-base text-ink-gray-6">
        A server lives in one region, so changing it means moving to a new one. We'll set up a matching server and
        move every site across — the addresses stay the same, so visitors won't notice.
      </p>

      <div class="mt-4 flex items-center gap-3 rounded-xl border border-outline-gray-2 p-3">
        <div class="min-w-0 flex-1">
          <div class="text-xs text-ink-gray-5">From</div>
          <div class="truncate text-sm font-medium text-ink-gray-9">{{ currentRegion.name }}</div>
          <div class="text-xs text-ink-gray-5">{{ currentRegion.provider }} · {{ currentPlan.name }}</div>
        </div>
        <span class="lucide-arrow-right size-4 shrink-0 text-ink-gray-4" />
        <div class="min-w-0 flex-1">
          <div class="text-xs text-ink-gray-5">To</div>
          <div class="truncate text-sm font-medium text-ink-gray-9">{{ region.name }}</div>
          <div class="text-xs text-ink-gray-5">{{ region.provider }} · {{ selected.name }}</div>
        </div>
      </div>

      <ol class="mt-4 space-y-2.5">
        <li v-for="(s, i) in migrationSteps" :key="i" class="flex items-start gap-2.5 text-sm text-ink-gray-7">
          <span class="grid size-5 shrink-0 place-items-center rounded-full bg-surface-gray-3 text-xs font-semibold text-ink-gray-7">{{ i + 1 }}</span>
          {{ s }}
        </li>
      </ol>

      <div class="mt-4 flex items-baseline justify-between rounded-lg bg-surface-gray-1 px-3 py-2.5">
        <span class="text-sm text-ink-gray-6">New monthly cost</span>
        <span class="text-sm"><span class="font-semibold text-ink-gray-9">{{ inr(newPrice) }}</span><span class="text-ink-gray-5">/mo · ≈{{ inr(Math.round(newPrice / 30)) }}/day</span></span>
      </div>
    </div>

    <template #actions>
      <div class="flex justify-end gap-2">
        <template v-if="step === 'choose'">
          <Button label="Cancel" @click="open = false" />
          <Button
            v-if="regionChanged"
            variant="solid"
            label="Review migration"
            icon-right="lucide-arrow-right"
            :disabled="!selected"
            @click="step = 'review'"
          />
          <Button
            v-else
            variant="solid"
            :label="planChanged ? `Change to ${selected.name}` : 'Change plan'"
            :disabled="!planChanged"
            @click="doResize"
          />
        </template>
        <template v-else>
          <Button icon-left="lucide-arrow-left" label="Back" @click="step = 'choose'" />
          <Button variant="solid" :label="`Migrate to ${region.name}`" @click="doMigrate" />
        </template>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Badge, Button, Dialog, Switch, toast } from 'frappe-ui'
import ProviderRegionPicker from './ProviderRegionPicker.vue'
import { PLANS, planById, priceFor, regionById } from '../data/catalog'
import { useCloudStore } from '../stores/cloud'
import { inr } from '../utils/format'

const props = defineProps({
  server: { type: Object, default: null },
})

const open = defineModel('open', { type: Boolean, default: false })

const store = useCloudStore()
const router = useRouter()

const step = ref('choose') // 'choose' | 'review'
const selectedId = ref(null)
const regionId = ref('aws-mumbai')
const rawSpecs = ref(false)

watch(open, (isOpen) => {
  if (isOpen) {
    step.value = 'choose'
    selectedId.value = props.server?.planId
    regionId.value = props.server?.regionId || 'aws-mumbai'
    rawSpecs.value = false
  }
})

const selected = computed(() => planById(selectedId.value))
const currentPlan = computed(() => planById(props.server?.planId))
const region = computed(() => regionById(regionId.value))
const currentRegion = computed(() => regionById(props.server?.regionId))

const regionChanged = computed(() => regionId.value !== props.server?.regionId)
const providerChanged = computed(() => region.value.providerId !== currentRegion.value.providerId)
const planChanged = computed(() => !!selected.value && selectedId.value !== props.server?.planId)

const newPrice = computed(() => priceFor(selectedId.value, regionId.value))

function isCurrent(p) {
  return p.id === props.server?.planId && regionId.value === props.server?.regionId
}
function isSelected(p) {
  return p.id === selectedId.value
}

const migrationSteps = computed(() => {
  const n = props.server?.sites.length || 0
  return [
    `We create a new ${selected.value.name} server in ${region.value.name}.`,
    n
      ? `Your ${n} site${n === 1 ? '' : 's'} move across — same addresses, brief unavailability during cutover.`
      : 'Once it’s ready, it takes over as your server.',
    `The old server in ${currentRegion.value.name} is retired automatically.`,
  ]
})

function doResize() {
  const name = selected.value.name
  const p = store.resizeServer(props.server.id, selectedId.value)
  open.value = false
  toast.promise(p, { loading: `Changing to ${name}…`, success: `Changed to ${name}`, error: 'Could not change plan' })
}

function doMigrate() {
  const target = store.migrateServer(props.server.id, { planId: selectedId.value, regionId: regionId.value })
  open.value = false
  if (target) {
    toast.success(`Migrating ${target.name} to ${region.value.name}…`)
    router.push(`/manage/${target.id}`)
  }
}
</script>

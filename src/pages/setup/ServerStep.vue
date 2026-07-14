<template>
  <OnboardingShell :step="2" back="/setup/app">
    <div class="flex items-start gap-3">
      <AppIcon :app-key="store.onboarding.appKey" size="md" class="mt-0.5" />
      <div class="min-w-0">
        <h1 class="text-xl font-semibold text-ink-gray-9">Host {{ appName }} on your server</h1>
        <p class="mt-1 text-p-sm text-ink-gray-6">
          This server is all yours. We've picked a size to start — resize anytime.
        </p>
      </div>
    </div>

    <div class="mt-5 rounded-xl border border-outline-gray-2 p-4">
      <!-- Header: plan + recommended on the left, price on the right -->
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <span class="text-lg font-semibold text-ink-gray-9">{{ plan.name }}</span>
          <Badge v-if="plan.id === store.recommendedPlanId" theme="blue" variant="subtle" label="Recommended" />
        </div>
        <div class="flex items-baseline gap-1.5">
          <span class="text-2xl font-semibold text-ink-gray-9">₹0</span>
          <span class="text-base text-ink-gray-4 line-through">{{ inr(price) }}</span>
          <span class="text-xs text-ink-gray-5">/month</span>
        </div>
      </div>
      <div class="mt-4 flex items-center gap-1.5 text-sm font-medium text-ink-green-6">
        <span class="lucide-gift size-4" />
        Free while your $25 credit lasts
      </div>

      <ul class="mt-3 space-y-2">
        <li v-for="f in plan.features" :key="f" class="flex items-start gap-2 text-sm text-ink-gray-8">
          <span class="lucide-check mt-0.5 size-4 shrink-0 text-ink-gray-4" />
          {{ f }}
        </li>
      </ul>

      <!-- Technical facts, set apart from the value above by a single rule -->
      <div class="mt-4 flex items-center justify-between gap-3 border-t border-outline-gray-2 pt-3 text-sm text-ink-gray-5">
        <span class="flex min-w-0 items-center gap-1.5">
          <span class="lucide-map-pin size-3.5 shrink-0" />
          <span class="truncate">{{ region.name }} ({{ region.provider }})</span>
        </span>
        <button class="flex shrink-0 items-center gap-1 hover:text-ink-gray-7" @click="showSpecs = !showSpecs">
          Server details
          <span class="size-4" :class="showSpecs ? 'lucide-chevron-up' : 'lucide-chevron-down'" />
        </button>
      </div>
      <div v-if="showSpecs" class="mt-2 space-y-1.5 rounded-lg bg-surface-alpha-gray-1 p-3 text-sm">
        <div v-for="row in specRows" :key="row.label" class="flex justify-between">
          <span class="text-ink-gray-5">{{ row.label }}</span>
          <span class="text-ink-gray-8">{{ row.value }}</span>
        </div>
      </div>
    </div>

    <Button variant="solid" size="md" label="Set up my server" class="mt-6 w-full" @click="confirm" />

    <template #below>
      <Button variant="ghost" size="sm" label="Compare plans & regions" icon-left="lucide-sliders-horizontal" @click="compareOpen = true" />
    </template>
  </OnboardingShell>

  <Dialog v-model:open="compareOpen" size="2xl">
    <template #title>
      <span class="text-xl font-semibold text-ink-gray-9">Choose a plan</span>
    </template>
    <div class="mb-4">
      <ProviderRegionPicker v-model="regionId" />
    </div>
    <PlanPicker
      v-model:plan-id="draftPlanId"
      v-model:custom-spec="draftSpec"
      :region-id="regionId"
      :current-plan-id="store.onboarding.planId"
      :current-spec="store.onboarding.customSpec"
      refined
    />
    <template #actions>
      <div class="flex justify-end gap-2">
        <Button label="Cancel" @click="compareOpen = false" />
        <Button variant="solid" label="Use this plan" @click="commitPlan" />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Badge, Button, Dialog } from 'frappe-ui'
import AppIcon from '../../components/AppIcon.vue'
import OnboardingShell from '../../components/OnboardingShell.vue'
import ProviderRegionPicker from '../../components/ProviderRegionPicker.vue'
import PlanPicker from '../../components/PlanPicker.vue'
import { CUSTOM_DEFAULT, appByKey, fmtSpec, planById, priceFor, regionById } from '../../data/catalog'
import { useCloudStore } from '../../stores/cloud'
import { inr } from '../../utils/format'

const store = useCloudStore()
const router = useRouter()

const appName = computed(() => appByKey(store.onboarding.appKey)?.name || 'your app')

const showSpecs = ref(false)
const compareOpen = ref(false)

// Draft selection inside the compare dialog — only committed on "Use this plan".
const draftPlanId = ref(store.onboarding.planId)
const draftSpec = ref(store.onboarding.customSpec ? { ...store.onboarding.customSpec } : null)

const selectedId = computed(() => store.onboarding.planId)
const plan = computed(() => planById(selectedId.value))

const regionId = computed({
  get: () => store.onboarding.regionId,
  set: (v) => (store.onboarding.regionId = v),
})
const region = computed(() => regionById(regionId.value))

const price = computed(() => priceFor(selectedId.value, regionId.value, store.onboarding.customSpec))

// Resolved resource picture: custom config when chosen, else the plan's specs.
const resolvedSpecs = computed(() =>
  selectedId.value === 'custom'
    ? store.onboarding.customSpec || CUSTOM_DEFAULT
    : plan.value?.specs,
)
const specRows = computed(() => [
  { label: 'CPU', value: fmtSpec('vcpu', resolvedSpecs.value?.vcpu) },
  { label: 'Memory', value: fmtSpec('memory', resolvedSpecs.value?.memory) },
  { label: 'Storage', value: fmtSpec('disk', resolvedSpecs.value?.disk) },
])

watch(compareOpen, (isOpen) => {
  if (isOpen) {
    draftPlanId.value = store.onboarding.planId
    draftSpec.value = store.onboarding.customSpec ? { ...store.onboarding.customSpec } : null
  }
})

function commitPlan() {
  store.choosePlan(draftPlanId.value, draftSpec.value)
  compareOpen.value = false
}

function confirm() {
  store.provisionServer()
  router.push('/setup/provisioning')
}
</script>

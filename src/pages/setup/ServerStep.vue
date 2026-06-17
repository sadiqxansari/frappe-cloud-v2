<template>
  <OnboardingShell :step="3" back="/setup/app">
    <h1 class="text-xl font-semibold text-ink-gray-9">Host {{ appName }} on a server</h1>
    <p class="mt-1.5 text-p-base text-ink-gray-6">
      {{ appName }} runs on a server that's yours — your data, full control, and room to grow.
      We've started you on the smallest plan; resize anytime as you grow.
    </p>

    <div class="mt-6 rounded-xl border border-outline-gray-2 p-5">
      <div class="flex items-center justify-between">
        <div class="text-lg font-semibold text-ink-gray-9">{{ plan.name }}</div>
        <Badge v-if="plan.id === store.recommendedPlanId" theme="blue" variant="subtle" label="Recommended" />
      </div>
      <p class="mt-1 text-p-sm text-ink-gray-6">{{ plan.blurb }}</p>

      <div class="mt-4 flex items-baseline gap-2">
        <span class="text-2xl font-semibold text-ink-gray-9">{{ inr(price) }}</span>
        <span class="text-sm text-ink-gray-5">/month · ≈{{ inr(Math.round(price / 30)) }}/day</span>
      </div>
      <div class="mt-2 flex items-center gap-1.5 text-sm font-medium text-ink-green-3">
        <span class="lucide-gift size-4" />
        Free on your $25 credit
      </div>

      <!-- Where it runs — info only; plan and region both change in the one modal -->
      <div class="mt-3 flex items-center gap-1.5 text-sm text-ink-gray-5">
        <span class="lucide-map-pin size-3.5" />
        Runs in {{ region.name }} ({{ region.provider }})
      </div>

      <ul class="mt-4 space-y-2">
        <li v-for="f in plan.features" :key="f" class="flex items-start gap-2 text-sm text-ink-gray-7">
          <span class="lucide-check mt-0.5 size-4 shrink-0 text-ink-green-3" />
          {{ f }}
        </li>
      </ul>

      <button
        class="mt-4 flex items-center gap-1 text-sm text-ink-gray-5 hover:text-ink-gray-7"
        @click="showSpecs = !showSpecs"
      >
        Server details
        <span class="size-4" :class="showSpecs ? 'lucide-chevron-up' : 'lucide-chevron-down'" />
      </button>
      <div v-if="showSpecs" class="mt-2 space-y-1.5 rounded-lg bg-surface-gray-1 p-3 text-sm">
        <div v-for="row in specRows" :key="row.label" class="flex justify-between">
          <span class="text-ink-gray-5">{{ row.label }}</span>
          <span class="text-ink-gray-8">{{ row.value }}</span>
        </div>
      </div>
    </div>

    <p class="mt-3 flex items-center gap-1.5 text-sm text-ink-gray-5">
      <span class="lucide-refresh-cw size-3.5" />
      Resize anytime — start small and grow when you need to.
    </p>

    <Button variant="solid" size="lg" label="Set up my server" class="mt-5 w-full" @click="confirm" />

    <template #below>
      <Button variant="ghost" size="sm" label="Compare plans & regions" icon-left="lucide-sliders-horizontal" @click="compareOpen = true" />
    </template>
  </OnboardingShell>

  <Dialog v-model:open="compareOpen" size="4xl">
    <template #title>
      <div class="flex w-full items-center justify-between gap-4 pr-6">
        <span class="text-xl font-semibold text-ink-gray-9">All plans</span>
        <Switch v-model="rawSpecs" label="Show raw specs" size="sm" />
      </div>
    </template>
    <div class="mb-4 rounded-lg border border-outline-gray-2 p-3">
      <ProviderRegionPicker v-model="regionId" />
      <p class="mt-2 text-xs text-ink-gray-5">Provider &amp; region — prices below update with your choice.</p>
    </div>
    <div class="grid gap-4 sm:grid-cols-3">
      <div
        v-for="p in visiblePlans"
        :key="p.id"
        class="flex flex-col rounded-xl border p-4"
        :class="p.id === selectedId ? 'border-outline-gray-4 ring-1 ring-outline-gray-4' : 'border-outline-gray-2'"
      >
        <div class="flex items-center justify-between">
          <div class="font-semibold text-ink-gray-9">{{ p.name }}</div>
          <Badge v-if="p.id === store.recommendedPlanId" theme="blue" variant="subtle" label="Recommended" />
        </div>
        <div class="mt-2 flex items-baseline gap-1">
          <span class="text-xl font-semibold text-ink-gray-9">{{ inr(priceFor(p.id, regionId)) }}</span>
          <span class="text-xs text-ink-gray-5">/month</span>
        </div>
        <div class="text-xs text-ink-gray-5">≈{{ inr(Math.round(priceFor(p.id, regionId) / 30)) }}/day</div>
        <p class="mt-2 text-p-sm text-ink-gray-6">{{ p.blurb }}</p>
        <ul class="mt-3 flex-1 space-y-1.5">
          <li v-for="f in p.features" :key="f" class="flex items-start gap-1.5 text-sm text-ink-gray-7">
            <span class="lucide-check mt-0.5 size-3.5 shrink-0 text-ink-green-3" />
            {{ f }}
          </li>
        </ul>
        <div v-if="rawSpecs" class="mt-3 space-y-1 rounded-lg bg-surface-gray-1 p-2.5 text-xs">
          <div class="flex justify-between"><span class="text-ink-gray-5">Compute</span><span class="text-ink-gray-8">{{ p.specs.compute }}</span></div>
          <div class="flex justify-between"><span class="text-ink-gray-5">Database</span><span class="text-ink-gray-8">{{ p.specs.database }}</span></div>
          <div class="flex justify-between"><span class="text-ink-gray-5">Disk</span><span class="text-ink-gray-8">{{ p.specs.disk }}</span></div>
        </div>
        <Button
          class="mt-4 w-full"
          :variant="p.id === selectedId ? 'solid' : 'subtle'"
          :label="p.id === selectedId ? 'Selected' : 'Choose ' + p.name"
          @click="choose(p.id)"
        />
      </div>
    </div>
    <div class="mt-4 flex items-center justify-center gap-3 text-sm">
      <button class="text-ink-gray-6 underline-offset-2 hover:underline" @click="allSizes = !allSizes">
        {{ allSizes ? 'Show fewer sizes' : `Show all ${PLANS.length} sizes` }}
      </button>
      <span class="text-ink-gray-4">·</span>
      <span class="text-ink-gray-5">Whatever you pick, you can resize anytime.</span>
    </div>
  </Dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Badge, Button, Dialog, Switch } from 'frappe-ui'
import OnboardingShell from '../../components/OnboardingShell.vue'
import ProviderRegionPicker from '../../components/ProviderRegionPicker.vue'
import { FEATURED_PLANS, PLANS, appByKey, planById, priceFor, regionById } from '../../data/catalog'
import { useCloudStore } from '../../stores/cloud'
import { inr } from '../../utils/format'

const store = useCloudStore()
const router = useRouter()

const appName = computed(() => appByKey(store.onboarding.appKey)?.name || 'your app')

const showSpecs = ref(false)
const compareOpen = ref(false)
const rawSpecs = ref(false)
const allSizes = ref(false)

const selectedId = computed(() => store.onboarding.planId)
const plan = computed(() => planById(selectedId.value))
const visiblePlans = computed(() => (allSizes.value ? PLANS : FEATURED_PLANS))

const regionId = computed({
  get: () => store.onboarding.regionId,
  set: (v) => (store.onboarding.regionId = v),
})
const region = computed(() => regionById(regionId.value))

const price = computed(() => priceFor(selectedId.value, regionId.value))

const specRows = computed(() => [
  { label: 'Compute', value: plan.value.specs.compute },
  { label: 'Database', value: plan.value.specs.database },
  { label: 'Disk', value: plan.value.specs.disk },
  { label: 'Region', value: `${region.value.name} (${region.value.provider})` },
])

function choose(planId) {
  store.choosePlan(planId)
  compareOpen.value = false
}

function confirm() {
  store.provisionServer()
  router.push('/setup/provisioning')
}
</script>

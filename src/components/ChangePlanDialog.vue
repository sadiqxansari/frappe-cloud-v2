<template>
  <Dialog v-model:open="open" size="3xl">
    <template #title>
      <div>
        <span class="text-xl font-semibold text-ink-gray-9">{{ step === 'review' ? 'Migrate your server' : 'Change plan' }}</span>
        <p v-if="step === 'review'" class="mt-1 text-p-sm font-normal text-ink-gray-5">
          Your server will be briefly unavailable during the migration.
        </p>
      </div>
    </template>

    <!-- Step 1 — choose a plan -->
    <div v-if="step === 'choose'">
      <div class="mb-3">
        <ProviderRegionPicker
          v-model="regionId"
          :current-provider-id="currentProvider.id"
          :current-region-id="server.regionId"
        />
      </div>

      <PlanPicker
        v-model:plan-id="selectedId"
        v-model:custom-spec="customSpec"
        :region-id="regionId"
        :current-plan-id="server?.planId"
        :current-spec="server?.customSpec"
        refined
      />

      <!-- Affordability note — only when the chosen plan outruns available billing -->
      <div v-if="!canAffordPlan" class="mt-3 flex items-center gap-2 rounded-lg border border-outline-red-2 bg-surface-red-1 px-3 py-2 text-xs text-ink-gray-7">
        <span class="lucide-alert-circle size-3.5 shrink-0 text-ink-red-8" />
        Insufficient balance — set up billing to switch.
        <a
          :href="router.resolve('/billing').href"
          target="_blank"
          rel="noopener"
          class="ml-auto cursor-pointer font-medium text-ink-gray-8 underline hover:text-ink-gray-9"
          @click.stop
        >Go to Billing</a>
      </div>

      <!-- Billing note -->
      <div v-else class="mt-3 flex items-center gap-1.5 text-xs text-ink-gray-5">
        <span class="lucide-credit-card size-3 shrink-0" />
        Takes effect today, billed by the day.
        <a href="#billing-docs" class="font-medium text-ink-gray-7 underline hover:text-ink-gray-9">Learn more</a>
      </div>
    </div>

    <!-- Step 2 — review the migration -->
    <div v-else>
      <!-- From → To map hero — endpoint cards pin to the dots. -->
      <MigrationMapCard
        class="mt-1"
        :from-region="currentRegion"
        :to-region="region"
        :from-provider="currentProvider"
        :to-provider="destProvider"
        :from-plan="currentPlan?.name"
        :to-plan="selected?.name"
        :cost="inr(newPrice)"
      />

      <!-- Scheduler: obvious times first, Custom for anything else.
           Here the options sit inline on the far right of the toggle row. -->
      <div class="mt-5 flex items-start gap-3">
        <Checkbox v-model="scheduled" label="Schedule for later" />
        <ScheduleField v-if="scheduled" v-model="scheduleAt" class="ml-auto items-end" />
      </div>
    </div>

    <template #actions>
      <!-- Step 1 actions -->
      <template v-if="step === 'choose'">
        <div class="flex w-full items-center justify-between gap-2">
          <Button
            label="Compare plans"
            icon-left="lucide-help-circle"
            variant="subtle"
            tag="a"
            href="#compare-plans-docs"
            target="_blank"
          />
          <div class="flex gap-2">
            <Button label="Cancel" @click="open = false" />
            <Tooltip
              v-if="regionChanged"
              :text="!canAffordPlan ? 'Set up billing first to switch to this plan.' : ''"
            >
              <div>
                <Button
                  variant="solid"
                  label="Review migration"
                  :icon-left="!canAffordPlan ? 'lucide-help-circle' : undefined"
                  :icon-right="canAffordPlan ? 'lucide-arrow-right' : undefined"
                  :disabled="!selected || !canAffordPlan"
                  @click="step = 'review'"
                />
              </div>
            </Tooltip>
            <Tooltip
              v-else
              :text="!canAffordPlan ? 'Set up billing first to switch to this plan.' : ''"
            >
              <div>
                <Button
                  variant="solid"
                  label="Change plan"
                  :icon-left="!canAffordPlan ? 'lucide-help-circle' : undefined"
                  :disabled="!planChanged || !canAffordPlan"
                  @click="doResize"
                />
              </div>
            </Tooltip>
          </div>
        </div>
      </template>

      <!-- Step 2 actions -->
      <template v-else>
        <div class="flex w-full justify-end gap-2">
          <Button icon-left="lucide-arrow-left" label="Back" @click="step = 'choose'" />
          <Button
            variant="solid"
            :label="scheduled ? 'Schedule migration' : 'Migrate'"
            :disabled="scheduled && !scheduleAt"
            @click="doMigrate"
          />
        </div>
      </template>
    </template>
  </Dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Button, Checkbox, Dialog, Tooltip, toast } from 'frappe-ui'
import ProviderRegionPicker from './ProviderRegionPicker.vue'
import PlanPicker from './PlanPicker.vue'
import ScheduleField from './ScheduleField.vue'
import MigrationMapCard from './MigrationMapCard.vue'
import { planById, priceFor, providerById, regionById } from '../data/catalog'
import { useCloudStore } from '../stores/cloud'
import { inr } from '../utils/format'

const props = defineProps({
  server: { type: Object, default: null },
})

const open = defineModel('open', { type: Boolean, default: false })

const store = useCloudStore()
const router = useRouter()

const step = ref('choose')
const selectedId = ref(null)
const customSpec = ref(null)
const regionId = ref('aws-mumbai')
const scheduled = ref(false)
const scheduleAt = ref('')

watch(open, (isOpen) => {
  if (isOpen) {
    step.value = 'choose'
    selectedId.value = props.server?.planId
    customSpec.value = props.server?.customSpec ? { ...props.server.customSpec } : null
    regionId.value = props.server?.regionId || 'aws-mumbai'
    scheduled.value = false
    scheduleAt.value = ''
  }
})

const selected = computed(() => planById(selectedId.value))
const currentPlan = computed(() => planById(props.server?.planId))
const region = computed(() => regionById(regionId.value))
const currentRegion = computed(() => regionById(props.server?.regionId))
const destProvider = computed(() => providerById(region.value.providerId))
const currentProvider = computed(() => providerById(currentRegion.value.providerId))

const INR_PER_USD = 83

function isPlanAffordable(planId) {
  // Billing is set up via a recurring method — the cardOnFile flag (AddCardDialog
  // path) or any saved card/UPI in the list (Payment methods path).
  if (store.cardOnFile || store.paymentMethods.length > 0) return true
  // …otherwise prepaid funds must cover it: server credit + wallet (both in ₹).
  const monthlyINR = priceFor(planId, regionId.value, customSpec.value)
  const creditINR = (props.server?.creditBalance ?? 0) * INR_PER_USD
  return monthlyINR <= creditINR + store.walletBalance
}

const canAffordPlan = computed(() => {
  if (!selected.value) return true
  return isPlanAffordable(selectedId.value)
})

// When billing is set up in another tab (the "Go to Billing" link opens Central
// billing in a new tab), the store syncs back via localStorage. Watch billing state
// directly — not canAffordPlan — so plan row clicks never trigger the toast.
watch(
  [() => store.cardOnFile, () => store.paymentMethods.length, () => store.walletBalance],
  () => {
    if (!open.value) return
    if (canAffordPlan.value) {
      toast.success('Billing updated — this plan is now available')
    } else {
      toast.success('Billing updated')
    }
  },
)

const regionChanged = computed(() => regionId.value !== props.server?.regionId)
const providerChanged = computed(() => region.value.providerId !== currentRegion.value.providerId)
const specChanged = computed(
  () =>
    selectedId.value === 'custom' &&
    JSON.stringify(customSpec.value) !== JSON.stringify(props.server?.customSpec),
)
const planChanged = computed(
  () => !!selected.value && (selectedId.value !== props.server?.planId || specChanged.value),
)

const newPrice = computed(() => priceFor(selectedId.value, regionId.value, customSpec.value))

function doResize() {
  const p = store.resizeServer(props.server.id, selectedId.value, customSpec.value)
  open.value = false
  toast.promise(p, { loading: 'Changing plan…', success: 'Plan changed', error: 'Could not change plan' })
}

function doMigrate() {
  const scheduledAt = scheduled.value && scheduleAt.value ? scheduleAt.value : undefined
  store.migrateServer(props.server.id, {
    planId: selectedId.value,
    customSpec: customSpec.value,
    regionId: regionId.value,
    scheduledAt,
  })
  open.value = false
  if (scheduled.value) {
    toast.success(`Migration scheduled for ${new Date(scheduledAt.replace(' ', 'T')).toLocaleString()}`)
  } else {
    toast.success('Migration started')
  }
  // Drop back to Central — the server row shows live "Migrating…" status, and
  // the dedicated progress screen is one click away from there (opens its own tab).
  router.push('/servers')
}
</script>

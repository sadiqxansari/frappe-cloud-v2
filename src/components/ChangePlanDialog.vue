<template>
  <Dialog v-model:open="open" size="3xl">
    <template #title>
      <span class="text-xl font-semibold text-ink-gray-9">{{ step === 'review' ? 'Migrate your server' : 'Change plan' }}</span>
    </template>

    <!-- Step 1 — choose a plan -->
    <div v-if="step === 'choose'">
      <div class="mb-3 rounded-lg border border-outline-gray-2 p-3">
        <ProviderRegionPicker
          v-model="regionId"
          :current-provider-id="currentProvider.id"
          :current-region-id="server.regionId"
        />
      </div>

      <!-- Column headers — transparent 1px border matches the rows' border so columns line up -->
      <div class="mb-1.5 flex items-center gap-4 border border-transparent px-4 text-xs font-medium text-ink-gray-6">
        <span class="min-w-0 flex-1">Plan</span>
        <span class="w-24">Database</span>
        <span class="w-20">Disk</span>
        <span class="w-24 text-center">Product warranty</span>
        <span class="w-28 text-right">Monthly cost</span>
      </div>

      <!-- Full plan ladder in ascending price; the warranty tier is marked by a divider -->
      <div class="flex flex-col gap-1">
        <template v-for="p in PLANS" :key="p.id">
          <button
            class="flex w-full items-center gap-4 rounded-[10px] border px-4 py-1.5 text-left transition-colors"
            :class="isSelected(p) ? 'border-outline-gray-5 bg-surface-gray-1' : 'border-outline-gray-3 hover:bg-surface-gray-1'"
            :aria-pressed="isSelected(p)"
            @click="selectedId = p.id"
          >
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-2">
                <span class="text-sm font-medium text-ink-gray-9">{{ p.name }}</span>
                <Badge v-if="isCurrent(p)" theme="gray" variant="outline" label="Current" size="sm" />
                <Badge v-else-if="p.recommended" theme="green" variant="subtle" label="Recommended" size="sm" />
                <template v-if="isSelected(p) && !isPlanAffordable(p.id)">
                  <Tooltip text="This plan exceeds your credit — add billing details first.">
                    <span class="lucide-alert-circle size-3.5 shrink-0 text-ink-red-3" />
                  </Tooltip>
                  <a
                    :href="router.resolve('/billing').href"
                    target="_blank"
                    rel="noopener"
                    class="cursor-pointer text-xs font-medium text-ink-gray-7 underline hover:text-ink-gray-9"
                    @click.stop
                  >Go to Billing</a>
                </template>
              </span>
            </span>
            <span class="w-24 text-sm text-ink-gray-6">{{ p.specs.database }}</span>
            <span class="w-20 text-sm text-ink-gray-6">{{ p.specs.disk }}</span>
            <span class="flex w-24 justify-center">
              <span v-if="p.enterprise" class="lucide-check size-4 text-ink-green-3" />
              <span v-else class="lucide-x size-4 text-ink-gray-4" />
            </span>
            <span class="w-28 text-right">
              <span class="text-base font-semibold text-ink-gray-9">{{ inr(priceFor(p.id, regionId)) }}</span>
              <span class="text-xs text-ink-gray-5">/mo</span>
            </span>
          </button>
        </template>
      </div>

      <!-- Billing note -->
      <div class="mt-3 flex items-center gap-1.5 text-xs text-ink-gray-5">
        <span class="lucide-credit-card size-3 shrink-0" />
        Your new plan takes effect today and is billed by the day.
        <a href="#billing-docs" class="font-medium text-ink-gray-7 underline hover:text-ink-gray-9">Learn more</a>
      </div>
    </div>

    <!-- Step 2 — review the migration -->
    <div v-else>
      <!-- Expectations note above ticket -->
      <div class="flex items-start gap-2 text-sm text-ink-gray-5">
        <span class="lucide-help-circle mt-0.5 size-3.5 shrink-0 text-ink-gray-4" />
        Your server will be briefly unavailable during migration. You'll be redirected to Central to track progress.
      </div>

      <!-- From → To with map — uniform 16px radius -->
      <div class="mt-4 overflow-hidden rounded-2xl border border-outline-gray-3 shadow-sm">
        <div class="flex items-center gap-3 p-3">
          <div class="flex min-w-0 flex-1 items-center gap-2.5">
            <span
              class="grid size-7 shrink-0 place-items-center rounded text-[10px] font-bold leading-none"
              :class="currentProvider.tile"
            >{{ currentProvider.mono }}</span>
            <div class="min-w-0">
              <div class="text-xs text-ink-gray-5">From</div>
              <div class="truncate text-sm font-medium text-ink-gray-9">{{ currentRegion.name }}</div>
              <div class="text-xs text-ink-gray-5">{{ currentProvider.short }} · {{ currentPlan.name }}</div>
            </div>
          </div>
          <span class="lucide-arrow-right size-4 shrink-0 text-ink-gray-4" />
          <div class="flex min-w-0 flex-1 items-center gap-2.5">
            <span
              class="grid size-7 shrink-0 place-items-center rounded text-[10px] font-bold leading-none"
              :class="destProvider.tile"
            >{{ destProvider.mono }}</span>
            <div class="min-w-0">
              <div class="text-xs text-ink-gray-5">To</div>
              <div class="truncate text-sm font-medium text-ink-gray-9">{{ region.name }}</div>
              <div class="text-xs text-ink-gray-5">{{ destProvider.short }} · {{ selected?.name }}</div>
            </div>
          </div>
        </div>
        <div class="h-44 border-t border-outline-gray-2 bg-surface-gray-1">
          <WorldMap
            :pins="migrationPins"
            :connections="migrationConnections"
            :highlight="mapHighlight"
            :pin-scale="2.4"
            dark
            fit
            :fit-padding="40"
            class="h-full w-full"
            @hover="mapHighlight = $event"
          />
        </div>
        <div class="flex items-center justify-between border-t border-outline-gray-2 px-3 py-2.5">
          <span class="text-xs text-ink-gray-5">New monthly cost</span>
          <span class="text-lg font-bold tabular-nums text-ink-gray-9">
            {{ inr(newPrice) }}<span class="text-xs font-normal text-ink-gray-5"> /mo</span>
          </span>
        </div>
      </div>

      <!-- Migration steps with titles -->
      <ol class="mt-4 space-y-0">
        <li
          v-for="(s, i) in migrationSteps"
          :key="i"
          class="relative flex items-start gap-3 pb-4 last:pb-0"
        >
          <div v-if="i < migrationSteps.length - 1" class="absolute left-[0.6rem] top-6 bottom-0 w-px bg-outline-gray-2" />
          <span class="relative z-10 grid size-5 shrink-0 place-items-center rounded-full bg-surface-gray-3 text-xs font-semibold text-ink-gray-7">{{ i + 1 }}</span>
          <span class="pt-0.5 text-sm">
            <span class="font-semibold text-ink-gray-8">{{ s.title }}</span>
            <span class="text-ink-gray-5"> — {{ s.text }}</span>
          </span>
        </li>
      </ol>

      <!-- Scheduler: two side-by-side inputs -->
      <div class="mt-3 flex items-center gap-3 rounded-lg border border-outline-gray-2 px-3 py-2.5">
        <Switch v-model="scheduled" size="sm" class="shrink-0" />
        <span class="text-sm text-ink-gray-7">Schedule for later</span>
        <div v-if="scheduled" class="ml-auto flex gap-2">
          <FormControl v-model="scheduledDate" type="date" :min="minScheduleDate" />
          <FormControl v-model="scheduledTime" type="time" :min="minScheduleTime || undefined" />
        </div>
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
            :label="scheduled ? 'Schedule plan change' : 'Migrate and change plan'"
            :disabled="scheduled && (!scheduledDate || !scheduledTime || scheduledInPast)"
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
import { Badge, Button, Dialog, FormControl, Switch, Tooltip, toast } from 'frappe-ui'
import ProviderRegionPicker from './ProviderRegionPicker.vue'
import WorldMap from './WorldMap.vue'
import { PLANS, planById, priceFor, providerById, regionById } from '../data/catalog'
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
const regionId = ref('aws-mumbai')
const scheduled = ref(false)
const scheduledDate = ref('')
const scheduledTime = ref('')
const mapHighlight = ref(null)

watch(open, (isOpen) => {
  if (isOpen) {
    step.value = 'choose'
    selectedId.value = props.server?.planId
    regionId.value = props.server?.regionId || 'aws-mumbai'
    scheduled.value = false
    scheduledDate.value = ''
    scheduledTime.value = ''
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
  const monthlyINR = priceFor(planId, regionId.value)
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
const planChanged = computed(() => !!selected.value && selectedId.value !== props.server?.planId)

const newPrice = computed(() => priceFor(selectedId.value, regionId.value))

// Local YYYY-MM-DD / HH:mm — toISOString() is UTC and would drift a day in IST.
function pad(x) {
  return String(x).padStart(2, '0')
}
const minScheduleDate = computed(() => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
})
const minScheduleTime = computed(() => {
  if (scheduledDate.value !== minScheduleDate.value) return '' // only constrain "today"
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
})
const scheduledInPast = computed(() => {
  if (!scheduledDate.value || !scheduledTime.value) return false
  return new Date(`${scheduledDate.value}T${scheduledTime.value}`) < new Date()
})

function isCurrent(p) {
  return p.id === props.server?.planId && regionId.value === props.server?.regionId
}
function isSelected(p) {
  return p.id === selectedId.value
}

const migrationSteps = computed(() => {
  const n = props.server?.sites.length || 0
  return [
    { title: 'Provision', text: `We create a new server in ${region.value.name}.` },
    {
      title: 'Transfer',
      text: n
        ? `Your ${n} site${n === 1 ? '' : 's'} move across — same domain names and URLs, brief downtime during cutover.`
        : "Once it's ready, it takes over as your server.",
    },
    { title: 'Retire', text: `The old server in ${currentRegion.value.name} is retired automatically.` },
  ]
})

const migrationPins = computed(() => {
  if (!currentRegion.value || !region.value) return []
  return [
    { id: currentRegion.value.id, lat: currentRegion.value.lat, lng: currentRegion.value.lng, status: 'active' },
    { id: region.value.id, lat: region.value.lat, lng: region.value.lng, status: null, selected: true },
  ]
})

const migrationConnections = computed(() => {
  if (!currentRegion.value || !region.value || currentRegion.value.id === region.value.id) return []
  return [{ fromId: currentRegion.value.id, toId: region.value.id, progress: 0 }]
})

function doResize() {
  const p = store.resizeServer(props.server.id, selectedId.value)
  open.value = false
  toast.promise(p, { loading: 'Changing plan…', success: 'Plan changed', error: 'Could not change plan' })
}

function doMigrate() {
  const scheduledAt = scheduled.value ? `${scheduledDate.value}T${scheduledTime.value}` : undefined
  store.migrateServer(props.server.id, {
    planId: selectedId.value,
    regionId: regionId.value,
    scheduledAt,
  })
  open.value = false
  if (scheduled.value) {
    toast.success(`Migration scheduled for ${new Date(scheduledAt).toLocaleString()}`)
  } else {
    toast.success('Migration started')
  }
  // Drop back to Central — the server row shows live "Migrating…" status, and
  // the dedicated progress screen is one click away from there (opens its own tab).
  router.push('/servers')
}
</script>

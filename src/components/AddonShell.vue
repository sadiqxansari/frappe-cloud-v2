<template>
  <CentralShell :crumbs="crumbs">
    <!-- Identity — the same header whichever add-on this is, so moving between
         them feels like one surface rather than four products. -->
    <div class="flex items-start justify-between gap-4">
      <div class="flex min-w-0 items-start gap-3">
        <span class="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-gray-2 text-ink-gray-7">
          <span class="size-5" :class="addon.icon" />
        </span>
        <div class="min-w-0">
          <h1 class="text-xl font-semibold text-ink-gray-9">{{ addon.name }}</h1>
          <p class="mt-0.5 text-p-base text-ink-gray-5">{{ addon.tagline }}</p>
        </div>
      </div>
      <Dropdown v-if="state.on" :options="menu" placement="bottom-end">
        <button class="mt-1 shrink-0 rounded p-1 text-ink-gray-5 hover:bg-surface-gray-2" aria-label="Add-on actions">
          <span class="lucide-ellipsis size-4" />
        </button>
      </Dropdown>
    </div>

    <!-- Off: the pitch. Pricing sits above the button, not behind it — nobody
         should have to switch something on to find out what it costs. -->
    <template v-if="!state.on">
      <p class="mt-6 max-w-prose text-p-base text-ink-gray-7">{{ addon.blurb }}</p>

      <section class="mt-6 rounded-lg border border-outline-gray-2 bg-surface-base p-5 pt-4">
        <h2 class="text-base font-semibold text-ink-gray-8">What you pay</h2>
        <p v-if="addon.meterNote" class="mt-0.5 text-p-sm text-ink-gray-5">{{ addon.meterNote }}</p>
        <div class="mt-2 divide-y divide-outline-alpha-gray-1">
          <div v-for="meter in addon.meters" :key="meter.key" class="flex items-baseline justify-between gap-3 py-2.5">
            <span class="min-w-0 truncate text-sm text-ink-gray-8">{{ meter.label }}</span>
            <span class="shrink-0 text-p-sm text-ink-gray-5">
              <span class="tabular-nums text-ink-gray-7">{{ qty(meter.included) }} {{ meter.unit }}</span> free, then
              <span class="tabular-nums text-ink-gray-7">{{ rate(meter.rate) }}</span> per {{ rateUnitOf(meter) }}
            </span>
          </div>
        </div>
      </section>

      <div class="mt-5 flex flex-wrap items-center gap-3">
        <Button variant="solid" label="Turn on" :loading="working" @click="turnOn" />
        <span class="text-p-sm text-ink-gray-5">Nothing to pay until you go over.</span>
      </div>
    </template>

    <!-- On: usage first (it's what you came to check), then the service's own
         controls. The link out to Billing is how the number here reconciles
         with the bill — same rows, wider context. -->
    <template v-else>
      <section class="mt-6 rounded-lg border border-outline-gray-2 bg-surface-base p-5 pt-4">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-base font-semibold text-ink-gray-8">This cycle</h2>
          <span class="text-base font-medium tabular-nums text-ink-gray-9">{{ inr(cost) }}</span>
        </div>
        <p v-if="addon.meterNote" class="mt-0.5 text-p-sm text-ink-gray-5">{{ addon.meterNote }}</p>
        <div class="mt-3 space-y-3">
          <MeterRow v-for="row in rows" :key="row.id" :row="row" />
        </div>
        <!-- Two sentences that stop most billing tickets: usage lags a little,
             and these are the same numbers the invoice is built from. A meter
             nobody trusts is worse than no meter. -->
        <p class="mt-3 text-p-xs text-ink-gray-4">Updated every few minutes. Your invoice uses these numbers.</p>
        <Button class="mt-2 -ml-2" variant="ghost" size="sm" label="See on billing" icon-left="lucide-receipt" @click="router.push('/billing')" />
      </section>

      <slot />
    </template>

    <ConfirmDialog
      v-model:open="offOpen"
      :title="`Turn off ${addon.name}?`"
      message="Calls stop working right away. Your settings are kept — turn it back on anytime."
      confirm-label="Turn off"
      @confirm="turnOff"
    />
  </CentralShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button, Dropdown, toast } from 'frappe-ui'
import CentralShell from './CentralShell.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import MeterRow from './MeterRow.vue'
import { addonByKey, rateUnitOf } from '../data/addons'
import { useCloudStore } from '../stores/cloud'
import { inr, qty, rate } from '../utils/format'

// Every add-on page is this shell plus its own controls in the default slot.
// Enabling, disabling, pricing and usage are identical across the four, so they
// live here once — a new add-on only has to write its own configuration.
const props = defineProps({
  addonKey: { type: String, required: true },
})

const store = useCloudStore()
const router = useRouter()

const addon = computed(() => addonByKey(props.addonKey))
const state = computed(() => store.addonState(props.addonKey))
// The only way back — the rail holds one entry for all of these, so the crumb
// is what carries you between a service and the list it came from.
const crumbs = computed(() => [{ label: 'Add-on services', route: '/addons' }, { label: addon.value.name }])

// This add-on's slice of the account-wide metered rows.
const rows = computed(() => store.meteredRows.filter((r) => r.addonKey === props.addonKey))
const cost = computed(() => Math.round(rows.value.reduce((sum, r) => sum + r.cost, 0)))

const menu = computed(() => [
  { label: 'Turn off', icon: 'lucide-power', onClick: () => { offOpen.value = true } },
])

const working = ref(false)
const offOpen = ref(false)

function turnOn() {
  working.value = true
  toast.promise(store.enableAddon(props.addonKey).finally(() => { working.value = false }), {
    loading: `Turning on ${addon.value.name}…`,
    success: () => `${addon.value.name} is on`,
    error: (e) => e.message,
  })
}

function turnOff() {
  toast.promise(store.disableAddon(props.addonKey), {
    loading: `Turning off ${addon.value.name}…`,
    success: () => `${addon.value.name} is off`,
    error: (e) => e.message,
  })
}
</script>

<template>
  <CentralShell :crumbs="[{ label: 'Add-on services' }]">
    <div>
      <h1 class="text-xl font-semibold text-ink-gray-9">Add-on services</h1>
      <p class="mt-1 text-p-base text-ink-gray-5">Pay for what you use, not a monthly fee.</p>
    </div>

    <!-- What the switched-on ones are costing, so the catalogue answers "what am
         I already paying for these?" before you browse for another. -->
    <div v-if="enabled.length" class="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-lg bg-surface-gray-1 px-4 py-3">
      <span class="text-base font-semibold tabular-nums text-ink-gray-9">{{ inr(enabledCost) }}</span>
      <span class="text-p-sm text-ink-gray-5">this cycle · {{ enabled.length }} of {{ ADDONS.length }} on</span>
      <button class="ml-auto text-p-sm text-ink-gray-7 transition-colors hover:text-ink-gray-9" @click="router.push('/billing')">
        See on billing
      </button>
    </div>

    <!-- One card per service, on or off. Off cards lead with price, on cards
         lead with this cycle's cost — in both states the money is the first
         thing you read, because it's the first thing you want to know. -->
    <div class="mt-5 grid gap-4 sm:grid-cols-2">
      <button
        v-for="addon in ADDONS"
        :key="addon.key"
        class="group flex flex-col rounded-lg border border-outline-gray-2 bg-surface-base p-5 text-left transition-colors hover:border-outline-gray-3"
        @click="router.push(addon.to)"
      >
        <div class="flex items-start justify-between gap-3">
          <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-gray-2 text-ink-gray-7">
            <span class="size-4.5" :class="addon.icon" />
          </span>
          <!-- Having a badge at all is the signal; colouring it too would say
               the same thing twice. -->
          <Badge v-if="isOn(addon.key)" theme="gray" variant="subtle" label="On" />
        </div>

        <h2 class="mt-3 text-base font-semibold text-ink-gray-9">{{ addon.name }}</h2>
        <p class="mt-1 text-p-sm text-ink-gray-5">{{ addon.tagline }}</p>

        <div class="mt-auto flex items-center justify-between gap-3 pt-4">
          <span v-if="isOn(addon.key)" class="text-p-sm">
            <span class="font-medium tabular-nums text-ink-gray-9">{{ inr(costOf(addon.key)) }}</span>
            <span class="text-ink-gray-5"> this cycle</span>
          </span>
          <span v-else class="text-p-sm text-ink-gray-5">{{ addon.priceLine }}</span>
          <span class="lucide-arrow-right size-4 shrink-0 text-ink-gray-4 transition-transform group-hover:translate-x-0.5" />
        </div>
      </button>
    </div>
  </CentralShell>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Badge } from 'frappe-ui'
import CentralShell from '../../components/CentralShell.vue'
import { ADDONS } from '../../data/addons'
import { useCloudStore } from '../../stores/cloud'
import { inr } from '../../utils/format'

const store = useCloudStore()
const router = useRouter()

const enabled = computed(() => store.enabledAddons)
const enabledCost = computed(() =>
  Math.round(store.meteredRows.filter((r) => r.addonKey).reduce((sum, r) => sum + r.cost, 0)),
)

function isOn(key) {
  return store.addonState(key).on
}

function costOf(key) {
  return Math.round(
    store.meteredRows.filter((r) => r.addonKey === key).reduce((sum, r) => sum + r.cost, 0),
  )
}
</script>

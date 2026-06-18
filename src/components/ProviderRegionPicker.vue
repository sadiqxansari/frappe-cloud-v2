<template>
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
    <!-- Custom provider picker -->
    <div>
      <label class="mb-1.5 block text-xs text-ink-gray-5">Provider</label>
      <div ref="providerPickerEl" class="relative" @focusout="onProviderFocusOut">
        <button
          type="button"
          role="combobox"
          aria-label="Provider"
          aria-haspopup="listbox"
          aria-controls="provider-listbox"
          :aria-expanded="providerOpen"
          :aria-activedescendant="providerOpen ? `provider-opt-${providerActiveIndex}` : undefined"
          class="flex w-full items-center gap-2 rounded border border-outline-gray-2 bg-surface-white px-2.5 py-[7px] text-left text-sm transition-colors hover:border-outline-gray-3 focus:outline-none focus:ring-1 focus:ring-outline-gray-4"
          @click="providerOpen ? closeProviderMenu() : openProviderMenu()"
          @keydown="onProviderKeydown"
        >
          <span
            class="grid size-5 shrink-0 place-items-center rounded text-[9px] font-bold leading-none"
            :class="selectedProvider.tile"
          >{{ selectedProvider.mono }}</span>
          <span class="min-w-0 flex-1 truncate text-ink-gray-9">{{ selectedProvider.name }}</span>
          <Badge v-if="isCurrentProvider" label="Current" theme="gray" variant="subtle" size="sm" class="shrink-0" />
          <Badge v-else label="Migration required" theme="blue" variant="subtle" size="sm" class="shrink-0" />
          <span class="lucide-chevron-down size-3.5 shrink-0 text-ink-gray-4" />
        </button>

        <div
          v-if="providerOpen"
          id="provider-listbox"
          role="listbox"
          class="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-outline-gray-2 bg-surface-white py-1 shadow-md"
        >
          <button
            v-for="(p, index) in PROVIDERS"
            :id="`provider-opt-${index}`"
            :key="p.id"
            type="button"
            role="option"
            :aria-selected="p.id === providerId"
            class="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors"
            :class="[
              p.id === providerId ? 'bg-surface-gray-1' : '',
              index === providerActiveIndex ? 'bg-surface-gray-2' : 'hover:bg-surface-gray-1',
            ]"
            @mousedown.prevent
            @mouseenter="providerActiveIndex = index"
            @click="selectProvider(p.id)"
          >
            <span
              class="grid size-6 shrink-0 place-items-center rounded text-[10px] font-bold leading-none"
              :class="p.tile"
            >{{ p.mono }}</span>
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm text-ink-gray-9">{{ p.name }}</div>
              <div class="text-xs text-ink-gray-5">from {{ inr(startingPrice(p.id)) }}/mo</div>
            </div>
            <Badge v-if="p.id === currentProviderId" label="Current" theme="gray" variant="subtle" size="sm" class="shrink-0" />
            <span v-else class="lucide-arrow-right-left size-3.5 shrink-0 text-ink-gray-5" />
            <span v-if="p.id === providerId" class="lucide-check size-3.5 shrink-0 text-ink-gray-7" />
          </button>
        </div>
      </div>
    </div>

    <!-- Custom region picker -->
    <div>
      <label class="mb-1.5 block text-xs text-ink-gray-5">Region</label>
      <div ref="regionPickerEl" class="relative" @focusout="onRegionFocusOut">
        <button
          type="button"
          role="combobox"
          aria-label="Region"
          aria-haspopup="listbox"
          aria-controls="region-listbox"
          :aria-expanded="regionOpen"
          :aria-activedescendant="regionOpen ? `region-opt-${regionActiveIndex}` : undefined"
          class="flex w-full items-center gap-2 rounded border border-outline-gray-2 bg-surface-white px-2.5 py-[7px] text-left text-sm transition-colors hover:border-outline-gray-3 focus:outline-none focus:ring-1 focus:ring-outline-gray-4"
          @click="regionOpen ? closeRegionMenu() : openRegionMenu()"
          @keydown="onRegionKeydown"
        >
          <span class="min-w-0 flex-1 truncate text-ink-gray-9">{{ selectedRegionLabel }}</span>
          <Badge v-if="isCurrentProvider && regionId === currentRegionId" label="Current" theme="gray" variant="subtle" size="sm" class="shrink-0" />
          <Badge v-else-if="isCurrentProvider && regionId !== currentRegionId" label="Migration required" theme="blue" variant="subtle" size="sm" class="shrink-0" />
          <span class="lucide-chevron-down size-3.5 shrink-0 text-ink-gray-4" />
        </button>

        <div
          v-if="regionOpen"
          id="region-listbox"
          role="listbox"
          class="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-outline-gray-2 bg-surface-white py-1 shadow-md"
        >
          <button
            v-for="(r, index) in regionOptions"
            :id="`region-opt-${index}`"
            :key="r.value"
            type="button"
            role="option"
            :aria-selected="r.value === regionId"
            class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors"
            :class="[
              r.value === regionId ? 'bg-surface-gray-1' : '',
              index === regionActiveIndex ? 'bg-surface-gray-2' : 'hover:bg-surface-gray-1',
            ]"
            @mousedown.prevent
            @mouseenter="regionActiveIndex = index"
            @click="selectRegion(r.value)"
          >
            <span class="min-w-0 flex-1 truncate text-ink-gray-9">{{ r.label }}</span>
            <template v-if="isCurrentProvider">
              <Badge v-if="r.value === currentRegionId" label="Current" theme="gray" variant="subtle" size="sm" class="shrink-0" />
              <span v-else class="lucide-arrow-right-left size-3.5 shrink-0 text-ink-gray-5" />
            </template>
            <span v-if="r.value === regionId" class="lucide-check size-3.5 shrink-0 text-ink-gray-7" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Badge } from 'frappe-ui'
import { PLANS, PROVIDERS, providerById, regionById, regionsOf, priceFor } from '../data/catalog'
import { inr } from '../utils/format'

const props = defineProps({
  currentProviderId: { type: String, default: null },
  currentRegionId: { type: String, default: null },
})

const regionId = defineModel({ type: String, required: true })

const providerId = ref(regionById(regionId.value).providerId)

// ── Provider picker state ──────────────────────────────────────────────────
const providerOpen = ref(false)
const providerActiveIndex = ref(0)
const providerPickerEl = ref(null)

const selectedProvider = computed(() => providerById(providerId.value))
const isCurrentProvider = computed(() => providerId.value === props.currentProviderId)

function startingPrice(pid) {
  const regions = regionsOf(pid)
  if (!regions.length) return 0
  return Math.min(...PLANS.map((p) => priceFor(p.id, regions[0].id)))
}

function openProviderMenu() {
  providerActiveIndex.value = PROVIDERS.findIndex((p) => p.id === providerId.value)
  providerOpen.value = true
}
function closeProviderMenu() { providerOpen.value = false }

function selectProvider(id) {
  providerId.value = id
  regionId.value = regionsOf(id)[0].id
  providerOpen.value = false
}

function onProviderFocusOut(e) {
  if (!providerPickerEl.value?.contains(e.relatedTarget)) providerOpen.value = false
}

function onProviderKeydown(e) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (!providerOpen.value) openProviderMenu()
    else providerActiveIndex.value = Math.min(providerActiveIndex.value + 1, PROVIDERS.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (providerOpen.value) providerActiveIndex.value = Math.max(providerActiveIndex.value - 1, 0)
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    if (!providerOpen.value) openProviderMenu()
    else selectProvider(PROVIDERS[providerActiveIndex.value].id)
  } else if (e.key === 'Escape' || e.key === 'Tab') {
    closeProviderMenu()
  }
}

// ── Region picker state ────────────────────────────────────────────────────
const regionOpen = ref(false)
const regionActiveIndex = ref(0)
const regionPickerEl = ref(null)

const regionOptions = computed(() =>
  regionsOf(providerId.value).map((r) => ({
    label: r.beta ? `${r.name} (Beta)` : r.name,
    value: r.id,
  })),
)

const selectedRegionLabel = computed(() => {
  const opt = regionOptions.value.find((r) => r.value === regionId.value)
  return opt?.label ?? regionId.value
})

function openRegionMenu() {
  regionActiveIndex.value = Math.max(0, regionOptions.value.findIndex((r) => r.value === regionId.value))
  regionOpen.value = true
}
function closeRegionMenu() { regionOpen.value = false }

function selectRegion(id) {
  regionId.value = id
  regionOpen.value = false
}

function onRegionFocusOut(e) {
  if (!regionPickerEl.value?.contains(e.relatedTarget)) regionOpen.value = false
}

function onRegionKeydown(e) {
  const opts = regionOptions.value
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (!regionOpen.value) openRegionMenu()
    else regionActiveIndex.value = Math.min(regionActiveIndex.value + 1, opts.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (regionOpen.value) regionActiveIndex.value = Math.max(regionActiveIndex.value - 1, 0)
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    if (!regionOpen.value) openRegionMenu()
    else selectRegion(opts[regionActiveIndex.value].value)
  } else if (e.key === 'Escape' || e.key === 'Tab') {
    closeRegionMenu()
  }
}
</script>

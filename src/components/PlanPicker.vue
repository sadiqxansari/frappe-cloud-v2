<template>
  <!-- The one place a plan gets chosen: three curated plans plus a fully
       custom fourth whose CPU / memory / storage sliders expand inline. Pure
       UI — it emits the selection upward and never touches the store. -->
  <div :class="compact ? 'space-y-1.5' : 'space-y-2'">
    <!-- Curated plans -->
    <button
      v-for="p in PLANS"
      :key="p.id"
      type="button"
      class="flex w-full items-center gap-3 rounded-lg border text-left transition-colors"
      :class="[
        compact ? 'px-3 py-2.5' : 'px-4 py-3',
        planId === p.id ? 'border-outline-gray-5' : 'border-outline-gray-3 hover:bg-surface-gray-1',
      ]"
      :aria-pressed="planId === p.id"
      @click="selectPlan(p.id)"
    >
      <span
        class="grid size-4 shrink-0 place-items-center rounded-full border"
        :class="planId === p.id ? 'border-outline-gray-7' : 'border-outline-gray-4'"
      >
        <span v-if="planId === p.id" class="size-2 rounded-full" :style="dotStyle" />
      </span>
      <!-- Refined: plan name and specs share one line, no marketing badges -->
      <span v-if="refined" class="flex min-w-0 flex-1 items-center gap-3">
        <span class="flex shrink-0 items-center gap-2">
          <span class="text-sm font-medium text-ink-gray-9">{{ p.name }}</span>
          <Badge v-if="isCurrent(p.id)" theme="gray" variant="outline" label="Current" size="sm" />
        </span>
        <span class="truncate text-xs text-ink-gray-5">{{ specLine(p.specs) }}</span>
      </span>
      <span v-else class="min-w-0 flex-1">
        <span class="flex items-center gap-2">
          <span class="text-sm font-medium text-ink-gray-9">{{ p.name }}</span>
          <Badge v-if="isCurrent(p.id)" theme="gray" variant="outline" label="Current" size="sm" />
          <Badge v-else-if="p.recommended" theme="green" variant="subtle" label="Recommended" size="sm" />
          <Badge v-else-if="p.popular" theme="blue" variant="subtle" label="Most picked" size="sm" />
        </span>
        <span class="mt-0.5 block truncate text-xs text-ink-gray-5">
          {{ p.bestFor }} · {{ specLine(p.specs) }}
        </span>
      </span>
      <span class="shrink-0 text-right">
        <span class="text-base font-semibold tabular-nums text-ink-gray-9">{{ inr(priceFor(p.id, regionId)) }}</span>
        <span class="text-xs text-ink-gray-5">/mo</span>
      </span>
    </button>

    <!-- Custom — selecting it expands the controls in place -->
    <div
      class="overflow-hidden rounded-lg border transition-colors"
      :class="isCustom ? 'border-outline-gray-5' : 'border-outline-gray-3'"
    >
      <button
        type="button"
        class="flex w-full items-center gap-3 text-left"
        :class="[compact ? 'px-3 py-2.5' : 'px-4 py-3', isCustom ? '' : 'hover:bg-surface-gray-1']"
        :aria-pressed="isCustom"
        @click="selectPlan('custom')"
      >
        <span
          class="grid size-4 shrink-0 place-items-center rounded-full border"
          :class="isCustom ? 'border-outline-gray-7' : 'border-outline-gray-4'"
        >
          <span v-if="isCustom" class="size-2 rounded-full" :style="dotStyle" />
        </span>
        <span v-if="refined" class="flex min-w-0 flex-1 items-center gap-3">
          <span class="flex shrink-0 items-center gap-2">
            <span class="text-sm font-medium text-ink-gray-9">Custom</span>
            <Badge v-if="isCurrent('custom')" theme="gray" variant="outline" label="Current" size="sm" />
            <span class="lucide-sliders-horizontal size-3.5 text-ink-gray-5" />
          </span>
          <span class="truncate text-xs text-ink-gray-5">{{ isCustom ? specLine(spec) : CUSTOM_PLAN.bestFor }}</span>
        </span>
        <span v-else class="min-w-0 flex-1">
          <span class="flex items-center gap-2">
            <span class="text-sm font-medium text-ink-gray-9">Custom</span>
            <Badge v-if="isCurrent('custom')" theme="gray" variant="outline" label="Current" size="sm" />
            <span class="lucide-sliders-horizontal size-3.5 text-ink-gray-5" />
          </span>
          <span class="mt-0.5 block truncate text-xs text-ink-gray-5">
            {{ isCustom ? specLine(spec) : CUSTOM_PLAN.bestFor }}
          </span>
        </span>
        <span class="shrink-0 text-right">
          <span class="text-base font-semibold tabular-nums text-ink-gray-9">{{ inr(customPrice) }}</span>
          <span class="text-xs text-ink-gray-5">/mo</span>
        </span>
      </button>

      <div v-if="isCustom" class="space-y-4 border-t border-outline-gray-2 px-4 pb-4 pt-3.5">
        <!-- Compute — the slider rides the vCPU ladder; the two dropdowns set
             vCPU and RAM precisely. Memory is bounded to supported ratios, so
             out-of-band sizes show disabled with a hint. -->
        <div class="flex items-center gap-3">
          <span class="shrink-0 text-sm font-medium text-ink-gray-8">Compute</span>
          <Slider
            class="min-w-0 flex-1"
            :model-value="[computeIndex]"
            :min="0"
            :max="COMPUTE_SIZES.length - 1"
            :step="1"
            @update:model-value="(v) => setCpu(COMPUTE_SIZES[v[0]])"
          />

          <!-- vCPU dropdown -->
          <Popover class="shrink-0" placement="bottom-end">
            <template #target="{ togglePopover }">
              <Button class="tabular-nums" :label="`${fmtVcpu(spec.vcpu)} vCPU`" @click="togglePopover" />
            </template>
            <template #body-main="{ close }">
              <div class="min-w-[7rem] p-1">
                <button
                  v-for="v in COMPUTE_SIZES"
                  :key="v"
                  type="button"
                  :class="[menuItemClass, spec.vcpu === v ? 'text-ink-gray-9' : 'text-ink-gray-7']"
                  @click="setCpu(v); close()"
                >
                  <span>{{ fmtVcpu(v) }} vCPU</span>
                  <span v-if="spec.vcpu === v" class="lucide-check size-3.5 text-ink-gray-7" />
                </button>
              </div>
            </template>
          </Popover>

          <!-- RAM dropdown — out-of-band ratios disabled with a hint -->
          <Popover class="shrink-0" placement="bottom-end">
            <template #target="{ togglePopover }">
              <Button class="tabular-nums" :label="`${spec.memory} GB RAM`" @click="togglePopover" />
            </template>
            <template #body-main="{ close }">
              <div class="min-w-[8rem] p-1">
                <template v-for="opt in ramChoices" :key="opt.memory">
                  <Tooltip v-if="!opt.supported" :text="ramHint">
                    <div :class="[menuItemClass, 'cursor-not-allowed text-ink-gray-4']" aria-disabled="true">
                      <span>{{ opt.memory }} GB</span>
                    </div>
                  </Tooltip>
                  <button
                    v-else
                    type="button"
                    :class="[menuItemClass, spec.memory === opt.memory ? 'text-ink-gray-9' : 'text-ink-gray-7']"
                    @click="setRam(opt.memory); close()"
                  >
                    <span>{{ opt.memory }} GB</span>
                    <span v-if="spec.memory === opt.memory" class="lucide-check size-3.5 text-ink-gray-7" />
                  </button>
                </template>
              </div>
            </template>
          </Popover>
        </div>

        <!-- Storage — the one independent dimension; the slider rides the full
             range, the stepper nudges by one step, and the value doubles as a
             quick-pick dropdown for common sizes. -->
        <div class="flex items-center gap-3">
          <span class="shrink-0 text-sm font-medium text-ink-gray-8">{{ CUSTOM_LIMITS.disk.label }}</span>
          <Slider
            class="min-w-0 flex-1"
            :model-value="[spec.disk]"
            :min="CUSTOM_LIMITS.disk.min"
            :max="CUSTOM_LIMITS.disk.max"
            :step="CUSTOM_LIMITS.disk.step"
            @update:model-value="(v) => setSpec('disk', v[0])"
          />
          <div class="flex shrink-0 items-center gap-1.5">
            <Button
              icon="lucide-minus"
              :disabled="spec.disk <= CUSTOM_LIMITS.disk.min"
              aria-label="Decrease storage"
              @click="stepDisk(-1)"
            />
            <Popover class="shrink-0" placement="bottom-end">
              <template #target="{ togglePopover }">
                <Button class="min-w-[4.5rem] tabular-nums" :label="`${spec.disk} GB`" @click="togglePopover" />
              </template>
              <template #body-main="{ close }">
                <div class="min-w-[7rem] p-1">
                  <button
                    v-for="d in DISK_CHOICES"
                    :key="d"
                    type="button"
                    :class="[menuItemClass, spec.disk === d ? 'text-ink-gray-9' : 'text-ink-gray-7']"
                    @click="setSpec('disk', d); close()"
                  >
                    <span>{{ d }} GB</span>
                    <span v-if="spec.disk === d" class="lucide-check size-3.5 text-ink-gray-7" />
                  </button>
                </div>
              </template>
            </Popover>
            <Button
              icon="lucide-plus"
              :disabled="spec.disk >= CUSTOM_LIMITS.disk.max"
              aria-label="Increase storage"
              @click="stepDisk(1)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Badge, Button, Slider, Popover, Tooltip } from 'frappe-ui'
import {
  PLANS,
  CUSTOM_PLAN,
  CUSTOM_LIMITS,
  CUSTOM_DEFAULT,
  DISK_CHOICES,
  COMPUTE_SIZES,
  MEMORY_RATIOS,
  DEFAULT_RATIO,
  memoryOptionsFor,
  memoryRangeFor,
  priceFor,
  fmtSpec,
  fmtVcpu,
} from '../data/catalog'
import { inr } from '../utils/format'

// Selected-radio dot — ink tokens aren't wired to backgrounds, so set the fill
// from the CSS var directly (flips dark/light like the rest of the ink scale).
const dotStyle = { backgroundColor: 'var(--ink-gray-9)' }

// Shared styling for the dropdown menu rows.
const menuItemClass =
  'flex w-full items-center justify-between gap-4 rounded px-2 py-1.5 text-sm tabular-nums hover:bg-surface-gray-3'

const props = defineProps({
  regionId: { type: String, required: true },
  currentPlanId: { type: String, default: null },
  currentSpec: { type: Object, default: null },
  compact: { type: Boolean, default: false },
  // Refined layout: specs inline with the plan name, no marketing badges.
  refined: { type: Boolean, default: false },
})

const planId = defineModel('planId', { type: String, default: 'starter' })
const customSpec = defineModel('customSpec', { type: Object, default: null })

const isCustom = computed(() => planId.value === 'custom')

// The live custom config — falls back to the sensible default until the user drags.
const spec = computed(() => customSpec.value || CUSTOM_DEFAULT)

const customPrice = computed(() => priceFor('custom', props.regionId, spec.value))

// The slider rides an index into the size ladder — even spacing for uneven steps.
const computeIndex = computed(() => {
  const i = COMPUTE_SIZES.indexOf(spec.value.vcpu)
  return i >= 0 ? i : 0
})

// Memory menu for the current vCPU; unsupported ratios render disabled.
const ramChoices = computed(() => memoryOptionsFor(spec.value.vcpu))

// Hint shown on a disabled memory option — the supported range for this vCPU.
const ramHint = computed(() => {
  const { min, max } = memoryRangeFor(spec.value.vcpu)
  return `Works with ${min}–${max} GB at ${fmtVcpu(spec.value.vcpu)} vCPU`
})

function specLine(s) {
  return `${fmtSpec('vcpu', s.vcpu)} · ${fmtSpec('memory', s.memory)} · ${fmtSpec('disk', s.disk)}`
}

function isCurrent(id) {
  if (props.currentPlanId !== id) return false
  // For custom, "Current" only when the config also matches.
  if (id !== 'custom') return true
  return JSON.stringify(props.currentSpec) === JSON.stringify(customSpec.value)
}

function selectPlan(id) {
  planId.value = id
  if (id === 'custom' && !customSpec.value) {
    customSpec.value = { ...(props.currentSpec || CUSTOM_DEFAULT) }
  }
}

function setSpec(key, value) {
  customSpec.value = { ...spec.value, [key]: value }
}

// Setting vCPU (slider or dropdown) keeps the current memory ratio if it's
// still supported, otherwise lands on the default pairing for the new size.
function setCpu(vcpu) {
  const ratio = spec.value.memory / spec.value.vcpu
  const keptRatio = MEMORY_RATIOS.includes(ratio) ? ratio : DEFAULT_RATIO
  customSpec.value = { ...spec.value, vcpu, memory: vcpu * keptRatio }
}

function setRam(memory) {
  customSpec.value = { ...spec.value, memory }
}

// Storage stepper — clamp to bounds and snap to the step increment.
function stepDisk(dir) {
  const { min, max, step } = CUSTOM_LIMITS.disk
  const next = Math.min(max, Math.max(min, spec.value.disk + dir * step))
  setSpec('disk', next)
}
</script>

<template>
  <!-- One metered line: what it is, what it costs, and how much of the
       allowance is gone. Shared by the Billing page's Metered card and each
       add-on's own page so the two can never disagree about a number. -->
  <div>
    <div class="flex items-baseline justify-between gap-3">
      <span class="min-w-0 truncate text-sm text-ink-gray-8">{{ row.label }}</span>
      <!-- Only a meter that costs something gets a number; "Included" already
           lives in the caption below, so repeating it on the right is noise. -->
      <span v-if="row.cost > 0" class="shrink-0 text-sm tabular-nums text-ink-gray-9">{{ inr(Math.round(row.cost)) }}</span>
    </div>

    <!-- The bar only appears once there's usage to show. An empty bar at zero is
         a flat line that says nothing — the caption already carries the allowance.
         Once there's usage it fills with the share used and pins at full past it;
         how far past is the caption's job. Stays neutral even when exceeded —
         going over isn't an error, and a page of amber bars reads as alarm. -->
    <div v-if="row.used > 0" class="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-gray-3">
      <div
        class="h-full rounded-full bg-[var(--ink-gray-6)] transition-[width] duration-500 ease-[var(--ease-out)]"
        :style="{ width }"
      />
    </div>

    <!-- "17.6 over × ₹40" rather than a sentence: it's the arithmetic behind
         the amount on the right, so the reader can check it at a glance. Same
         shape the invoice uses for its metered lines. -->
    <div class="mt-1 text-p-xs text-ink-gray-5">
      {{ qty(row.used) }} of {{ qty(row.included) }} {{ row.unit }} included
      <template v-if="over"> · {{ qty(row.used - row.included) }} over × {{ rate(row.rate) }}</template>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { inr, qty, rate } from '../utils/format'

// The detailed view of one meter, used on each service's own page. The billing
// page deliberately doesn't use this — it shows a service's total and sends you
// here for the breakdown.
const props = defineProps({
  // A row from `store.meteredRows`: { label, used, included, unit, rate, cost }.
  row: { type: Object, required: true },
})

const over = computed(() => props.row.used > props.row.included)

// A meter with no allowance bills from the first unit, so it reads as full
// straight away rather than dividing by zero.
const width = computed(() =>
  props.row.included
    ? `${Math.min(100, Math.round((props.row.used / props.row.included) * 100))}%`
    : '100%',
)
</script>

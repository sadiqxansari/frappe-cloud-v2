<template>
  <!-- One metered line: what it is, what it costs, and how much of the
       allowance is gone. Shared by the Billing page's Metered card and each
       add-on's own page so the two can never disagree about a number. -->
  <div>
    <div class="flex items-baseline justify-between gap-3">
      <span class="min-w-0 truncate text-sm text-ink-gray-8">{{ row.label }}</span>
      <span class="shrink-0 text-sm tabular-nums" :class="row.cost > 0 ? 'text-ink-gray-9' : 'text-ink-gray-4'">
        {{ row.cost > 0 ? inr(Math.round(row.cost)) : 'Included' }}
      </span>
    </div>

    <!-- Fills with the share of the allowance used, and pins at full once
         you're past it — how far past is the caption's job, not the bar's. Stays
         neutral even when exceeded: going over isn't an error, it's the service
         working, and a page of amber bars reads as alarm where none is meant. -->
    <div class="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-gray-3">
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

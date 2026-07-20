<template>
  <div>
    <!-- Sticky table headers (index.css's div:has(> .fc-listview) rule) need this
         wrapper — and ListView's own hardcoded overflow-x-auto wrapper — to carry
         no scroll container of their own; our fixed column widths fit within
         .fc-scroll's content width anyway, so there's no horizontal scroll to lose. -->
    <div>
      <ListView
        class="fc-listview"
        :columns="columns"
        :rows="visibleRows"
        :options="options"
        :row-key="rowKey"
        v-bind="$attrs"
      >
        <!-- Only overridden when a caller wants bulk actions on selected rows —
             ListView's own default slot bundles header/rows/select-banner
             together, so reaching the banner's `actions` slot means
             reconstructing that default rather than layering on top of it.
             Callers that don't need this keep ListView's untouched default. -->
        <template v-if="$slots.selectionActions" #default="{ showGroupedRows, selectable }">
          <ListHeader />
          <template v-if="visibleRows.length">
            <ListGroups v-if="showGroupedRows" />
            <ListRows v-else />
          </template>
          <ListEmptyState v-else />
          <ListSelectBanner v-if="selectable">
            <template #actions="bannerSlotProps">
              <slot name="selectionActions" v-bind="bannerSlotProps" />
            </template>
          </ListSelectBanner>
        </template>
        <template #cell="slotProps">
          <slot name="cell" v-bind="slotProps" />
        </template>
      </ListView>
    </div>
    <!-- Footer only when there's more than one page. Page-length buttons come from
         frappe-ui's ListFooter; its built-in Load More renders an empty button in
         this version, so we supply the right side ourselves. -->
    <ListFooter
      v-if="rows.length > pageLength"
      class="mt-3 border-t border-outline-alpha-gray-1 pt-3"
      v-model="shown"
      :options="{ rowCount: visibleRows.length, totalCount: rows.length, pageLengthOptions }"
    >
      <template #right>
        <div class="flex items-center gap-3">
          <Button v-if="visibleRows.length < rows.length" size="sm" variant="subtle" label="Load more" @click="shown += pageLength" />
          <span class="text-p-sm text-ink-gray-5">{{ visibleRows.length }} of {{ rows.length }}</span>
        </div>
      </template>
    </ListFooter>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Button, ListView, ListFooter, ListHeader, ListRows, ListGroups, ListEmptyState, ListSelectBanner } from 'frappe-ui'

// A ListView that pages long lists with frappe-ui's ListFooter. Renders only the
// visible slice, so the table never grows unbounded and never needs an inner
// scrollbar. The page-length buttons drive `shown`; Load More adds a page.
const props = defineProps({
  columns: { type: Array, required: true },
  rows: { type: Array, required: true },
  rowKey: { type: String, required: true },
  options: { type: Object, default: () => ({}) },
  pageLength: { type: Number, default: 20 },
  pageLengthOptions: { type: Array, default: () => [20, 50, 100] },
})

defineOptions({ inheritAttrs: false })

const shown = ref(props.pageLength)
// Changing the page length (or the underlying rows shrinking) resets the window.
watch(() => props.pageLength, (n) => (shown.value = n))
const visibleRows = computed(() => props.rows.slice(0, shown.value))
</script>

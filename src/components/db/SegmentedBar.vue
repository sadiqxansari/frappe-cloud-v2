<template>
  <div class="flex h-5 w-full overflow-hidden rounded-full bg-surface-gray-2">
    <div
      v-for="s in visible"
      :key="s.label"
      class="h-full"
      :style="{ width: pct(s) + '%', background: s.color }"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'

// One strip, many colored segments. Segments without a color (e.g. Free) are
// left to the gray track underneath rather than drawn.
const props = defineProps({
  segments: { type: Array, required: true }, // [{ label, gb, color }]
  totalGb: { type: Number, required: true },
})

const visible = computed(() => props.segments.filter((s) => s.color && s.gb > 0))
const pct = (s) => (props.totalGb ? (s.gb / props.totalGb) * 100 : 0)
</script>

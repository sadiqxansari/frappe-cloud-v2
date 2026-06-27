<template>
  <span class="grid shrink-0 place-items-center border border-outline-gray-2 bg-surface-elevation-1 text-ink-gray-6" :class="tile">
    <span class="lucide-globe" :class="icon" />
  </span>
</template>

<script setup>
import { computed } from 'vue'

// A site's avatar is a website icon — not the logo of whatever app happens to be
// installed first. One small component so every site reads the same.
const props = defineProps({ size: { type: String, default: 'md' } }) // sm | md | lg
const tile = computed(() => ({ sm: 'size-7 rounded-md', md: 'size-8 rounded-lg', lg: 'size-12 rounded-xl' })[props.size])
const icon = computed(() => ({ sm: 'size-3.5', md: 'size-4', lg: 'size-6' })[props.size])
</script>

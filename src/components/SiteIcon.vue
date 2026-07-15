<template>
  <span class="grid shrink-0 place-items-center bg-surface-gray-2 text-ink-gray-6" :class="tile">
    <span class="lucide-globe" :class="icon" />
  </span>
</template>

<script setup>
import { computed } from 'vue'

// A site's avatar is a website icon — not the logo of whatever app happens to be
// installed first. One small component so every site reads the same. A soft
// gray tile (no outline); `lg` is the 40px card / site-header size.
const props = defineProps({ size: { type: String, default: 'md' } }) // sm | md | lg
const tile = computed(() => ({ sm: 'size-7 rounded-md', md: 'size-8 rounded-lg', lg: 'size-10 rounded-xl' })[props.size])
const icon = computed(() => ({ sm: 'size-3.5', md: 'size-4', lg: 'size-5' })[props.size])
</script>

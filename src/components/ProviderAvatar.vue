<template>
  <!-- Circular provider mark for map nodes and list rows. Uses the dedicated
       Provider=*.svg badge assets (self-contained circle + baked shadow);
       falls back to the ProviderIcon monogram if one is ever missing. -->
  <span class="block shrink-0 select-none" :style="{ width: `${size}px`, height: `${size}px` }">
    <img v-if="src" :src="src" :alt="provider.name" class="size-full" draggable="false" />
    <ProviderIcon v-else :provider="provider" :size="size" class="rounded-full" />
  </span>
</template>

<script setup>
import { computed } from 'vue'
import ProviderIcon from './ProviderIcon.vue'

const props = defineProps({
  provider: { type: Object, required: true },
  size: { type: Number, default: 32 },
})

const BADGE_NAME = { aws: 'AWS', digitalocean: 'DO', frappe: 'Frappe', hetzner: 'Hetzner', oracle: 'OCI' }
const badges = import.meta.glob('../assets/providers/Provider=*.svg', { eager: true, import: 'default' })

const src = computed(() => badges[`../assets/providers/Provider=${BADGE_NAME[props.provider.id]}.svg`] || null)
</script>

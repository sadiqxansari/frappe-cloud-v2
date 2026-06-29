<template>
  <!-- Real provider logo when an asset exists at
       src/assets/providers/<provider.id>.(svg|png), else the monogram tile.
       Drop a file named by the provider id and it renders everywhere. -->
  <span
    class="grid shrink-0 place-items-center overflow-hidden"
    :class="logo ? '' : provider.tile"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <img v-if="logo" :src="logo" :alt="provider.name" class="size-full object-contain" />
    <span v-else class="font-bold leading-none" :style="{ fontSize: `${Math.round(size * 0.42)}px` }">
      {{ provider.mono }}
    </span>
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  provider: { type: Object, required: true },
  size: { type: Number, default: 24 },
})

// Eagerly glob any logo assets; key by filename stem (the provider id).
const logos = import.meta.glob('../assets/providers/*.{svg,png,webp}', {
  eager: true,
  import: 'default',
})

const logo = computed(() => {
  const entry = Object.entries(logos).find(
    ([path]) => path.split('/').pop().split('.')[0] === props.provider.id,
  )
  return entry ? entry[1] : null
})
</script>

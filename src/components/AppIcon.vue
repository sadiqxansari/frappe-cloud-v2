<template>
  <img v-if="logo" :src="logo" :alt="meta?.name || appKey" class="shrink-0" :class="imgClasses" />
  <div
    v-else
    class="grid shrink-0 place-items-center rounded-lg font-semibold"
    :class="[meta.tile, sizeClasses]"
  >
    {{ meta.letter }}
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { appByKey } from '../data/catalog'

// Real product marks, keyed by catalog app key (rounded squares with
// transparency, so no extra tile styling needed).
const logos = import.meta.glob('../assets/apps/*.png', { eager: true, import: 'default' })

const props = defineProps({
  appKey: { type: String, required: true },
  size: { type: String, default: 'md' }, // sm | md | lg | xl
})

// Unknown keys (e.g. apps installed from GitHub) fall back to a letter tile.
const meta = computed(
  () =>
    appByKey(props.appKey) || {
      name: props.appKey,
      letter: (props.appKey.replace(/^gh-/, '')[0] || '?').toUpperCase(),
      tile: 'bg-surface-gray-2 text-ink-gray-7',
    },
)
const logo = computed(() => logos[`../assets/apps/${props.appKey}.png`] || null)

const imgClasses = computed(
  () =>
    ({
      sm: 'size-5 rounded-md',
      md: 'size-8 rounded-lg',
      lg: 'size-12 rounded-xl',
      xl: 'size-16 rounded-2xl',
    })[props.size],
)

const sizeClasses = computed(
  () =>
    ({
      sm: 'size-5 text-xs rounded-md',
      md: 'size-8 text-sm',
      lg: 'size-12 text-lg rounded-xl',
      xl: 'size-16 text-2xl rounded-2xl',
    })[props.size],
)
</script>

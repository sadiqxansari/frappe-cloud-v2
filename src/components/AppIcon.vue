<template>
  <img v-if="logo" :src="logo" :alt="meta?.name || appKey" class="shrink-0" :class="imgClasses" />
  <div
    v-else
    class="grid shrink-0 place-items-center rounded-4 font-semibold"
    :class="[meta.tile || 'text-white', sizeClasses]"
    :style="meta.tile ? {} : { background: logoColor(appKey) }"
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
  size: { type: String, default: 'md' }, // sm | smd | md | lg | xl
})

// Unknown keys (e.g. apps installed from GitHub) fall back to a letter tile,
// colored by a hash of the key so each custom app still reads as distinct.
const COLORS = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed']
function logoColor(key) {
  let hash = 0
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return COLORS[Math.abs(hash) % COLORS.length]
}

const meta = computed(
  () =>
    appByKey(props.appKey) || {
      name: props.appKey,
      letter: (props.appKey.replace(/^gh-/, '')[0] || '?').toUpperCase(),
      tile: null,
    },
)
const logo = computed(() => logos[`../assets/apps/${props.appKey}.png`] || null)

const imgClasses = computed(
  () =>
    ({
      sm: 'size-5 rounded-3',
      smd: 'size-7 rounded-4',
      md: 'size-8 rounded-4',
      lg: 'size-12 rounded-4',
      xl: 'size-16 rounded-4',
    })[props.size],
)

const sizeClasses = computed(
  () =>
    ({
      sm: 'size-5 text-xs rounded-3',
      smd: 'size-7 text-sm rounded-4',
      md: 'size-8 text-sm rounded-4',
      lg: 'size-12 text-lg rounded-4',
      xl: 'size-16 text-2xl rounded-4',
    })[props.size],
)
</script>

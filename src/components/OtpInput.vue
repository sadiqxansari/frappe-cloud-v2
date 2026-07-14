<template>
  <div class="flex items-center justify-between gap-2" @paste="onPaste">
    <input
      v-for="(d, i) in digits"
      :key="i"
      :ref="(el) => (boxes[i] = el)"
      :value="d"
      type="text"
      inputmode="numeric"
      maxlength="1"
      autocomplete="one-time-code"
      class="h-12 w-full rounded-lg border border-outline-gray-3 bg-surface-base text-center text-lg font-semibold text-ink-gray-9 outline-none transition-colors focus:border-outline-gray-4 focus:ring-2 focus:ring-outline-gray-3"
      @input="onInput(i, $event)"
      @keydown="onKeydown(i, $event)"
      @focus="$event.target.select()"
    />
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'

const props = defineProps({
  length: { type: Number, default: 6 },
})
const model = defineModel({ type: String, default: '' })

const digits = ref(Array.from({ length: props.length }, () => ''))
const boxes = ref([])

onMounted(() => boxes.value[0]?.focus())

// Keep the boxes in sync if the parent resets the value (e.g. on resend).
watch(model, (v) => {
  if (v === digits.value.join('')) return
  const chars = (v || '').slice(0, props.length).split('')
  digits.value = Array.from({ length: props.length }, (_, i) => chars[i] || '')
})

function emit() {
  model.value = digits.value.join('')
}

function onInput(i, e) {
  const v = e.target.value.replace(/\D/g, '')
  digits.value[i] = v.slice(-1) || ''
  emit()
  if (v && i < props.length - 1) boxes.value[i + 1]?.focus()
}

function onKeydown(i, e) {
  if (e.key === 'Backspace' && !digits.value[i] && i > 0) {
    boxes.value[i - 1]?.focus()
  } else if (e.key === 'ArrowLeft' && i > 0) {
    boxes.value[i - 1]?.focus()
  } else if (e.key === 'ArrowRight' && i < props.length - 1) {
    boxes.value[i + 1]?.focus()
  }
}

function onPaste(e) {
  e.preventDefault()
  const text = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, props.length)
  if (!text) return
  digits.value = Array.from({ length: props.length }, (_, i) => text[i] || '')
  emit()
  boxes.value[Math.min(text.length, props.length - 1)]?.focus()
}
</script>

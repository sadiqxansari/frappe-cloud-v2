<template>
  <div class="flex min-h-screen flex-col bg-surface-gray-1">
    <header class="flex items-center justify-center gap-2 pb-4 pt-10">
      <img :src="cloudLogo" alt="Frappe Cloud" class="size-7 rounded-md" />
      <span class="text-base font-medium text-ink-gray-8">Frappe Cloud</span>
    </header>

    <main class="flex flex-1 items-start justify-center px-4 pb-20 pt-8">
      <div class="w-full max-w-md">
        <div class="mb-5 flex gap-1.5">
          <div
            v-for="i in steps"
            :key="i"
            class="h-1 flex-1 rounded-full"
            :class="i <= step ? 'bg-surface-gray-7' : 'bg-surface-gray-3'"
          />
        </div>

        <div class="rounded-xl border border-outline-gray-1 bg-surface-white p-8 shadow-sm">
          <slot />
        </div>

        <div class="mt-4 text-center">
          <slot name="below" />
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import cloudLogo from '../assets/apps/cloud.png'

defineProps({
  step: { type: Number, required: true },
  steps: { type: Number, default: 4 },
})
</script>

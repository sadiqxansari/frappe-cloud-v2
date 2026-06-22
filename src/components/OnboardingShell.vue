<template>
  <div class="flex min-h-screen flex-col bg-surface-elevation-1">
    <header class="flex items-center justify-center gap-2 pb-2 pt-10">
      <img :src="cloudLogo" alt="Frappe Cloud" class="size-7 rounded-md" />
      <span class="text-lg font-semibold text-ink-gray-8">Frappe Cloud</span>
    </header>

    <main class="flex flex-1 items-start justify-center px-4 pb-20 pt-6">
      <div class="w-full max-w-sm">
        <button
          v-if="back"
          class="mb-4 inline-flex items-center gap-1 text-sm text-ink-gray-5 transition-colors hover:text-ink-gray-8"
          @click="$router.push(back)"
        >
          <span class="lucide-arrow-left size-4" />
          Back
        </button>

        <div class="mb-5 flex gap-1.5">
          <div
            v-for="i in steps"
            :key="i"
            class="h-1 flex-1 rounded-full"
            :class="i <= step ? 'bg-surface-gray-7' : 'bg-surface-gray-3'"
          />
        </div>

        <div class="py-2">
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
  // Route to return to — renders a Back link (issue #5). Omit on the first step.
  back: { type: String, default: null },
})
</script>

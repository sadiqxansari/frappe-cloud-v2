<template>
  <div class="flex min-h-screen flex-col bg-surface-base">
    <main class="flex flex-1 items-start justify-center px-4 pb-20 pt-16">
      <div class="w-full max-w-sm">
        <!-- Brand centered over the stepper; Back is absolute so it never
             shifts the layout when it appears (only on later steps). The
             provisioning screen hides it — its header carries the logo instead. -->
        <div v-if="!hideBrand" class="relative mb-6 flex h-7 items-center justify-center">
          <button
            v-if="back"
            class="absolute left-0 inline-flex items-center gap-1 text-sm text-ink-gray-5 transition-colors hover:text-ink-gray-8"
            @click="$router.push(back)"
          >
            <span class="lucide-arrow-left size-4" />
            Back
          </button>
          <div class="flex items-center gap-2">
            <img :src="cloudLogo" alt="Frappe Cloud" class="size-6 rounded-md" />
            <span class="text-base font-semibold text-ink-gray-8">Frappe Cloud</span>
          </div>
        </div>

        <div v-if="!hideStepper" class="mb-5 flex gap-1.5">
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
  step: { type: Number, default: 0 },
  steps: { type: Number, default: 3 },
  // Provisioning runs after the 3-step flow, so it hides the stepper entirely.
  hideStepper: { type: Boolean, default: false },
  // Provisioning's own header carries the logo, so it hides the centered brand.
  hideBrand: { type: Boolean, default: false },
  // Route to return to — renders a Back link (issue #5). Omit on the first step.
  back: { type: String, default: null },
})
</script>

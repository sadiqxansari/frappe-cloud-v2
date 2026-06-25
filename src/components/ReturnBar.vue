<template>
  <!-- The always-visible exit for a round-trip. When the user was sent here
       from somewhere (the Desk, usually), this persistent bar lets them get
       back in one click — so they're never stranded in a shell we were
       sparing them. Shown only while a return context is set. -->
  <div
    v-if="store.returnContext"
    class="flex h-9 shrink-0 items-center border-b border-outline-gray-2 bg-surface-gray-2 px-4"
  >
    <button
      class="flex items-center gap-1.5 text-sm font-medium text-ink-gray-7 transition-colors hover:text-ink-gray-9"
      @click="back"
    >
      <span class="lucide-arrow-left size-4" />
      Back to {{ store.returnContext.label }}
    </button>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useCloudStore } from '../stores/cloud'

const store = useCloudStore()
const router = useRouter()

// Manual return — leave without completing whatever sent us here.
function back() {
  const ctx = store.returnContext
  store.clearReturnContext()
  router.push(ctx?.path || '/')
}
</script>

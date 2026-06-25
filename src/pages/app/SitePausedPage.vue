<template>
  <!-- The interceptor a suspended site serves on its own URL (decision 11): the
       Desk can't load when the site is paused, so this stands in its place with
       a calm, single path back — add credit → resume. Nothing is deleted. -->
  <div class="flex min-h-screen items-center justify-center bg-surface-gray-2 px-4 py-10">
    <div class="w-full max-w-md text-center">
      <div class="rounded-2xl border border-outline-gray-2 bg-surface-elevation-1 p-8 shadow-xl">
        <span class="mx-auto grid size-12 place-items-center rounded-full bg-surface-amber-2">
          <span class="lucide-pause size-6 text-ink-amber-8" />
        </span>
        <h1 class="mt-4 text-xl font-semibold text-ink-gray-9">{{ site?.subdomain || 'Your site' }} is paused</h1>
        <p class="mx-auto mt-2 max-w-sm text-p-base text-ink-gray-6">
          Your credit ran out, so we paused your site. Nothing is deleted — add credit and it's back in a few seconds, exactly as it was.
        </p>
        <Button
          class="mt-6"
          variant="solid"
          size="lg"
          label="Add credit to resume"
          icon-left="lucide-zap"
          @click="resume"
        />
        <p class="mt-3 text-p-xs text-ink-gray-5">You'll only be charged for what you use.</p>
      </div>
      <div class="mt-4 flex items-center justify-center gap-1.5 text-p-sm text-ink-gray-5">
        <img :src="cloudLogo" alt="" class="size-4 rounded" />
        Hosted on Frappe Cloud
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from 'frappe-ui'
import cloudLogo from '../../assets/apps/cloud.png'
import { useCloudStore } from '../../stores/cloud'

const store = useCloudStore()
const router = useRouter()

const site = computed(() => store.currentSite || store.server?.sites[0] || null)

// Resume = add credit, then come back to the Desk (which now loads). The gateway
// brings a suspended account back online on a successful payment.
function resume() {
  store.redirectWithReturn(router, '/pay', { label: site.value?.subdomain || 'your site', path: '/app' })
}
</script>

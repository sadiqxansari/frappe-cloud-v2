<template>
  <OnboardingShell :step="3" back="/setup/app">
    <h1 class="text-xl font-semibold text-ink-gray-9">You're almost there to running {{ appName }}</h1>

    <div class="mt-6 space-y-2.5 text-p-sm text-ink-gray-6">
      <div class="flex items-start gap-2">
        <span class="lucide-server mt-0.5 size-4 shrink-0 text-ink-gray-5" />
        <span>Hosted on your own server, on a basic plan.</span>
      </div>
      <div class="flex items-start gap-2">
        <span class="lucide-gift mt-0.5 size-4 shrink-0 text-ink-green-6" />
        <span>Free while your $25 credit lasts — no card needed.</span>
      </div>
      <div class="flex items-start gap-2">
        <span class="lucide-sliders-horizontal mt-0.5 size-4 shrink-0 text-ink-gray-5" />
        <span>Change plan anytime.</span>
      </div>
    </div>

    <Button variant="solid" size="md" label="Set up my server" class="mt-8 w-full" @click="confirm" />
  </OnboardingShell>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from 'frappe-ui'
import OnboardingShell from '../../components/OnboardingShell.vue'
import { appByKey } from '../../data/catalog'
import { useCloudStore } from '../../stores/cloud'

const store = useCloudStore()
const router = useRouter()

const appName = computed(() => appByKey(store.onboarding.appKey)?.name || 'your app')

// Plan stays Starter under the hood (store default); the copy just calls it a
// "basic plan" so the user never has to reason about tier names.
function confirm() {
  store.provisionServer()
  router.push('/setup/provisioning')
}
</script>

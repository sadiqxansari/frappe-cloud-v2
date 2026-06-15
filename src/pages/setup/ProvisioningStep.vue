<template>
  <OnboardingShell :step="4">
    <div class="flex flex-col items-center py-2 text-center">
      <div class="grid size-14 animate-pulse place-items-center rounded-xl bg-surface-gray-2">
        <span class="lucide-server size-7 text-ink-gray-7" />
      </div>
      <h1 class="mt-5 text-xl font-semibold text-ink-gray-9">Setting up your server</h1>
      <p class="mt-1.5 text-base text-ink-gray-6">This usually takes about 2 minutes.</p>

      <Progress :value="progress" size="md" class="mt-6 w-full" />

      <ul class="mt-6 w-full space-y-3 text-left">
        <li v-for="(s, i) in steps" :key="s" class="flex items-center gap-2.5 text-sm">
          <span v-if="i < stepIndex" class="lucide-circle-check size-5 text-ink-green-3" />
          <Spinner v-else-if="i === stepIndex" class="size-5 text-ink-gray-5" />
          <span v-else class="grid size-5 place-items-center">
            <span class="size-1.5 rounded-full bg-surface-gray-4" />
          </span>
          <span :class="i <= stepIndex ? 'text-ink-gray-8' : 'text-ink-gray-4'">{{ s }}</span>
        </li>
      </ul>

      <Button variant="ghost" size="sm" label="Skip the wait (demo)" class="mt-8" @click="finish" />
    </div>
  </OnboardingShell>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button, Progress, Spinner } from 'frappe-ui'
import OnboardingShell from '../../components/OnboardingShell.vue'
import { appByKey } from '../../data/catalog'
import { useCloudStore } from '../../stores/cloud'

const store = useCloudStore()
const router = useRouter()

const appName = appByKey(store.onboarding.appKey).name
const steps = ['Creating your server', `Installing ${appName}`, 'Creating your site']

const stepIndex = ref(0)
let timer = null

const progress = computed(() => Math.round((stepIndex.value / steps.length) * 100))

onMounted(() => {
  if (!store.server) {
    router.replace('/setup/account')
    return
  }
  if (store.server.status === 'active') {
    router.replace('/app')
    return
  }
  timer = setInterval(() => {
    stepIndex.value += 1
    if (stepIndex.value >= steps.length) finish()
  }, 1700)
})

onBeforeUnmount(() => clearInterval(timer))

// No "you're live" stop in between — the site itself is the payoff.
function finish() {
  clearInterval(timer)
  store.completeProvisioning()
  router.replace('/app')
}
</script>

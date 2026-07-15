<template>
  <MinimalAuthShell>
    <div v-if="region">
      <!-- The wait becomes a place: the dotted map zoomed in on the region, with
           a pinging dot that settles still when the site is up. -->
      <RegionMap :region="region" :label="`${region.name} · ${region.provider}`" :ready="ready" />

      <Transition name="status-swap" mode="out-in">
        <!-- Ready: the site is up; confirm, then hand off to the signed-in desk. -->
        <div v-if="ready" key="ready" class="mt-6">
          <h1 class="text-xl font-semibold text-ink-gray-8">{{ siteName }} is ready</h1>
          <p class="mt-1 text-p-sm text-ink-gray-5">
            Signing you in as <span class="font-medium text-ink-gray-7">Administrator</span>…
          </p>
          <div class="mt-6 flex items-center gap-2 text-p-base text-ink-gray-7">
            <span class="lucide-loader-circle size-4 shrink-0 animate-spin text-ink-gray-5" aria-hidden="true" />
            <span>Taking you to your site…</span>
          </div>
        </div>

        <!-- Provisioning: a calm determinate bar with a phase-aware status line.
             Hand-rolled (not frappe-ui Progress) so the fill can ease between
             creep ticks — the width transition outlasts the update interval,
             reading as one continuous glide. See frappe/frappe-ui#838. -->
        <div v-else key="provisioning" class="mt-6">
          <div class="h-2 w-full overflow-hidden rounded-full bg-surface-gray-2">
            <div
              class="h-full rounded-full bg-surface-gray-10 transition-[width] duration-700 ease-out"
              :style="{ width: `${progressValue}%` }"
            />
          </div>
          <div class="mt-5 flex items-center gap-2 text-p-base text-ink-gray-7">
            <span class="lucide-info size-4 shrink-0 text-ink-gray-5" aria-hidden="true" />
            <Transition name="status-swap" mode="out-in">
              <span :key="phase">{{ statusLine }}</span>
            </Transition>
          </div>
        </div>
      </Transition>
    </div>
  </MinimalAuthShell>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MinimalAuthShell from '../../components/MinimalAuthShell.vue'
import RegionMap from '../../components/RegionMap.vue'
import { appByKey, isFrappeApp, regionById } from '../../data/catalog'
import { useCloudStore } from '../../stores/cloud'

const route = useRoute()
const router = useRouter()
const store = useCloudStore()

const product = computed(() => (route.query.product ? String(route.query.product) : ''))
const app = computed(() => (product.value && isFrappeApp(product.value) ? appByKey(product.value) : null))

const server = computed(() => store.server)
const region = computed(() => (server.value ? regionById(server.value.regionId) : null))
// "Mumbai, India" → "Mumbai" for the status line; the badge keeps the full name.
const city = computed(() => (region.value ? region.value.name.split(',')[0] : ''))
const siteName = computed(() => store.onboarding.subdomain || 'Your site')

// Phases advance on timers (mock has no real backend to poll): server → site →
// install → ready. The pin stays neutral+pulsing until the site is live.
const phase = ref('server')
const ready = ref(false)
const progressValue = ref(6)

const statusLine = computed(() => {
  if (phase.value === 'server') return `Setting up your private server in ${city.value}…`
  if (phase.value === 'site') return `Creating ${siteName.value} on it…`
  return app.value ? `Installing ${app.value.name}…` : 'Putting on the finishing touches…'
})

// Progress creeps toward a target per phase, so the bar always feels alive.
const TARGETS = { server: 45, site: 78, install: 94 }
let creepTimer = null
const phaseTimers = []

function creep() {
  const target = TARGETS[phase.value] ?? 94
  if (progressValue.value < target) {
    progressValue.value = Math.min(target, progressValue.value + (target - progressValue.value) * 0.15 + 0.4)
  }
}

onMounted(() => {
  if (!store.server) {
    router.replace('/signup')
    return
  }
  if (store.server.status === 'active') {
    router.replace('/app')
    return
  }
  creepTimer = setInterval(creep, 300)
  phaseTimers.push(setTimeout(() => (phase.value = 'site'), 2400))
  phaseTimers.push(setTimeout(() => (phase.value = 'install'), 4800))
  phaseTimers.push(setTimeout(finish, 7200))
})

onBeforeUnmount(() => {
  clearInterval(creepTimer)
  phaseTimers.forEach(clearTimeout)
})

// Site is up: fill the bar, create the site + install the app, hold on the
// "ready" beat, then hand the tenant off to their signed-in desk.
function finish() {
  clearInterval(creepTimer)
  progressValue.value = 100
  store.completeProvisioning()
  ready.value = true
  phaseTimers.push(setTimeout(() => router.replace('/app'), 1500))
}
</script>

<style scoped>
.status-swap-enter-active {
  transition:
    opacity 200ms cubic-bezier(0.23, 1, 0.32, 1),
    transform 200ms cubic-bezier(0.23, 1, 0.32, 1);
}
.status-swap-leave-active {
  transition: opacity 150ms ease;
}
.status-swap-enter-from {
  opacity: 0;
  transform: translateY(4px);
}
.status-swap-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .status-swap-enter-active,
  .status-swap-leave-active {
    transition: opacity 150ms ease;
  }
  .status-swap-enter-from,
  .status-swap-leave-to {
    transform: none;
  }
}
</style>

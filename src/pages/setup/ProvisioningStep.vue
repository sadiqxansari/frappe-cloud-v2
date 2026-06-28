<template>
  <OnboardingShell hide-stepper hide-brand>
    <div v-if="region" class="flex flex-col py-2">
      <!-- Header: the cloud logo, then the title, with the estimate as subtext. -->
      <div class="flex items-center gap-3">
        <img :src="cloudLogo" alt="Frappe Cloud" class="size-10 shrink-0 rounded-xl" />
        <div class="min-w-0">
          <h1 class="text-lg font-semibold text-ink-gray-9">
            {{ live ? `Your server is live in ${city}` : `Setting up your server in ${city}` }}
          </h1>
          <p class="mt-1 text-p-sm text-ink-gray-5">
            {{ live ? 'Opening your site…' : 'Usually takes about 2 mins' }}
          </p>
        </div>
      </div>

      <!-- The wait becomes a place: the dotted map zoomed into the region, with a
           pulsing pin that turns green when the server is live, and a badge that
           names exactly where it's being born. -->
      <div class="relative mt-5 h-48 w-full overflow-hidden rounded-xl bg-surface-gray-1 ring-1 ring-outline-gray-2">
        <WorldMap :pins="pins" :focus="region.id" :scale="1.4" :pin-scale="3.5" class="h-full w-full" />
        <div class="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[calc(100%+18px)]">
          <span class="inline-flex items-center whitespace-nowrap rounded-full bg-surface-gray-2 px-2.5 py-1 text-xs font-medium text-ink-gray-8 shadow-sm ring-1 ring-outline-gray-2">
            {{ region.name }} · {{ region.provider }}
          </span>
        </div>
      </div>

      <!-- A normal determinate bar carries the progress — calm and familiar. -->
      <Progress :value="progressValue" size="lg" class="mt-5 w-full" />

      <!-- A rotating tip turns the wait into a head start. Hidden during the live
           beat so the screen settles before the site opens. -->
      <template v-if="!live">
        <div class="mt-4 flex min-h-[2.5rem] items-start gap-2">
          <svg viewBox="0 0 16 16" fill="none" class="mt-0.5 size-4 shrink-0 text-ink-gray-5" aria-hidden="true">
            <path :d="infoIcon" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" />
          </svg>
          <Transition name="tip" mode="out-in">
            <p :key="tipIndex" class="text-p-sm text-ink-gray-6">{{ tips[tipIndex] }}</p>
          </Transition>
        </div>

        <Button variant="ghost" size="sm" label="Skip the wait (demo)" class="-ml-2 mt-3 self-start" @click="finish" />
      </template>
    </div>
  </OnboardingShell>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button, Progress } from 'frappe-ui'
import OnboardingShell from '../../components/OnboardingShell.vue'
import WorldMap from '../../components/WorldMap.vue'
import cloudLogo from '../../assets/apps/cloud.png'
import { regionById } from '../../data/catalog'
import { useCloudStore } from '../../stores/cloud'

const store = useCloudStore()
const router = useRouter()

const server = computed(() => store.server)
const region = computed(() => (server.value ? regionById(server.value.regionId) : null))
// "Mumbai, India" → "Mumbai" for the headline; the caption keeps the full name.
const city = computed(() => (region.value ? region.value.name.split(',')[0] : ''))
// Driven by the store: completeProvisioning() flips status to 'active', which
// turns the pin green and swaps the copy — no separate "you're live" screen.
const live = computed(() => server.value?.status === 'active')

const pins = computed(() => {
  if (!region.value) return []
  return [
    {
      id: server.value.id,
      lat: region.value.lat,
      lng: region.value.lng,
      status: server.value.status, // 'provisioning' → amber, 'active' → green
      pulse: true, // breathing halo so the hero pin reads as alive
    },
  ]
})

// True, useful things a new account should know — one at a time.
const tips = [
  'Install apps from the Marketplace in a few clicks.',
  'Run multiple sites and apps on a single server.',
  'Add your own domain anytime — SSL is issued and renewed for you.',
  'Daily backups run automatically — restore your site to any point.',
  'Download a full copy of your site anytime — your data is always yours.',
]
// The filled info glyph from Alert (blue theme), shown here in gray.
const infoIcon =
  'M8 1C11.866 1 15 4.13401 15 8C15 11.866 11.866 15 8 15C4.13401 15 1 11.866 1 8C1 4.13401 4.13401 1 8 1ZM8 6.93652C7.72386 6.93652 7.5 7.16038 7.5 7.43652V11.1436C7.50005 11.4197 7.72389 11.6436 8 11.6436C8.27611 11.6436 8.49995 11.4197 8.5 11.1436V7.43652C8.5 7.16038 8.27614 6.93652 8 6.93652ZM8 4C7.51675 4 7.125 4.39175 7.125 4.875C7.125 5.35825 7.51675 5.75 8 5.75C8.48325 5.75 8.875 5.35825 8.875 4.875C8.875 4.39175 8.48325 4 8 4Z'
const tipIndex = ref(0)
const progressValue = ref(0)

let provisionTimer = null
let tipTimer = null
let progressTimer = null
let openTimer = null

onMounted(() => {
  if (!store.server) {
    router.replace('/setup/account')
    return
  }
  if (store.server.status === 'active') {
    router.replace('/app')
    return
  }
  // Fill steadily toward ~96% over the ~30s wait — never hit 100 until it's done.
  progressTimer = setInterval(() => {
    progressValue.value = Math.min(96, progressValue.value + 0.64)
  }, 200)
  tipTimer = setInterval(() => {
    tipIndex.value = (tipIndex.value + 1) % tips.length
  }, 4500)
  // Mockup: hold on this screen ~30s so the map + tips are actually visible.
  provisionTimer = setTimeout(finish, 30000)
})

onBeforeUnmount(() => {
  clearInterval(progressTimer)
  clearInterval(tipTimer)
  clearTimeout(provisionTimer)
  clearTimeout(openTimer)
})

// Finish the bar, flip the pin green, then hold ~1s on the "live" beat before
// opening the site — a small aha before the real payoff.
function finish() {
  clearInterval(progressTimer)
  clearInterval(tipTimer)
  clearTimeout(provisionTimer)
  progressValue.value = 100
  store.completeProvisioning()
  openTimer = setTimeout(() => router.replace('/app'), 1100)
}
</script>

<style scoped>
/* Tip swap: old slides up, new rises from below; blur masks the crossfade so the
   eye reads one moving line instead of two overlapping ones. */
.tip-enter-active,
.tip-leave-active {
  transition:
    opacity 320ms cubic-bezier(0.23, 1, 0.32, 1),
    transform 320ms cubic-bezier(0.23, 1, 0.32, 1),
    filter 320ms cubic-bezier(0.23, 1, 0.32, 1);
}
.tip-enter-from {
  opacity: 0;
  transform: translateY(6px);
  filter: blur(3px);
}
.tip-leave-to {
  opacity: 0;
  transform: translateY(-6px);
  filter: blur(3px);
}

/* Reduced motion: keep the meaning (fade), drop the movement. */
@media (prefers-reduced-motion: reduce) {
  .tip-enter-active,
  .tip-leave-active {
    transition: opacity 200ms ease;
  }
  .tip-enter-from,
  .tip-leave-to {
    transform: none;
    filter: none;
  }
}
</style>

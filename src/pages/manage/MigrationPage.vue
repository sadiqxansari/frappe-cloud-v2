<template>
  <div v-if="server && server.migration" class="flex h-screen overflow-hidden bg-surface-elevation-1">
    <!-- Left: details -->
    <section class="flex w-[42rem] shrink-0 flex-col overflow-y-auto border-r border-outline-alpha-gray-1">
      <div class="p-6">
        <!-- Header with inline controls -->
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 text-sm text-ink-gray-5">
              <span class="size-1.5 shrink-0 rounded-full bg-[var(--ink-amber-7)]" />
              <span class="truncate">{{ server.name }}</span>
            </div>
            <h1 class="mt-1 text-xl font-semibold text-ink-gray-9">
              {{ isPaused ? 'Plan change paused' : 'Changing your server plan' }}
            </h1>
            <p class="mt-0.5 text-p-sm text-ink-gray-5">
              {{ fromRegion?.name }} ({{ fromProvider?.short }}) → {{ toRegion?.name }} ({{ toProvider?.short }})
            </p>
          </div>
          <div class="flex shrink-0 gap-2 pt-1">
            <Button
              :label="isPaused ? 'Resume' : 'Pause'"
              :icon-left="isPaused ? 'lucide-play' : 'lucide-pause'"
              variant="subtle"
              size="sm"
              @click="togglePause"
            />
            <Button
              label="Stop"
              icon-left="lucide-square"
              variant="subtle"
              size="sm"
              theme="red"
              @click="stopMigration"
            />
          </div>
        </div>

        <!-- Connected stepper -->
        <ol class="mt-6 space-y-0">
          <li
            v-for="(step, i) in migrationSteps"
            :key="i"
            class="relative flex items-start gap-3 pb-5 last:pb-0"
          >
            <div
              v-if="i < migrationSteps.length - 1"
              class="absolute left-[0.6rem] top-6 bottom-0 w-px"
              :class="completedSteps > i ? 'bg-[var(--ink-green-7)]' : 'bg-outline-gray-3'"
            />
            <span
              class="relative z-10 grid size-5 shrink-0 place-items-center rounded-full text-xs font-semibold transition-colors duration-300"
              :class="stepCircleClass(i)"
            >
              <span v-if="completedSteps > i" class="lucide-check size-3" />
              <span
                v-else-if="completedSteps === i"
                class="size-2.5 animate-spin rounded-full border-2 border-current border-t-transparent"
              />
              <template v-else>{{ i + 1 }}</template>
            </span>
            <span
              class="pt-0.5 text-sm transition-colors duration-300"
              :class="completedSteps > i ? 'text-ink-gray-7' : completedSteps === i ? 'text-ink-gray-7' : 'text-ink-gray-4'"
            >
              <span :class="completedSteps > i ? 'font-semibold text-ink-gray-8' : completedSteps === i ? 'font-semibold text-ink-gray-8' : 'font-semibold text-ink-gray-4'">{{ step.title }}</span>
              <span> — {{ step.text }}</span>
            </span>
          </li>
        </ol>
      </div>
    </section>

    <!-- Right: map -->
    <section class="relative min-w-0 flex-1 p-4">
      <div class="relative h-full w-full overflow-hidden rounded-xl border border-outline-gray-2 bg-surface-gray-1">
        <WorldMap
          :pins="mapPins"
          :connections="mapConnections"
          :highlight="hoverId"
          :pin-scale="1.5"
          dark
          fit
          :fit-padding="60"
          class="h-full w-full"
          @hover="hoverId = $event"
        />
        <!-- Region labels -->
        <div class="absolute bottom-4 left-4 right-4 flex justify-between">
          <div class="rounded-lg border border-outline-gray-2 bg-surface-elevation-1/90 px-3 py-1.5 backdrop-blur-sm">
            <p class="text-p-xs text-ink-gray-5">From</p>
            <p class="text-p-sm font-medium text-ink-gray-9">{{ fromRegion?.name }}</p>
          </div>
          <div class="rounded-lg border border-outline-gray-2 bg-surface-elevation-1/90 px-3 py-1.5 backdrop-blur-sm">
            <p class="text-p-xs text-ink-gray-5">To</p>
            <p class="text-p-sm font-medium text-ink-gray-9">{{ toRegion?.name }}</p>
          </div>
        </div>
      </div>
    </section>
  </div>

  <!-- Loading / not ready state — shown only briefly before migration seeds -->
  <div v-else class="flex h-screen items-center justify-center bg-surface-elevation-1">
    <div class="size-6 animate-spin rounded-full border-2 border-outline-gray-3 border-t-ink-gray-6" />
  </div>
</template>

<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button, toast } from 'frappe-ui'
import WorldMap from '../../components/WorldMap.vue'
import { providerById, regionById } from '../../data/catalog'
import { useCloudStore } from '../../stores/cloud'

const store = useCloudStore()
const route = useRoute()
const router = useRouter()

// Seed the grown scenario in a fresh tab — the uid() counter starts at 1000
// in every new JS context, so server IDs match between tabs deterministically.
if (!store.allServers.length) {
  store.loadScenario('grown')
}

const toRegionId = route.query.to
const toPlanId = route.query.plan
const server = computed(() => store.findServer(route.params.serverId))

// The migration normally starts in Central before we navigate here, persists to
// localStorage, and main.js's resumeMigrations() re-arms its timer when this tab
// boots — so we only display, never restart. Seed from URL params only as a
// fallback when no migration exists yet (e.g. a direct deep-link), and never when
// one is already in flight, so reopening this screen can't reset progress to 0.
if (server.value && toRegionId && !server.value.migration) {
  store.migrateServer(server.value.id, { regionId: toRegionId, planId: toPlanId })
}

const hoverId = ref(null)

const fromRegion = computed(() => server.value?.migration ? regionById(server.value.migration.fromRegionId) : null)
const toRegion = computed(() => server.value?.migration ? regionById(server.value.migration.toRegionId) : null)
const fromProvider = computed(() => fromRegion.value ? providerById(fromRegion.value.providerId) : null)
const toProvider = computed(() => toRegion.value ? providerById(toRegion.value.providerId) : null)

const completedSteps = computed(() => server.value?.migration?.completedSteps ?? 0)
const isPaused = computed(() => server.value?.migration?.paused ?? false)

const progressPct = computed(() => Math.round((completedSteps.value / 3) * 100))

const migrationSteps = computed(() => {
  const n = server.value?.sites?.length || 0
  const toR = toRegion.value?.name || '…'
  const fromR = fromRegion.value?.name || '…'
  return [
    { title: 'Provision', text: `Creating a new server in ${toR}.` },
    {
      title: 'Transfer',
      text: n
        ? `Moving ${n} site${n === 1 ? '' : 's'} across — same domain names and URLs.`
        : 'Transferring configuration to the new server.',
    },
    { title: 'Retire', text: `Retiring the old server in ${fromR}.` },
  ]
})

function stepCircleClass(i) {
  if (completedSteps.value > i) return 'bg-surface-green-2 text-ink-green-6'
  if (completedSteps.value === i) return 'bg-surface-gray-3 ring-1 ring-outline-gray-3 text-ink-gray-8'
  return 'bg-surface-gray-2 text-ink-gray-4'
}

const mapPins = computed(() => {
  if (!fromRegion.value || !toRegion.value) return []
  return [
    { id: fromRegion.value.id, lat: fromRegion.value.lat, lng: fromRegion.value.lng, status: 'active' },
    { id: toRegion.value.id, lat: toRegion.value.lat, lng: toRegion.value.lng, status: null, selected: true },
  ]
})

const mapConnections = computed(() => {
  if (!fromRegion.value || !toRegion.value || fromRegion.value.id === toRegion.value.id) return []
  return [{ fromId: fromRegion.value.id, toId: toRegion.value.id, progress: completedSteps.value / 3, lineColor: 'var(--ink-gray-7)' }]
})

function togglePause() {
  if (!server.value) return
  if (isPaused.value) {
    store.resumeMigration(server.value.id)
  } else {
    store.pauseMigration(server.value.id)
  }
}

function stopMigration() {
  if (!server.value) return
  store.cancelMigration(server.value.id)
  toast.success('Migration stopped')
  window.close()
}

// When _completeMigration fires, status transitions from 'migrating' → 'active'
// in the same synchronous call that clears server.migration. Watch status so
// the redirect fires before the "no migration" fallback ever renders.
watch(
  () => server.value?.status,
  (status, prev) => {
    if (prev === 'migrating' && status === 'active' && server.value) {
      toast.success('Server plan changed')
      router.push(`/manage/${server.value.id}`)
    }
  },
)
</script>

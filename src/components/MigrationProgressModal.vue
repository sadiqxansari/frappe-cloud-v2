<template>
  <Dialog v-model:open="open" :title="isPaused ? 'Migration paused' : `Migrating ${server?.name} server`" size="2xl">
    <div v-if="server?.migration">
      <!-- Same map hero as the Migrate review step; the line fills as steps complete. -->
      <MigrationMapCard
        v-if="fromRegion && toRegion && fromProvider && toProvider"
        class="mt-1"
        height-class="h-56"
        :from-region="fromRegion"
        :to-region="toRegion"
        :from-provider="fromProvider"
        :to-provider="toProvider"
        :from-plan="fromPlan"
        :to-plan="toPlan"
        :progress="completedSteps / 3"
      />

      <!-- Migration steps — horizontal tracker -->
      <ol class="mt-6 flex items-start">
        <li
          v-for="(step, i) in migrationSteps"
          :key="i"
          class="relative flex flex-1 flex-col items-center px-2 text-center"
        >
          <div
            v-if="i < migrationSteps.length - 1"
            class="absolute left-1/2 top-[10px] h-0.5 w-full overflow-hidden rounded-full bg-outline-gray-2"
          >
            <!-- Green draws across (scaleX) with a strong ease-out when the step lands. -->
            <div
              class="h-full w-full origin-left bg-[var(--ink-green-7)] transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
              :class="completedSteps > i ? 'scale-x-100' : 'scale-x-0'"
            />
          </div>
          <div
            class="relative z-10 grid size-[22px] shrink-0 place-items-center rounded-full transition-colors duration-300"
            :class="stepCircleClass(i)"
          >
            <span v-if="completedSteps > i" class="lucide-check size-3.5" />
            <Spinner v-else-if="completedSteps === i && !isPaused" class="size-3" />
            <span v-else class="text-xs font-medium">{{ i + 1 }}</span>
          </div>
          <div class="mt-2 text-sm font-medium" :class="completedSteps >= i ? 'text-ink-gray-8' : 'text-ink-gray-4'">{{ step.title }}</div>
          <div class="mt-0.5 text-p-xs" :class="completedSteps >= i ? 'text-ink-gray-5' : 'text-ink-gray-4'">{{ step.caption }}</div>
        </li>
      </ol>
    </div>

    <template #actions>
      <div class="flex w-full items-center justify-between gap-2">
        <Button
          :label="isPaused ? 'Resume' : 'Pause'"
          :icon-left="isPaused ? 'lucide-play' : 'lucide-pause'"
          variant="subtle"
          @click="togglePause"
        />
        <div class="flex gap-2">
          <Button label="Stop" icon-left="lucide-square" variant="ghost" theme="red" @click="stopMigration" />
          <Button label="Close" variant="subtle" @click="open = false" />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { computed, watch } from 'vue'
import { Button, Dialog, Spinner, toast } from 'frappe-ui'
import MigrationMapCard from './MigrationMapCard.vue'
import { planById, providerById, regionById } from '../data/catalog'
import { useCloudStore } from '../stores/cloud'

const props = defineProps({
  server: { type: Object, default: null },
})

const open = defineModel('open', { type: Boolean, default: false })

const store = useCloudStore()

const fromRegion = computed(() => (props.server?.migration ? regionById(props.server.migration.fromRegionId) : null))
const toRegion = computed(() => (props.server?.migration ? regionById(props.server.migration.toRegionId) : null))
const fromProvider = computed(() => (fromRegion.value ? providerById(fromRegion.value.providerId) : null))
const toProvider = computed(() => (toRegion.value ? providerById(toRegion.value.providerId) : null))
const fromPlan = computed(() => planById(props.server?.migration?.fromPlanId)?.name || '')
const toPlan = computed(() => planById(props.server?.migration?.toPlanId)?.name || '')

const completedSteps = computed(() => props.server?.migration?.completedSteps ?? 0)
const isPaused = computed(() => props.server?.migration?.paused ?? false)

const migrationSteps = computed(() => {
  const n = props.server?.sites?.length || 0
  return [
    { title: 'Provision', caption: 'Creating new server' },
    { title: 'Transfer', caption: n ? `Moving ${n} site${n === 1 ? '' : 's'}` : 'Moving config' },
    { title: 'Retire', caption: 'Retiring old server' },
  ]
})

function stepCircleClass(i) {
  if (completedSteps.value > i) return 'bg-surface-green-2 text-ink-green-6'
  if (completedSteps.value === i) return 'bg-surface-gray-3 ring-1 ring-outline-gray-3 text-ink-gray-8'
  return 'bg-surface-gray-2 text-ink-gray-4'
}

function togglePause() {
  if (!props.server) return
  if (isPaused.value) store.resumeMigration(props.server.id)
  else store.pauseMigration(props.server.id)
}

function stopMigration() {
  if (!props.server) return
  store.cancelMigration(props.server.id)
  open.value = false
  toast.success('Migration stopped')
}

// The store drives the migration on a wall-clock timer in this same tab, so the
// modal only ever displays. When it finishes, status flips migrating → active and
// server.migration clears — close and confirm rather than leave a stale panel open.
watch(
  () => props.server?.status,
  (status, prev) => {
    if (prev === 'migrating' && status === 'active') {
      open.value = false
      toast.success('Migration complete')
    }
  },
)
</script>

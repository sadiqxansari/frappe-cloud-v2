<template>
  <div>
    <!-- The verdict comes first; numbers only on request. -->
    <button class="flex w-full items-center gap-2.5 text-left" @click="expanded = !expanded">
      <span
        class="size-4 shrink-0"
        :class="health.ok ? 'lucide-circle-check text-ink-green-3' : 'lucide-triangle-alert text-ink-amber-3'"
      />
      <span class="flex-1 text-sm font-medium text-ink-gray-8">
        {{ health.ok ? 'Everything looks healthy' : 'Running a little hot' }}
        <span class="ml-1 font-normal text-ink-gray-5">
          {{ health.ok ? 'CPU, memory and disk are all comfortable.' : 'Worth a look — or a resize.' }}
        </span>
      </span>
      <span
        class="size-4 shrink-0 text-ink-gray-5 transition-transform"
        :class="['lucide-chevron-down', expanded && 'rotate-180']"
      />
    </button>

    <div v-if="expanded" class="mt-4 space-y-4">
      <div v-for="row in rows" :key="row.label">
        <div class="flex justify-between text-sm">
          <span class="text-ink-gray-6">{{ row.label }}</span>
          <span class="font-medium tabular-nums text-ink-gray-8">{{ row.value }}</span>
        </div>
        <Progress :value="row.pct" size="sm" class="mt-2" />
      </div>
      <div class="flex items-center justify-between">
        <p class="text-sm text-ink-gray-5">Backups don't count against your storage.</p>
        <Button variant="subtle" size="sm" label="Resize server" icon-left="lucide-scaling" @click="$emit('resize')" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Button, Progress } from 'frappe-ui'
import { useCloudStore } from '../stores/cloud'

const props = defineProps({
  server: { type: Object, required: true },
})

defineEmits(['resize'])

const store = useCloudStore()
const expanded = ref(false)

const health = computed(() => store.healthOf(props.server))

const rows = computed(() => [
  { label: 'CPU', value: `${health.value.cpuPct}%`, pct: health.value.cpuPct },
  {
    label: 'Memory',
    value: `${health.value.memUsed} GB of ${health.value.memTotal} GB`,
    pct: health.value.memPct,
  },
  {
    label: 'Disk',
    value: `${health.value.diskUsed} GB of ${health.value.diskTotal} GB`,
    pct: health.value.diskPct,
  },
])
</script>

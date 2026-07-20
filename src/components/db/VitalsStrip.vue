<template>
  <!-- Triage status line, borrowed from the top-of-terminal vitals a DBA reads
       in htop / SHOW PROCESSLIST: the whole server's health in one glance before
       drilling into any panel. Each stat is a button that opens its accordion, so
       "3 slow queries" is one click from the slow-query list. -->
  <div class="grid items-start gap-6" :style="{ gridTemplateColumns: `repeat(${vitals.length}, 1fr)` }">
    <button
      v-for="v in vitals"
      :key="v.key"
      type="button"
      class="group flex min-w-0 items-start gap-3 text-left"
      @click="emit('focus', v.key)"
    >
      <!-- No card chrome — these float as read-outs, not boxed sections. Box is
           still deliberately smaller than the value + label stack beside it, a
           supporting glyph rather than a competing focal point. Tinted by
           severity so a red/amber box reads as urgent before the numbers register. -->
      <span class="grid size-10 shrink-0 place-items-center rounded-md" :class="boxClass(v.tone)">
        <span :class="[v.icon, iconClass(v.tone)]" class="size-4" />
      </span>
      <span class="flex min-w-0 flex-col gap-1">
        <!-- The value stays plain gray — tone is carried by the icon/box, not
             by tinting numbers, so the strip reads as data first. -->
        <span class="text-lg font-semibold tabular-nums text-ink-gray-9">{{ v.value }}</span>
        <!-- Hover affordance is just the label darkening, not a card fill or
             an icon, so the strip stays a row of read-outs, not buttons. -->
        <span class="truncate text-p-base text-ink-gray-5 transition-colors group-hover-hover:text-ink-gray-7">{{ v.label }}</span>
      </span>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'

// Severity is the only color language on this page: gray = nominal, amber =
// attention, red = active harm. Kept here so every value and the accordion
// underneath map the same way.
const props = defineProps({
  connections: { type: Number, required: true },
  blocked: { type: Number, required: true },
  slow: { type: Number, required: true },
  binlogGb: { type: Number, required: true },
  edgeBroken: { type: Boolean, default: false },
})
const emit = defineEmits(['focus'])

const iconClass = (tone) =>
  ({
    red: 'text-ink-red-6',
    amber: 'text-ink-amber-7',
    gray: 'text-ink-gray-5',
  })[tone]
const boxClass = (tone) =>
  ({
    red: 'bg-surface-red-1',
    amber: 'bg-surface-amber-1',
    gray: 'bg-surface-gray-1',
  })[tone]

const vitals = computed(() => [
  {
    key: 'processes',
    icon: 'lucide-activity',
    label: props.edgeBroken ? 'Connections · unavailable' : `Connection${props.connections === 1 ? '' : 's'}`,
    value: props.edgeBroken ? '—' : props.connections,
    tone: props.edgeBroken ? 'red' : 'gray',
  },
  {
    key: 'locks',
    icon: 'lucide-lock',
    label: 'Blocked',
    value: props.blocked,
    tone: props.blocked ? 'red' : 'gray',
  },
  {
    key: 'slow',
    icon: 'lucide-timer',
    label: 'Slow · 24h',
    value: props.slow,
    tone: props.slow ? 'amber' : 'gray',
  },
  {
    key: 'binlogs',
    icon: 'lucide-scroll-text',
    label: 'Binary logs',
    value: `${props.binlogGb} GB`,
    tone: 'gray',
  },
])
</script>

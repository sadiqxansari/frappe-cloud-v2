<template>
  <Dialog v-model:open="open" :options="{ size: 'xl', bare: true }">
    <template #default>
      <div v-if="server" class="flex max-h-[80vh] flex-col">
        <!-- Header — what this server is, at a glance -->
        <div class="flex items-start gap-3 px-5 pt-5">
          <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--ink-gray-9)] text-ink-base">
            <span class="lucide-server size-5" />
          </span>
          <div class="min-w-0 flex-1">
            <h2 class="truncate text-lg font-semibold text-ink-gray-9">{{ server.name }}</h2>
            <p class="mt-0.5 flex items-center gap-1.5 text-p-sm text-ink-gray-5">
              <span>{{ region.flag }} {{ region.name }}</span>
              <span class="text-ink-gray-4">·</span>
              <span>{{ provider.name }}</span>
            </p>
          </div>
          <!-- Dialog provides its own close button (top-right); leave room for it. -->
          <Badge :theme="statusBadge.theme" variant="subtle" :label="statusBadge.label" class="mr-7 mt-0.5 shrink-0" />
        </div>

        <div class="mt-5 flex-1 overflow-y-auto px-5 pb-1">
          <!-- Server -->
          <Section title="Server">
            <Row label="Plan" :value="plan.name" />
            <Row label="Frappe version" :value="versionLabel" />
            <Row label="Created" :value="created" />
            <Row label="Server ID" :value="server.id" copyable />
          </Section>

          <!-- Storage — the one number with a shape to it -->
          <Section title="Storage">
            <div class="py-2">
              <div class="flex items-baseline justify-between">
                <span class="text-sm text-ink-gray-5">Disk</span>
                <span class="text-sm font-medium tabular-nums text-ink-gray-8">{{ usedGb }} GB of {{ totalGb }} GB</span>
              </div>
              <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-gray-3">
                <div class="h-full rounded-full" :class="diskBarColor" :style="{ width: diskPct + '%' }" />
              </div>
            </div>
          </Section>

          <!-- Runtime versions — read-only facts, copyable for support tickets -->
          <Section title="Runtime">
            <Row v-for="r in runtime" :key="r.label" :label="r.label" :value="r.value" copyable />
          </Section>

          <!-- Services — what's running right now -->
          <Section title="Services">
            <div v-for="p in services" :key="p.name" class="flex items-center gap-3 py-2">
              <span class="size-2 shrink-0 rounded-full" :class="p.status === 'running' ? 'bg-[var(--ink-green-7)]' : 'bg-surface-gray-5'" />
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-medium text-ink-gray-8">{{ p.desc }}</div>
                <div class="truncate font-mono text-xs text-ink-gray-5">{{ p.name }}</div>
              </div>
              <span class="w-16 shrink-0 text-right text-xs tabular-nums text-ink-gray-5">{{ p.cpu }} CPU</span>
              <span class="w-16 shrink-0 text-right text-xs tabular-nums text-ink-gray-5">{{ p.memory }}</span>
            </div>
          </Section>
        </div>

        <!-- Footer — say who owns these, and where to actually change them -->
        <p class="border-t border-outline-alpha-gray-1 px-5 py-3 text-p-xs text-ink-gray-5">
          Frappe Cloud keeps these tuned for you, so there's nothing to set here. To move to a newer
          Frappe version, go to <span class="font-medium text-ink-gray-7">Settings → Change version</span>;
          for more disk, change your plan.
        </p>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { computed, h } from 'vue'
import { Badge, Dialog, toast } from 'frappe-ui'
import { providerById, regionById, versionById } from '../data/catalog'
import { RUNTIME_LABELS, SYSTEM_INFO, makeProcesses } from '../data/system'
import { useCloudStore } from '../stores/cloud'
import { fmtDate } from '../utils/format'

const props = defineProps({
  server: { type: Object, default: null },
})
const open = defineModel('open', { type: Boolean, default: false })

const store = useCloudStore()

const region = computed(() => regionById(props.server?.regionId) || {})
const provider = computed(() => providerById(region.value.providerId) || {})
const plan = computed(() => store.planOf(props.server))
const versionLabel = computed(() => versionById(props.server?.version)?.label || '—')
const created = computed(() => fmtDate(props.server?.createdAt))

const statusBadge = computed(() => {
  const map = {
    active: { label: 'Running', theme: 'green' },
    provisioning: { label: 'Setting up', theme: 'blue' },
    suspended: { label: 'Suspended', theme: 'orange' },
    broken: { label: 'Needs attention', theme: 'red' },
  }
  return map[props.server?.status] || { label: 'Running', theme: 'green' }
})

// Disk usage — total comes from the plan spec ("25 GB"), the fraction from the
// server's live health reading.
const totalGb = computed(() => parseInt(plan.value?.specs?.disk, 10) || 0)
const diskFrac = computed(() => props.server?.health?.diskFrac || 0)
const usedGb = computed(() => (totalGb.value * diskFrac.value).toFixed(1))
const diskPct = computed(() => Math.round(diskFrac.value * 100))
const diskBarColor = computed(() =>
  diskFrac.value >= 0.9 ? 'bg-surface-red-5' : diskFrac.value >= 0.75 ? 'bg-surface-amber-5' : 'bg-surface-gray-7',
)

const runtime = computed(() =>
  RUNTIME_LABELS.map((label) => SYSTEM_INFO.find((s) => s.label === label)).filter(Boolean),
)

const services = makeProcesses()

function copy(text) {
  navigator.clipboard?.writeText(text)
  toast.success('Copied')
}

// Local row helpers keep the template scannable. A label/value line, plus a
// copy button that only appears on hover for the copyable facts.
const Section = (sectionProps, { slots }) =>
  h('div', { class: 'border-t border-outline-alpha-gray-1 py-2 first:border-t-0' }, [
    h('div', { class: 'pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-ink-gray-4' }, sectionProps.title),
    slots.default?.(),
  ])
Section.props = ['title']

const Row = (rowProps) =>
  h('div', { class: 'group flex items-center justify-between gap-4 py-2' }, [
    h('span', { class: 'shrink-0 text-sm text-ink-gray-5' }, rowProps.label),
    h('span', { class: 'flex min-w-0 items-center gap-1.5' }, [
      h('span', { class: 'truncate text-sm font-medium text-ink-gray-8' }, rowProps.value),
      rowProps.copyable
        ? h(
            'button',
            {
              class: 'shrink-0 text-ink-gray-4 opacity-0 transition-opacity hover:text-ink-gray-7 group-hover:opacity-100',
              'aria-label': `Copy ${rowProps.label}`,
              onClick: () => copy(rowProps.value),
            },
            [h('span', { class: 'lucide-copy size-3.5 block' })],
          )
        : null,
    ]),
  ])
Row.props = ['label', 'value', 'copyable']
</script>

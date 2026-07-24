<template>
  <!-- All sites — pill that expands into the full-height floating list.
       Rendered in the same corner by the map and the site page (where it is
       the split view's left column), so navigating between the two reads as
       the panel standing still. Narrow, tab-like list: the open site is
       marked with a vertical-tab indicator. -->
  <div class="pointer-events-none absolute bottom-4 left-4 top-4 z-30">
    <Transition name="ssp-panel">
      <div
        v-if="open"
        class="pointer-events-auto flex h-full w-[17rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-outline-gray-1 bg-surface-elevation-1"
        :style="{ transformOrigin: 'top left' }"
      >
        <div class="flex items-center justify-between px-4 pb-2 pt-4">
          <div class="flex items-center gap-2 text-base font-medium text-ink-gray-7">
            Your sites
            <Badge theme="gray" variant="subtle" size="sm" :label="String(sites.length)" />
          </div>
          <button class="grid size-7 place-items-center rounded text-ink-gray-5 hover:bg-surface-gray-3 hover:text-ink-gray-7" aria-label="Collapse site list" @click="emit('update:open', false)">
            <span class="lucide-minimize-2 size-4" />
          </button>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto pb-3 pr-2">
          <p v-if="!panelSites.length" class="px-2 py-3 text-sm text-ink-gray-5">No sites yet.</p>
          <div
            v-for="site in panelSites"
            :key="site.id"
            role="button"
            tabindex="0"
            class="group relative flex cursor-pointer items-start gap-2.5 rounded-lg py-3 pl-4 pr-2 text-left transition-colors"
            :class="site.id !== activeSiteId && 'hover:bg-surface-gray-1'"
            :aria-current="site.id === activeSiteId ? 'page' : undefined"
            @click="emit('select', site)"
            @keydown.enter="emit('select', site)"
            @mouseenter="emit('hover', site.id)"
            @mouseleave="emit('hover', null)"
          >
            <!-- Vertical-tab indicator for the open site — a short pill centered
                 against the panel's left edge, per the reference. -->
            <span v-if="site.id === activeSiteId" class="absolute left-0 top-1/2 h-8 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--ink-gray-6)]" aria-hidden="true" />
            <span class="relative mt-0.5 shrink-0 opacity-90 transition-opacity group-hover:opacity-100">
              <SiteIcon size="sm" />
              <span class="absolute -bottom-px -right-px size-2 rounded-full border-2 border-[var(--surface-elevation-1)]" :style="{ background: siteStatusVar(site) }" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-1.5">
                <span class="truncate text-sm font-medium text-ink-gray-9">{{ site.name }}</span>
                <Badge v-if="site.status !== 'live'" :theme="statusTheme(site)" variant="subtle" size="sm" :label="statusLabel(site)" class="shrink-0" />
              </span>
              <span class="mt-0.5 block truncate text-p-sm text-ink-gray-5">{{ appsLabel(site) }} · {{ storageLabel(site) }}</span>
              <span class="storage-bar mt-2.5 block">
                <Progress size="md" :value="storagePct(site)" />
              </span>
            </span>
            <span class="shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100" @click.stop>
              <Dropdown :options="siteOptions(site)" placement="bottom-end">
                <button class="grid size-6 shrink-0 place-items-center rounded text-ink-gray-5 hover:bg-surface-gray-3 hover:text-ink-gray-7" :aria-label="`Actions for ${site.name}`" @click.stop>
                  <span class="lucide-ellipsis size-4" />
                </button>
              </Dropdown>
            </span>
          </div>
        </div>
      </div>
      <button
        v-else
        class="pointer-events-auto mt-2 flex items-center gap-2 rounded-xl border border-outline-gray-1 bg-surface-elevation-1 px-4 py-2 shadow-sm transition-shadow hover:shadow-md"
        @click="emit('update:open', true)"
      >
        <span class="text-base font-medium text-ink-gray-7">Your sites</span>
        <Badge theme="gray" variant="subtle" size="sm" :label="String(sites.length)" />
        <span class="grid size-7 place-items-center text-ink-gray-5">
          <span class="lucide-maximize-2 size-3.5" />
        </span>
      </button>
    </Transition>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Badge, Dropdown, Progress } from 'frappe-ui'
import SiteIcon from './SiteIcon.vue'
import { useCloudStore } from '../stores/cloud'
import { appsLabel, serverDiskGb, siteRowOptions, sitesByAttention, siteStatusVar, siteStorageGb, statusLabel, statusTheme } from '../utils/sites'

const props = defineProps({
  server: { type: Object, required: true },
  // The site open beside the panel (site page only) — its row stays lit.
  activeSiteId: { type: String, default: null },
  open: { type: Boolean, default: false },
})
const emit = defineEmits(['update:open', 'select', 'hover'])

const store = useCloudStore()
const router = useRouter()

const sites = computed(() => props.server.sites)
const panelSites = computed(() => sitesByAttention(sites.value))
const siteOptions = (site) => siteRowOptions(site, { store, router })

// The bar shows the slice of the server's disk this site occupies, so the
// unfilled track reads as headroom on the shared disk. Floored at 2% so even
// a tiny site draws a visible sliver rather than an empty bar.
const diskGb = computed(() => serverDiskGb(props.server))
const storagePct = (site) => Math.max(2, Math.round((siteStorageGb(site) / diskGb.value) * 100))
// The GB label anchors the bar so it reads as storage, not a stray progress line.
const storageLabel = (site) => `${siteStorageGb(site)} GB`
</script>

<style scoped>
/* Pill ⇄ panel: a plain cross-fade with a small vertical drift — no scale, so
   the rows inside never squash/morph during the transition. */
.ssp-panel-enter-active {
  transition: opacity 200ms cubic-bezier(0.23, 1, 0.32, 1), transform 200ms cubic-bezier(0.23, 1, 0.32, 1);
}
.ssp-panel-leave-active {
  transition: opacity 120ms ease-in;
  position: absolute;
  left: 0;
}
.ssp-panel-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}
.ssp-panel-leave-to {
  opacity: 0;
}

/* frappe-ui's Progress track is bg-surface-gray-2 — near-invisible on the
   white panel. Give the empty track a visible grey so it reads as a meter. */
.storage-bar :deep([role='progressbar']) {
  background-color: var(--surface-gray-3);
}

@media (prefers-reduced-motion: reduce) {
  .ssp-panel-enter-active,
  .ssp-panel-leave-active {
    transition: opacity 100ms ease;
  }
}
</style>

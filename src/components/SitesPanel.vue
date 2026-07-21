<template>
  <!-- All sites — pill that expands into the full-height floating list.
       Rendered in the same corner by the map and the site page (where it is
       the split view's left column), so navigating between the two reads as
       the panel standing still. -->
  <div class="pointer-events-none absolute bottom-4 left-4 top-4 z-30">
    <Transition name="ssp-panel">
      <div
        v-if="open"
        class="pointer-events-auto flex h-full w-[24rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl bg-surface-elevation-1 shadow-sm"
        :style="{ transformOrigin: 'top left' }"
      >
        <div class="flex items-center justify-between px-5 pb-3 pt-4">
          <div class="text-base font-medium text-ink-gray-7">
            All sites <span class="font-normal text-ink-gray-5">({{ sites.length }})</span>
          </div>
          <button class="grid size-7 place-items-center rounded text-ink-gray-5 hover:bg-surface-gray-3 hover:text-ink-gray-7" aria-label="Collapse site list" @click="emit('update:open', false)">
            <span class="lucide-minimize-2 size-4" />
          </button>
        </div>
        <div class="min-h-0 flex-1 divide-y divide-outline-alpha-gray-1 overflow-y-auto px-3 pb-3">
          <p v-if="!panelSites.length" class="px-3.5 py-3.5 text-sm text-ink-gray-5">No sites yet.</p>
          <div
            v-for="site in panelSites"
            :key="site.id"
            role="button"
            tabindex="0"
            class="group flex cursor-pointer items-start gap-3 rounded-lg py-3.5 pl-4 pr-3.5 text-left"
            :aria-current="site.id === activeSiteId ? 'page' : undefined"
            @click="emit('select', site)"
            @keydown.enter="emit('select', site)"
            @mouseenter="emit('hover', site.id)"
            @mouseleave="emit('hover', null)"
          >
            <span class="relative shrink-0 opacity-80 transition-opacity group-hover:opacity-100">
              <SiteIcon size="md" />
              <span class="absolute -bottom-px -right-px size-2.5 rounded-full border-2 border-[var(--surface-elevation-1)]" :style="{ background: siteStatusVar(site) }" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-1.5">
                <span class="truncate text-sm font-medium text-ink-gray-9">{{ site.name }}</span>
                <Badge v-if="site.status !== 'live'" :theme="statusTheme(site)" variant="subtle" size="sm" :label="statusLabel(site)" class="shrink-0" />
              </span>
              <span class="mt-1 block truncate text-sm text-ink-gray-5 transition-colors group-hover:text-ink-gray-7">{{ appsLabel(site) }}</span>
              <span class="mt-2 flex items-center gap-2">
                <span class="w-16 shrink-0 opacity-70">
                  <Progress size="sm" :value="storagePct(site)" />
                </span>
                <span class="shrink-0 text-xs tabular-nums text-ink-gray-4">{{ siteStorageGb(site) }} GB</span>
              </span>
            </span>
            <span @click.stop>
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
        class="pointer-events-auto flex h-9 items-center gap-2 rounded-lg border border-outline-gray-2 bg-surface-elevation-1 px-3 shadow-sm transition-shadow hover:shadow-md"
        @click="emit('update:open', true)"
      >
        <span class="text-sm font-semibold text-ink-gray-9">All sites</span>
        <span class="text-sm text-ink-gray-5">({{ sites.length }})</span>
        <span class="lucide-maximize-2 size-3.5 text-ink-gray-5" />
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
import { appsLabel, siteRowOptions, sitesByAttention, siteStatusVar, siteStorageGb, statusLabel, statusTheme } from '../utils/sites'

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

// Bars read relative to the biggest site in this list, not some absolute
// disk total — the point is "which of my sites is heaviest", not a %-of-plan.
const maxStorageGb = computed(() => Math.max(...sites.value.map(siteStorageGb), 1))
const storagePct = (site) => Math.round((siteStorageGb(site) / maxStorageGb.value) * 100)
</script>

<style scoped>
/* Pill ⇄ panel: origin-aware scale from the corner it lives in. */
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
  transform: scale(0.97);
}
.ssp-panel-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .ssp-panel-enter-active,
  .ssp-panel-leave-active {
    transition: opacity 100ms ease;
  }
}
</style>

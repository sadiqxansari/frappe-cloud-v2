<template>
  <!-- All sites — pill that expands into the floating list. The panel hugs
       its rows (min half the stage, capped at full height). z-40 keeps it
       above the map's dim wash (z-35) while a site card is open, so it stays
       bright and usable for switching sites. -->
  <div class="pointer-events-none absolute bottom-4 left-4 top-4 z-40 flex flex-col items-start">
    <Transition name="ssp-panel">
      <div
        v-if="open"
        class="pointer-events-auto flex max-h-full min-h-[50%] w-[24rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-outline-gray-1 bg-surface-elevation-1 shadow-xl"
        :style="{ transformOrigin: 'top left' }"
      >
        <div class="flex items-center justify-between px-4 pb-2 pt-3.5">
          <div class="text-base font-semibold text-ink-gray-9">
            All sites <span class="font-normal text-ink-gray-5">({{ sites.length }})</span>
          </div>
          <button class="grid size-7 place-items-center rounded text-ink-gray-5 hover:bg-surface-gray-3 hover:text-ink-gray-7" aria-label="Collapse site list" @click="emit('update:open', false)">
            <span class="lucide-minimize-2 size-4" />
          </button>
        </div>
        <div class="shrink-0 px-4 pb-3">
          <FormControl v-model="q" type="text" placeholder="Search" autocomplete="off" class="[&_input]:w-full">
            <template #prefix><span class="lucide-search size-4 text-ink-gray-5" /></template>
          </FormControl>
        </div>
        <div class="min-h-0 flex-1 divide-y divide-outline-alpha-gray-1 overflow-y-auto border-t border-outline-alpha-gray-1 px-2 pb-2">
          <p v-if="!panelSites.length" class="px-2.5 py-3 text-sm text-ink-gray-5">No sites match.</p>
          <div
            v-for="site in panelSites"
            :key="site.id"
            role="button"
            tabindex="0"
            class="group flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-3 text-left transition-colors hover:bg-surface-gray-2"
            :class="site.id === activeSiteId && 'bg-surface-gray-2'"
            :aria-current="site.id === activeSiteId ? 'page' : undefined"
            @click="emit('select', site)"
            @keydown.enter="emit('select', site)"
            @mouseenter="emit('hover', site.id)"
            @mouseleave="emit('hover', null)"
          >
            <span class="relative shrink-0">
              <SiteIcon size="md" />
              <span class="absolute -bottom-px -right-px size-2.5 rounded-full border-2 border-[var(--surface-elevation-1)]" :style="{ background: siteStatusVar(site) }" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-1.5">
                <span class="truncate text-sm font-medium text-ink-gray-9">{{ site.name }}</span>
                <Badge v-if="site.status !== 'live'" :theme="statusTheme(site)" variant="subtle" size="sm" :label="statusLabel(site)" class="shrink-0" />
              </span>
              <span class="mt-1 block truncate text-sm text-ink-gray-5">{{ appsLabel(site) }}</span>
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
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Badge, Dropdown, FormControl } from 'frappe-ui'
import SiteIcon from './SiteIcon.vue'
import { useCloudStore } from '../stores/cloud'
import { appsLabel, siteRowOptions, sitesByAttention, siteStatusVar, statusLabel, statusTheme } from '../utils/sites'

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
const q = ref('')
const panelSites = computed(() => {
  const term = q.value.trim().toLowerCase()
  return sitesByAttention(sites.value).filter((s) => !term || s.name.toLowerCase().includes(term))
})
const siteOptions = (site) => siteRowOptions(site, { store, router })
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

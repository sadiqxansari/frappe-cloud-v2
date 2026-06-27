<template>
  <CentralShell :crumbs="[{ label: 'Servers', route: '/servers' }, { label: 'New server' }]" wide>
    <template #actions>
      <Button variant="ghost" size="sm" label="Cancel" @click="$router.push('/servers')" />
      <Button variant="solid" size="sm" :label="`Deploy server — ${inr(price)}/mo`" @click="deploy" />
    </template>

    <div class="flex min-h-0 flex-col-reverse lg:h-[calc(100vh-50px)] lg:flex-row">
      <!-- Map (left) -->
      <div class="border-t border-outline-alpha-gray-1 p-4 lg:flex-1 lg:border-r lg:border-t-0">
        <div class="relative h-72 w-full overflow-hidden rounded-xl border border-outline-gray-2 bg-surface-gray-1 lg:h-full">
          <WorldMap
            :pins="pins"
            :focus="focus"
            :highlight="hoverRegion"
            :scale="mapScale"
            selectable
            class="h-full w-full"
            @select="selectRegion"
            @hover="hoverRegion = $event"
          />
          <div class="absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-lg border border-outline-gray-2 bg-surface-elevation-1 shadow-sm">
            <button class="grid size-8 place-items-center text-ink-gray-6 hover:bg-surface-gray-2" aria-label="Zoom in" @click="zoom(0.4)">
              <span class="lucide-zoom-in size-4" />
            </button>
            <button class="grid size-8 place-items-center border-t border-outline-alpha-gray-1 text-ink-gray-6 hover:bg-surface-gray-2" aria-label="Zoom out" @click="zoom(-0.4)">
              <span class="lucide-zoom-out size-4" />
            </button>
          </div>
        </div>
      </div>

      <!-- Form (right) — width matches the server list panel so the map is the same size on both -->
      <div class="w-full overflow-y-auto p-6 lg:w-[40rem] lg:shrink-0">
        <h1 class="text-xl font-semibold text-ink-gray-9">Add a new server</h1>
        <p class="mt-1 text-p-sm text-ink-gray-5">Pick where it lives and how big it is. You can resize anytime.</p>

        <!-- Stepped form -->
        <div class="mt-6">
          <!-- Step: provider -->
          <div class="flex gap-4">
            <div class="flex flex-col items-center pt-1">
              <span class="size-2.5 shrink-0 rounded-full bg-[var(--ink-gray-9)]" />
              <span class="mt-1.5 w-px grow bg-[var(--outline-gray-2)]" />
            </div>
            <div class="min-w-0 flex-1 pb-6">
              <div class="text-sm font-medium text-ink-gray-7">Select a provider</div>
              <div class="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                <Tooltip v-for="p in PROVIDERS" :key="p.id" :text="providerDown(p.id) ? `${p.name} is down right now` : ''">
                  <button
                    class="flex w-full flex-col items-center gap-1.5 rounded-lg border p-2.5 transition-colors"
                    :class="providerDown(p.id)
                      ? 'cursor-not-allowed border-outline-gray-2 opacity-40'
                      : p.id === providerId ? 'border-outline-gray-4 ring-1 ring-outline-gray-4' : 'border-outline-gray-2 hover:bg-surface-gray-1'"
                    :aria-disabled="providerDown(p.id)"
                    @click="selectProvider(p.id)"
                  >
                    <span class="grid size-8 place-items-center rounded-md text-[11px] font-semibold" :class="p.tile">{{ p.mono }}</span>
                    <span class="truncate text-xs text-ink-gray-7">{{ p.short }}</span>
                  </button>
                </Tooltip>
              </div>
            </div>
          </div>

          <!-- Step: region -->
          <div class="flex gap-4">
            <div class="flex flex-col items-center pt-1">
              <span class="size-2.5 shrink-0 rounded-full bg-[var(--ink-gray-9)]" />
              <span class="mt-1.5 w-px grow bg-[var(--outline-gray-2)]" />
            </div>
            <div class="min-w-0 flex-1 pb-6">
              <div class="text-sm font-medium text-ink-gray-7">Select a region</div>
              <div class="mt-2 flex flex-wrap gap-2">
                <Tooltip v-for="r in regions" :key="r.id" :text="regionDown(r.id) ? `${r.name} is at capacity right now` : ''">
                  <button
                    class="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors"
                    :class="regionDown(r.id)
                      ? 'cursor-not-allowed border-outline-gray-2 text-ink-gray-7 opacity-40'
                      : r.id === regionId ? 'border-outline-gray-4 bg-surface-gray-2 text-ink-gray-9' : 'border-outline-gray-2 text-ink-gray-7 hover:bg-surface-gray-1'"
                    :aria-disabled="regionDown(r.id)"
                    @click="selectRegion(r.id)"
                  >
                    <span>{{ r.flag }}</span>
                    {{ r.name }}
                    <Badge v-if="r.beta" theme="gray" variant="subtle" label="Beta" />
                  </button>
                </Tooltip>
              </div>
            </div>
          </div>

          <!-- Step: plan -->
          <div class="flex gap-4">
            <div class="flex flex-col items-center pt-1">
              <span class="size-2.5 shrink-0 rounded-full bg-[var(--ink-gray-9)]" />
              <span class="mt-1.5 w-px grow bg-[var(--outline-gray-2)]" />
            </div>
            <div class="min-w-0 flex-1 pb-6">
              <div class="flex items-center justify-between">
                <div class="text-sm font-medium text-ink-gray-7">Select a plan</div>
                <button class="text-xs text-ink-gray-5 hover:text-ink-gray-7" @click="showSpecs = !showSpecs">
                  {{ showSpecs ? 'Hide specs' : 'Show specs' }}
                </button>
              </div>
              <div class="mt-1 divide-y divide-outline-alpha-gray-1">
                <button
                  v-for="p in PLANS"
                  :key="p.id"
                  class="flex w-full items-center gap-3 py-2 text-left"
                  @click="planId = p.id"
                >
                  <span
                    class="grid size-4 shrink-0 place-items-center rounded-full border"
                    :class="p.id === planId ? 'border-outline-gray-4' : 'border-outline-gray-2'"
                  >
                    <span v-if="p.id === planId" class="size-2 rounded-full bg-[var(--ink-gray-8)]" />
                  </span>
                  <span class="flex min-w-0 flex-1 items-center gap-1.5">
                    <span class="text-sm font-medium text-ink-gray-9">{{ p.name }}</span>
                    <span v-if="p.recommended" class="lucide-star size-3 shrink-0 text-ink-amber-8" />
                    <span v-if="showSpecs" class="truncate text-xs text-ink-gray-5">· {{ p.specs.compute }} · {{ p.specs.disk }}</span>
                  </span>
                  <span class="shrink-0 text-sm font-semibold tabular-nums text-ink-gray-9">
                    {{ inr(priceFor(p.id, regionId)) }}<span class="text-[11px] font-normal text-ink-gray-5">/mo</span>
                  </span>
                </button>
              </div>
            </div>
          </div>

          <!-- Step: version (last — no connector) -->
          <div class="flex gap-4">
            <div class="flex flex-col items-center pt-1">
              <span class="size-2.5 shrink-0 rounded-full bg-[var(--ink-gray-9)]" />
            </div>
            <div class="min-w-0 flex-1">
              <FormControl type="select" label="Frappe version" v-model="version" :options="versionOptions" />
              <p class="mt-4 flex items-center gap-1.5 text-p-xs text-ink-gray-5">
                <span class="lucide-map-pin size-3.5" />
                Runs in {{ regionName }} — this is where your data lives.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </CentralShell>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Badge, Button, FormControl, Tooltip, toast } from 'frappe-ui'
import CentralShell from '../../components/CentralShell.vue'
import WorldMap from '../../components/WorldMap.vue'
import { PLANS, PROVIDERS, VERSIONS, priceFor, regionById, regionsOf } from '../../data/catalog'
import { useCloudStore } from '../../stores/cloud'
import { inr } from '../../utils/format'

const store = useCloudStore()
const router = useRouter()

const providerId = ref('aws')
const regionId = ref('aws-mumbai')
const planId = ref('business')
const version = ref('v15')
const showSpecs = ref(false)
const hoverRegion = ref(null)
const mapScale = ref(1)

function zoom(delta) {
  mapScale.value = Math.min(3, Math.max(1, Math.round((mapScale.value + delta) * 10) / 10))
}

const regions = computed(() => regionsOf(providerId.value))
const regionName = computed(() => regionById(regionId.value).name)

// In Edge mode some providers/regions are "down" — shown disabled with a hover
// note instead of letting you pick them and fail at deploy. Empty otherwise.
const downProviders = computed(() => (store.edgeMode ? new Set(['oracle']) : new Set()))
const downRegions = computed(() => (store.edgeMode ? new Set(['aws-singapore', 'aws-jakarta']) : new Set()))
function providerDown(id) {
  return downProviders.value.has(id)
}
function regionDown(id) {
  return downRegions.value.has(id)
}
const price = computed(() => priceFor(planId.value, regionId.value))
const versionOptions = computed(() => VERSIONS.map((v) => ({ label: `${v.label} — ${v.note}`, value: v.id })))

// The map zooms to the provider's coverage only. Picking a region within that
// view doesn't zoom further — the selected region's pin just grows.
const focus = computed(() => providerId.value)
const pins = computed(() => regions.value.map((r) => ({ id: r.id, lat: r.lat, lng: r.lng, selected: r.id === regionId.value })))

// Reset manual zoom whenever the provider/region focus changes.
watch(focus, () => (mapScale.value = 1))

function selectProvider(id) {
  if (providerDown(id)) return
  providerId.value = id
  // Land on the first region that's actually available.
  const list = regionsOf(id)
  regionId.value = (list.find((r) => !regionDown(r.id)) || list[0]).id
}

function selectRegion(id) {
  if (regionDown(id)) return
  const r = regionById(id)
  if (providerDown(r.providerId)) return
  providerId.value = r.providerId
  regionId.value = id
}

function deploy() {
  const srv = store.addServer({ planId: planId.value, regionId: regionId.value, version: version.value })
  toast.success(`${srv.name} is being set up in ${regionName.value}`)
  // Just graduated to a 2nd server? Land in Central — their new home — where a
  // one-time note explains the change (decision 9). Otherwise go to the server.
  router.push(store.graduationNotice ? '/servers' : `/manage/${srv.id}`)
}
</script>

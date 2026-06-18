<template>
  <CentralShell :crumbs="[{ label: 'Servers', route: '/servers' }]" wide>
    <template #actions>
      <Button variant="solid" size="sm" label="New server" icon-left="lucide-plus" @click="$router.push('/servers/new')" />
    </template>

    <div class="flex h-full lg:flex-row-reverse">
      <!-- Map (right) -->
      <section class="hidden min-w-0 flex-1 p-4 lg:block">
        <div class="relative h-full w-full overflow-hidden rounded-xl border border-outline-gray-2 bg-surface-gray-1">
          <WorldMap
            :pins="mapPins"
            :highlight="hoverId"
            :scale="scale"
            fit
            selectable
            class="h-full w-full"
            @select="goServer"
            @hover="hoverId = $event"
          />
          <div class="absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-lg border border-outline-gray-2 bg-surface-white shadow-sm">
            <button class="grid size-8 place-items-center text-ink-gray-6 hover:bg-surface-gray-2" aria-label="Zoom in" @click="zoom(0.3)">
              <span class="lucide-zoom-in size-4" />
            </button>
            <button class="grid size-8 place-items-center border-t border-outline-gray-1 text-ink-gray-6 hover:bg-surface-gray-2" aria-label="Zoom out" @click="zoom(-0.3)">
              <span class="lucide-zoom-out size-4" />
            </button>
          </div>
        </div>
      </section>

      <!-- List (left) -->
      <section class="flex h-full w-full flex-col lg:w-[40rem] lg:shrink-0 lg:border-r lg:border-outline-gray-1">
        <div class="shrink-0 px-6 pb-3 pt-6">
          <h2 class="text-lg font-semibold text-ink-gray-9">Your servers</h2>
          <div class="mt-3 flex items-center gap-2">
            <FormControl v-model="q" class="min-w-0 flex-1 [&_input]:w-full" type="text" placeholder="Search" autocomplete="off" />
            <div class="w-36 shrink-0"><FormControl v-model="providerFilter" type="select" :options="providerOptions" /></div>
            <div class="w-32 shrink-0"><FormControl v-model="statusFilter" type="select" :options="statusOptions" /></div>
            <Dropdown :options="viewOptions" placement="bottom-end">
              <Button variant="subtle" icon="lucide-ellipsis" aria-label="More" />
            </Dropdown>
          </div>
        </div>

        <!-- Column headers -->
        <div class="grid grid-cols-[1fr_9.5rem_7rem_1.75rem] items-center gap-3 border-b border-outline-gray-2 px-6 py-2 text-xs font-medium text-ink-gray-5">
          <div>Name</div>
          <div>Region</div>
          <div>Status</div>
          <div />
        </div>

        <!-- Rows -->
        <div class="min-w-0 flex-1 overflow-y-auto">
          <div
            v-for="srv in filtered"
            :key="srv.id"
            class="grid grid-cols-[1fr_9.5rem_7rem_1.75rem] items-center gap-3 border-b border-outline-gray-1 px-6 py-3 transition-colors hover:bg-surface-gray-1"
            @mouseenter="hoverId = srv.id"
            @mouseleave="hoverId = null"
          >
            <button class="min-w-0 text-left" @click="goServer(srv.id)">
              <div class="truncate font-medium text-ink-gray-9">{{ srv.name }}</div>
              <div class="truncate text-sm text-ink-gray-5">
                {{ store.planOf(srv).name }} · {{ inr(store.monthlyPriceOf(srv)) }}/mo
              </div>
            </button>

            <button class="flex min-w-0 items-center gap-2 text-left" @click="goServer(srv.id)">
              <span class="grid size-5 shrink-0 place-items-center rounded text-[9px] font-bold leading-none" :class="provOf(srv).tile">
                {{ provOf(srv).mono }}
              </span>
              <span class="truncate text-sm text-ink-gray-8">{{ city(srv) }}</span>
            </button>

            <div class="flex items-center gap-1.5">
              <!-- Migrating: clickable badge -->
              <template v-if="srv.status === 'migrating'">
                <button type="button" class="cursor-pointer" @click="openMigration(srv)">
                  <Badge theme="blue" variant="subtle" size="sm">
                    <template #prefix><Spinner class="size-3 shrink-0" /></template>
                    Migrating…
                  </Badge>
                </button>
              </template>
              <!-- Scheduled: active dot + clickable badge -->
              <template v-else-if="srv.status === 'migration-scheduled'">
                <span class="inline-flex items-center gap-1.5 text-sm text-ink-gray-7">
                  <span class="size-1.5 rounded-full bg-[var(--ink-green-3)]" />Active
                </span>
                <button type="button" class="cursor-pointer" @click="scheduledServer = srv; scheduledModalOpen = true">
                  <Badge label="Scheduled" theme="blue" variant="subtle" size="sm" />
                </button>
              </template>
              <!-- Normal statuses -->
              <template v-else-if="srv.status === 'broken'">
                <Badge theme="red" variant="subtle" size="sm">
                  <template #prefix><span class="block size-1.5 rounded-full bg-[var(--ink-red-3)]" /></template>
                  Broken
                </Badge>
              </template>
              <template v-else>
                <span class="inline-flex items-center gap-1.5 text-sm text-ink-gray-7">
                  <span class="size-1.5 rounded-full" :class="dotClass(srv)" />{{ statusLabel(srv) }}
                </span>
              </template>
            </div>

            <ServerActions :server="srv" />
          </div>

          <MigrationScheduledModal v-model:open="scheduledModalOpen" :server="scheduledServer" />

          <EmptyState
            v-if="!filtered.length"
            class="m-6"
            :icon="store.allServers.length ? 'lucide-search' : 'lucide-server'"
            :title="store.allServers.length ? 'No servers match' : 'No servers yet'"
            :description="store.allServers.length ? 'Try a different search or clear the filters.' : 'Spin up your first server to host your sites.'"
          >
            <Button v-if="!store.allServers.length" variant="solid" size="sm" label="New server" icon-left="lucide-plus" @click="router.push('/servers/new')" />
          </EmptyState>
        </div>
      </section>
    </div>
  </CentralShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Badge, Button, Dropdown, FormControl, Spinner, toast } from 'frappe-ui'
import CentralShell from '../../components/CentralShell.vue'
import EmptyState from '../../components/EmptyState.vue'
import MigrationScheduledModal from '../../components/MigrationScheduledModal.vue'
import ServerActions from '../../components/ServerActions.vue'
import WorldMap from '../../components/WorldMap.vue'
import { PROVIDERS, providerById } from '../../data/catalog'
import { useCloudStore } from '../../stores/cloud'
import { inr } from '../../utils/format'

const store = useCloudStore()
const router = useRouter()

const q = ref('')
const providerFilter = ref('')
const statusFilter = ref('')
const hoverId = ref(null)
const scale = ref(1)
const scheduledModalOpen = ref(false)
const scheduledServer = ref(null)

const providerOptions = [
  { label: 'All providers', value: '' },
  ...PROVIDERS.map((p) => ({ label: p.short, value: p.id })),
]
const statusOptions = [
  { label: 'Status', value: '' },
  { label: 'Active', value: 'active' },
  { label: 'Broken', value: 'broken' },
  { label: 'Suspended', value: 'suspended' },
  { label: 'Setting up', value: 'provisioning' },
  { label: 'Migrating', value: 'migrating' },
]
const viewOptions = [
  { label: 'Refresh', icon: 'lucide-refresh-cw', onClick: () => toast.success('Refreshed') },
]

function provOf(srv) {
  return providerById(store.regionOf(srv).providerId)
}
function city(srv) {
  return store.regionOf(srv).name.split(',')[0]
}

const filtered = computed(() => {
  const term = q.value.trim().toLowerCase()
  return store.servers.filter((srv) => {
    const region = store.regionOf(srv)
    if (providerFilter.value && region.providerId !== providerFilter.value) return false
    if (statusFilter.value && srv.status !== statusFilter.value) return false
    if (term && !(`${srv.name} ${region.name} ${region.provider}`.toLowerCase().includes(term))) return false
    return true
  })
})

const mapPins = computed(() =>
  filtered.value.map((srv) => {
    const r = store.regionOf(srv)
    return { id: srv.id, lat: r.lat, lng: r.lng, status: srv.status }
  }),
)

// Each server is its own workspace — open it in a new browser tab.
function goServer(id) {
  window.open(`/manage/${id}`, '_blank', 'noopener')
}
function openMigration(srv) {
  const { toRegionId, toPlanId } = srv.migration || {}
  window.open(`/migration/${srv.id}?to=${toRegionId}&plan=${toPlanId}`, '_blank', 'noopener')
}
function zoom(delta) {
  scale.value = Math.min(2.4, Math.max(1, Math.round((scale.value + delta) * 10) / 10))
}

function dotClass(srv) {
  if (srv.status === 'broken') return 'bg-[var(--ink-red-3)]'
  if (srv.status === 'suspended' || srv.status === 'provisioning') return 'bg-[var(--ink-amber-3)]'
  return 'bg-[var(--ink-green-3)]'
}
function statusLabel(srv) {
  return { active: 'Active', provisioning: 'Setting up…', suspended: 'Suspended', broken: 'Broken', migrating: 'Migrating…', 'migration-scheduled': 'Active' }[srv.status] || srv.status
}
</script>

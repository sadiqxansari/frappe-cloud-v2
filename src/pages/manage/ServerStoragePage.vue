<template>
  <ServerShell v-if="server" :server="server" :crumbs="crumbs" roomy>
    <div class="flex flex-wrap items-center gap-3">
      <h1 class="text-2xl font-semibold text-ink-gray-9">Server</h1>
      <Badge variant="subtle" theme="orange" size="sm" label="WIP" />
    </div>

    <!-- Storage sub-section: the disk read-out and the DB/App breakdown all
         live under one heading so the page can grow other server sections later. -->
    <section class="mt-8">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="flex items-center gap-2">
          <span class="lucide-hard-drive size-5 shrink-0 text-ink-gray-5" />
          <h2 class="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-lg font-semibold text-ink-gray-9">
            <span>Storage</span>
            <!-- Total disk usage, matching ServerHealth / Central; the two
                 workload meters below each show their own slice of it. -->
            <span class="text-p-sm font-normal">
              <span class="font-medium tabular-nums text-ink-gray-8">{{ fmtGb(disk.diskUsed) }}</span>
              <span class="ml-1 text-ink-gray-5">of {{ fmtGb(disk.diskTotal) }} used</span>
            </span>
          </h2>
        </div>
        <div class="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon="lucide-rotate-cw" aria-label="Refresh" @click="toast.success('Refreshed')" />
          <Button variant="subtle" size="sm" label="Manage Storage" @click="router.push('/servers')">
            <template #prefix>
              <img :src="cloudLogo" alt="" class="size-4 shrink-0 rounded-sm" />
            </template>
          </Button>
        </div>
      </div>

      <div class="mt-6">
        <ServerStorageView :server="server" :live-sites="liveSites" @drill="drillToSiteDb" />
      </div>
    </section>
  </ServerShell>
</template>

<script setup>
import { computed, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Badge, Button, toast } from 'frappe-ui'
import ServerShell from '../../components/ServerShell.vue'
import ServerStorageView from '../../components/db/ServerStorageView.vue'
import { fmtGb } from '../../components/db/format'
import { useCloudStore } from '../../stores/cloud'
import cloudLogo from '../../assets/apps/cloud.png'

// The server's own storage picture — DB + app breakdowns for the whole box.
// Drilling into a database jumps to that site's detail in the DB analyzer.
const store = useCloudStore()
const route = useRoute()
const router = useRouter()

const server = computed(() => store.findServer(route.params.serverId) || store.server)
watchEffect(() => {
  if (!server.value) router.replace('/')
})

const liveSites = computed(() => (server.value?.sites || []).filter((s) => s.status === 'live'))
const disk = computed(() => store.healthOf(server.value))

const crumbs = computed(() => [{ label: 'Server' }])

const drillToSiteDb = (siteId) =>
  router.push(`/manage/${server.value.id}/developer/database?site=${siteId}`)
</script>

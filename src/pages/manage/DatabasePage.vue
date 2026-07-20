<template>
  <ServerShell v-if="server" :server="server" :crumbs="crumbs" roomy>
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-center gap-2">
        <Button v-if="activeSite" variant="ghost" icon="lucide-arrow-left" aria-label="Back to server view" @click="backToServer" />
        <div>
          <div class="flex items-center gap-2">
            <span v-if="activeSite" class="lucide-globe size-5 shrink-0 text-ink-gray-5" />
            <h1 class="text-2xl font-semibold text-ink-gray-9">{{ activeSite ? activeSite.name : 'Live database activity across every site' }}</h1>
          </div>
          <p v-if="activeSite" class="mt-1 text-p-base text-ink-gray-5">
            This site's database — size, tables, queries and indexes.
          </p>
          <div v-else class="mt-1 flex items-center gap-2 text-p-base text-ink-gray-5">
            <ProviderAvatar :provider="provider" :size="20" />
            <span>{{ server.name }} · {{ region.name }}</span>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="ghost" size="sm" icon="lucide-rotate-cw" aria-label="Refresh" @click="toast.success('Refreshed')" />
        <!-- Server mode: one site filter scopes every diagnostics accordion. -->
        <Dropdown v-if="!activeSite && liveSites.length > 1" :options="siteFilterOptions" placement="bottom-end">
          <Button variant="outline" size="sm" icon-right="lucide-chevron-down" :label="siteFilterLabel" />
        </Dropdown>
      </div>
    </div>

    <!-- mt-8 opens a clear gap below the header; the accordions keep their own
         mt-4 rhythm between each other (the first card's margin collapses into
         this one, so the header gap stays a single, larger step). -->
    <div class="mt-8">
      <DbSiteView v-if="activeSite" :key="activeSite.id" :site="activeSite" />
      <DbServerView v-else :server="server" :live-sites="liveSites" :site-filter="siteFilter" @drill="drill" />
    </div>
  </ServerShell>
</template>

<script setup>
import { computed, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button, Dropdown, toast } from 'frappe-ui'
import ServerShell from '../../components/ServerShell.vue'
import ProviderAvatar from '../../components/ProviderAvatar.vue'
import DbServerView from '../../components/db/DbServerView.vue'
import DbSiteView from '../../components/db/DbSiteView.vue'
import { useCloudStore } from '../../stores/cloud'
import { providerById } from '../../data/catalog'
import { getServerDbData } from '../../data/dbAnalyzer'

// Two levels: the server-wide storage picture by default; drill into a site
// (?site=…) for that database's tables, queries and indexes.
const store = useCloudStore()
const route = useRoute()
const router = useRouter()

const server = computed(() => store.findServer(route.params.serverId) || store.server)
watchEffect(() => {
  if (!server.value) router.replace('/')
})

const region = computed(() => store.regionOf(server.value))
const provider = computed(() => providerById(region.value.providerId))

const liveSites = computed(() => (server.value?.sites || []).filter((s) => s.status === 'live'))
const activeSite = computed(() => liveSites.value.find((s) => s.id === route.query.site) || null)

// One site filter, in the header, scopes every diagnostics accordion at once.
const siteFilter = ref(null)
const siteFilterLabel = computed(() => liveSites.value.find((s) => s.id === siteFilter.value)?.name || 'All sites')

// Active connection count per site — lets the busiest site float to the top,
// so picking a site from a long, otherwise-identical domain list means
// something. Edge mode has no reliable process data, so skip it there.
const disk = computed(() => store.healthOf(server.value))
const connectionCountOf = computed(() => {
  const counts = new Map()
  if (store.edgeMode || !server.value || !liveSites.value.length) return counts
  const data = getServerDbData(server.value, liveSites.value, disk.value)
  for (const p of data.processes) counts.set(p.siteId, (counts.get(p.siteId) || 0) + 1)
  return counts
})
const siteFilterOptions = computed(() => [
  { label: 'All sites', icon: 'lucide-globe', onClick: () => (siteFilter.value = null) },
  ...[...liveSites.value]
    .sort((a, b) => (connectionCountOf.value.get(b.id) || 0) - (connectionCountOf.value.get(a.id) || 0))
    .map((s) => {
      const count = connectionCountOf.value.get(s.id) || 0
      return {
        label: s.name,
        icon: 'lucide-globe',
        description: store.edgeMode ? undefined : `${count} connection${count === 1 ? '' : 's'}`,
        onClick: () => (siteFilter.value = s.id),
      }
    }),
])

// A ?site= that doesn't resolve (dropped site, stale link) falls back cleanly.
watchEffect(() => {
  if (route.query.site && !activeSite.value) router.replace({ query: {} })
})

const serverViewPath = computed(() => `/manage/${server.value.id}/developer/database`)
const crumbs = computed(() => {
  const base = [{ label: 'Dev tools', route: `/manage/${server.value.id}/developer/logs` }]
  return activeSite.value
    ? [...base, { label: 'DB analyzer', route: serverViewPath.value }, { label: activeSite.value.name }]
    : [...base, { label: 'DB analyzer' }]
})

const drill = (siteId) => router.push({ query: { site: siteId } })
const backToServer = () => router.push(serverViewPath.value)
</script>

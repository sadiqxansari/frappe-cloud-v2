<template>
  <ServerShell v-if="server" :server="server" :crumbs="crumbs" container-class="mx-auto w-full max-w-5xl px-4 py-8 sm:px-16">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-2">
          <Button
            v-if="activeSite"
            class="-ml-2"
            variant="ghost"
            size="sm"
            icon="lucide-arrow-left"
            aria-label="Back to server view"
            @click="backToServer"
          />
          <h1 class="text-2xl font-semibold text-ink-gray-9">{{ activeSite ? activeSite.name : 'Live database activity across every site' }}</h1>
          <span v-if="activeSiteDb" class="font-mono text-p-sm text-ink-gray-5">{{ activeSiteDb.dbName }}</span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="ghost" size="sm" icon="lucide-rotate-cw" aria-label="Refresh" @click="toast.success('Refreshed')" />
        <!-- Server mode: one site filter scopes every diagnostics accordion. -->
        <Select
          v-if="!activeSite && liveSites.length > 1"
          v-model="siteFilter"
          variant="subtle"
          size="sm"
          class="min-w-56"
          :options="siteFilterOptions"
        />
      </div>
    </div>

    <!-- The vitals strip is the header's own read-out of server health, so it
         sits with the title rather than inside the diagnostics below. -->
    <VitalsStrip
      v-if="!activeSite"
      class="mt-6"
      :connections="filteredProcesses.length"
      :blocked="filteredLocks.length"
      :slow="filteredSlow.length"
      :binlog-gb="binlogTotalGb"
      :edge-broken="edgeBroken"
      @focus="focusPanel"
    />

    <!-- Site mode: the size strip is this header's own read-out (like the
         vitals strip is for server mode), so it sits close underneath rather
         than behind the same big gap as the accordions. Server mode keeps the
         full mt-10 gap before its first accordion. -->
    <div :class="activeSite ? 'mt-3' : 'mt-10'">
      <DbSiteView v-if="activeSite" :key="activeSite.id" :site="activeSite" />
      <DbServerView
        v-else
        :server="server"
        :live-sites="liveSites"
        :site-filter="siteFilter"
        :open-key="openKey"
        @update:open-key="openKey = $event"
        @drill="drill"
      />
    </div>
  </ServerShell>
</template>

<script setup>
import { computed, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button, Select, toast } from 'frappe-ui'
import ServerShell from '../../components/ServerShell.vue'
import DbServerView from '../../components/db/DbServerView.vue'
import DbSiteView from '../../components/db/DbSiteView.vue'
import VitalsStrip from '../../components/db/VitalsStrip.vue'
import { useCloudStore } from '../../stores/cloud'
import { getServerDbData, getSiteDbData } from '../../data/dbAnalyzer'

// Two levels: the server-wide storage picture by default; drill into a site
// (?site=…) for that database's tables, queries and indexes.
const store = useCloudStore()
const route = useRoute()
const router = useRouter()

const server = computed(() => store.findServer(route.params.serverId) || store.server)
watchEffect(() => {
  if (!server.value) router.replace('/')
})

const liveSites = computed(() => (server.value?.sites || []).filter((s) => s.status === 'live'))
const activeSite = computed(() => liveSites.value.find((s) => s.id === route.query.site) || null)
const activeSiteDb = computed(() => (activeSite.value ? getSiteDbData(activeSite.value) : null))

// One site filter, in the header, scopes every diagnostics accordion at once.
// '' (Select's own "no value" sentinel) means "All sites" — falsy, so every
// `siteFilter ? … : …` check below still reads it the same way `null` did.
const siteFilter = ref('')

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
  { label: 'All sites', value: '', icon: 'lucide-globe' },
  ...[...liveSites.value]
    .sort((a, b) => (connectionCountOf.value.get(b.id) || 0) - (connectionCountOf.value.get(a.id) || 0))
    .map((s) => {
      const count = connectionCountOf.value.get(s.id) || 0
      return {
        label: s.name,
        value: s.id,
        icon: 'lucide-globe',
        description: store.edgeMode ? undefined : `${count} connection${count === 1 ? '' : 's'}`,
      }
    }),
])

// Vitals strip lives in the header, but the data and the notion of "which
// accordion is open" belong to the diagnostics below — computed here from the
// same cached generators so the two stay in lockstep without duplicating them.
const edgeBroken = computed(() => store.edgeMode)
const serverData = computed(() =>
  liveSites.value.length ? getServerDbData(server.value, liveSites.value, disk.value) : null
)
const siteDbs = computed(() => liveSites.value.map(getSiteDbData))
const isSlowProc = (p) => p.command === 'Query' && /^\d+s$/.test(p.time) && parseInt(p.time) >= 5
const filteredProcesses = computed(() => {
  if (!serverData.value) return []
  return siteFilter.value ? serverData.value.processes.filter((p) => p.siteId === siteFilter.value) : serverData.value.processes
})
const filteredLocks = computed(() => {
  if (!serverData.value) return []
  return siteFilter.value ? serverData.value.locks.filter((l) => l.siteId === siteFilter.value) : serverData.value.locks
})
const filteredSlow = computed(() => {
  const all = siteDbs.value.flatMap((db) => db.slowQueries.map((q) => ({ siteId: db.siteId })))
  return siteFilter.value ? all.filter((q) => q.siteId === siteFilter.value) : all
})
const binlogTotalGb = computed(() => {
  if (!serverData.value) return 0
  return Math.round((serverData.value.binlogs.reduce((a, f) => a + f.sizeMb, 0) / 1024) * 10) / 10
})

// Exclusive accordion, owned here: on load it opens the most notable panel —
// an outage or a slow query surfaces the process list, a blocked transaction
// surfaces the locks. Nothing notable ⇒ everything stays folded.
function mostNotable() {
  if (!serverData.value) return null
  if (edgeBroken.value || serverData.value.processes.some(isSlowProc)) return 'processes'
  if (serverData.value.locks.length > 0) return 'locks'
  return null
}
const openKey = ref(mostNotable())
function focusPanel(key) {
  openKey.value = openKey.value === key ? null : key
}

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

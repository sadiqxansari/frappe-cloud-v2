<template>
  <ServerShell v-if="server" :server="server" :crumbs="crumbs" roomy>
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="flex items-start gap-2">
        <Button v-if="activeSite" variant="ghost" icon="lucide-arrow-left" aria-label="Back to server view" @click="backToServer" />
        <div>
          <div class="flex items-center gap-2">
            <span :class="activeSite ? 'lucide-globe' : 'lucide-database'" class="size-5 shrink-0 text-ink-gray-5" />
            <h1 class="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-2xl font-semibold text-ink-gray-9">
              <span>{{ activeSite ? activeSite.name : 'DB analyzer' }}</span>
              <!-- Server mode: total disk usage (matching ServerHealth /
                   Central) sits inline; the two workload meters below each
                   show their own slice of it. -->
              <span v-if="!activeSite" class="text-p-sm font-normal">
                <span class="font-medium tabular-nums text-ink-gray-8">{{ fmtGb(disk.diskUsed) }}</span>
                <span class="ml-1 text-ink-gray-5">of {{ fmtGb(disk.diskTotal) }} used</span>
              </span>
            </h1>
          </div>
          <p v-if="activeSite" class="mt-1 text-p-base text-ink-gray-5">
            This site's database — size, tables, queries and indexes.
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="ghost" size="sm" icon="lucide-rotate-cw" aria-label="Refresh" @click="toast.success('Refreshed')" />
        <Button v-if="!activeSite" variant="subtle" size="sm" label="Manage Storage" @click="router.push('/servers')">
          <template #prefix>
            <img :src="cloudLogo" alt="" class="size-4 shrink-0 rounded-sm" />
          </template>
        </Button>
      </div>
    </div>

    <DbSiteView v-if="activeSite" :key="activeSite.id" :site="activeSite" />
    <DbServerView v-else :server="server" :live-sites="liveSites" @drill="drill" />
  </ServerShell>
</template>

<script setup>
import { computed, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button, toast } from 'frappe-ui'
import ServerShell from '../../components/ServerShell.vue'
import DbServerView from '../../components/db/DbServerView.vue'
import DbSiteView from '../../components/db/DbSiteView.vue'
import { fmtGb } from '../../components/db/format'
import { useCloudStore } from '../../stores/cloud'
import cloudLogo from '../../assets/apps/cloud.png'

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

// Server-mode disk usage — same picture ServerHealth and Central show.
const disk = computed(() => store.healthOf(server.value))

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

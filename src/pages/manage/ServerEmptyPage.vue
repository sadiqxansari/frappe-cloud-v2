<template>
  <ServerShell v-if="server" :server="server" :crumbs="crumbs">
    <template #actions>
      <Button variant="solid" size="sm" label="New site" icon-left="lucide-plus" :disabled="server.status !== 'active'" @click="newSiteOpen = true" />
    </template>

    <ServerLifecycleBanners :server="server" />

    <EmptyState icon="lucide-globe" title="No sites yet" description="Create your first site on this server to get started.">
      <Button variant="solid" size="sm" label="New site" icon-left="lucide-plus" :disabled="server.status !== 'active'" @click="newSiteOpen = true" />
    </EmptyState>

    <NewSiteDialog v-model:open="newSiteOpen" :server="server" />
  </ServerShell>
</template>

<script setup>
import { computed, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button } from 'frappe-ui'
import EmptyState from '../../components/EmptyState.vue'
import NewSiteDialog from '../../components/NewSiteDialog.vue'
import ServerLifecycleBanners from '../../components/ServerLifecycleBanners.vue'
import ServerShell from '../../components/ServerShell.vue'
import { useCloudStore } from '../../stores/cloud'

const store = useCloudStore()
const route = useRoute()
const router = useRouter()

const server = computed(() => store.findServer(route.params.serverId))
watchEffect(() => {
  if (!server.value) router.replace('/')
})

const base = computed(() => `/manage/${server.value.id}`)
const crumbs = computed(() => [{ label: 'Sites', route: base.value }])

const newSiteOpen = ref(false)
</script>

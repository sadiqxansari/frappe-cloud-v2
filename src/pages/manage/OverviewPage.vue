<template>
  <ServerShell v-if="server" :server="server" :crumbs="crumbs" wide>
    <template #actions>
      <Button variant="solid" size="sm" label="New site" icon-left="lucide-plus" :disabled="server.status !== 'active'" @click="newSiteOpen = true" />
    </template>

    <div class="relative h-full">
      <!-- The sites map is the page: sites fan out around the server on the
           dotted world. The floating panel inside covers list duties (search,
           statuses, actions); the server pill covers the old specs rail. -->
      <SitesMap :server="server" @new-site="newSiteOpen = true" />

      <!-- Lifecycle banners float over the map so the stage stays full-bleed. -->
      <div
        v-if="store.creditExpired || server.status !== 'active'"
        class="pointer-events-none absolute inset-x-0 top-16 z-40 flex justify-center px-4"
      >
        <div class="pointer-events-auto w-full max-w-xl space-y-2">
          <Alert
            v-if="store.creditExpired"
            theme="red"
            title="Your sites are paused — credit ran out"
            :action="{ label: 'Add a card', onClick: () => (addCardOpen = true) }"
          >
            <template #description>Nothing is deleted. Add a card and they're back in seconds.</template>
          </Alert>

          <!-- Server lifecycle banners. Independent v-if from creditExpired (both can
               be true); the three statuses are mutually exclusive so they chain. -->
          <Alert v-if="server.status === 'suspended'" theme="yellow" title="This server is suspended" :action="{ label: 'Resume server', onClick: resumeServer }">
            <template #description>Sites are offline. Resume to bring them back — nothing is deleted.</template>
          </Alert>

          <Alert v-else-if="server.status === 'broken'" theme="red" title="This server is unreachable" :action="{ label: 'Contact support', icon: 'lucide-life-buoy', onClick: contactSupport }">
            <template #description>We've lost contact with the host and are looking into it. Your data is safe; actions here are paused until it's back.</template>
          </Alert>

          <Alert v-else-if="server.status === 'provisioning'" theme="blue" title="Setting up your server" :dismissible="false">
            <template #description>This usually takes a couple of minutes. You can add sites as soon as it's ready.</template>
          </Alert>
        </div>
      </div>
    </div>

    <AddCardDialog v-model:open="addCardOpen" />
    <NewSiteDialog v-model:open="newSiteOpen" :server="server" stay />
  </ServerShell>
</template>

<script setup>
import { computed, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button, toast } from 'frappe-ui'
import Alert from '../../components/Alert.vue'
import AddCardDialog from '../../components/AddCardDialog.vue'
import NewSiteDialog from '../../components/NewSiteDialog.vue'
import ServerShell from '../../components/ServerShell.vue'
import SitesMap from '../../components/SitesMap.vue'
import { useCloudStore } from '../../stores/cloud'

const store = useCloudStore()
const route = useRoute()
const router = useRouter()

const server = computed(() => (route.params.serverId ? store.findServer(route.params.serverId) : store.server))
watchEffect(() => {
  if (!server.value) router.replace('/')
})

const base = computed(() => `/manage/${server.value.id}`)
const crumbs = computed(() => [{ label: 'Sites', route: base.value }])

const addCardOpen = ref(false)
const newSiteOpen = ref(false)

function resumeServer() {
  store.setServerSuspended(server.value.id, false)
  toast.success(`${server.value.name} resumed`)
}
function contactSupport() {
  toast('In the real thing, this opens a support ticket for this server')
}
</script>

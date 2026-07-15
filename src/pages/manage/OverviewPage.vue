<template>
  <ServerShell v-if="server" :server="server" :crumbs="crumbs" wide>
    <template #actions>
      <Button variant="subtle" size="sm" label="New site" icon-left="lucide-plus" :disabled="server.status !== 'active'" @click="newSiteOpen = true" />
    </template>

    <div class="relative h-full">
      <!-- The sites map is the page: sites fan out around the server on the
           dotted world. The floating panel inside covers list duties (search,
           statuses, actions); the server pill covers the old specs rail.
           While a site is open (child route), the stage dims under the wash —
           only the sites panel stays bright, since it's how you switch sites. -->
      <SitesMap
        :server="server"
        :dimmed="!!activeSite"
        :active-site-id="activeSite?.id || null"
        @new-site="newSiteOpen = true"
        @dismiss="closeSite"
      />

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
      <!-- The floating site card (site-detail child route). It rises over the
           dimmed map and fades out on dismiss; switching sites reuses the same
           component instance, so that swap is instant. -->
      <router-view v-slot="{ Component }">
        <Transition name="sdo">
          <component :is="Component" />
        </Transition>
      </router-view>
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
import { sitesPanelOpen } from '../../utils/sites'

const store = useCloudStore()
const route = useRoute()
const router = useRouter()

// The map wants the full stage — start with the sidebar collapsed. Assigning
// state directly (not setSidebarCollapsed) skips localStorage, so landing here
// never overwrites the remembered preference; expanding by hand still persists.
store.sidebarCollapsed = true

const server = computed(() => (route.params.serverId ? store.findServer(route.params.serverId) : store.server))
watchEffect(() => {
  if (!server.value) router.replace('/')
})

const base = computed(() => `/manage/${server.value.id}`)

// The open site (child route), if any — drives the dim wash and the crumb.
const activeSite = computed(() => server.value?.sites.find((s) => s.id === route.params.siteId) || null)
const crumbs = computed(() => {
  const list = [{ label: 'Sites', route: base.value }]
  if (activeSite.value) list.push({ label: activeSite.value.name, route: route.fullPath })
  return list
})

// Scrim click behaves like Esc: the card AND the sites panel close together,
// landing on the bare map.
function closeSite() {
  sitesPanelOpen.value = false
  router.push(base.value)
}

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

<style scoped>
/* The site card rises over the dimming map; dismissing is a quick fade so
   the map is back the moment you let go. (Scoped styles reach the child's
   root element, which is the card's positioned wrapper.) */
.sdo-enter-active {
  transition: opacity 250ms cubic-bezier(0.23, 1, 0.32, 1), transform 250ms cubic-bezier(0.23, 1, 0.32, 1);
}
.sdo-leave-active {
  transition: opacity 150ms ease-in;
}
.sdo-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.99);
}
.sdo-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .sdo-enter-active,
  .sdo-leave-active {
    transition: opacity 100ms ease;
  }
  .sdo-enter-from {
    transform: none;
  }
}
</style>

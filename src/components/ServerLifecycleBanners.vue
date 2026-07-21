<template>
  <div v-if="store.creditExpired || server.status !== 'active'" class="mb-6 space-y-2">
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

  <AddCardDialog v-model:open="addCardOpen" />
</template>

<script setup>
import { ref } from 'vue'
import { toast } from 'frappe-ui'
import Alert from './Alert.vue'
import AddCardDialog from './AddCardDialog.vue'
import { useCloudStore } from '../stores/cloud'

const props = defineProps({
  server: { type: Object, required: true },
})

const store = useCloudStore()
const addCardOpen = ref(false)

function resumeServer() {
  store.setServerSuspended(props.server.id, false)
  toast.success(`${props.server.name} resumed`)
}
function contactSupport() {
  toast('In the real thing, this opens a support ticket for this server')
}
</script>

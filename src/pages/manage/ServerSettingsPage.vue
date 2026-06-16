<template>
  <ServerShell v-if="server" :server="server" :crumbs="crumbs">
    <h1 class="text-xl font-semibold text-ink-gray-9">Settings</h1>

    <TabButtons v-model="tab" :buttons="tabs" class="mt-4" />

    <!-- General — actions only; the read-only facts live on the server overview. -->
    <div v-if="tab === 'general'" class="mt-5 space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-gray-2 bg-surface-white p-4">
        <div>
          <div class="text-sm font-medium text-ink-gray-9">Server name</div>
          <div class="mt-0.5 text-sm text-ink-gray-5">Currently <span class="font-medium text-ink-gray-7">{{ server.name }}</span>.</div>
        </div>
        <Button variant="subtle" size="sm" label="Rename" @click="openRename" />
      </div>
      <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-gray-2 bg-surface-white p-4">
        <div>
          <div class="text-sm font-medium text-ink-gray-9">Frappe version</div>
          <div class="mt-0.5 text-sm text-ink-gray-5">Currently <span class="font-medium text-ink-gray-7">{{ versionLabel }}</span>. Changing it migrates every site on this server.</div>
        </div>
        <Button variant="subtle" size="sm" label="Change version" @click="versionOpen = true" />
      </div>
      <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-gray-2 bg-surface-white p-4">
        <div>
          <div class="text-sm font-medium text-ink-gray-9">Restart server</div>
          <div class="mt-0.5 text-sm text-ink-gray-5">Reboots the machine. Sites are briefly unavailable while it comes back.</div>
        </div>
        <Button variant="subtle" size="sm" label="Restart" icon-left="lucide-rotate-cw" @click="restart" />
      </div>

      <p class="text-sm text-ink-gray-5">
        SSH keys and API access are account-wide — manage them in
        <RouterLink to="/settings" class="text-ink-gray-7 underline-offset-2 hover:underline">Settings → Developer</RouterLink>.
      </p>
    </div>

    <!-- Firewall -->
    <div v-else class="mt-5">
      <div class="flex items-center justify-between">
        <h2 class="text-base font-semibold text-ink-gray-8">Firewall</h2>
        <Button variant="subtle" size="sm" label="Add rule" icon-left="lucide-plus" @click="ruleOpen = true" />
      </div>
      <div class="mt-3 divide-y divide-outline-gray-1 rounded-lg border border-outline-gray-2 text-sm">
        <div v-for="r in server.firewallRules" :key="r.id" class="flex items-center gap-3 p-3">
          <div class="min-w-0 flex-1">
            <span class="font-medium text-ink-gray-8">{{ r.name }}</span>
            <span class="text-ink-gray-5"> · port {{ r.port }}</span>
          </div>
          <Badge :theme="r.action === 'Allow' ? 'green' : 'red'" variant="subtle" :label="r.action" />
          <Switch :modelValue="r.enabled" @update:modelValue="store.toggleFirewallRule(server.id, r.id)" />
          <Button variant="ghost" size="sm" icon="lucide-trash-2" label="Delete" @click="store.removeFirewallRule(server.id, r.id)" />
        </div>
        <div v-if="!server.firewallRules.length" class="p-3 text-ink-gray-5">No rules — all inbound traffic is blocked.</div>
      </div>
    </div>

    <!-- Dialogs -->
    <Dialog v-model:open="ruleOpen" size="sm">
      <template #title><span class="text-xl font-semibold text-ink-gray-9">Add firewall rule</span></template>
      <div class="space-y-3">
        <FormControl v-model="rule.name" type="text" label="Name" placeholder="e.g. Custom port" />
        <div class="grid grid-cols-2 gap-3">
          <FormControl v-model="rule.port" type="text" label="Port" placeholder="8080" />
          <FormControl v-model="rule.action" type="select" label="Action" :options="['Allow', 'Deny']" />
        </div>
      </div>
      <template #actions>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" @click="ruleOpen = false" />
          <Button variant="solid" label="Add rule" :disabled="!rule.name.trim() || !rule.port" @click="addRule" />
        </div>
      </template>
    </Dialog>

    <Dialog v-model:open="renameOpen" size="sm">
      <template #title><span class="text-xl font-semibold text-ink-gray-9">Rename server</span></template>
      <FormControl v-model="newName" type="text" label="Server name" placeholder="My server" />
      <template #actions>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" @click="renameOpen = false" />
          <Button variant="solid" label="Rename" :disabled="!newName.trim() || newName.trim() === server.name" @click="rename" />
        </div>
      </template>
    </Dialog>

    <ChangeVersionDialog v-model:open="versionOpen" :server="server" />
  </ServerShell>
</template>

<script setup>
import { computed, reactive, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Badge, Button, Dialog, FormControl, Switch, TabButtons, toast } from 'frappe-ui'
import ChangeVersionDialog from '../../components/ChangeVersionDialog.vue'
import ServerShell from '../../components/ServerShell.vue'
import { versionById } from '../../data/catalog'
import { useCloudStore } from '../../stores/cloud'

const store = useCloudStore()
const route = useRoute()
const router = useRouter()

const server = computed(() => store.findServer(route.params.serverId) || store.server)
watchEffect(() => {
  if (!server.value) router.replace('/')
})
const crumbs = computed(() => [{ label: 'Settings' }])

const tabs = [
  { label: 'General', value: 'general' },
  { label: 'Firewall', value: 'firewall' },
]
const tab = ref('general')

const ruleOpen = ref(false)
const rule = reactive({ name: '', port: '', action: 'Allow' })
function addRule() {
  store.addFirewallRule(server.value.id, { ...rule })
  toast.success('Firewall rule added')
  ruleOpen.value = false
  rule.name = ''
  rule.port = ''
  rule.action = 'Allow'
}

const versionLabel = computed(() => versionById(server.value.version).label)
const versionOpen = ref(false)

const renameOpen = ref(false)
const newName = ref('')
function openRename() {
  newName.value = server.value.name
  renameOpen.value = true
}
function rename() {
  store.renameServer(server.value.id, newName.value)
  toast.success('Server renamed')
  renameOpen.value = false
}
function restart() {
  toast.promise(store.restartServer(server.value.id), {
    loading: 'Restarting…',
    success: 'Server restarted',
    error: 'Restart failed',
  })
}
</script>

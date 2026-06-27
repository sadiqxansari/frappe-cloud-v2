<template>
  <Dialog v-model:open="open" :options="{ size: '3xl' }" bare>
    <template #default>
      <!-- Fixed height across all tabs (averaged between the short General tab
           and the long Developer tab) so switching tabs doesn't jump; the right
           pane scrolls when content exceeds it. Caps at 85vh on short screens. -->
      <div v-if="server" class="flex h-[39rem] max-h-[85vh]">
        <!-- Left nav — settings categories, frappe-ui idiom -->
        <nav class="flex w-52 shrink-0 flex-col gap-0.5 border-r border-outline-gray-2 bg-surface-gray-1 p-3">
          <div class="p-2 text-base font-semibold text-ink-gray-9">Settings</div>
          <button
            v-for="t in tabs"
            :key="t.value"
            class="flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors"
            :class="tab === t.value ? 'bg-surface-elevation-3 text-ink-gray-9 shadow-sm' : 'text-ink-gray-7 hover:bg-surface-gray-2'"
            @click="tab = t.value"
          >
            <span class="size-4 shrink-0 text-ink-gray-6" :class="t.icon" />
            <span>{{ t.label }}</span>
          </button>
        </nav>

        <!-- Right pane — scrolls; leave room for the Dialog's close button -->
        <div class="min-h-0 min-w-0 flex-1 overflow-y-auto p-6">
          <!-- General -->
          <div v-if="tab === 'general'">
            <h2 class="text-lg font-semibold text-ink-gray-9">General</h2>
            <div class="space-y-3 pt-4">
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-medium text-ink-gray-9">Server name</div>
                  <div class="mt-0.5 text-p-sm text-ink-gray-5">Currently <span class="font-medium text-ink-gray-7">{{ server.name }}</span>.</div>
                </div>
                <Button class="shrink-0" variant="subtle" size="sm" label="Rename" @click="openRename" />
              </div>
              <!-- Patch update within the current major (issue #24) -->
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <div class="text-sm font-medium text-ink-gray-9">Frappe updates</div>
                    <Badge v-if="updateAvailable" theme="green" variant="subtle" label="Update available" />
                  </div>
                  <div class="mt-0.5 text-p-sm text-ink-gray-5">
                    Running <span class="font-medium tabular-nums text-ink-gray-7">{{ server.build }}</span>.
                    <template v-if="updateAvailable"> Latest is <span class="font-medium tabular-nums text-ink-gray-7">{{ latestBuild }}</span>.</template>
                    <template v-else> You're on the latest patch.</template>
                  </div>
                </div>
                <Button v-if="updateAvailable" class="shrink-0" variant="subtle" size="sm" label="Update" icon-left="lucide-arrow-up" @click="updateOpen = true" />
              </div>
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-medium text-ink-gray-9">Frappe version</div>
                  <div class="mt-0.5 text-p-sm text-ink-gray-5">Currently <span class="font-medium text-ink-gray-7">{{ versionLabel }}</span>. Changing it migrates every site on this server.</div>
                </div>
                <Button class="shrink-0" variant="subtle" size="sm" label="Change version" @click="versionOpen = true" />
              </div>
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-medium text-ink-gray-9">Restart server</div>
                  <div class="mt-0.5 text-p-sm text-ink-gray-5">Reboots the machine. Sites are briefly unavailable while it comes back.</div>
                </div>
                <Button class="shrink-0" variant="subtle" size="sm" label="Restart" icon-left="lucide-rotate-cw" @click="restart" />
              </div>
            </div>
          </div>

          <!-- Firewall -->
          <div v-else-if="tab === 'firewall'">
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-semibold text-ink-gray-9">Firewall</h2>
              <Button variant="subtle" size="sm" label="Add rule" icon-left="lucide-plus" @click="ruleOpen = true" />
            </div>
            <div class="mt-3 divide-y divide-outline-alpha-gray-1 rounded-lg border border-outline-gray-2 text-sm">
              <div v-for="r in server.firewallRules" :key="r.id" class="flex items-center gap-3 p-3">
                <div class="min-w-0 flex-1">
                  <span class="font-medium text-ink-gray-8">{{ r.name }}</span>
                  <span class="text-ink-gray-5"> · port {{ r.port }}</span>
                </div>
                <Badge :theme="r.action === 'Allow' ? 'green' : 'red'" variant="subtle" :label="r.action" />
                <Switch :modelValue="r.enabled" @update:modelValue="(v) => onToggleRule(r, v)" />
                <Button variant="ghost" size="sm" icon="lucide-trash-2" label="Delete" @click="askRemoveRule(r)" />
              </div>
              <div v-if="!server.firewallRules.length" class="p-3 text-ink-gray-5">No rules — all inbound traffic is blocked.</div>
            </div>
          </div>

          <!-- Developer -->
          <div v-else class="space-y-5">
            <h2 class="text-lg font-semibold text-ink-gray-9">Developer</h2>
            <section class="rounded-xl border border-outline-gray-2 p-4">
              <div class="flex items-center justify-between">
                <h3 class="text-base font-semibold text-ink-gray-8">API access</h3>
                <Button variant="subtle" size="sm" label="Regenerate" icon-left="lucide-refresh-cw" @click="regenerate" />
              </div>
              <div class="mt-3 flex items-center gap-2 rounded-lg border border-outline-gray-2 bg-surface-gray-2 px-3 py-2">
                <code class="min-w-0 flex-1 truncate font-mono text-sm text-ink-gray-8">{{ store.apiKey }}</code>
                <button class="text-ink-gray-5 hover:text-ink-gray-7" aria-label="Copy" @click="copy(store.apiKey)"><span class="lucide-copy size-4" /></button>
              </div>
            </section>

            <section class="rounded-xl border border-outline-gray-2 p-4">
              <div class="flex items-center justify-between">
                <h3 class="text-base font-semibold text-ink-gray-8">SSH keys</h3>
                <Button variant="subtle" size="sm" label="Add SSH key" icon-left="lucide-plus" @click="keyOpen = true" />
              </div>
              <div v-if="store.accountSshKeys.length" class="mt-3 divide-y divide-outline-alpha-gray-1 rounded-lg border border-outline-gray-2">
                <div v-for="k in store.accountSshKeys" :key="k.id" class="flex items-center gap-3 p-3">
                  <span class="lucide-key-round size-4 shrink-0 text-ink-gray-5" />
                  <div class="min-w-0 flex-1">
                    <div class="truncate text-sm font-medium text-ink-gray-9">{{ k.name }}</div>
                    <div class="truncate font-mono text-xs text-ink-gray-5">{{ k.fingerprint }}</div>
                  </div>
                  <Button variant="ghost" size="sm" icon="lucide-trash-2" :aria-label="`Remove ${k.name}`" @click="store.removeAccountSshKey(k.id)" />
                </div>
              </div>
              <EmptyState v-else class="mt-3" icon="lucide-key-round" title="No SSH keys yet" description="Add a public key to access your servers over SSH.">
                <Button variant="subtle" size="sm" label="Add SSH key" icon-left="lucide-plus" @click="keyOpen = true" />
              </EmptyState>
            </section>

            <section class="rounded-xl border border-outline-gray-2 p-4">
              <div class="flex items-center justify-between">
                <h3 class="text-base font-semibold text-ink-gray-8">Webhooks</h3>
                <Button variant="subtle" size="sm" label="Add webhook" icon-left="lucide-plus" @click="hookOpen = true" />
              </div>
              <div v-if="store.webhooks.length" class="mt-3 divide-y divide-outline-alpha-gray-1 rounded-lg border border-outline-gray-2">
                <div v-for="w in store.webhooks" :key="w.id" class="p-3">
                  <div class="flex items-center gap-3">
                    <span class="lucide-webhook size-4 shrink-0 text-ink-gray-5" />
                    <span class="min-w-0 flex-1 truncate text-sm text-ink-gray-8">{{ w.url }}</span>
                    <Badge :theme="w.status === 'failing' ? 'red' : 'green'" variant="subtle" :label="w.status === 'failing' ? 'Failing' : 'Active'" />
                    <Button v-if="w.status === 'failing'" variant="subtle" size="sm" label="Send test" @click="testHook(w)" />
                    <Button variant="ghost" size="sm" icon="lucide-trash-2" aria-label="Remove webhook" @click="store.removeWebhook(w.id)" />
                  </div>
                  <p v-if="w.status === 'failing' && w.lastError" class="mt-1.5 flex items-center gap-1 pl-7 text-p-xs text-ink-red-8">
                    <span class="lucide-triangle-alert size-3 shrink-0" /> {{ w.lastError }} — check the endpoint, then send a test.
                  </p>
                </div>
              </div>
              <EmptyState v-else class="mt-3" icon="lucide-webhook" title="No webhooks yet" description="Add an endpoint to receive event notifications.">
                <Button variant="subtle" size="sm" label="Add webhook" icon-left="lucide-plus" @click="hookOpen = true" />
              </EmptyState>
            </section>
          </div>
        </div>
      </div>
    </template>
  </Dialog>

  <!-- Sub-dialogs (portal to body, so they stack above the settings modal) -->
  <Dialog v-model:open="ruleOpen" size="sm">
    <template #title><span class="text-xl font-semibold text-ink-gray-9">Add firewall rule</span></template>
    <div class="space-y-3">
      <FormControl v-model="rule.name" type="text" label="Name" placeholder="e.g. Custom port" />
      <div class="grid grid-cols-2 gap-3">
        <div>
          <FormControl v-model="rule.port" type="text" label="Port" placeholder="8080" />
          <p v-if="rule.port && portError" class="mt-1 text-p-xs text-ink-red-8">{{ portError }}</p>
        </div>
        <FormControl v-model="rule.action" type="select" label="Action" :options="['Allow', 'Deny']" />
      </div>
    </div>
    <template #actions>
      <div class="flex justify-end gap-2">
        <Button label="Cancel" @click="ruleOpen = false" />
        <Button variant="solid" label="Add rule" :disabled="!rule.name.trim() || !!portError" @click="addRule" />
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

  <ConfirmDialog
    v-model:open="lockoutOpen"
    theme="red"
    title="This can lock you out"
    message="Port 22 is how you reach this server over SSH. Removing or disabling this rule may cut off your access until you re-add it from another machine."
    confirm-label="I understand, continue"
    @confirm="confirmLockout"
  />

  <ChangeVersionDialog v-model:open="versionOpen" :server="server" />
  <UpdateServerDialog v-model:open="updateOpen" :server="server" />

  <Dialog v-model:open="keyOpen" size="sm">
    <template #title><span class="text-xl font-semibold text-ink-gray-9">Add SSH key</span></template>
    <FormControl v-model="keyName" type="text" label="Key name" placeholder="e.g. work-laptop" />
    <template #actions>
      <div class="flex justify-end gap-2"><Button label="Cancel" @click="keyOpen = false" /><Button variant="solid" label="Add key" :disabled="!keyName.trim()" @click="addKey" /></div>
    </template>
  </Dialog>

  <Dialog v-model:open="hookOpen" size="sm">
    <template #title><span class="text-xl font-semibold text-ink-gray-9">Add webhook</span></template>
    <FormControl v-model="hookUrl" type="text" label="Endpoint URL" placeholder="https://example.com/hooks/fc" />
    <p v-if="hookUrl && hookError" class="mt-1 text-p-xs text-ink-red-8">{{ hookError }}</p>
    <template #actions>
      <div class="flex justify-end gap-2"><Button label="Cancel" @click="hookOpen = false" /><Button variant="solid" label="Add webhook" :disabled="!!hookError" @click="addHook" /></div>
    </template>
  </Dialog>

  <ConfirmDialog
    v-model:open="regenOpen"
    theme="red"
    title="Regenerate the API secret?"
    message="The current secret stops working immediately. Any script or integration using it will start failing until you update it with the new key."
    confirm-label="Regenerate"
    @confirm="confirmRegenerate"
  />
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { Badge, Button, Dialog, FormControl, Switch, toast } from 'frappe-ui'
import ChangeVersionDialog from './ChangeVersionDialog.vue'
import UpdateServerDialog from './UpdateServerDialog.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import EmptyState from './EmptyState.vue'
import { latestBuildFor, versionById } from '../data/catalog'
import { useCloudStore } from '../stores/cloud'
import { validatePort, validateUrl } from '../utils/validate'

const props = defineProps({
  server: { type: Object, default: null },
})
const open = defineModel('open', { type: Boolean, default: false })

const store = useCloudStore()

const tabs = [
  { label: 'General', value: 'general', icon: 'lucide-settings' },
  { label: 'Firewall', value: 'firewall', icon: 'lucide-shield' },
  { label: 'Developer', value: 'developer', icon: 'lucide-code' },
]
const tab = ref('general')

const versionLabel = computed(() => versionById(props.server?.version)?.label || '—')
const latestBuild = computed(() => latestBuildFor(props.server?.version))
const updateAvailable = computed(() => !!props.server && props.server.build !== latestBuild.value)

// — Firewall
const ruleOpen = ref(false)
const rule = reactive({ name: '', port: '', action: 'Allow' })
const portError = computed(() => validatePort(rule.port))
function addRule() {
  if (portError.value) return
  store.addFirewallRule(props.server.id, { ...rule })
  toast.success('Firewall rule added')
  ruleOpen.value = false
  rule.name = ''
  rule.port = ''
  rule.action = 'Allow'
}

// Removing or disabling the SSH (port 22) rule can lock the user out, so we
// confirm first. Other rules apply immediately.
const lockoutOpen = ref(false)
const pendingRule = ref(null)
const pendingAction = ref('remove')
const isSsh = (r) => Number(r.port) === 22 && r.action === 'Allow'
function askRemoveRule(r) {
  if (isSsh(r) && r.enabled) { pendingRule.value = r; pendingAction.value = 'remove'; lockoutOpen.value = true }
  else store.removeFirewallRule(props.server.id, r.id)
}
function onToggleRule(r, val) {
  if (isSsh(r) && !val) { pendingRule.value = r; pendingAction.value = 'disable'; lockoutOpen.value = true }
  else store.toggleFirewallRule(props.server.id, r.id)
}
function confirmLockout() {
  const r = pendingRule.value
  if (!r) return
  if (pendingAction.value === 'remove') store.removeFirewallRule(props.server.id, r.id)
  else store.toggleFirewallRule(props.server.id, r.id)
  pendingRule.value = null
}

// — General
const versionOpen = ref(false)
const updateOpen = ref(false)
const renameOpen = ref(false)
const newName = ref('')
function openRename() {
  newName.value = props.server.name
  renameOpen.value = true
}
function rename() {
  store.renameServer(props.server.id, newName.value)
  toast.success('Server renamed')
  renameOpen.value = false
}
function restart() {
  toast.promise(store.restartServer(props.server.id), {
    loading: 'Restarting…',
    success: 'Server restarted',
    error: 'Restart failed',
  })
}

// — Developer
const regenOpen = ref(false)
function regenerate() {
  regenOpen.value = true
}
function confirmRegenerate() {
  store.regenerateApiKey()
  toast.success('API secret regenerated')
}
function testHook(w) {
  toast.promise(store.testWebhook(w.id), {
    loading: 'Sending test event…',
    success: 'Test delivered — webhook is healthy again',
    error: 'Test failed — the endpoint still isn’t responding',
  })
}
function copy(text) {
  navigator.clipboard?.writeText(text)
  toast.success('Copied')
}
const keyOpen = ref(false)
const keyName = ref('')
function addKey() {
  store.addAccountSshKey({ name: keyName.value.trim() })
  toast.success('SSH key added')
  keyOpen.value = false
  keyName.value = ''
}
const hookOpen = ref(false)
const hookUrl = ref('')
const hookError = computed(() => validateUrl(hookUrl.value, { required: true }))
function addHook() {
  if (hookError.value) return
  store.addWebhook({ url: hookUrl.value.trim() })
  toast.success('Webhook added')
  hookOpen.value = false
  hookUrl.value = ''
}
</script>

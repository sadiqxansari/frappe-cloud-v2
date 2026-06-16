<template>
  <CentralShell :crumbs="[{ label: 'Settings', route: '/settings' }]">
    <h1 class="text-xl font-semibold text-ink-gray-9">Settings</h1>

    <TabButtons v-model="tab" :buttons="tabs" class="mt-4" />

    <!-- Profile -->
    <div v-if="tab === 'profile'" class="mt-5">
      <div class="divide-y divide-outline-gray-1 rounded-xl border border-outline-gray-2 bg-surface-white">
        <div class="flex items-center gap-3 p-4">
          <Avatar :label="store.user.name || 'You'" size="lg" />
          <div class="min-w-0 flex-1">
            <div class="truncate font-medium text-ink-gray-9">{{ store.user.name || 'You' }}</div>
            <div class="truncate text-sm text-ink-gray-5">{{ store.user.email || '—' }}</div>
          </div>
          <Button variant="subtle" size="sm" label="Edit" icon-left="lucide-pencil" @click="openEdit" />
        </div>
        <div class="flex items-center justify-between gap-3 p-4">
          <div>
            <div class="text-sm font-medium text-ink-gray-9">Notifications</div>
            <div class="text-sm text-ink-gray-5">Choose what we email you about.</div>
          </div>
          <Button variant="subtle" size="sm" label="Manage" @click="notifyOpen = true" />
        </div>
        <div class="flex items-center justify-between gap-3 p-4">
          <div>
            <div class="text-sm font-medium text-ink-gray-9">Two-factor authentication</div>
            <div class="text-sm text-ink-gray-5">Add a second step when signing in.</div>
          </div>
          <Button variant="subtle" size="sm" label="Enable" @click="toast.success('Two-factor setup started')" />
        </div>
      </div>
    </div>

    <!-- Team -->
    <div v-else-if="tab === 'team'" class="mt-5 max-w-2xl">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-base font-semibold text-ink-gray-8">Team</h2>
          <p class="text-sm text-ink-gray-5">People who can access this account. Assign each a role.</p>
        </div>
        <Button variant="subtle" size="sm" label="Invite" icon-left="lucide-plus" @click="openInvite" />
      </div>
      <div class="mt-3 divide-y divide-outline-gray-1 overflow-hidden rounded-xl border border-outline-gray-2">
        <div v-for="m in store.members" :key="m.id" class="flex items-center gap-3 p-3">
          <Avatar :label="m.name" size="sm" />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="truncate text-sm font-medium text-ink-gray-9">{{ m.name }}</span>
              <Badge v-if="m.invited" theme="orange" variant="subtle" label="Invited" />
            </div>
            <div class="truncate text-xs text-ink-gray-5">{{ m.email }}</div>
          </div>
          <Badge v-if="m.role === 'Owner'" theme="green" variant="subtle" label="Owner" />
          <div v-else class="w-32 shrink-0">
            <FormControl
              type="select"
              :modelValue="m.role"
              :options="roleNames"
              @update:modelValue="(v) => store.assignMemberRole(m.id, v)"
            />
          </div>
          <Dropdown v-if="m.role !== 'Owner'" :options="memberOptions(m)" placement="bottom-end">
            <Button variant="ghost" size="sm" icon="lucide-ellipsis-vertical" :aria-label="`Actions for ${m.name}`" />
          </Dropdown>
        </div>
      </div>
    </div>

    <!-- Roles -->
    <div v-else-if="tab === 'roles'" class="mt-5 max-w-2xl">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-base font-semibold text-ink-gray-8">Roles</h2>
          <p class="text-sm text-ink-gray-5">Define roles here, then assign them to people on the Team tab.</p>
        </div>
        <Button variant="subtle" size="sm" label="New role" icon-left="lucide-plus" @click="openRole" />
      </div>
      <div class="mt-3 divide-y divide-outline-gray-1 overflow-hidden rounded-xl border border-outline-gray-2">
        <div v-for="r in store.roles" :key="r.id" class="flex items-center gap-3 p-3.5">
          <span class="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-gray-2">
            <span class="lucide-shield size-4 text-ink-gray-6" />
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="truncate text-sm font-medium text-ink-gray-9">{{ r.name }}</span>
              <Badge v-if="r.system" theme="gray" variant="subtle" label="Built-in" />
            </div>
            <div class="truncate text-xs text-ink-gray-5">{{ r.desc }}</div>
          </div>
          <Button v-if="!r.system" variant="ghost" size="sm" icon="lucide-trash-2" :aria-label="`Delete ${r.name}`" @click="store.removeRole(r.id)" />
        </div>
      </div>
    </div>

    <!-- Developer -->
    <div v-else class="mt-5 max-w-2xl space-y-5">
      <!-- API access -->
      <section class="rounded-xl border border-outline-gray-2 bg-surface-white p-4">
        <div class="flex items-center justify-between">
          <h2 class="text-base font-semibold text-ink-gray-8">API access</h2>
          <Button variant="subtle" size="sm" label="Regenerate" icon-left="lucide-refresh-cw" @click="regenerate" />
        </div>
        <div class="mt-3 flex items-center gap-2 rounded-lg border border-outline-gray-2 bg-surface-gray-2 px-3 py-2">
          <code class="min-w-0 flex-1 truncate font-mono text-sm text-ink-gray-8">{{ store.apiKey }}</code>
          <button class="text-ink-gray-5 hover:text-ink-gray-7" aria-label="Copy" @click="copy(store.apiKey)"><span class="lucide-copy size-4" /></button>
        </div>
      </section>

      <!-- SSH keys -->
      <section class="rounded-xl border border-outline-gray-2 bg-surface-white p-4">
        <div class="flex items-center justify-between">
          <h2 class="text-base font-semibold text-ink-gray-8">SSH keys</h2>
          <Button variant="subtle" size="sm" label="Add SSH key" icon-left="lucide-plus" @click="keyOpen = true" />
        </div>
        <div v-if="store.accountSshKeys.length" class="mt-3 divide-y divide-outline-gray-1 rounded-lg border border-outline-gray-2">
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

      <!-- Webhooks -->
      <section class="rounded-xl border border-outline-gray-2 bg-surface-white p-4">
        <div class="flex items-center justify-between">
          <h2 class="text-base font-semibold text-ink-gray-8">Webhooks</h2>
          <Button variant="subtle" size="sm" label="Add webhook" icon-left="lucide-plus" @click="hookOpen = true" />
        </div>
        <div v-if="store.webhooks.length" class="mt-3 divide-y divide-outline-gray-1 rounded-lg border border-outline-gray-2">
          <div v-for="w in store.webhooks" :key="w.id" class="p-3">
            <div class="flex items-center gap-3">
              <span class="lucide-webhook size-4 shrink-0 text-ink-gray-5" />
              <span class="min-w-0 flex-1 truncate text-sm text-ink-gray-8">{{ w.url }}</span>
              <Badge :theme="w.status === 'failing' ? 'red' : 'green'" variant="subtle" :label="w.status === 'failing' ? 'Failing' : 'Active'" />
              <Button v-if="w.status === 'failing'" variant="subtle" size="sm" label="Send test" @click="testHook(w)" />
              <Button variant="ghost" size="sm" icon="lucide-trash-2" aria-label="Remove webhook" @click="store.removeWebhook(w.id)" />
            </div>
            <p v-if="w.status === 'failing' && w.lastError" class="mt-1.5 flex items-center gap-1 pl-7 text-xs text-ink-red-4">
              <span class="lucide-triangle-alert size-3 shrink-0" /> {{ w.lastError }} — check the endpoint, then send a test.
            </p>
          </div>
        </div>
        <EmptyState v-else class="mt-3" icon="lucide-webhook" title="No webhooks yet" description="Add an endpoint to receive event notifications.">
          <Button variant="subtle" size="sm" label="Add webhook" icon-left="lucide-plus" @click="hookOpen = true" />
        </EmptyState>
      </section>
    </div>

    <!-- Dialogs -->
    <Dialog v-model:open="editOpen" size="sm">
      <template #title><span class="text-xl font-semibold text-ink-gray-9">Edit profile</span></template>
      <div class="space-y-3">
        <FormControl v-model="form.name" type="text" label="Name" />
        <FormControl v-model="form.email" type="email" label="Email" />
      </div>
      <template #actions>
        <div class="flex justify-end gap-2"><Button label="Cancel" @click="editOpen = false" /><Button variant="solid" label="Save" @click="saveProfile" /></div>
      </template>
    </Dialog>

    <Dialog v-model:open="notifyOpen" size="sm">
      <template #title><span class="text-xl font-semibold text-ink-gray-9">Notifications</span></template>
      <div class="space-y-3">
        <div v-for="n in notifyRows" :key="n.key" class="flex items-center justify-between gap-3">
          <span class="text-sm text-ink-gray-7">{{ n.label }}</span>
          <Switch v-model="notify[n.key]" />
        </div>
      </div>
      <template #actions>
        <div class="flex justify-end gap-2"><Button label="Cancel" @click="notifyOpen = false" /><Button variant="solid" label="Save" @click="saveNotify" /></div>
      </template>
    </Dialog>

    <Dialog v-model:open="inviteOpen" size="sm">
      <template #title><span class="text-xl font-semibold text-ink-gray-9">Invite to team</span></template>
      <div class="space-y-3">
        <FormControl v-model="invite.email" type="email" label="Email" placeholder="teammate@company.com" />
        <FormControl v-model="invite.role" type="select" label="Role" :options="roleNames" />
      </div>
      <template #actions>
        <div class="flex justify-end gap-2"><Button label="Cancel" @click="inviteOpen = false" /><Button variant="solid" label="Send invite" :disabled="!invite.email.trim()" @click="sendInvite" /></div>
      </template>
    </Dialog>

    <Dialog v-model:open="roleOpen" size="sm">
      <template #title><span class="text-xl font-semibold text-ink-gray-9">New role</span></template>
      <div class="space-y-3">
        <FormControl v-model="newRole.name" type="text" label="Name" placeholder="e.g. Support" />
        <FormControl v-model="newRole.desc" type="text" label="Description" placeholder="What can this role do?" />
      </div>
      <template #actions>
        <div class="flex justify-end gap-2"><Button label="Cancel" @click="roleOpen = false" /><Button variant="solid" label="Create role" :disabled="!newRole.name.trim()" @click="createRole" /></div>
      </template>
    </Dialog>

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
      <p v-if="hookUrl && hookError" class="mt-1 text-xs text-ink-red-4">{{ hookError }}</p>
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
  </CentralShell>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { Avatar, Badge, Button, Dialog, Dropdown, FormControl, Switch, TabButtons, toast } from 'frappe-ui'
import CentralShell from '../../components/CentralShell.vue'
import ConfirmDialog from '../../components/ConfirmDialog.vue'
import EmptyState from '../../components/EmptyState.vue'
import { useCloudStore } from '../../stores/cloud'
import { validateUrl } from '../../utils/validate'

const store = useCloudStore()
const tabs = [
  { label: 'Profile', value: 'profile' },
  { label: 'Team', value: 'team' },
  { label: 'Roles', value: 'roles' },
  { label: 'Developer', value: 'developer' },
]
const tab = ref('profile')

const roleNames = computed(() => store.roles.map((r) => r.name))

// — Profile
const editOpen = ref(false)
const form = reactive({ name: '', email: '' })
function openEdit() {
  form.name = store.user.name
  form.email = store.user.email
  editOpen.value = true
}
function saveProfile() {
  store.user.name = form.name.trim() || store.user.name
  store.user.email = form.email.trim() || store.user.email
  toast.success('Profile updated')
  editOpen.value = false
}

const notifyOpen = ref(false)
const notifyRows = [
  { key: 'product', label: 'Product updates' },
  { key: 'billing', label: 'Billing and invoices' },
  { key: 'security', label: 'Security alerts' },
]
const notify = reactive({ product: true, billing: true, security: true })
function saveNotify() {
  toast.success('Notification preferences saved')
  notifyOpen.value = false
}

// — Team
const inviteOpen = ref(false)
const invite = reactive({ email: '', role: 'Member' })
function openInvite() {
  invite.email = ''
  invite.role = 'Member'
  inviteOpen.value = true
}
function sendInvite() {
  store.inviteMember(invite.email.trim(), invite.role)
  toast.success('Invite sent')
  inviteOpen.value = false
}
function memberOptions(m) {
  return [
    { label: 'Resend invite', icon: 'lucide-mail', onClick: () => toast.success('Invite resent') },
    { label: 'Remove from team', icon: 'lucide-user-minus', onClick: () => { store.revokeMember(m.id); toast.success('Removed from team') } },
  ]
}

// — Roles
const roleOpen = ref(false)
const newRole = reactive({ name: '', desc: '' })
function openRole() {
  newRole.name = ''
  newRole.desc = ''
  roleOpen.value = true
}
function createRole() {
  store.addRole({ name: newRole.name.trim(), desc: newRole.desc.trim() })
  toast.success('Role created')
  roleOpen.value = false
}

// — Developer
// Regenerating the key breaks every integration using the old one, so confirm.
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

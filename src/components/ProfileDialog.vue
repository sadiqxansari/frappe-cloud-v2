<template>
  <Dialog v-model:open="open" size="md">
    <template #title><span class="text-xl font-semibold text-ink-gray-9">Your profile</span></template>

    <div class="space-y-5">
      <!-- Identity + account settings -->
      <div class="divide-y divide-outline-alpha-gray-1 rounded-xl border border-outline-gray-2 bg-surface-elevation-1">
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

      <!-- Refer & Earn -->
      <section class="rounded-xl border border-outline-gray-2 bg-surface-elevation-1 p-4">
        <h2 class="text-base font-semibold text-ink-gray-8">Refer &amp; Earn</h2>
        <p class="mt-0.5 text-p-sm text-ink-gray-5">Your unique referral link</p>
        <div class="mt-3 flex items-center gap-2 rounded-lg border border-outline-gray-2 bg-surface-gray-2 px-3 py-2">
          <code class="min-w-0 flex-1 truncate font-mono text-sm text-ink-gray-8">{{ referralLink }}</code>
          <button class="text-ink-gray-5 hover:text-ink-gray-7" aria-label="Copy referral link" @click="copy(referralLink)"><span class="lucide-copy size-4" /></button>
        </div>
        <p class="mt-3 text-p-sm text-ink-gray-5">
          Invite someone to Frappe Cloud and <span class="font-medium text-ink-gray-8">get $10 in Frappe Cloud credits</span> when they sign up and spend at least $25!
        </p>
      </section>
    </div>
  </Dialog>

  <!-- Edit profile -->
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

  <!-- Notification preferences -->
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
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { Avatar, Button, Dialog, FormControl, Switch, toast } from 'frappe-ui'
import { useCloudStore } from '../stores/cloud'

const open = defineModel('open', { type: Boolean, default: false })

const store = useCloudStore()

const referralLink = computed(() => `https://cloud.frappe.io/dashboard/signup?referrer=${store.referralCode}`)

function copy(text) {
  navigator.clipboard?.writeText(text)
  toast.success('Copied')
}

// ── Edit profile ──────────────────────────────────────────────
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

// ── Notification preferences ──────────────────────────────────
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
</script>

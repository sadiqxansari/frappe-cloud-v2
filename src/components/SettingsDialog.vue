<template>
  <Dialog v-model:open="open" :options="{ size: '3xl' }" bare>
    <template #default>
      <!-- Fixed height so switching tabs doesn't jump; the right pane scrolls. -->
      <div class="relative flex h-[34rem] max-h-[85vh]">
        <button
          class="absolute right-3 top-3 z-10 grid size-7 place-items-center rounded text-ink-gray-5 transition-colors hover:bg-surface-gray-3 hover:text-ink-gray-7"
          aria-label="Close"
          @click="open = false"
        >
          <span class="lucide-x size-4" />
        </button>
        <!-- Left nav -->
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

        <!-- Right pane -->
        <div class="min-h-0 min-w-0 flex-1 overflow-y-auto p-6">
          <!-- ───────── Profile ───────── -->
          <div v-if="tab === 'profile'">
            <h2 class="text-xl font-semibold text-ink-gray-9">Profile</h2>
            <p class="mt-1 text-p-base text-ink-gray-5">Your account details, referral link and partner code.</p>

            <div class="mt-6 flex items-center gap-3">
              <Avatar :label="store.user.name || 'You'" size="xl" />
              <div class="min-w-0 flex-1">
                <div class="truncate font-medium text-ink-gray-9">{{ store.user.name || 'You' }}</div>
                <div class="truncate text-sm text-ink-gray-5">{{ store.user.email || '—' }}</div>
              </div>
              <Button variant="subtle" size="sm" label="Edit" icon-left="lucide-pencil" @click="openEdit" />
            </div>

            <div class="my-6 border-t border-outline-gray-2" />

            <!-- Refer & Earn (no card, just a divider above) -->
            <h2 class="text-base font-semibold text-ink-gray-9">Refer &amp; Earn</h2>
            <p class="mt-0.5 text-p-sm text-ink-gray-5">Your unique referral link</p>
            <div class="mt-3 flex items-center gap-2 rounded-lg border border-outline-gray-2 bg-surface-gray-2 px-3 py-2">
              <code class="min-w-0 flex-1 truncate font-mono text-sm text-ink-gray-8">{{ referralLink }}</code>
              <button class="shrink-0 text-ink-gray-5 hover:text-ink-gray-7" aria-label="Copy referral link" @click="copy(referralLink)"><span class="lucide-copy size-4" /></button>
            </div>
            <p class="mt-3 text-p-sm text-ink-gray-5">
              Invite someone to Frappe Cloud and <span class="font-medium text-ink-gray-8">get $10 in Frappe Cloud credits</span> when they sign up and spend at least $25.
            </p>

            <div class="my-6 border-t border-outline-gray-2" />

            <!-- Frappe Partner (no card, just a divider above) -->
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <h2 class="text-base font-semibold text-ink-gray-9">Frappe Partner</h2>
                <p class="mt-0.5 text-p-sm text-ink-gray-5">Manage partner access to your account</p>
              </div>
              <Button variant="subtle" size="sm" :label="store.partnerCode ? 'Edit Partner Code' : 'Add Partner Code'" icon-left="lucide-square-pen" @click="openPartner" />
            </div>
            <p v-if="store.partnerCode" class="mt-3 text-p-sm text-ink-gray-6">
              Linked with Partner code <span class="font-mono font-medium text-ink-gray-8">{{ store.partnerCode }}</span>.
            </p>
            <p v-else class="mt-3 text-p-sm text-ink-gray-5">
              Have a Frappe Partner Referral Code? Click on <span class="font-medium text-ink-gray-8">Add Partner Code</span> to link with your Partner team.
            </p>
          </div>

          <!-- ───────── Notifications ───────── -->
          <div v-else-if="tab === 'notifications'">
            <h2 class="text-xl font-semibold text-ink-gray-9">Notifications</h2>
            <p class="mt-1 text-p-base text-ink-gray-5">Choose which notifications you want to receive.</p>
            <div class="mt-6 divide-y divide-outline-gray-2">
              <div v-for="n in notifyRows" :key="n.key" class="flex items-center justify-between gap-4 py-4 first:pt-0">
                <span class="text-sm text-ink-gray-8">{{ n.label }}</span>
                <Switch v-model="store.notificationPrefs[n.key]" />
              </div>
            </div>
          </div>

          <!-- ───────── Account settings ───────── -->
          <div v-else>
            <h2 class="text-xl font-semibold text-ink-gray-9">Account settings</h2>
            <p class="mt-1 text-p-base text-ink-gray-5">Security and sign-in for your account.</p>

            <div class="mt-6 flex items-start justify-between gap-4">
              <div class="min-w-0">
                <div class="text-base font-semibold text-ink-gray-9">Enable 2FA</div>
                <p class="mt-0.5 text-p-sm text-ink-gray-5">Enable two-factor authentication for your account to add an extra layer of security.</p>
              </div>
              <Switch v-model="store.twoFactorEnabled" class="mt-0.5 shrink-0" />
            </div>

            <!-- Appears once 2FA is toggled on — no repeated heading. -->
            <div v-if="store.twoFactorEnabled" class="mt-6 border-t border-outline-gray-2 pt-6">
              <div class="flex justify-center">
                <svg :viewBox="`0 0 ${QR_N} ${QR_N}`" class="size-28 rounded-lg ring-1 ring-outline-gray-2" shape-rendering="crispEdges" aria-label="2FA QR code">
                  <rect :width="QR_N" :height="QR_N" fill="white" />
                  <rect v-for="(c, i) in qrCells" :key="i" :x="c.x" :y="c.y" width="1" height="1" fill="currentColor" class="text-ink-gray-9" />
                </svg>
              </div>

              <div class="mt-5 rounded-lg border border-outline-gray-2 bg-surface-gray-1 p-4 text-p-sm text-ink-gray-6">
                <div class="font-medium text-ink-gray-8">Steps to Enable 2FA</div>
                <ul class="mt-2 list-disc space-y-1 pl-4">
                  <li>Download an authenticator app, such as Google Authenticator or Aegis, or a browser extension like 1Password.</li>
                  <li>Scan the QR code above.</li>
                  <li>Unable to scan? Use the <span class="font-mono text-ink-gray-8">{{ setupKey }}</span> setup key to configure it manually.</li>
                  <li>Enter the code from the authenticator app below.</li>
                </ul>
                <p class="mt-3 text-ink-gray-5">
                  <span class="font-medium text-ink-gray-7">Note:</span> If you lose access to your authenticator app, your account will be locked out. Make sure to back up your vault/key.
                </p>
              </div>

              <div class="mt-5">
                <FormControl v-model="code2fa" type="text" label="Verify the code from the app to enable 2FA" placeholder="123456" />
                <Button variant="solid" class="mt-3 w-full" label="Enable 2FA" :disabled="code2fa.trim().length < 6" @click="confirm2fa" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
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

  <!-- Partner code -->
  <Dialog v-model:open="partnerOpen" size="sm">
    <template #title><span class="text-xl font-semibold text-ink-gray-9">{{ store.partnerCode ? 'Edit Partner Code' : 'Add Partner Code' }}</span></template>
    <FormControl v-model="partnerInput" type="text" label="Frappe Partner Referral Code" placeholder="e.g. 4F8A2C" />
    <template #actions>
      <div class="flex justify-end gap-2"><Button label="Cancel" @click="partnerOpen = false" /><Button variant="solid" label="Save" @click="savePartner" /></div>
    </template>
  </Dialog>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { Avatar, Button, Dialog, FormControl, Switch, toast } from 'frappe-ui'
import { useCloudStore } from '../stores/cloud'

const open = defineModel('open', { type: Boolean, default: false })
const store = useCloudStore()

const tab = ref('profile')
const tabs = [
  { value: 'profile', label: 'Profile', icon: 'lucide-user' },
  { value: 'notifications', label: 'Notifications', icon: 'lucide-bell' },
  { value: 'account', label: 'Account settings', icon: 'lucide-settings' },
]

const referralLink = computed(() => `https://cloud.frappe.io/dashboard/signup?referrer=${store.referralCode}`)
const setupKey = computed(() => store.referralCode.toUpperCase().match(/.{1,4}/g)?.join(' ') || 'XXXX XXXX')

function copy(text) {
  navigator.clipboard?.writeText(text)
  toast.success('Copied')
}

const notifyRows = [
  { key: 'product', label: 'Product Updates' },
  { key: 'billing', label: 'Billing and invoices' },
  { key: 'security', label: 'Security alerts' },
]

// ── 2FA ───────────────────────────────────────────────────────
const code2fa = ref('')
function confirm2fa() {
  if (code2fa.value.trim().length < 6) return
  toast.success('Two-factor authentication enabled')
  code2fa.value = ''
}

// A faithful-looking faux QR: three finder patterns + a deterministic field.
const QR_N = 21
function isFinder(x, y) {
  const inBox = (ox, oy) => {
    const dx = x - ox
    const dy = y - oy
    if (dx < 0 || dy < 0 || dx > 6 || dy > 6) return false
    const border = dx === 0 || dx === 6 || dy === 0 || dy === 6
    const core = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4
    return border || core
  }
  return inBox(0, 0) || inBox(QR_N - 7, 0) || inBox(0, QR_N - 7)
}
const qrCells = computed(() => {
  const cells = []
  const reserved = (x, y) =>
    (x < 8 && y < 8) || (x > QR_N - 9 && y < 8) || (x < 8 && y > QR_N - 9)
  for (let y = 0; y < QR_N; y++) {
    for (let x = 0; x < QR_N; x++) {
      let on
      if (reserved(x, y)) on = isFinder(x, y)
      else {
        const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
        on = s - Math.floor(s) > 0.55
      }
      if (on) cells.push({ x, y })
    }
  }
  return cells
})

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

// ── Partner code ──────────────────────────────────────────────
const partnerOpen = ref(false)
const partnerInput = ref('')
function openPartner() {
  partnerInput.value = store.partnerCode
  partnerOpen.value = true
}
function savePartner() {
  store.setPartnerCode(partnerInput.value)
  toast.success(store.partnerCode ? 'Partner code linked' : 'Partner code removed')
  partnerOpen.value = false
}
</script>

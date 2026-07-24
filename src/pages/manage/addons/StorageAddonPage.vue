<template>
  <AddonShell addon-key="storage">
    <div class="mt-8">
      <TabButtons v-model="tab" :options="tabs" />

      <!-- ── Buckets ────────────────────────────────────────────────── -->
      <template v-if="tab === 'buckets'">
        <section class="mt-6">
          <!-- No "Buckets" heading — the active tab already names this. -->
          <div class="flex justify-end">
            <Button variant="subtle" size="sm" label="New bucket" icon-left="lucide-plus" @click="newBucketOpen = true" />
          </div>

          <div v-if="buckets.length" class="mt-3 divide-y divide-outline-alpha-gray-1 border-t border-outline-alpha-gray-1">
            <div v-for="b in buckets" :key="b.id" class="flex items-center gap-3 py-2.5">
              <span class="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-gray-2 text-ink-gray-6">
                <span class="lucide-box size-4" />
              </span>
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-medium text-ink-gray-9">{{ b.name }}</div>
                <div class="truncate text-p-sm text-ink-gray-5">{{ b.region }} · {{ b.objects.toLocaleString('en-IN') }} objects</div>
              </div>
              <span class="shrink-0 text-sm tabular-nums text-ink-gray-8">{{ b.sizeGb }} GB</span>
              <Dropdown :options="bucketMenu(b)" placement="bottom-end">
                <button class="rounded p-1 text-ink-gray-5 hover:bg-surface-gray-2" :aria-label="`Actions for ${b.name}`"><span class="lucide-ellipsis size-4" /></button>
              </Dropdown>
            </div>
          </div>
          <EmptyState
            v-else
            class="mt-3"
            icon="lucide-box"
            title="No buckets"
            description="A bucket is where your files live."
          >
            <Button variant="subtle" size="sm" label="Create bucket" icon-left="lucide-plus" @click="newBucketOpen = true" />
          </EmptyState>
        </section>
      </template>

      <!-- ── Access keys ────────────────────────────────────────────── -->
      <template v-else>
        <section class="mt-6">
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-base font-semibold text-ink-gray-8">Endpoint</h2>
            <button class="flex items-center gap-1.5 text-p-sm text-ink-gray-6 transition-colors hover:text-ink-gray-9" @click="copy(ENDPOINT)">
              <span class="lucide-copy size-3.5" />
              Copy
            </button>
          </div>
          <p class="mt-1 font-mono text-p-sm text-ink-gray-7">{{ ENDPOINT }}</p>
          <p class="mt-2 text-p-sm text-ink-gray-5">Works with the AWS CLI, boto3, rclone — anything that speaks S3.</p>
        </section>

        <section class="mt-8 border-t border-outline-gray-2 pt-8">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-1.5">
              <h2 class="text-base font-semibold text-ink-gray-8">Access keys</h2>
              <Tooltip text="The secret is shown once when created. Revoke and make a new pair if you lose it.">
                <span class="lucide-info size-3.5 text-ink-gray-4" />
              </Tooltip>
            </div>
            <Button variant="ghost" size="sm" icon="lucide-plus" aria-label="New access key" @click="newKeyOpen = true" />
          </div>

          <div v-if="accessKeys.length" class="mt-2 divide-y divide-outline-alpha-gray-1">
            <div v-for="k in accessKeys" :key="k.id" class="flex items-center gap-3 py-2.5">
              <span class="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-gray-2 text-ink-gray-6">
                <span class="lucide-key-round size-4" />
              </span>
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-medium text-ink-gray-9">{{ k.label }}</div>
                <div class="truncate font-mono text-p-sm text-ink-gray-5">FCS••••{{ k.tail }}</div>
              </div>
              <span class="shrink-0 text-p-sm text-ink-gray-5">Added {{ k.created }}</span>
              <Dropdown :options="keyMenu(k)" placement="bottom-end">
                <button class="rounded p-1 text-ink-gray-5 hover:bg-surface-gray-2" :aria-label="`Actions for ${k.label}`"><span class="lucide-ellipsis size-4" /></button>
              </Dropdown>
            </div>
          </div>
          <EmptyState
            v-else
            class="mt-3"
            icon="lucide-key-round"
            title="No access keys"
            description="You need a key pair to read or write objects."
          >
            <Button variant="subtle" size="sm" label="New access key" icon-left="lucide-plus" @click="newKeyOpen = true" />
          </EmptyState>
        </section>
      </template>
    </div>

    <Dialog v-model:open="newBucketOpen" title="Create bucket" size="sm">
      <FormControl v-model="newBucketName" type="text" label="Name" placeholder="e.g. acme-uploads" />
      <p class="mt-2 text-p-sm text-ink-gray-5">Lowercase letters, numbers and dashes. The name can't be changed later.</p>
      <template #actions>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" @click="newBucketOpen = false" />
          <Button variant="solid" label="Create" :disabled="!newBucketName.trim()" @click="createBucket" />
        </div>
      </template>
    </Dialog>

    <Dialog v-model:open="newKeyOpen" title="New access key" size="sm">
      <FormControl v-model="newKeyLabel" type="text" label="Name" placeholder="e.g. Backups" />
      <p class="mt-2 text-p-sm text-ink-gray-5">The secret is shown once, right after you create it.</p>
      <template #actions>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" @click="newKeyOpen = false" />
          <Button variant="solid" label="Create" :disabled="!newKeyLabel.trim()" @click="createKey" />
        </div>
      </template>
    </Dialog>

    <SecretDialog v-model:open="secretOpen" title="Your new access key" :fields="secretFields" />

    <ConfirmDialog
      v-model:open="confirmOpen"
      :title="confirmTitle"
      :message="confirmMessage"
      :confirm-label="confirmLabel"
      theme="red"
      @confirm="runConfirm"
    />
  </AddonShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Button, Dialog, Dropdown, FormControl, TabButtons, Tooltip, toast } from 'frappe-ui'
import AddonShell from '../../../components/AddonShell.vue'
import ConfirmDialog from '../../../components/ConfirmDialog.vue'
import EmptyState from '../../../components/EmptyState.vue'
import SecretDialog from '../../../components/SecretDialog.vue'
import { useCloudStore } from '../../../stores/cloud'

const store = useCloudStore()

const ENDPOINT = 'https://storage.frappe.cloud'

const tab = ref('buckets')
const tabs = [
  { label: 'Buckets', value: 'buckets' },
  { label: 'Access keys', value: 'keys' },
]

const buckets = computed(() => store.addonState('storage').buckets || [])
const accessKeys = computed(() => store.addonState('storage').accessKeys || [])

function patch(changes) {
  store.addons.storage = { ...store.addonState('storage'), ...changes }
}

function copy(text) {
  navigator.clipboard?.writeText(text)
  toast.success('Endpoint copied')
}

// — Buckets
const newBucketOpen = ref(false)
const newBucketName = ref('')

function createBucket() {
  const name = newBucketName.value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-')
  newBucketOpen.value = false
  newBucketName.value = ''
  patch({ buckets: [...buckets.value, { id: `bkt-${name}`, name, region: 'Mumbai (ap-south-1)', objects: 0, sizeGb: 0 }] })
  toast.success(`Created ${name}`)
}

// — Access keys
const newKeyOpen = ref(false)
const newKeyLabel = ref('')

const secretOpen = ref(false)
const secretFields = ref([])

function createKey() {
  const label = newKeyLabel.value.trim()
  newKeyOpen.value = false
  newKeyLabel.value = ''
  const id = 'FCS' + Array.from({ length: 17 }, () => Math.random().toString(36)[2].toUpperCase()).join('')
  const secret = Array.from({ length: 40 }, () => Math.random().toString(36)[2]).join('')
  const tail = id.slice(-4)
  patch({ accessKeys: [...accessKeys.value, { id: `ak-${tail}`, label, tail, created: 'just now' }] })
  // An S3 pair is only usable together, so both are revealed in one moment.
  secretFields.value = [
    { label: 'Access key ID', value: id },
    { label: 'Secret access key', value: secret },
  ]
  secretOpen.value = true
}

// — Confirmations. Both destructive actions here share one dialog; the pending
// action decides what it says and what it does.
const confirmOpen = ref(false)
const pending = ref(null)

const confirmTitle = computed(() => (pending.value?.type === 'bucket' ? 'Delete this bucket?' : 'Revoke this key?'))
const confirmMessage = computed(() =>
  pending.value?.type === 'bucket'
    ? `Everything in ${pending.value.item.name} is deleted and can't be recovered.`
    : 'Anything still using it stops working immediately. Other keys are unaffected.',
)
const confirmLabel = computed(() => (pending.value?.type === 'bucket' ? 'Delete' : 'Revoke'))

function bucketMenu(b) {
  return [{ label: 'Delete', icon: 'lucide-trash-2', onClick: () => { pending.value = { type: 'bucket', item: b }; confirmOpen.value = true } }]
}

function keyMenu(k) {
  return [{ label: 'Revoke', icon: 'lucide-trash-2', onClick: () => { pending.value = { type: 'key', item: k }; confirmOpen.value = true } }]
}

function runConfirm() {
  const p = pending.value
  if (!p) return
  if (p.type === 'bucket') {
    patch({ buckets: buckets.value.filter((b) => b.id !== p.item.id) })
    toast.success(`Deleted ${p.item.name}`)
  } else {
    patch({ accessKeys: accessKeys.value.filter((k) => k.id !== p.item.id) })
    toast.success(`Revoked ${p.item.label}`)
  }
  pending.value = null
}
</script>

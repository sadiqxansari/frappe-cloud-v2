<template>
  <Dropdown :options="options" placement="bottom-end">
    <Button variant="ghost" icon="lucide-ellipsis-vertical" :label="`Actions for ${server.name}`" />
  </Dropdown>

  <!-- Rename -->
  <Dialog v-model:open="renameOpen" title="Rename server" size="sm">
    <FormControl v-model="newName" type="text" label="Server name" :placeholder="server.name" />
    <template #actions>
      <div class="flex justify-end gap-2">
        <Button label="Cancel" @click="renameOpen = false" />
        <Button variant="solid" label="Rename" :disabled="!newName.trim()" @click="doRename" />
      </div>
    </template>
  </Dialog>

  <!-- Drop server (type to confirm) -->
  <Dialog v-model:open="dropOpen" title="Drop this server" size="sm">
    <p class="text-p-base text-ink-gray-6">
      This permanently removes <span class="font-medium text-ink-gray-8">{{ server.name }}</span> and all its sites.
      Backups are kept for 30 days.
    </p>
    <FormControl v-model="dropTyped" type="text" class="mt-4" :label="`Type ${server.name} to confirm`" :placeholder="server.name" />
    <template #actions>
      <div class="flex justify-end gap-2">
        <Button label="Cancel" @click="dropOpen = false" />
        <Button variant="solid" theme="red" label="Drop server" :disabled="!dropMatches" @click="doDrop" />
      </div>
    </template>
  </Dialog>

  <!-- Restart / suspend / duplicate -->
  <ConfirmDialog
    v-model:open="confirmOpen"
    :title="confirm.title"
    :message="confirm.message"
    :theme="confirm.theme"
    :confirm-label="confirm.label"
    @confirm="onConfirm"
  />

  <!-- Central-only: quick overview + the plan/migration flow live in this menu. -->
  <template v-if="central">
    <ServerOverviewModal v-model:open="overviewOpen" :server="server" />
    <ChangePlanDialog v-model:open="changePlanOpen" :server="server" />
  </template>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button, Dialog, Dropdown, FormControl, toast } from 'frappe-ui'
import ConfirmDialog from './ConfirmDialog.vue'
import ServerOverviewModal from './ServerOverviewModal.vue'
import ChangePlanDialog from './ChangePlanDialog.vue'
import { useCloudStore } from '../stores/cloud'

const props = defineProps({
  server: { type: Object, required: true },
  // In Central the dropdown also carries the overview and the plan/migration
  // flow; inside a server workspace it stays to lifecycle actions only.
  central: { type: Boolean, default: false },
})

const store = useCloudStore()
const router = useRouter()

const renameOpen = ref(false)
const dropOpen = ref(false)
const confirmOpen = ref(false)
const overviewOpen = ref(false)
const changePlanOpen = ref(false)

const newName = ref('')
const dropTyped = ref('')
const pendingKind = ref(null)
const confirm = ref({ title: '', message: '', theme: 'gray', label: 'Confirm' })

const dropMatches = computed(() => dropTyped.value.trim().toLowerCase() === props.server.name.toLowerCase())

// Restart is the everyday lifecycle action, so it sits at the top level.
const restartOption = { label: 'Restart', icon: 'lucide-rotate-cw', onClick: () => ask('restart') }

// The rest — occasional or destructive — live under "More".
const moreOptions = computed(() => [
  { label: 'Rename', icon: 'lucide-pencil', onClick: openRename },
  {
    label: props.server.status === 'suspended' ? 'Resume' : 'Suspend',
    icon: props.server.status === 'suspended' ? 'lucide-play' : 'lucide-pause',
    onClick: () => ask('suspend'),
  },
  { label: 'Duplicate', icon: 'lucide-copy', onClick: () => ask('duplicate') },
  { label: 'Drop server', icon: 'lucide-trash-2', onClick: () => { dropTyped.value = ''; dropOpen.value = true } },
])

const options = computed(() =>
  // In Central the menu leads with the common moves — overview, plan, restart —
  // and tucks the rest into "More" so the top level stays short.
  props.central
    ? [
        { label: 'Overview', icon: 'lucide-gauge', onClick: () => { overviewOpen.value = true } },
        { label: 'Change plan', icon: 'lucide-scaling', onClick: () => { changePlanOpen.value = true } },
        restartOption,
        { label: 'More', icon: 'lucide-ellipsis', submenu: moreOptions.value },
      ]
    : [restartOption, ...moreOptions.value],
)

function openRename() {
  newName.value = props.server.name
  renameOpen.value = true
}
function doRename() {
  store.renameServer(props.server.id, newName.value)
  toast.success('Server renamed')
  renameOpen.value = false
}
function doDrop() {
  const n = props.server.name
  store.dropServer(props.server.id)
  toast.success(`${n} dropped`)
  dropOpen.value = false
  router.push('/servers')
}

function ask(kind) {
  pendingKind.value = kind
  const s = props.server
  if (kind === 'restart') {
    confirm.value = { title: `Restart ${s.name}?`, message: 'Your sites stay up; services reconnect in a few seconds.', theme: 'gray', label: 'Restart' }
  } else if (kind === 'suspend') {
    confirm.value =
      s.status === 'suspended'
        ? { title: `Resume ${s.name}?`, message: 'Its sites come back online.', theme: 'gray', label: 'Resume' }
        : { title: `Suspend ${s.name}?`, message: 'Its sites go offline until you resume. Nothing is deleted.', theme: 'gray', label: 'Suspend' }
  } else if (kind === 'duplicate') {
    confirm.value = { title: `Duplicate ${s.name}?`, message: 'Same plan, region and version.', theme: 'gray', label: 'Duplicate' }
  }
  confirmOpen.value = true
}

function onConfirm() {
  const s = props.server
  if (pendingKind.value === 'restart') {
    toast.promise(store.restartServer(s.id), { loading: `Restarting ${s.name}…`, success: `${s.name} restarted`, error: 'Restart failed' })
  } else if (pendingKind.value === 'suspend') {
    const on = s.status !== 'suspended'
    store.setServerSuspended(s.id, on)
    toast.success(on ? `${s.name} suspended` : `${s.name} resumed`)
  } else if (pendingKind.value === 'duplicate') {
    const ns = store.duplicateServer(s.id)
    toast.success(`Duplicating ${s.name}…`)
    if (ns) router.push(`/manage/${ns.id}`)
  }
}
</script>

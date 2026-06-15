<template>
  <Dropdown :options="options" placement="bottom-end">
    <Button variant="ghost" icon="lucide-ellipsis-vertical" :label="`Actions for ${server.name}`" />
  </Dropdown>

  <!-- Rename -->
  <Dialog v-model:open="renameOpen" size="sm">
    <template #title><span class="text-xl font-semibold text-ink-gray-9">Rename server</span></template>
    <FormControl v-model="newName" type="text" label="Server name" :placeholder="server.name" />
    <template #actions>
      <div class="flex justify-end gap-2">
        <Button label="Cancel" @click="renameOpen = false" />
        <Button variant="solid" label="Rename" :disabled="!newName.trim()" @click="doRename" />
      </div>
    </template>
  </Dialog>

  <!-- Resize / change plan -->
  <ResizeDialog v-model:open="resizeOpen" :server="server" />

  <!-- Drop server (type to confirm) -->
  <Dialog v-model:open="dropOpen" size="sm">
    <template #title><span class="text-xl font-semibold text-ink-gray-9">Drop this server</span></template>
    <p class="text-base text-ink-gray-6">
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
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button, Dialog, Dropdown, FormControl, toast } from 'frappe-ui'
import ConfirmDialog from './ConfirmDialog.vue'
import ResizeDialog from './ResizeDialog.vue'
import { useCloudStore } from '../stores/cloud'

const props = defineProps({
  server: { type: Object, required: true },
})

const store = useCloudStore()
const router = useRouter()

const renameOpen = ref(false)
const resizeOpen = ref(false)
const dropOpen = ref(false)
const confirmOpen = ref(false)

const newName = ref('')
const dropTyped = ref('')
const pendingKind = ref(null)
const confirm = ref({ title: '', message: '', theme: 'gray', label: 'Confirm' })

const dropMatches = computed(() => dropTyped.value.trim().toLowerCase() === props.server.name.toLowerCase())

const options = computed(() => [
  { label: 'Rename', icon: 'lucide-pencil', onClick: openRename },
  { label: 'Change plan', icon: 'lucide-scaling', onClick: () => (resizeOpen.value = true) },
  { label: 'Restart', icon: 'lucide-rotate-cw', onClick: () => ask('restart') },
  {
    label: props.server.status === 'suspended' ? 'Resume' : 'Suspend',
    icon: props.server.status === 'suspended' ? 'lucide-play' : 'lucide-pause',
    onClick: () => ask('suspend'),
  },
  { label: 'Duplicate', icon: 'lucide-copy', onClick: () => ask('duplicate') },
  { label: 'Drop server', icon: 'lucide-trash-2', onClick: () => { dropTyped.value = ''; dropOpen.value = true } },
])

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
    confirm.value = { title: `Duplicate ${s.name}?`, message: 'Creates a new server with the same plan, region and version.', theme: 'gray', label: 'Duplicate' }
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

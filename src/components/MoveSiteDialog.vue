<template>
  <Dialog v-model:open="open" size="lg">
    <template #title>
      <span class="text-xl font-semibold text-ink-gray-9">
        {{ requiredVersion ? `Move to ${versionById(effectiveVersion).label}` : 'Change version' }}
      </span>
    </template>

    <p class="text-p-base text-ink-gray-6">
      A site's version comes from the server it runs on — so {{ site.name }} moves to a server running the
      version you pick. The address stays the same; visitors won't notice.
    </p>

    <!-- Which version, when the caller didn't fix one -->
    <div v-if="!requiredVersion" class="mt-4">
      <TabButtons v-model="pickedVersion" :buttons="versionTabs" />
    </div>

    <div class="mt-4 space-y-2">
      <button
        v-for="srv in candidates"
        :key="srv.id"
        class="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors"
        :class="choice === srv.id ? 'border-outline-gray-4 ring-1 ring-outline-gray-4' : 'border-outline-gray-2 hover:bg-surface-gray-1'"
        @click="choice = srv.id"
      >
        <span class="lucide-server size-4 shrink-0 text-ink-gray-5" />
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-medium text-ink-gray-9">{{ srv.name }}</span>
          <span class="block text-xs text-ink-gray-5">
            {{ store.regionOf(srv).name }} · {{ srv.version }} · {{ store.planOf(srv).name }} plan · no extra cost
          </span>
        </span>
        <span class="text-sm text-ink-gray-5">{{ srv.sites.length }} {{ srv.sites.length === 1 ? 'site' : 'sites' }}</span>
      </button>

      <button
        class="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors"
        :class="choice === 'new' ? 'border-outline-gray-4 ring-1 ring-outline-gray-4' : 'border-outline-gray-2 hover:bg-surface-gray-1'"
        @click="choice = 'new'"
      >
        <span class="lucide-plus size-4 shrink-0 text-ink-gray-5" />
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-medium text-ink-gray-9">
            A new server running {{ versionById(effectiveVersion).label }}
          </span>
          <span class="block text-xs text-ink-gray-5">
            Same size as now — {{ store.planOf(server).name }}, {{ store.regionOf(server).name }}
          </span>
        </span>
      </button>
    </div>

    <!-- A new server is a new bill — say it plainly before the click -->
    <div
      v-if="choice === 'new'"
      class="mt-3 flex items-start gap-2.5 rounded-lg border border-outline-amber-1 bg-surface-amber-1 px-3 py-2.5"
    >
      <span class="lucide-info mt-0.5 size-4 shrink-0 text-ink-amber-4" />
      <p class="text-p-sm text-ink-amber-4">
        This adds a second server to your bill — {{ inr(newPrice) }}/month (≈{{ inr(Math.round(newPrice / 30)) }}/day),
        on top of what you pay today. Your current server keeps running for your other sites.
      </p>
    </div>

    <template #actions>
      <div class="flex justify-end gap-2">
        <Button label="Cancel" @click="open = false" />
        <Button
          variant="solid"
          :label="choice === 'new' ? `Create server & move — ${inr(newPrice)}/mo` : 'Move site'"
          @click="move"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Button, Dialog, TabButtons, toast } from 'frappe-ui'
import { VERSIONS, priceFor, versionById } from '../data/catalog'
import { useCloudStore } from '../stores/cloud'
import { inr } from '../utils/format'

const props = defineProps({
  site: { type: Object, required: true },
  server: { type: Object, required: true },
  // When set, only servers on this version qualify (e.g. from the marketplace).
  requiredVersion: { type: String, default: null },
})

const open = defineModel('open', { type: Boolean, default: false })
const emit = defineEmits(['moved'])

const store = useCloudStore()

// Free version choice when the caller didn't pin one.
const pickedVersion = ref(null)
const versionTabs = computed(() =>
  VERSIONS.filter((v) => v.id !== props.server.version).map((v) => ({ label: v.label, value: v.id })),
)

const effectiveVersion = computed(() => props.requiredVersion || pickedVersion.value)

const candidates = computed(() =>
  store.servers.filter(
    (s) =>
      s.id !== props.server.id &&
      s.status === 'active' &&
      s.version === effectiveVersion.value,
  ),
)

const choice = ref('new')

watch(open, (isOpen) => {
  if (isOpen) {
    pickedVersion.value = props.requiredVersion || versionTabs.value[0]?.value
    choice.value = candidates.value[0]?.id || 'new'
  }
})

// Re-pick when the version changes — candidates change with it.
watch(effectiveVersion, () => {
  choice.value = candidates.value[0]?.id || 'new'
})

const newPrice = computed(() => priceFor(props.server.planId, props.server.regionId))

function move() {
  let target
  if (choice.value === 'new') {
    target = store.addServer({
      name: `My ${effectiveVersion.value} server`,
      planId: props.server.planId,
      regionId: props.server.regionId,
      version: effectiveVersion.value,
    })
  } else {
    target = store.findServer(choice.value)
  }
  store.moveSite(props.site.id, target.id)
  open.value = false
  toast.success(`Moving ${props.site.name} to ${target.name}`)
  emit('moved', target)
}
</script>

<template>
  <!-- One marketplace app: icon · name + tagline · action. Shared by all
       marketplace views. Spacing between rows is handled by the parent grid gap. -->
  <div class="flex items-center gap-3">
    <AppIcon :app-key="app.key" size="md" class="shrink-0" />
    <div class="flex min-w-0 flex-1 items-center justify-between gap-2 py-2">
      <div class="min-w-0">
        <div class="flex items-center gap-1.5">
          <span class="truncate text-base font-medium text-ink-gray-8">{{ app.name }}</span>
          <span class="shrink-0 text-p-xs text-ink-gray-5">{{ app.version }}</span>
        </div>
        <div class="truncate text-p-sm text-ink-gray-5">{{ app.tagline }}</div>
      </div>

      <!-- Already installed — hover crossfades the checkmark into an uninstall action. -->
      <Tooltip v-if="app.installedHere" :text="canUninstall ? 'Uninstall' : 'Installed'">
        <button
          type="button"
          class="group relative grid size-7 shrink-0 place-items-center rounded transition-[background-color,transform] duration-150 ease-[var(--ease-out)]"
          :class="canUninstall ? 'hover:bg-surface-red-2 active:scale-95' : 'cursor-default'"
          aria-label="Installed"
          @click="canUninstall && $emit('uninstall')"
        >
          <span
            class="size-4 text-ink-green-6 lucide-check transition-[opacity,transform] duration-150 ease-[var(--ease-out)]"
            :class="canUninstall ? 'group-hover:scale-90 group-hover:opacity-0' : ''"
          />
          <span
            v-if="canUninstall"
            class="absolute inset-0 m-auto size-4 scale-90 text-ink-red-5 opacity-0 lucide-trash-2 transition-[opacity,transform] duration-150 ease-[var(--ease-out)] group-hover:scale-100 group-hover:opacity-100"
          />
        </button>
      </Tooltip>

      <!-- Version mismatch: opens a dialog comparing current vs required version. -->
      <Tooltip v-else-if="!app.compatible" :text="`Requires ${app.needs ? app.needs : 'a newer Frappe version'}`">
        <Button variant="ghost" label="Install" class="!text-ink-gray-4" @click="showIncompatible = true">
          <template #icon><span class="lucide-download size-4" /></template>
        </Button>
      </Tooltip>

      <!-- Installable. -->
      <Tooltip v-else :text="`Install ${app.name}`">
        <Button variant="ghost" label="Install" class="group" @click="$emit('install')">
          <template #icon>
            <span
              class="lucide-download size-4 transition-transform duration-150 ease-[var(--ease-out)] group-hover:translate-y-0.5 group-active:scale-95 group-active:duration-100"
            />
          </template>
        </Button>
      </Tooltip>
    </div>

    <Dialog v-model:open="showIncompatible" title="Incompatible app" size="sm">
      <template #body-content>
        <p class="text-sm text-ink-gray-7">{{ app.name }} needs {{ app.needs || 'a newer Frappe version' }} to install.</p>
        <div class="mt-3 flex flex-col gap-1.5 text-sm">
          <div class="flex justify-between">
            <span class="text-ink-gray-5">Current version</span>
            <span class="font-medium text-ink-gray-8">{{ versionLabel || 'Unknown' }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-ink-gray-5">Required version</span>
            <span class="font-medium text-ink-gray-8">{{ app.needs || 'Not specified' }}</span>
          </div>
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Button, Dialog, Tooltip } from 'frappe-ui'
import AppIcon from './AppIcon.vue'

defineProps({
  app: { type: Object, required: true },
  versionLabel: { type: String, default: '' },
  canUninstall: { type: Boolean, default: true },
})
defineEmits(['install', 'uninstall'])

const showIncompatible = ref(false)
</script>

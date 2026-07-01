<template>
  <!-- One marketplace app: icon on the left, name + tagline in the middle, and a
       single context-dependent control on the right. Shared by every marketplace
       view (featured, category sections, category detail, search results) so the
       row looks and behaves identically everywhere. -->
  <div class="flex items-center gap-2.5 border-b border-outline-gray-2 py-4">
    <AppIcon :app-key="app.key" size="md" class="shrink-0" />
    <div class="flex min-w-0 flex-1 items-center justify-between gap-2">
      <div class="min-w-0">
        <div class="flex items-center gap-1.5">
          <span class="truncate text-base font-medium text-ink-gray-8">{{ app.name }}</span>
          <span class="shrink-0 text-p-xs text-ink-gray-5">{{ app.version }}</span>
        </div>
        <div v-if="failed" class="truncate text-p-sm text-ink-red-6">Install failed — build error</div>
        <div v-else class="truncate text-p-sm text-ink-gray-5">{{ app.tagline }}</div>
      </div>

      <!-- Installing: a determinate ring that fills over ~30s, with a stop
           control in the center to cancel mid-flight. -->
      <div v-if="installing" class="relative grid size-7 shrink-0 place-items-center">
        <svg class="size-7 -rotate-90" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="var(--surface-gray-3)" stroke-width="2.5" />
          <circle
            cx="12" cy="12" r="9"
            stroke="var(--ink-gray-8)" stroke-width="2.5" stroke-linecap="round"
            :stroke-dasharray="RING_C"
            :stroke-dashoffset="RING_C * (1 - (progress || 0) / 100)"
            class="transition-[stroke-dashoffset] duration-200 ease-linear"
          />
        </svg>
        <Tooltip text="Cancel install">
          <button class="absolute inset-0 grid place-items-center text-ink-gray-6 hover:text-ink-gray-9" aria-label="Cancel install" @click="$emit('cancel')">
            <span class="lucide-x size-3" />
          </button>
        </Tooltip>
      </div>

      <!-- Failed: name turns red above; offer a retry and the log. -->
      <div v-else-if="failed" class="flex shrink-0 items-center gap-1">
        <Button size="xs" variant="ghost" label="View log" @click="$emit('view-log')" />
        <Button size="sm" variant="subtle" label="Retry" @click="$emit('retry')" />
      </div>

      <!-- Already installed on the site we arrived from — a disabled button, so it
           reads as a resolved state rather than an available action. -->
      <Button v-else-if="app.installedHere" size="sm" label="Installed" disabled class="shrink-0 pointer-events-none" />

      <!-- Not installed, version-locked: a disabled Install, with the reason on
           hover. -->
      <Tooltip v-else-if="!app.compatible" :text="`Needs ${app.needs} — this server runs ${versionLabel}`">
        <span class="inline-flex shrink-0">
          <Button size="sm" label="Install" disabled class="pointer-events-none" />
        </span>
      </Tooltip>

      <!-- Not installed, installable. -->
      <Button v-else size="sm" label="Install" class="shrink-0" @click="$emit('install')" />
    </div>
  </div>
</template>

<script setup>
import { Button, Tooltip } from 'frappe-ui'
import AppIcon from './AppIcon.vue'

defineProps({
  app: { type: Object, required: true },
  versionLabel: { type: String, default: '' },
  installing: { type: Boolean, default: false },
  progress: { type: Number, default: 0 },
  failed: { type: Boolean, default: false },
})
defineEmits(['install', 'cancel', 'retry', 'view-log'])

const RING_C = 2 * Math.PI * 9
</script>

<template>
  <div class="mt-5">
    <div class="flex flex-col gap-2 sm:flex-row">
      <FormControl v-model="searchModel" class="flex-1 [&_input]:w-full" type="text" placeholder="Search for any app" autocomplete="off">
        <template #prefix>
          <LucideSearch class="size-4 text-ink-gray-5" />
        </template>
      </FormControl>

      <div class="flex gap-2">
        <Dropdown :options="worksWithMenu" placement="bottom-end">
          <template #default="{ open }">
            <Button class="w-32 [&>.truncate]:flex-1 [&>.truncate]:text-left" :active="open">
              <template #suffix><span class="size-4 shrink-0 lucide-chevron-down" /></template>
              {{ worksWithLabel }}
            </Button>
          </template>
        </Dropdown>

        <Button variant="subtle" @click="$emit('add-from-github')">
          <template #prefix><GithubMark class="size-4" /></template>
          Import app
        </Button>
      </div>
    </div>

    <div class="mt-3 flex flex-wrap gap-1.5">
      <button
        v-for="pill in pills"
        :key="pill.value"
        type="button"
        class="rounded-full border px-3 py-0.5 text-p-sm transition duration-150 ease-[var(--ease-out)] active:scale-[0.97]"
        :class="
          pill.value === pillModel
            ? 'border-outline-gray-2 bg-surface-gray-3 text-ink-gray-9'
            : 'border-outline-gray-2 text-ink-gray-6 hover:bg-surface-gray-1 hover:text-ink-gray-8'
        "
        @click="pillModel = pill.value"
      >
        {{ pill.label }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, h } from 'vue'
import { Button, Dropdown, FormControl } from 'frappe-ui'
import LucideSearch from '~icons/lucide/search'
import AppIcon from './AppIcon.vue'
import GithubMark from './icons/GithubMark.vue'
import { APP_CATEGORIES } from '../data/catalog'

const props = defineProps({
  worksWithOptions: { type: Array, default: () => [] },
})
defineEmits(['add-from-github'])

const searchModel = defineModel('search', { type: String })
const pillModel = defineModel('pill', { type: String })
const worksWithModel = defineModel('worksWith', { type: String })

// Fixed taxonomy — 'All' plus the marketplace's category pills.
const pills = [{ label: 'All', value: 'all' }, ...APP_CATEGORIES]

const worksWithMenu = computed(() => [
  {
    label: 'Any app',
    icon: () => h('span', { class: 'size-4 text-ink-gray-6 lucide-layout-grid' }),
    onClick: () => (worksWithModel.value = ''),
  },
  ...props.worksWithOptions.map((option) => ({
    label: option.name,
    icon: () => h(AppIcon, { appKey: option.key, size: 'sm' }),
    onClick: () => (worksWithModel.value = option.name),
  })),
])

const worksWithLabel = computed(() => (worksWithModel.value ? `Works with ${worksWithModel.value}` : 'Works with'))
</script>

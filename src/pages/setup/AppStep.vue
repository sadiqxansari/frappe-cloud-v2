<template>
  <OnboardingShell :step="2" back="/setup/account">
    <!-- Title with the "what we're setting up" context pinned far right -->
    <div class="flex items-center justify-between gap-3">
      <h1 class="text-xl font-semibold text-ink-gray-9">Name your site</h1>
      <div class="inline-flex shrink-0 items-center gap-2 rounded-full border border-outline-gray-2 bg-surface-gray-1 py-1 pl-1 pr-2.5">
        <AppIcon app-key="erpnext" size="sm" />
        <span class="text-xs font-medium text-ink-gray-7">Setting up ERPNext</span>
      </div>
    </div>
    <p class="mt-1.5 text-p-base text-ink-gray-6">
      This is the web address you'll use to reach it. You can connect a custom domain later.
    </p>

    <!-- The one decision on this screen — give it room -->
    <FormControl
      ref="addressEl"
      v-model="subdomainInput"
      type="text"
      size="md"
      label="Site address"
      placeholder="yourcompany"
      class="site-address mt-6"
      @keydown.enter="go"
    >
      <template #suffix>
        <span class="text-base text-ink-gray-4">.frappe.cloud</span>
      </template>
    </FormControl>

    <!-- Live preview of the full URL + availability -->
    <div class="mt-2 flex min-h-5 items-center gap-1.5 text-p-sm">
      <template v-if="slug">
        <span class="lucide-check size-4 shrink-0 text-ink-green-6" />
        <span class="text-ink-gray-6">
          <span class="font-medium text-ink-gray-8">{{ slug }}.frappe.cloud</span> is available
        </span>
      </template>
      <span v-else class="text-ink-gray-4">Lowercase letters, numbers and hyphens.</span>
    </div>

    <Button variant="solid" size="md" label="Continue" class="mt-6 w-full" :disabled="!slug" @click="go" />
  </OnboardingShell>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button, FormControl } from 'frappe-ui'
import AppIcon from '../../components/AppIcon.vue'
import OnboardingShell from '../../components/OnboardingShell.vue'
import { useCloudStore } from '../../stores/cloud'

const store = useCloudStore()
const router = useRouter()

const subdomainInput = ref(store.onboarding.subdomain)
const addressEl = ref(null)

// Subdomains allow hyphens (just not leading/trailing). Empty ⇒ '' so the
// availability hint and Continue button stay off until something's typed.
const slug = computed(() =>
  subdomainInput.value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30),
)

onMounted(() => nextTick(() => addressEl.value?.$el?.querySelector('input')?.focus()))

function go() {
  if (!slug.value) return
  store.onboarding.subdomain = slug.value
  router.push('/setup/server')
}
</script>

<style scoped>
/* The frappe-ui suffix slot is sized for an icon; widen the input's right
   padding so ".frappe.cloud" never overlaps what the user types. */
.site-address :deep(input) {
  padding-inline-end: 6.75rem;
}
</style>

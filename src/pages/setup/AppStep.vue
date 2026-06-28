<template>
  <OnboardingShell :step="2" back="/setup/account">
    <h1 class="text-xl font-semibold text-ink-gray-9">Name your site</h1>
    <p class="mt-2 text-p-base text-ink-gray-6">
      Your web address — you can add a custom domain later.
    </p>

    <!-- The one decision on this screen — give it room -->
    <FormControl
      ref="addressEl"
      v-model="subdomainInput"
      type="text"
      size="md"
      label="Site address"
      placeholder="yourcompany"
      class="site-address mt-8"
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

    <Button variant="solid" size="md" label="Continue" class="mt-8 w-full" :disabled="!slug" @click="go" />
  </OnboardingShell>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button, FormControl } from 'frappe-ui'
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

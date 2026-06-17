<template>
  <OnboardingShell :step="2" back="/setup/account">
    <h1 class="text-xl font-semibold text-ink-gray-9">What are you setting up?</h1>
    <p class="mt-1.5 text-p-base text-ink-gray-6">
      You followed an ERPNext link, so we've picked it for you.
    </p>

    <div class="mt-6 flex items-center gap-3 rounded-xl border border-outline-gray-2 bg-surface-gray-1 p-3">
      <AppIcon app-key="erpnext" size="md" />
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <span class="font-semibold text-ink-gray-9">ERPNext</span>
          <Badge theme="green" variant="subtle" size="sm" label="Ready to set up" />
        </div>
        <p class="text-p-sm text-ink-gray-6">Accounting, inventory and orders for your business</p>
      </div>
    </div>

    <FormControl
      v-model="subdomainInput"
      type="text"
      size="md"
      label="Choose your site address"
      placeholder="yourcompany"
      class="site-address mt-6"
    >
      <template #suffix>
        <span class="text-base text-ink-gray-4">.frappe.cloud</span>
      </template>
    </FormControl>

    <Button variant="solid" size="md" label="Continue" class="mt-6 w-full" @click="go" />
  </OnboardingShell>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Badge, Button, FormControl } from 'frappe-ui'
import AppIcon from '../../components/AppIcon.vue'
import OnboardingShell from '../../components/OnboardingShell.vue'
import { useCloudStore } from '../../stores/cloud'
import { slugify } from '../../utils/format'

const store = useCloudStore()
const router = useRouter()

const subdomainInput = ref(store.onboarding.subdomain)

function go() {
  store.onboarding.subdomain = slugify(subdomainInput.value) || 'mysite'
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

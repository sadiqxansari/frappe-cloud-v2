<template>
  <OnboardingShell :step="2">
    <h1 class="text-xl font-semibold text-ink-gray-9">What are you setting up?</h1>
    <p class="mt-1.5 text-base text-ink-gray-6">
      You followed an ERPNext link, so we've picked it for you.
    </p>

    <div class="mt-6 flex items-center gap-3 rounded-xl border border-outline-gray-2 bg-surface-gray-1 p-4">
      <AppIcon app-key="erpnext" size="lg" />
      <div class="min-w-0 flex-1">
        <div class="font-semibold text-ink-gray-9">ERPNext</div>
        <div class="text-sm text-ink-gray-6">Accounting, inventory and orders for your business</div>
      </div>
      <Badge theme="green" variant="subtle" size="md" label="Ready to set up" />
    </div>

    <div class="mt-6">
      <FormControl v-model="subdomainInput" type="text" label="Choose your site address" placeholder="yourcompany" />
      <p class="mt-2 text-sm text-ink-gray-5">
        Your site will live at
        <span class="font-medium text-ink-gray-7">{{ subdomain }}</span>
      </p>
    </div>

    <div class="mt-6">
      <label class="text-sm font-medium text-ink-gray-7">Roughly how big is your team?</label>
      <TabButtons
        v-model="teamSize"
        class="mt-2"
        :buttons="[
          { label: 'Just me', value: 'solo' },
          { label: '2–25 people', value: 'small' },
          { label: 'More than 25', value: 'large' },
        ]"
      />
      <p class="mt-2 text-sm text-ink-gray-5">
        We'll use this to suggest a server size. You can change it anytime.
      </p>
    </div>

    <Button variant="solid" size="md" label="Continue" class="mt-6 w-full" @click="go" />
  </OnboardingShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Badge, Button, FormControl, TabButtons } from 'frappe-ui'
import AppIcon from '../../components/AppIcon.vue'
import OnboardingShell from '../../components/OnboardingShell.vue'
import { useCloudStore } from '../../stores/cloud'
import { slugify } from '../../utils/format'

const store = useCloudStore()
const router = useRouter()

const teamSize = ref(store.onboarding.teamSize)
const subdomainInput = ref(store.onboarding.subdomain)

const subdomain = computed(
  () => `${subdomainInput.value.trim() ? slugify(subdomainInput.value) : 'yourcompany'}.frappe.cloud`,
)

function go() {
  store.setTeamSize(teamSize.value)
  store.onboarding.subdomain = slugify(subdomainInput.value) || 'mysite'
  router.push('/setup/server')
}
</script>

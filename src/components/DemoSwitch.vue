<template>
  <div class="fixed bottom-4 right-4 z-50">
    <Dropdown :options="options" placement="top-end">
      <Button variant="outline" size="sm" label="Demo" icon-left="lucide-flask-conical" class="shadow-md bg-surface-elevation-1" />
    </Dropdown>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Button, Dropdown } from 'frappe-ui'
import { useCloudStore } from '../stores/cloud'

const store = useCloudStore()
const router = useRouter()

function switchTo(name) {
  store.loadScenario(name)
  // Single-server personas land in the Desk (their home); fleet personas land
  // in Central; a fresh signup starts onboarding.
  const target = { fresh: '/signup', solo: '/app', grown: '/servers', partner: '/servers' }[name]
  router.push(target)
}

// Kick off an app-aware "product signup" — the funnel a user hits after clicking
// "sign up" for a specific app on the marketing site. Fresh account, ?product set.
function productSignup(appKey) {
  store.loadScenario('fresh')
  router.push({ path: '/signup', query: { product: appKey } })
}

const check = (name) => (store.scenario === name ? 'lucide-check' : 'lucide-minus')

// The apps Central features as product signups.
const PRODUCT_SIGNUPS = [
  { key: 'erpnext', label: 'ERPNext' },
  { key: 'crm', label: 'Frappe CRM' },
  { key: 'hr', label: 'Frappe HR' },
  { key: 'helpdesk', label: 'Helpdesk' },
]

const options = computed(() => [
  {
    group: 'Personas',
    options: [
      { label: 'First-time', icon: check('fresh'), onClick: () => switchTo('fresh') },
      { label: 'Single Site', icon: check('solo'), onClick: () => switchTo('solo') },
      { label: 'Multi Server', icon: check('grown'), onClick: () => switchTo('grown') },
      { label: 'Partner', icon: check('partner'), onClick: () => switchTo('partner') },
    ],
  },
  {
    group: 'Product signups',
    options: PRODUCT_SIGNUPS.map((p) => ({
      label: p.label,
      icon: 'lucide-package',
      onClick: () => productSignup(p.key),
    })),
  },
  {
    group: 'Toggles',
    options: [
      {
        label: 'Credit expired',
        icon: store.creditExpired ? 'lucide-check' : 'lucide-minus',
        onClick: () => store.setCreditExpired(!store.creditExpired),
      },
      {
        label: 'Edge mode (errors everywhere)',
        icon: store.edgeMode ? 'lucide-check' : 'lucide-minus',
        // Toggle in place — don't yank the user to Billing; turn edge on wherever they are.
        onClick: () => store.setEdgeMode(!store.edgeMode),
      },
    ],
  },
])
</script>

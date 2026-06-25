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
  // Single-server personas land in the Desk (their home); the fleet operator
  // lands in Central; a fresh signup starts onboarding.
  const target = { fresh: '/setup/account', solo: '/app', multisite: '/app', grown: '/servers' }[name]
  router.push(target)
}

const check = (name) => (store.scenario === name ? 'lucide-check' : 'lucide-minus')

const options = computed(() => [
  {
    group: 'Personas',
    options: [
      { label: 'First-time — fresh signup', icon: check('fresh'), onClick: () => switchTo('fresh') },
      { label: 'Solo — one site (Ravi)', icon: check('solo'), onClick: () => switchTo('solo') },
      { label: 'Multi-site — one server (Meera)', icon: check('multisite'), onClick: () => switchTo('multisite') },
      { label: 'Operator — a fleet (Arjun)', icon: check('grown'), onClick: () => switchTo('grown') },
    ],
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

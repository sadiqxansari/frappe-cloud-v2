<template>
  <ServerShell v-if="server" :server="server" :crumbs="crumbs">
    <h1 class="text-xl font-semibold text-ink-gray-9">Billing</h1>
    <p class="mt-1 text-base text-ink-gray-5">What {{ server.name }} costs and earns.</p>

    <div class="mt-5 grid gap-4 sm:grid-cols-2">
      <div class="rounded-xl border border-outline-gray-2 bg-surface-white p-4">
        <div class="text-sm text-ink-gray-5">Monthly cost</div>
        <div class="mt-1 text-2xl font-semibold text-ink-gray-9">{{ inr(store.monthlyPriceOf(server)) }}</div>
        <div class="mt-0.5 text-sm text-ink-gray-5">{{ store.planOf(server).name }} plan</div>
      </div>
      <div class="rounded-xl border border-outline-gray-2 bg-surface-white p-4">
        <div class="text-sm text-ink-gray-5">Credit left</div>
        <div class="mt-1 text-2xl font-semibold text-ink-gray-9">{{ usd(server.creditBalance) }}</div>
        <div class="mt-0.5 text-sm text-ink-gray-5">of {{ usd(server.creditTotal) }}</div>
      </div>
    </div>

    <div class="mt-4">
      <Button variant="subtle" size="sm" label="Set budget alert" icon-left="lucide-bell" @click="budgetOpen = true" />
    </div>

    <!-- Marketplace payouts -->
    <section class="mt-6 rounded-xl border border-outline-gray-2 bg-surface-white p-5">
      <div class="flex items-center gap-2">
        <h2 class="text-base font-semibold text-ink-gray-8">Marketplace payouts</h2>
        <Badge theme="gray" variant="subtle" label="For app publishers" />
      </div>
      <p class="mt-1 text-sm text-ink-gray-5">
        Earnings from apps you publish. <span class="text-ink-gray-6">(May move to Central in a later pass.)</span>
      </p>
      <div class="mt-3 flex items-baseline gap-2">
        <span class="text-xl font-semibold text-ink-gray-9">{{ usd(0) }}</span>
        <span class="text-sm text-ink-gray-5">available to withdraw</span>
      </div>
      <Button variant="subtle" size="sm" label="Request payout" class="mt-3" @click="requestPayout" />
    </section>

    <Dialog v-model:open="budgetOpen" size="sm">
      <template #title><span class="text-xl font-semibold text-ink-gray-9">Set a budget alert</span></template>
      <FormControl v-model="budget" type="number" label="Alert me when monthly spend exceeds (₹)" placeholder="5000" />
      <template #actions>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" @click="budgetOpen = false" />
          <Button variant="solid" label="Set alert" :disabled="!(Number(budget) > 0)" @click="setBudget" />
        </div>
      </template>
    </Dialog>
  </ServerShell>
</template>

<script setup>
import { computed, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Badge, Button, Dialog, FormControl, toast } from 'frappe-ui'
import ServerShell from '../../components/ServerShell.vue'
import { useCloudStore } from '../../stores/cloud'
import { inr, usd } from '../../utils/format'

const store = useCloudStore()
const route = useRoute()
const router = useRouter()

const server = computed(() => store.findServer(route.params.serverId) || store.server)
watchEffect(() => {
  if (!server.value) router.replace('/')
})
const crumbs = computed(() => [{ label: 'Billing' }])

function requestPayout() {
  store.requestPayout()
  toast.success('Payout requested')
}

const budgetOpen = ref(false)
const budget = ref('5000')
function setBudget() {
  toast.success(`Budget alert set at ₹${Number(budget.value).toLocaleString('en-IN')}/mo`)
  budgetOpen.value = false
}
</script>

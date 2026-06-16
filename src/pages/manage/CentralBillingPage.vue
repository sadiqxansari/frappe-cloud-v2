<template>
  <CentralShell :crumbs="[{ label: 'Billing', route: '/billing' }]" wide>
    <div class="flex h-full overflow-hidden">
      <!-- Billing content — centered in whatever space the panel leaves it -->
      <div class="min-w-0 flex-1 overflow-y-auto">
        <div class="mx-auto max-w-3xl px-6 py-8">
          <div>
            <h1 class="text-xl font-semibold text-ink-gray-9">Billing</h1>
            <p class="mt-1 text-base leading-6 text-ink-gray-5">One account funds every server.</p>
          </div>

          <Alert v-if="store.creditExpired" theme="red" class="mt-5" title="Your credit ran out, so your sites are paused" :dismissible="false">
            <template #description>Nothing is deleted — add a card and they're back in seconds, exactly as they were.</template>
            <template #footer><Button variant="solid" size="sm" label="Add a card" @click="addCardOpen = true" /></template>
          </Alert>

          <!-- Dunning — an unpaid/overdue invoice is the single most urgent thing here -->
          <Alert v-if="overdueInvoice" theme="red" class="mt-5" :title="`Invoice ${overdueInvoice.number} is overdue`" :dismissible="false">
            <template #description>
              {{ inr(total(overdueInvoice)) }} was due on {{ overdueInvoice.dueDate }}. Pay now to avoid your servers being suspended.
            </template>
            <template #footer>
              <div class="flex gap-2">
                <Button variant="solid" size="sm" label="Pay now" @click="payInvoice(overdueInvoice)" />
                <Button variant="outline" size="sm" label="View invoice" @click="openPanel = { type: 'invoice', data: overdueInvoice }" />
              </div>
            </template>
          </Alert>

          <!-- A declined primary method blocks every charge, including auto-recharge.
               Independent v-if (not else-if) so it isn't hidden by the overdue alert. -->
          <Alert v-if="declinedMethod" theme="yellow" class="mt-5" title="Your primary payment method was declined" :dismissible="false">
            <template #description>
              We couldn't charge {{ declinedMethod.label }} {{ declinedMethod.detail }}.
              {{ store.autoRecharge ? 'Auto-recharge is paused until it’s fixed.' : 'Update it to keep things running.' }}
            </template>
            <template #footer><Button variant="solid" size="sm" label="Update payment method" @click="openPm" /></template>
          </Alert>

          <div class="mt-5 space-y-5">
            <!-- What it'll cost + what funds it -->
            <div class="grid gap-4 sm:grid-cols-2">
              <!-- Estimated this cycle -->
              <section class="rounded-xl border border-outline-gray-2 bg-surface-white p-5">
                <div class="flex items-center justify-between">
                  <span class="text-sm text-ink-gray-5">Estimated this cycle</span>
                  <button class="text-xs text-ink-gray-5 underline-offset-2 hover:text-ink-gray-7 hover:underline" @click="budgetOpen = true">Set alert</button>
                </div>
                <div class="mt-1 text-2xl font-semibold tabular-nums text-ink-gray-9">{{ inr(store.estimatedThisCycle) }}</div>
                <div class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <span class="text-ink-gray-5">Bills on {{ billingDueDate }}</span>
                  <span v-if="store.estimateDeltaPct" class="inline-flex items-center gap-0.5 font-medium" :class="deltaUp ? 'text-ink-amber-3' : 'text-ink-green-3'">
                    <span class="size-3" :class="deltaUp ? 'lucide-arrow-up' : 'lucide-arrow-down'" />
                    {{ Math.abs(store.estimateDeltaPct) }}% vs last month
                  </span>
                </div>
              </section>

              <!-- Wallet — clickable → history panel -->
              <div
                role="button"
                tabindex="0"
                class="cursor-pointer rounded-xl border bg-surface-white p-5 text-left transition-colors"
                :class="openPanel?.type === 'wallet' ? 'border-outline-gray-4 ring-1 ring-outline-gray-4' : 'border-outline-gray-2 hover:border-outline-gray-3'"
                @click="openPanel = { type: 'wallet' }"
                @keydown.enter="openPanel = { type: 'wallet' }"
              >
                <div class="flex items-center justify-between">
                  <span class="text-sm text-ink-gray-5">Wallet</span>
                  <span class="lucide-chevron-right size-4 text-ink-gray-4" />
                </div>
                <div class="mt-1 text-2xl font-semibold tabular-nums text-ink-gray-9">{{ inr(store.walletBalance) }}</div>
                <div class="mt-1.5 flex items-center justify-between gap-2">
                  <span class="text-xs text-ink-gray-5">Applied to your monthly invoice</span>
                  <Button variant="subtle" size="sm" label="Add" icon-left="lucide-plus" @click.stop="creditOpen = true" />
                </div>
                <p v-if="walletAtRisk" class="mt-2 flex items-center gap-1 text-xs text-ink-amber-3">
                  <span class="lucide-triangle-alert size-3 shrink-0" />
                  Won't cover the {{ billingDueDate }} invoice ({{ inr(store.estimatedThisCycle) }}).
                </p>
              </div>
            </div>

            <!-- Payment methods -->
            <section class="rounded-xl border border-outline-gray-2 bg-surface-white p-5 pt-4">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5">
                  <h2 class="text-base font-semibold text-ink-gray-8">Payment methods</h2>
                  <Tooltip text="If the primary fails, we automatically try the next one in line.">
                    <span class="lucide-info size-3.5 text-ink-gray-4" />
                  </Tooltip>
                </div>
                <Button variant="ghost" size="sm" icon="lucide-plus" aria-label="Add payment method" @click="openPm" />
              </div>

              <div v-if="store.paymentMethods.length" class="mt-2 divide-y divide-outline-gray-1">
                <div v-for="pm in store.paymentMethods" :key="pm.id" class="flex items-center gap-3 py-2.5">
                  <span class="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-gray-2 text-ink-gray-6">
                    <span class="size-4" :class="pm.kind === 'upi' ? 'lucide-smartphone' : 'lucide-credit-card'" />
                  </span>
                  <div class="min-w-0 flex-1">
                    <div class="truncate text-sm font-medium text-ink-gray-9">{{ pm.label }}</div>
                    <div class="text-p-sm" :class="pm.status === 'declined' ? 'text-ink-red-4' : 'text-ink-gray-5'">
                      {{ pm.status === 'declined' ? `${pm.detail} · declined` : pm.detail }}
                    </div>
                  </div>
                  <Badge v-if="pm.primary" theme="green" variant="subtle" label="Primary" />
                  <Badge v-else theme="gray" variant="subtle" label="Backup" />
                  <Dropdown :options="pmMenu(pm)" placement="bottom-end">
                    <button class="rounded p-1 text-ink-gray-5 hover:bg-surface-gray-2" :aria-label="`Actions for ${pm.label}`"><span class="lucide-ellipsis size-4" /></button>
                  </Dropdown>
                </div>
              </div>
              <p v-else class="mt-2 text-sm text-ink-gray-5">No payment method yet — add one to keep things running.</p>
            </section>

            <!-- Subscriptions (one per server) -->
            <section class="rounded-xl border border-outline-gray-2 bg-surface-white p-5 pt-4">
              <div class="flex items-center justify-between gap-3">
                <h2 class="text-base font-semibold text-ink-gray-8">Subscriptions</h2>
                <Button v-if="hasActive" variant="ghost" size="sm" label="Stop all billing" @click="stopAllOpen = true" />
                <Button v-else-if="store.allServers.some((s) => s.status === 'suspended')" variant="ghost" size="sm" label="Resume all" @click="resumeAll" />
              </div>
              <div class="mt-2 divide-y divide-outline-gray-1">
                <div v-for="srv in store.allServers" :key="srv.id" class="flex items-center justify-between gap-3 py-3">
                  <div class="flex min-w-0 items-center gap-2.5">
                    <span class="lucide-server size-4 shrink-0 text-ink-gray-5" />
                    <div class="min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="truncate text-base font-medium text-ink-gray-9">{{ srv.name }}</span>
                        <span v-if="srv.status === 'suspended'" class="shrink-0 text-p-xs text-ink-amber-3">Stopped</span>
                      </div>
                      <div class="truncate text-p-sm text-ink-gray-5">{{ store.planOf(srv).name }} · {{ store.regionOf(srv).name }} ({{ store.regionOf(srv).provider }})</div>
                    </div>
                  </div>
                  <div class="shrink-0 text-right">
                    <div class="text-base font-medium tabular-nums" :class="srv.status === 'suspended' ? 'text-ink-gray-4 line-through' : 'text-ink-gray-9'">{{ inr(store.monthlyPriceOf(srv)) }}/mo</div>
                    <div class="text-p-sm tabular-nums text-ink-gray-5">{{ daysElapsed }} of {{ cycleDays }} days · {{ inr(store.perDayOf(srv)) }}/day</div>
                  </div>
                </div>
              </div>
            </section>

            <!-- Invoices -->
            <section class="rounded-xl border border-outline-gray-2 bg-surface-white p-5">
              <div class="flex items-center justify-between">
                <h2 class="text-base font-semibold text-ink-gray-8">Invoices</h2>
                <span class="text-xs text-ink-gray-5">Sent to {{ store.billingProfile.invoiceRecipient || store.billingProfile.billingEmail || store.user.email }}</span>
              </div>
              <div v-if="store.invoices.length" class="mt-2 divide-y divide-outline-gray-1">
                <button
                  v-for="inv in store.invoices"
                  :key="inv.number"
                  class="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors"
                  :class="openPanel?.type === 'invoice' && openPanel.data.number === inv.number ? 'bg-surface-gray-2' : 'hover:bg-surface-gray-1'"
                  @click="openPanel = { type: 'invoice', data: inv }"
                >
                  <div class="min-w-0">
                    <div class="font-medium text-ink-gray-8">{{ inv.period }}</div>
                    <div class="truncate text-p-sm" :class="inv.overdue ? 'text-ink-red-4' : 'text-ink-gray-5'">
                      {{ inv.number }} · {{ inv.overdue ? `Due ${inv.dueDate}` : `Issued ${inv.issued}` }}
                    </div>
                  </div>
                  <div class="flex shrink-0 items-center gap-3">
                    <span class="tabular-nums text-ink-gray-8">{{ inr(total(inv)) }}</span>
                    <Badge :theme="statusTheme(inv.status)" variant="subtle" :label="inv.status" />
                    <span class="lucide-chevron-right size-4 text-ink-gray-4" />
                  </div>
                </button>
              </div>
              <p v-else class="mt-2 text-sm text-ink-gray-5">No invoices yet — your first one arrives at the end of the cycle.</p>
            </section>

            <!-- Marketplace payouts -->
            <section class="rounded-xl border border-outline-gray-2 bg-surface-white p-5">
              <div class="flex items-center gap-2">
                <h2 class="text-base font-semibold text-ink-gray-8">Marketplace payouts</h2>
                <Badge theme="gray" variant="subtle" label="For app publishers" />
              </div>
              <p class="mt-1 text-sm text-ink-gray-5">Earnings from apps you publish on the marketplace.</p>
              <div class="mt-3 flex items-center justify-between gap-3">
                <div class="flex items-baseline gap-2">
                  <span class="text-xl font-semibold text-ink-gray-9">{{ usd(store.payoutBalance) }}</span>
                  <span class="text-sm text-ink-gray-5">available to withdraw</span>
                </div>
                <Button v-if="store.payoutBalance > 0 && !store.payoutAccount" variant="solid" size="sm" label="Add payout account" @click="payoutOpen = true" />
                <Button v-else variant="subtle" size="sm" label="Request payout" :disabled="store.payoutBalance <= 0 || !store.payoutAccount" @click="requestPayout" />
              </div>
              <p v-if="store.payoutBalance > 0 && !store.payoutAccount" class="mt-2 flex items-center gap-1 text-xs text-ink-amber-3">
                <span class="lucide-triangle-alert size-3 shrink-0" />
                Add a bank account before you can withdraw your earnings.
              </p>
            </section>

            <!-- Tax & compliance -->
            <section class="rounded-xl border border-outline-gray-2 bg-surface-white p-5 pt-4">
              <div class="flex items-center justify-between">
                <h2 class="text-base font-semibold text-ink-gray-8">Tax &amp; compliance</h2>
                <Button variant="ghost" size="sm" icon="lucide-pencil" aria-label="Edit tax & compliance" @click="openTax" />
              </div>
              <dl class="mt-3 space-y-1.5 text-p-sm">
                <div class="flex justify-between gap-3"><dt class="text-ink-gray-5">Tax region</dt><dd class="text-ink-gray-8 text-p-sm">{{ taxRegion.country }}</dd></div>
                <div class="flex justify-between gap-3"><dt class="text-ink-gray-5 text-p-sm">{{ taxRegion.idLabel }}</dt><dd class="text-p-sm" :class="taxMissing ? 'text-ink-amber-3' : 'text-ink-gray-8'">{{ store.billingProfile.taxValue || 'Not added' }}</dd></div>
              </dl>
              <button v-if="taxMissing" class="mt-2 flex items-center gap-1 text-xs text-ink-amber-3 underline-offset-2 hover:underline" @click="openTax">
                <span class="lucide-triangle-alert size-3 shrink-0" />
                Add your {{ taxRegion.idLabel }} so invoices are tax-compliant in {{ taxRegion.country }}.
              </button>
            </section>

            <!-- Contact & address -->
            <section class="rounded-xl border border-outline-gray-2 bg-surface-white p-5 pt-4">
              <div class="flex items-center justify-between">
                <h2 class="text-base font-semibold text-ink-gray-8">Contact &amp; address</h2>
                <Button variant="ghost" size="sm" icon="lucide-pencil" aria-label="Edit contact & address" @click="openDetails" />
              </div>
              <dl class="mt-3 space-y-1.5 text-p-sm">
                <div class="flex justify-between gap-3"><dt class="text-ink-gray-5 text-p-sm">Billing email</dt><dd class="text-p-sm" :class="store.billingProfile.emailBounced ? 'text-ink-red-4' : 'text-ink-gray-8'">{{ store.billingProfile.billingEmail || 'Not added' }}{{ store.billingProfile.emailBounced ? ' · bouncing' : '' }}</dd></div>
                <div class="flex justify-between gap-3"><dt class="text-ink-gray-5 text-p-sm">Invoice recipient</dt><dd class="text-ink-gray-8 text-p-sm">{{ store.billingProfile.invoiceRecipient || 'Not added' }}</dd></div>
                <div class="flex justify-between gap-3"><dt class="text-ink-gray-5 text-p-sm">Invoice language</dt><dd class="text-ink-gray-8 text-p-sm">{{ langLabel(store.billingProfile.invoiceLanguage) }}</dd></div>
                <div class="flex justify-between gap-3"><dt class="text-ink-gray-5 text-p-sm">Billing address</dt><dd class="max-w-[60%] truncate text-ink-gray-8 text-p-sm">{{ store.billingProfile.address || 'Not added' }}</dd></div>
              </dl>
              <button v-if="store.billingProfile.emailBounced" class="mt-2 flex items-center gap-1 text-xs text-ink-red-4 underline-offset-2 hover:underline" @click="openDetails">
                <span class="lucide-triangle-alert size-3 shrink-0" />
                Invoices are bouncing back — update your billing email.
              </button>
            </section>
          </div>
        </div>
      </div>

      <!-- Docked panel — invoice detail OR wallet history -->
      <Transition name="slide">
        <aside v-if="openPanel" class="flex w-[24rem] shrink-0 flex-col border-l border-outline-gray-2 bg-surface-white">
          <!-- Invoice -->
          <template v-if="openPanel.type === 'invoice'">
            <div class="flex items-start justify-between gap-3 border-b border-outline-gray-2 p-4">
              <div class="min-w-0">
                <div class="truncate text-base font-semibold text-ink-gray-9">{{ openPanel.data.number }}</div>
                <div class="text-sm text-ink-gray-5">{{ openPanel.data.period }} · Issued {{ openPanel.data.issued }}</div>
              </div>
              <button class="grid size-7 shrink-0 place-items-center rounded text-ink-gray-5 hover:bg-surface-gray-2" aria-label="Close" @click="openPanel = null">
                <span class="lucide-x size-4" />
              </button>
            </div>

            <div class="flex-1 space-y-4 overflow-y-auto p-4">
              <div class="flex items-center justify-between text-sm">
                <span class="text-ink-gray-5">Status</span>
                <Badge :theme="statusTheme(openPanel.data.status)" variant="subtle" :label="openPanel.data.status" />
              </div>
              <div v-if="openPanel.data.overdue" class="flex items-center justify-between text-sm">
                <span class="text-ink-gray-5">Due</span>
                <span class="text-ink-red-4">{{ openPanel.data.dueDate }} (overdue)</span>
              </div>
              <div class="flex items-center justify-between text-sm">
                <span class="text-ink-gray-5">Billed to</span>
                <span class="text-ink-gray-8">{{ store.billingProfile.billingEmail || store.user.email }}</span>
              </div>

              <div class="overflow-hidden rounded-lg border border-outline-gray-2">
                <div class="flex items-center justify-between gap-3 border-b border-outline-gray-1 bg-surface-gray-1 px-3 py-2 text-xs font-medium text-ink-gray-5">
                  <span>Item</span><span>Amount</span>
                </div>
                <div v-for="(it, i) in openPanel.data.items" :key="i" class="flex items-center justify-between gap-3 border-b border-outline-gray-1 px-3 py-2.5 text-sm last:border-b-0">
                  <div class="min-w-0">
                    <div class="truncate text-ink-gray-7">{{ it.label }}</div>
                    <div class="text-p-sm text-ink-gray-5">{{ it.plan }} · {{ it.days }} × {{ inr(it.perDay) }}/day</div>
                  </div>
                  <span class="shrink-0 tabular-nums text-ink-gray-8">{{ inr(it.amount) }}</span>
                </div>
              </div>

              <dl class="space-y-1.5 text-sm">
                <div class="flex justify-between"><dt class="text-ink-gray-5">Subtotal</dt><dd class="tabular-nums text-ink-gray-8">{{ inr(subtotal(openPanel.data)) }}</dd></div>
                <div class="flex justify-between"><dt class="text-ink-gray-5">GST (18%)</dt><dd class="tabular-nums text-ink-gray-8">{{ inr(tax(openPanel.data)) }}</dd></div>
                <div v-if="openPanel.data.credits" class="flex justify-between"><dt class="text-ink-green-3">Credits applied</dt><dd class="tabular-nums text-ink-green-3">−{{ inr(openPanel.data.credits) }}</dd></div>
                <div class="flex justify-between border-t border-outline-gray-1 pt-1.5 font-semibold"><dt class="text-ink-gray-8">Total</dt><dd class="tabular-nums text-ink-gray-9">{{ inr(total(openPanel.data)) }}</dd></div>
              </dl>
            </div>

            <div class="border-t border-outline-gray-2 p-4">
              <Button v-if="openPanel.data.status === 'Unpaid'" variant="solid" theme="red" class="mb-2 w-full" :label="`Pay ${inr(total(openPanel.data))} now`" icon-left="lucide-credit-card" @click="payInvoice(openPanel.data)" />
              <div class="flex gap-2">
                <Button variant="subtle" class="flex-1" label="Email invoice" icon-left="lucide-mail" @click="emailInvoice" />
                <Button variant="subtle" class="flex-1" label="Download PDF" icon-left="lucide-download" @click="download" />
              </div>
            </div>
          </template>

          <!-- Wallet history -->
          <template v-else>
            <div class="flex items-start justify-between gap-3 border-b border-outline-gray-2 p-4">
              <div class="min-w-0">
                <div class="text-base font-semibold text-ink-gray-9">Wallet history</div>
                <div class="text-sm text-ink-gray-5">Balance {{ inr(store.walletBalance) }}</div>
              </div>
              <button class="grid size-7 shrink-0 place-items-center rounded text-ink-gray-5 hover:bg-surface-gray-2" aria-label="Close" @click="openPanel = null">
                <span class="lucide-x size-4" />
              </button>
            </div>

            <div class="flex-1 overflow-y-auto p-4">
              <div v-if="store.walletHistory.length" class="divide-y divide-outline-gray-1">
                <div v-for="tx in store.walletHistory" :key="tx.id" class="flex items-center justify-between gap-3 py-2.5">
                  <div class="flex min-w-0 items-center gap-2.5">
                    <span class="grid size-7 shrink-0 place-items-center rounded-full" :class="tx.amount >= 0 ? 'bg-surface-green-2 text-ink-green-3' : 'bg-surface-gray-2 text-ink-gray-6'">
                      <span class="size-3.5" :class="tx.amount >= 0 ? 'lucide-arrow-down-left' : 'lucide-arrow-up-right'" />
                    </span>
                    <div class="min-w-0">
                      <div class="truncate text-sm text-ink-gray-8">{{ tx.label }}</div>
                      <div class="text-p-sm text-ink-gray-5">{{ tx.date }}</div>
                    </div>
                  </div>
                  <span class="shrink-0 text-sm font-medium tabular-nums" :class="tx.amount >= 0 ? 'text-ink-green-3' : 'text-ink-gray-8'">
                    {{ tx.amount >= 0 ? '+' : '−' }}{{ inr(Math.abs(tx.amount)) }}
                  </span>
                </div>
              </div>
              <p v-else class="text-sm text-ink-gray-5">No wallet activity yet.</p>
            </div>

            <div class="space-y-3 border-t border-outline-gray-2 p-4">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <div class="text-sm font-medium text-ink-gray-8">Auto-recharge</div>
                  <div class="text-xs text-ink-gray-5">Top up from your primary method when low.</div>
                </div>
                <Switch :modelValue="store.autoRecharge" @update:modelValue="store.setAutoRecharge" />
              </div>
              <Button variant="solid" class="w-full" label="Add credit" icon-left="lucide-plus" @click="creditOpen = true" />
            </div>
          </template>
        </aside>
      </Transition>
    </div>

    <!-- Add credit -->
    <Dialog v-model:open="creditOpen" size="sm">
      <template #title><span class="text-xl font-semibold text-ink-gray-9">Add credit</span></template>
      <div class="space-y-3">
        <div class="flex gap-2">
          <Button v-for="amt in [2000, 5000, 10000]" :key="amt" :variant="creditAmount === String(amt) ? 'solid' : 'subtle'" :label="inr(amt)" @click="creditAmount = String(amt)" />
        </div>
        <FormControl v-model="creditAmount" type="number" label="Amount (₹)" placeholder="5000" />
      </div>
      <template #actions>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" @click="creditOpen = false" />
          <Button variant="solid" label="Add to wallet" :disabled="!(Number(creditAmount) > 0)" @click="addCredit" />
        </div>
      </template>
    </Dialog>

    <!-- Add / update payment method -->
    <Dialog v-model:open="pmOpen" size="sm">
      <template #title><span class="text-xl font-semibold text-ink-gray-9">{{ editingPmId ? 'Update payment method' : 'Add payment method' }}</span></template>
      <div class="space-y-3">
        <FormControl v-model="pmForm.kind" type="select" label="Type" :options="[{ label: 'Card', value: 'card' }, { label: 'UPI', value: 'upi' }]" />
        <FormControl
          v-model="pmForm.value"
          type="text"
          :label="pmForm.kind === 'upi' ? 'UPI ID' : 'Card number'"
          :placeholder="pmForm.kind === 'upi' ? 'you@okbank' : '4242 4242 4242 4242'"
        />
      </div>
      <template #actions>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" @click="pmOpen = false" />
          <Button variant="solid" :label="editingPmId ? 'Save' : 'Add method'" :disabled="!pmForm.value.trim()" @click="addPm" />
        </div>
      </template>
    </Dialog>

    <!-- Tax & compliance -->
    <Dialog v-model:open="taxOpen" size="sm">
      <template #title><span class="text-xl font-semibold text-ink-gray-9">Tax &amp; compliance</span></template>
      <div class="space-y-3">
        <FormControl v-model="taxForm.taxRegion" type="select" label="Tax region" :options="TAX_REGION_OPTIONS" />
        <div>
          <FormControl v-model="taxForm.taxValue" type="text" :label="taxFormRegion.idLabel" :placeholder="taxFormRegion.placeholder" />
          <p v-if="taxForm.taxValue && taxFormError" class="mt-1 text-xs text-ink-red-4">{{ taxFormError }}</p>
        </div>
      </div>
      <template #actions>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" @click="taxOpen = false" />
          <Button variant="solid" label="Save" :disabled="!!taxFormError" @click="saveTax" />
        </div>
      </template>
    </Dialog>

    <!-- Contact & address -->
    <Dialog v-model:open="detailsOpen" size="md">
      <template #title><span class="text-xl font-semibold text-ink-gray-9">Contact &amp; address</span></template>
      <div class="space-y-3">
        <div>
          <FormControl v-model="details.billingEmail" type="text" label="Billing email" placeholder="billing@company.com" />
          <p v-if="details.billingEmail && billingEmailError" class="mt-1 text-xs text-ink-red-4">{{ billingEmailError }}</p>
        </div>
        <div>
          <FormControl v-model="details.invoiceRecipient" type="text" label="Invoice email recipient" placeholder="accounts@company.com" />
          <p v-if="details.invoiceRecipient && recipientError" class="mt-1 text-xs text-ink-red-4">{{ recipientError }}</p>
        </div>
        <FormControl v-model="details.invoiceLanguage" type="select" label="Invoice language" :options="LANGUAGES" />
        <FormControl v-model="details.address" type="textarea" label="Billing address" placeholder="Street, City, State, PIN" />
      </div>
      <template #actions>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" @click="detailsOpen = false" />
          <Button variant="solid" label="Save" :disabled="!detailsValid" @click="saveDetails" />
        </div>
      </template>
    </Dialog>

    <!-- Budget alert -->
    <Dialog v-model:open="budgetOpen" size="sm">
      <template #title><span class="text-xl font-semibold text-ink-gray-9">Set a budget alert</span></template>
      <FormControl v-model="budget" type="number" label="Alert me when the cycle estimate exceeds (₹)" placeholder="20000" />
      <template #actions>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" @click="budgetOpen = false" />
          <Button variant="solid" label="Set alert" :disabled="!(Number(budget) > 0)" @click="setBudget" />
        </div>
      </template>
    </Dialog>

    <!-- Add payout account -->
    <Dialog v-model:open="payoutOpen" size="sm">
      <template #title><span class="text-xl font-semibold text-ink-gray-9">Add payout account</span></template>
      <div class="space-y-3">
        <p class="text-p-sm text-ink-gray-6">Connect a bank account to withdraw your marketplace earnings. Payouts are sent in USD, usually within 5–7 business days.</p>
        <p class="text-p-sm text-ink-gray-5">You'll be redirected to our payments partner to add the account securely.</p>
      </div>
      <template #actions>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" @click="payoutOpen = false" />
          <Button variant="solid" label="Connect bank account" @click="savePayoutAccount" />
        </div>
      </template>
    </Dialog>

    <ConfirmDialog
      v-model:open="stopAllOpen"
      theme="red"
      title="Stop billing on all servers?"
      message="Every server is suspended and its sites go offline until you resume. You won't be charged while they're stopped — nothing is deleted."
      confirm-label="Stop all billing"
      @confirm="confirmStopAll"
    />

    <AddCardDialog v-model:open="addCardOpen" />
  </CentralShell>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { Alert, Badge, Button, Dialog, Dropdown, FormControl, Switch, Tooltip, toast } from 'frappe-ui'
import AddCardDialog from '../../components/AddCardDialog.vue'
import CentralShell from '../../components/CentralShell.vue'
import ConfirmDialog from '../../components/ConfirmDialog.vue'
import { TAX_REGION_OPTIONS, taxRegionByCode } from '../../data/tax'
import { CYCLE_DAYS, useCloudStore } from '../../stores/cloud'
import { inr, usd } from '../../utils/format'
import { validateEmail, validateTaxId } from '../../utils/validate'

const store = useCloudStore()

// — Problem states (mostly surfaced by Edge mode, but real once the API is live)
const overdueInvoice = computed(() => store.invoices.find((i) => i.overdue || i.status === 'Unpaid') || null)
const declinedMethod = computed(() => store.paymentMethods.find((p) => p.status === 'declined') || null)
// The wallet is prepaid and a healthy card covers any shortfall — so it's only
// "at risk" when the balance is short AND there's no working method behind it.
const walletAtRisk = computed(
  () => store.walletBalance < store.estimatedThisCycle && (!!declinedMethod.value || !store.paymentMethods.length),
)
// Every curated region except the US legally expects a tax ID on B2B invoices.
const taxRequired = computed(() => store.billingProfile.taxRegion !== 'US')
const taxMissing = computed(() => taxRequired.value && !store.billingProfile.taxValue)

function statusTheme(status) {
  if (['Unpaid', 'Overdue', 'Failed'].includes(status)) return 'red'
  if (status === 'Paid') return 'green'
  return 'gray'
}

const LANGUAGES = [
  { label: 'English', value: 'en' },
  { label: 'Hindi', value: 'hi' },
  { label: 'German', value: 'de' },
  { label: 'Arabic', value: 'ar' },
]
function langLabel(v) {
  return LANGUAGES.find((l) => l.value === v)?.label || 'English'
}

// — The one docked panel: either an invoice or the wallet history.
const openPanel = ref(null)

// — Cycle figures (monthly billing; per-day is an informational breakdown)
const cycleDays = CYCLE_DAYS
const daysElapsed = Math.min(new Date().getDate(), CYCLE_DAYS)
const billingDueDate = computed(() => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
})
const deltaUp = computed(() => store.estimateDeltaPct > 0)

// — Invoice maths
const GST_RATE = 0.18
function subtotal(inv) {
  return inv.items.reduce((s, i) => s + i.amount, 0)
}
function tax(inv) {
  return Math.round(subtotal(inv) * GST_RATE)
}
function total(inv) {
  return subtotal(inv) + tax(inv) - (inv.credits || 0)
}

// — Subscriptions
const hasActive = computed(() => store.allServers.some((s) => s.status !== 'suspended'))

// — Stop / resume all
const stopAllOpen = ref(false)
function confirmStopAll() {
  store.allServers.forEach((s) => store.setServerSuspended(s.id, true))
  toast.success('Billing stopped on all servers')
}
function resumeAll() {
  store.allServers.forEach((s) => store.setServerSuspended(s.id, false))
  toast.success('Billing resumed')
}

// — Payment methods
const pmOpen = ref(false)
const pmForm = reactive({ kind: 'card', value: '' })
const editingPmId = ref(null) // null = adding; otherwise updating that method
function openPm() {
  editingPmId.value = null
  pmForm.kind = 'card'
  pmForm.value = ''
  pmOpen.value = true
}
// "Update" on a declined/expired method — re-enter details to fix it.
function updatePm(pm) {
  editingPmId.value = pm.id
  pmForm.kind = pm.kind
  pmForm.value = ''
  pmOpen.value = true
}
function addPm() {
  const v = pmForm.value.trim()
  if (!v) return
  const detail = pmForm.kind === 'upi' ? v : '•••• ' + v.replace(/\s/g, '').slice(-4)
  if (editingPmId.value) {
    store.updatePaymentMethod(editingPmId.value, { detail, status: null })
    toast.success('Payment method updated')
  } else {
    const label = pmForm.kind === 'upi' ? 'UPI' : 'Card'
    store.addPaymentMethod({ kind: pmForm.kind, label, detail })
    toast.success('Payment method added')
  }
  pmOpen.value = false
}
function pmMenu(pm) {
  const opts = []
  opts.push({ label: 'Update', icon: 'lucide-pencil', onClick: () => updatePm(pm) })
  if (!pm.primary) opts.push({ label: 'Make primary', icon: 'lucide-star', onClick: () => store.setPrimaryMethod(pm.id) })
  opts.push({ label: 'Remove', icon: 'lucide-trash-2', onClick: () => store.removePaymentMethod(pm.id) })
  return opts
}

// — Wallet
const creditOpen = ref(false)
const creditAmount = ref('5000')
function addCredit() {
  store.addToWallet(creditAmount.value)
  toast.success(`Added ${inr(Number(creditAmount.value))} to your wallet`)
  creditOpen.value = false
}

// — Invoices
function payInvoice(inv) {
  openPanel.value = null
  toast.promise(store.payInvoice(inv.number), {
    loading: 'Processing payment…',
    success: `Invoice ${inv.number} paid`,
    error: 'Payment failed — please try again',
  })
}

// — Marketplace payouts
const payoutOpen = ref(false)
function savePayoutAccount() {
  store.setPayoutAccount(true)
  toast.success('Payout account connected')
  payoutOpen.value = false
}
function requestPayout() {
  store.requestPayout()
  toast.success('Payout requested')
}

// — Tax & compliance
const taxRegion = computed(() => taxRegionByCode(store.billingProfile.taxRegion))
const taxOpen = ref(false)
const taxForm = reactive({ taxRegion: 'IN', taxValue: '' })
const taxFormRegion = computed(() => taxRegionByCode(taxForm.taxRegion))
const taxFormError = computed(() => validateTaxId(taxForm.taxRegion, taxForm.taxValue, { required: taxForm.taxRegion !== 'US' }))
function openTax() {
  taxForm.taxRegion = store.billingProfile.taxRegion || 'IN'
  taxForm.taxValue = store.billingProfile.taxValue || ''
  taxOpen.value = true
}
function saveTax() {
  if (taxFormError.value) return
  store.setBillingProfile({ taxRegion: taxForm.taxRegion, taxValue: taxForm.taxValue })
  toast.success('Tax details saved')
  taxOpen.value = false
}

// — Contact & address
const detailsOpen = ref(false)
const details = reactive({ address: '', billingEmail: '', invoiceRecipient: '', invoiceLanguage: 'en' })
function openDetails() {
  details.address = store.billingProfile.address
  details.billingEmail = store.billingProfile.billingEmail
  details.invoiceRecipient = store.billingProfile.invoiceRecipient
  details.invoiceLanguage = store.billingProfile.invoiceLanguage
  detailsOpen.value = true
}
const billingEmailError = computed(() => validateEmail(details.billingEmail, { required: true }))
const recipientError = computed(() => validateEmail(details.invoiceRecipient))
const detailsValid = computed(() => !billingEmailError.value && !recipientError.value)
function saveDetails() {
  if (!detailsValid.value) return
  store.setBillingProfile({ ...details, emailBounced: false })
  toast.success('Billing details saved')
  detailsOpen.value = false
}

// — Budget alert
const budgetOpen = ref(false)
const budget = ref('20000')
function setBudget() {
  toast.success(`Budget alert set at ₹${Number(budget.value).toLocaleString('en-IN')}/cycle`)
  budgetOpen.value = false
}

// — Trial credit alert path
const addCardOpen = ref(false)

function download() {
  toast('In the real thing, this downloads the invoice PDF')
}
function emailInvoice() {
  toast.success(`Invoice emailed to ${store.billingProfile.invoiceRecipient || store.billingProfile.billingEmail || store.user.email}`)
}
</script>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}
</style>

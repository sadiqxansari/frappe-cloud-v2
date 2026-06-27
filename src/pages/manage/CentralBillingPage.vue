<template>
  <CentralShell :crumbs="crumbs" wide>
    <div class="flex h-full overflow-hidden">
      <!-- Billing content — centered in whatever space the panel leaves it -->
      <div class="min-w-0 flex-1 overflow-y-auto">
        <div class="mx-auto max-w-3xl px-6 py-8">
        <template v-if="view === 'overview'">
          <div>
            <h1 class="text-xl font-semibold text-ink-gray-9">Billing</h1>
            <p class="mt-1 text-p-base text-ink-gray-5">One account funds every server.</p>
          </div>

          <!-- Only ever one banner: the single most urgent payment problem (see
               billingBanner). The budget warning lives inline on the Estimated
               card below — no stacking. -->
          <Alert
            v-if="billingBanner"
            :key="billingBanner.key"
            :theme="billingBanner.theme"
            :title="billingBanner.title"
            :description="billingBanner.description"
            :action="billingBanner.action"
            class="mt-5"
          />

          <div class="mt-5 space-y-5">
            <!-- What it'll cost + what funds it -->
            <div class="grid gap-4 sm:grid-cols-2">
              <!-- Estimated this cycle -->
              <section class="flex flex-col rounded-xl border border-outline-gray-2 bg-surface-elevation-1 p-5">
                <span class="text-sm text-ink-gray-5">Estimated this cycle</span>
                <div class="mt-1 text-2xl font-semibold tabular-nums text-ink-gray-9">{{ inr(store.estimatedThisCycle) }}</div>
                <div class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <span class="text-ink-gray-5">Day {{ daysElapsed }} of {{ cycleDays }} · bills {{ billingDueDate }}</span>
                  <span v-if="store.estimateDeltaPct" class="inline-flex items-center gap-0.5 font-medium" :class="deltaUp ? 'text-ink-amber-8' : 'text-ink-green-6'">
                    <span class="size-3" :class="deltaUp ? 'lucide-arrow-up' : 'lucide-arrow-down'" />
                    {{ Math.abs(store.estimateDeltaPct) }}% vs last month
                  </span>
                </div>
                <!-- Budget alert pinned to the bottom, mirroring the wallet card's row -->
                <div class="mt-auto border-t border-outline-alpha-gray-1 pt-5">
                  <div class="flex items-center justify-between gap-2">
                    <span class="flex items-center gap-1.5 text-sm text-ink-gray-8">
                      <span class="lucide-bell size-3.5 shrink-0" :class="budgetCrossed ? 'text-ink-red-8' : budgetNear ? 'text-ink-amber-8' : 'text-ink-gray-4'" />
                      Budget alert
                    </span>
                    <Button variant="subtle" size="sm" :class="budgetCrossed ? '!text-ink-red-8' : budgetNear ? '!text-ink-amber-8' : ''" :label="store.budgetAlert ? `Alert at ${inr(store.budgetAlert)}` : 'Set alert'" @click="openBudget" />
                  </div>
                </div>
              </section>

              <!-- Wallet — the title and chevron open the history panel. Add credit
                   sits with the balance; auto-recharge is a real toggle here (its
                   threshold edit still lives in the panel). -->
              <div
                class="flex flex-col rounded-xl border bg-surface-elevation-1 p-5 transition-colors"
                :class="openPanel?.type === 'wallet' ? 'border-outline-gray-4 ring-1 ring-outline-gray-4' : 'border-outline-gray-2'"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1">
                    <button class="text-sm text-ink-gray-5 transition-colors hover:text-ink-gray-7" @click="openPanel = { type: 'wallet' }">Wallet</button>
                    <Tooltip text="Applied to your invoice first, before any card is charged.">
                      <span class="lucide-info size-3.5 text-ink-gray-4" />
                    </Tooltip>
                  </div>
                  <button class="grid size-6 place-items-center rounded text-ink-gray-4 hover:bg-surface-gray-2 hover:text-ink-gray-6" aria-label="Open wallet history" @click="openPanel = { type: 'wallet' }">
                    <span class="lucide-chevron-right size-4" />
                  </button>
                </div>
                <!-- Balance + Add credit, paired -->
                <div class="mt-1 mb-5 flex items-center justify-between gap-2">
                  <span class="text-2xl font-semibold tabular-nums text-ink-gray-9">{{ inr(store.walletBalance) }}</span>
                  <Button variant="subtle" size="sm" label="Add credit" icon-left="lucide-plus" @click="creditOpen = true" />
                </div>
                <!-- Auto-recharge — the safety toggle, on its own row with room to breathe -->
                <div class="mt-auto border-t border-outline-alpha-gray-1 pt-5">
                  <div class="flex items-center justify-between gap-2">
                    <span class="flex items-center gap-1.5 text-sm text-ink-gray-8">
                      <span class="lucide-zap size-3.5 shrink-0" :class="store.autoRecharge ? 'text-ink-green-6' : 'text-ink-gray-4'" />
                      Auto-recharge
                    </span>
                    <Switch :modelValue="store.autoRecharge" @update:modelValue="store.setAutoRecharge" />
                  </div>
                  <button v-if="store.autoRecharge" class="mt-1 text-left text-xs text-ink-gray-5 transition-colors hover:text-ink-gray-8" @click="openRecharge">
                    Below {{ inr(store.rechargeThreshold) }}, add {{ inr(store.rechargeAmount) }}
                  </button>
                </div>
                <p v-if="walletAtRisk" class="mt-2 flex items-center gap-1 text-p-xs text-ink-amber-8">
                  <span class="lucide-triangle-alert size-3 shrink-0" />
                  Won't cover the {{ inr(store.estimatedThisCycle) }} invoice.
                </p>
              </div>
            </div>

            <!-- Payment methods -->
            <section class="rounded-xl border border-outline-gray-2 bg-surface-elevation-1 p-5 pt-4">
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-1.5">
                  <h2 class="text-base font-semibold text-ink-gray-8">Payment methods</h2>
                  <Tooltip text="The primary is used first. If it fails, your backup is tried automatically.">
                    <span class="lucide-info size-3.5 text-ink-gray-4" />
                  </Tooltip>
                </div>
                <Button variant="ghost" size="sm" icon="lucide-plus" :aria-label="store.paymentMethods.length ? 'Add backup method' : 'Add payment method'" @click="openPm" />
              </div>

              <div v-if="store.paymentMethods.length" class="mt-2 divide-y divide-outline-alpha-gray-1">
                <div v-for="pm in store.paymentMethods" :key="pm.id" class="flex items-center gap-3 py-2.5">
                  <span class="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-gray-2 text-ink-gray-6">
                    <span class="size-4" :class="pm.kind === 'upi' ? 'lucide-smartphone' : 'lucide-credit-card'" />
                  </span>
                  <div class="min-w-0 flex-1">
                    <div class="truncate text-sm font-medium text-ink-gray-9">{{ pm.label }}</div>
                    <div class="text-p-sm">
                      <span :class="pm.status === 'declined' ? 'text-ink-red-8' : 'text-ink-gray-5'">{{ pm.detail }}<template v-if="pm.status === 'declined'"> · declined</template></span><template v-if="pm.expiry && pm.status !== 'declined'"><span class="text-ink-gray-5"> · </span><span :class="expiryClass(pm)">{{ expiryLabel(pm) }}</span></template>
                    </div>
                  </div>
                  <Badge v-if="pm.primary" theme="green" variant="subtle" label="Primary" />
                  <Badge v-else theme="gray" variant="subtle" label="Backup" />
                  <Dropdown :options="pmMenu(pm)" placement="bottom-end">
                    <button class="rounded p-1 text-ink-gray-5 hover:bg-surface-gray-2" :aria-label="`Actions for ${pm.label}`"><span class="lucide-ellipsis size-4" /></button>
                  </Dropdown>
                </div>
              </div>
              <EmptyState
                v-else
                icon="lucide-credit-card"
                title="No payment method yet"
                description="Add a card or UPI to keep your servers running. We charge the primary first, then any backup."
              >
                <Button variant="solid" size="sm" label="Add payment method" icon-left="lucide-plus" @click="openPm" />
              </EmptyState>
            </section>

            <!-- Billing contact & tax — its own card; email, address and tax
                 details together (#14). -->
            <section class="rounded-xl border border-outline-gray-2 bg-surface-elevation-1 p-5">
              <div class="flex items-center justify-between">
                <h2 class="text-base font-semibold text-ink-gray-8">Billing contact &amp; tax</h2>
                <button class="rounded p-1 text-ink-gray-5 transition-colors hover:bg-surface-gray-2 hover:text-ink-gray-7" aria-label="Edit billing contact and tax" @click="openContact"><span class="lucide-pencil size-3.5" /></button>
              </div>
              <dl class="mt-2 space-y-1.5 text-p-sm">
                <div class="flex justify-between gap-3"><dt class="text-ink-gray-5">Billing email</dt><dd :class="store.billingProfile.emailBounced ? 'text-ink-red-8' : 'text-ink-gray-8'">{{ store.billingProfile.billingEmail || 'Not added' }}{{ store.billingProfile.emailBounced ? ' · bouncing' : '' }}</dd></div>
                <div class="flex justify-between gap-3"><dt class="text-ink-gray-5">Billing address</dt><dd class="max-w-[60%] truncate text-ink-gray-8">{{ store.billingProfile.address || 'Not added' }}</dd></div>
                <div class="flex justify-between gap-3"><dt class="text-ink-gray-5">Tax region</dt><dd class="text-ink-gray-8">{{ taxRegion.country }}</dd></div>
                <div class="flex justify-between gap-3"><dt class="text-ink-gray-5">{{ taxRegion.idLabel }}</dt><dd :class="taxMissing ? 'text-ink-amber-8' : 'text-ink-gray-8'">{{ store.billingProfile.taxValue || 'Not added' }}</dd></div>
              </dl>
              <button v-if="store.billingProfile.emailBounced" class="mt-2 flex items-center gap-1 text-xs text-ink-red-8 transition-colors hover:text-ink-red-8" @click="openContact">
                <span class="lucide-triangle-alert size-3 shrink-0" />
                Invoices are bouncing back — update your billing email.
              </button>
              <button v-if="taxMissing" class="mt-2 flex items-center gap-1 text-xs text-ink-amber-8 transition-colors hover:text-ink-amber-4" @click="openContact">
                <span class="lucide-triangle-alert size-3 shrink-0" />
                Add your {{ taxRegion.idLabel }} to make invoices tax-compliant.
              </button>
            </section>

            <!-- Subscriptions (one per server) -->
            <section class="rounded-xl border border-outline-gray-2 bg-surface-elevation-1 p-5 pt-4">
              <h2 class="text-base font-semibold text-ink-gray-8">Subscriptions</h2>
              <div class="mt-2 divide-y divide-outline-alpha-gray-1">
                <div v-for="srv in store.allServers" :key="srv.id" class="flex items-center justify-between gap-3 py-3">
                  <button class="group flex min-w-0 items-start gap-2.5 text-left" @click="goServer(srv.id)">
                    <span class="lucide-server mt-1 size-4 shrink-0 text-ink-gray-5" />
                    <div class="min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="truncate text-base font-medium text-ink-gray-9 transition-colors group-hover:text-ink-gray-7">{{ srv.name }}</span>
                        <span v-if="srv.status === 'suspended'" class="shrink-0 text-p-xs text-ink-amber-8">Suspended</span>
                      </div>
                      <div class="truncate text-p-sm text-ink-gray-5">{{ store.planOf(srv).name }} · {{ store.regionOf(srv).name }} ({{ store.regionOf(srv).provider }})</div>
                    </div>
                  </button>
                  <div class="flex shrink-0 items-center gap-3">
                    <span class="text-base font-medium tabular-nums" :class="srv.status === 'suspended' ? 'text-ink-gray-4 line-through' : 'text-ink-gray-9'">{{ inr(store.monthlyPriceOf(srv)) }}/mo</span>
                    <Dropdown :options="subMenu(srv)" placement="bottom-end">
                      <button class="rounded p-1 text-ink-gray-5 hover:bg-surface-gray-2" :aria-label="`Actions for ${srv.name}`"><span class="lucide-ellipsis size-4" /></button>
                    </Dropdown>
                  </div>
                </div>
              </div>
            </section>

            <!-- Marketplace payouts — always shown for discoverability (issue
                 #19). Before you publish anything it's an invitation; once you're
                 a developer it shows your withdrawable earnings. -->
            <section class="rounded-xl border border-outline-gray-2 bg-surface-elevation-1 p-5">
              <div class="flex items-center gap-2">
                <h2 class="text-base font-semibold text-ink-gray-8">Marketplace payouts</h2>
                <Badge theme="gray" variant="subtle" label="Paid in USD" />
              </div>

              <!-- Not a developer yet — a discoverable way in, not a buried feature. -->
              <template v-if="!isMarketplaceDeveloper">
                <p class="mt-2 text-p-sm text-ink-gray-5">
                  Publish an app on the Frappe Marketplace and earn a share of every subscription. Earnings show up here, withdrawable in USD.
                </p>
                <Button class="mt-3" variant="subtle" size="sm" label="Become a marketplace developer" icon-left="lucide-store" @click="becomeDeveloper" />
              </template>

              <!-- Developer — the real payout controls. -->
              <template v-else>
                <div class="mt-3 flex items-center justify-between gap-3">
                  <div class="flex items-baseline gap-2">
                    <span class="text-xl font-semibold text-ink-gray-9">{{ usd(store.payoutBalance) }}</span>
                    <span class="text-sm text-ink-gray-5">available to withdraw</span>
                  </div>
                  <Button v-if="store.payoutBalance > 0 && !store.payoutAccount" variant="solid" size="sm" label="Add payout account" @click="payoutOpen = true" />
                  <Button v-else variant="subtle" size="sm" label="Request payout" :disabled="store.payoutBalance <= 0 || !store.payoutAccount" @click="requestPayout" />
                </div>
                <p v-if="store.payoutBalance > 0 && !store.payoutAccount" class="mt-2 flex items-center gap-1 text-p-xs text-ink-amber-8">
                  <span class="lucide-triangle-alert size-3 shrink-0" />
                  Add a bank account to withdraw your earnings.
                </p>
                <p v-else-if="store.payoutBalance <= 0" class="mt-2 text-p-xs text-ink-gray-4">
                  No earnings yet — they'll appear here once your published apps start earning.
                </p>
              </template>
            </section>

            <!-- Stop / resume billing — the single global switch. Suspends every
                 server (reversible); nothing is deleted, so it stays calm — a plain
                 card with a single subtle red action, not an alarming red card. -->
            <section v-if="store.allServers.length" class="rounded-xl border border-outline-gray-2 bg-surface-elevation-1 p-5">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="min-w-0">
                  <template v-if="allSuspended">
                    <h2 class="text-base font-semibold text-ink-gray-8">Billing stopped</h2>
                    <p class="mt-0.5 text-p-sm text-ink-gray-5">All servers suspended. Resume to bring your sites back online.</p>
                  </template>
                  <template v-else>
                    <h2 class="text-base font-semibold text-ink-gray-8">Stop billing</h2>
                    <p class="mt-0.5 text-p-sm text-ink-gray-5">Suspend all servers to pause charges. Sites go offline; nothing is deleted.</p>
                  </template>
                </div>
                <Button v-if="allSuspended" variant="solid" theme="green" label="Resume billing" @click="resumeBilling" />
                <Button v-else variant="subtle" theme="red" label="Stop billing" @click="cancelOpen = true" />
              </div>
            </section>
          </div>
        </template>

        <!-- ── Invoices ─────────────────────────────────────────── -->
        <template v-else>
          <div class="flex items-start justify-between gap-3">
            <div>
              <h1 class="text-xl font-semibold text-ink-gray-9">Invoices</h1>
              <p class="mt-1 text-p-base text-ink-gray-5">
                Sent to {{ store.billingProfile.invoiceRecipient || store.billingProfile.billingEmail || store.user.email }} · in {{ langLabel(store.billingProfile.invoiceLanguage) }}
              </p>
            </div>
            <button class="mt-1 flex shrink-0 items-center gap-1.5 rounded px-2 py-1 text-sm text-ink-gray-5 transition-colors hover:bg-surface-gray-2 hover:text-ink-gray-7" @click="openInvoiceSettings">
              <span class="lucide-pencil size-3.5" />
              Recipient &amp; language
            </button>
          </div>

          <!-- Search + status filter, side by side (issue #12) -->
          <div v-if="store.invoices.length" class="mt-5 flex items-center gap-2">
            <div class="min-w-0 flex-1">
              <FormControl
                v-model="invoiceQuery"
                type="text"
                size="sm"
                placeholder="Search by period or invoice number…"
              >
                <template #prefix><span class="lucide-search size-4 text-ink-gray-4" /></template>
              </FormControl>
            </div>
            <div class="w-36 shrink-0">
              <FormControl
                v-model="invoiceStatusFilter"
                type="select"
                size="sm"
                :options="invoiceStatusOptions"
              />
            </div>
          </div>

          <div v-if="store.invoices.length" class="mt-3 divide-y divide-outline-alpha-gray-1">
            <button
              v-for="inv in filteredInvoices"
              :key="inv.number"
              class="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors"
              :class="openPanel?.type === 'invoice' && openPanel.data.number === inv.number ? 'bg-surface-gray-2' : 'hover:bg-surface-gray-1'"
              @click="openPanel = { type: 'invoice', data: inv }"
            >
              <div class="min-w-0">
                <div class="font-medium text-ink-gray-8">{{ inv.period }}</div>
                <div class="truncate text-p-sm" :class="inv.overdue ? 'text-ink-red-8' : 'text-ink-gray-5'">
                  {{ inv.number }} · {{ inv.overdue ? `Due ${inv.dueDate}` : `Issued ${inv.issued}` }}
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-3">
                <span class="tabular-nums text-ink-gray-8">{{ inr(total(inv)) }}</span>
                <Badge :theme="statusTheme(inv.status)" variant="subtle" :label="inv.status" />
                <span class="lucide-chevron-right size-4 text-ink-gray-4" />
              </div>
            </button>
            <p v-if="!filteredInvoices.length" class="px-3 py-8 text-center text-p-sm text-ink-gray-4">
              No invoices match your search.
            </p>
          </div>
          <EmptyState
            v-else
            class="mt-5"
            icon="lucide-receipt"
            title="No invoices yet"
            description="Your first invoice appears here at the end of the billing cycle — we'll email a copy too."
          />
        </template>
        </div>
      </div>

      <!-- Docked panel — invoice detail OR wallet history -->
      <Transition name="slide">
        <aside v-if="openPanel" class="flex w-[24rem] shrink-0 flex-col border-l border-outline-gray-2 bg-surface-elevation-1">
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
                <span class="text-ink-red-8">{{ openPanel.data.dueDate }} (overdue)</span>
              </div>
              <div class="flex items-center justify-between text-sm">
                <span class="text-ink-gray-5">Billed to</span>
                <span class="text-ink-gray-8">{{ store.billingProfile.billingEmail || store.user.email }}</span>
              </div>

              <div class="overflow-hidden rounded-lg border border-outline-gray-2">
                <div class="flex items-center justify-between gap-3 border-b border-outline-alpha-gray-1 bg-surface-gray-1 px-3 py-2 text-xs font-medium text-ink-gray-5">
                  <span>Item</span><span>Amount</span>
                </div>
                <div v-for="(it, i) in openPanel.data.items" :key="i" class="flex items-center justify-between gap-3 border-b border-outline-alpha-gray-1 px-3 py-2.5 text-sm last:border-b-0">
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
                <div v-if="openPanel.data.credits" class="flex justify-between"><dt class="text-ink-green-6">Credits applied</dt><dd class="tabular-nums text-ink-green-6">−{{ inr(openPanel.data.credits) }}</dd></div>
                <div class="flex justify-between border-t border-outline-alpha-gray-1 pt-1.5 font-semibold"><dt class="text-ink-gray-8">Total</dt><dd class="tabular-nums text-ink-gray-9">{{ inr(total(openPanel.data)) }}</dd></div>
                <!-- Wallet credit is auto-applied on payment, so preview it here. -->
                <template v-if="openPanel.data.status === 'Unpaid' && walletApplyPreview > 0">
                  <div class="flex justify-between"><dt class="text-ink-green-6">Wallet credit (applied on payment)</dt><dd class="tabular-nums text-ink-green-6">−{{ inr(walletApplyPreview) }}</dd></div>
                  <div class="flex justify-between font-semibold"><dt class="text-ink-gray-8">You'll pay</dt><dd class="tabular-nums text-ink-gray-9">{{ inr(total(openPanel.data) - walletApplyPreview) }}</dd></div>
                </template>
              </dl>
            </div>

            <div class="border-t border-outline-gray-2 p-4">
              <Button v-if="openPanel.data.status === 'Unpaid'" variant="solid" theme="red" class="mb-2 w-full" :label="`Pay ${inr(total(openPanel.data) - walletApplyPreview)} now`" icon-left="lucide-credit-card" @click="payInvoice(openPanel.data)" />
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

            <!-- Auto-recharge sits up top, right under the balance — it's the
                 safety setting that keeps the wallet from running dry, not a
                 footnote below the history. -->
            <div class="space-y-2 border-b border-outline-gray-2 p-4">
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <div class="text-sm font-medium text-ink-gray-8">Auto-recharge</div>
                  <div class="text-xs text-ink-gray-5">
                    <template v-if="store.autoRecharge">
                      When your wallet drops below {{ inr(store.rechargeThreshold) }}, we add {{ inr(store.rechargeAmount) }} from your primary method.
                    </template>
                    <template v-else>Top up automatically when your wallet runs low.</template>
                  </div>
                </div>
                <Switch :modelValue="store.autoRecharge" @update:modelValue="store.setAutoRecharge" />
              </div>
              <Button v-if="store.autoRecharge" variant="ghost" size="xs" class="-ml-1.5" label="Edit threshold & amount" @click="openRecharge" />
            </div>

            <div class="flex-1 overflow-y-auto p-4">
              <div v-if="store.walletHistory.length" class="divide-y divide-outline-alpha-gray-1">
                <div v-for="tx in store.walletHistory" :key="tx.id" class="flex items-center justify-between gap-3 py-2.5">
                  <div class="flex min-w-0 items-center gap-2.5">
                    <span class="grid size-7 shrink-0 place-items-center rounded-full" :class="tx.amount >= 0 ? 'bg-surface-green-2 text-ink-green-6' : 'bg-surface-gray-2 text-ink-gray-6'">
                      <span class="size-3.5" :class="tx.amount >= 0 ? 'lucide-arrow-down-left' : 'lucide-arrow-up-right'" />
                    </span>
                    <div class="min-w-0">
                      <div class="truncate text-sm text-ink-gray-8">{{ tx.label }}</div>
                      <div class="text-p-sm text-ink-gray-5">{{ tx.date }}</div>
                    </div>
                  </div>
                  <span class="shrink-0 text-sm font-medium tabular-nums" :class="tx.amount >= 0 ? 'text-ink-green-6' : 'text-ink-gray-8'">
                    {{ tx.amount >= 0 ? '+' : '−' }}{{ inr(Math.abs(tx.amount)) }}
                  </span>
                </div>
              </div>
              <EmptyState
                v-else
                icon="lucide-wallet"
                title="No wallet activity yet"
                description="Credit you add and charges we apply show up here."
              />
            </div>

            <div class="border-t border-outline-gray-2 p-4">
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

    <!-- Add / update payment method — the shared billing FTU (also used by the
         Desk's Frappe Cloud modal). Two steps when billing details are missing. -->
    <PaymentSetupDialog v-model:open="pmOpen" :editing-pm="editingPm" />

    <!-- Billing contact & tax — email, address and tax details in one place -->
    <Dialog v-model:open="contactOpen" size="md">
      <template #title><span class="text-xl font-semibold text-ink-gray-9">Billing contact &amp; tax</span></template>
      <div class="space-y-3">
        <div>
          <FormControl v-model="details.billingEmail" type="text" label="Billing email" placeholder="billing@company.com" />
          <p v-if="details.billingEmail && billingEmailError" class="mt-1 text-p-xs text-ink-red-8">{{ billingEmailError }}</p>
        </div>
        <FormControl v-model="details.address" type="textarea" label="Billing address" placeholder="Street, City, State, PIN" />
        <FormControl v-model="details.taxRegion" type="select" label="Tax region" :options="TAX_REGION_OPTIONS" />
        <div>
          <FormControl v-model="details.taxValue" type="text" :label="detailsTaxRegion.idLabel" :placeholder="detailsTaxRegion.placeholder" />
          <p v-if="details.taxValue && detailsTaxError" class="mt-1 text-p-xs text-ink-red-8">{{ detailsTaxError }}</p>
        </div>
      </div>
      <template #actions>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" @click="contactOpen = false" />
          <Button variant="solid" label="Save" :disabled="!!billingEmailError || !!detailsTaxError" @click="saveDetails(() => (contactOpen = false))" />
        </div>
      </template>
    </Dialog>

    <!-- Invoice settings — recipient & language (paired with invoices) -->
    <Dialog v-model:open="invoiceSettingsOpen" size="md">
      <template #title><span class="text-xl font-semibold text-ink-gray-9">Invoice recipient &amp; language</span></template>
      <div class="space-y-3">
        <div>
          <FormControl v-model="details.invoiceRecipient" type="text" label="Invoice email recipient" placeholder="accounts@company.com" />
          <p v-if="details.invoiceRecipient && recipientError" class="mt-1 text-p-xs text-ink-red-8">{{ recipientError }}</p>
        </div>
        <FormControl v-model="details.invoiceLanguage" type="select" label="Invoice language" :options="LANGUAGES" />
      </div>
      <template #actions>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" @click="invoiceSettingsOpen = false" />
          <Button variant="solid" label="Save" :disabled="!!recipientError" @click="saveDetails(() => (invoiceSettingsOpen = false))" />
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

    <!-- Edit auto-recharge threshold & amount -->
    <Dialog v-model:open="rechargeOpen" size="sm">
      <template #title><span class="text-xl font-semibold text-ink-gray-9">Auto-recharge</span></template>
      <div class="space-y-3">
        <FormControl v-model="rechargeForm.threshold" type="number" label="Top up when wallet drops below (₹)" placeholder="2000" />
        <FormControl v-model="rechargeForm.amount" type="number" label="Add this much each time (₹)" placeholder="5000" />
      </div>
      <template #actions>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" @click="rechargeOpen = false" />
          <Button variant="solid" label="Save" :disabled="!(Number(rechargeForm.threshold) > 0 && Number(rechargeForm.amount) > 0)" @click="saveRecharge" />
        </div>
      </template>
    </Dialog>

    <CancelSubscriptionDialog v-model:open="cancelOpen" />

    <AddCardDialog v-model:open="addCardOpen" />
  </CentralShell>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Badge, Button, Dialog, Dropdown, FormControl, Switch, Tooltip, toast } from 'frappe-ui'
import Alert from '../../components/Alert.vue'
import AddCardDialog from '../../components/AddCardDialog.vue'
import CancelSubscriptionDialog from '../../components/CancelSubscriptionDialog.vue'
import PaymentSetupDialog from '../../components/PaymentSetupDialog.vue'
import CentralShell from '../../components/CentralShell.vue'
import EmptyState from '../../components/EmptyState.vue'
import { TAX_REGION_OPTIONS, taxRegionByCode } from '../../data/tax'
import { CYCLE_DAYS, useCloudStore } from '../../stores/cloud'
import { inr, usd } from '../../utils/format'
import { validateEmail, validateTaxId } from '../../utils/validate'

const store = useCloudStore()
const route = useRoute()
const router = useRouter()

// One component serves both billing routes; the path picks the view.
const view = computed(() => (route.path === '/billing/invoices' ? 'invoices' : 'overview'))
const crumbs = computed(() =>
  view.value === 'invoices'
    ? [{ label: 'Billing', route: '/billing' }, { label: 'Invoices' }]
    : [{ label: 'Billing', route: '/billing' }],
)

// — Problem states (mostly surfaced by Edge mode, but real once the API is live)
const overdueInvoice = computed(() => store.invoices.find((i) => i.overdue || i.status === 'Unpaid') || null)
// A declined PRIMARY is only a problem if there's no working backup behind it.
// With a working backup, the charge just falls through to it — a soft notice.
const declinedPrimary = computed(() => store.paymentMethods.find((p) => p.primary && p.status === 'declined') || null)
const backupMethod = computed(() => store.paymentMethods.find((p) => !p.primary && p.status !== 'declined') || null)
const hasWorkingMethod = computed(() => store.paymentMethods.some((p) => p.status !== 'declined'))
// The real emergency: methods exist but none can be charged.
const noWorkingMethod = computed(() => store.paymentMethods.length > 0 && !hasWorkingMethod.value)
// The wallet is prepaid and a healthy card covers any shortfall — so it's only
// "at risk" when the balance is short AND nothing can be charged behind it.
const walletAtRisk = computed(
  () => store.walletBalance < store.estimatedThisCycle && (noWorkingMethod.value || !store.paymentMethods.length),
)
// The budget alert has actually been crossed — this cycle's estimate is at or
// over the threshold the user set.
const budgetCrossed = computed(
  () => !!store.budgetAlert && store.estimatedThisCycle >= store.budgetAlert,
)
// Amber is for "getting close," not "an alert exists" — only warn within 80% of
// the threshold. Comfortably under (e.g. ₹400 of a ₹20,000 alert) stays neutral.
const budgetNear = computed(
  () => !!store.budgetAlert && !budgetCrossed.value && store.estimatedThisCycle >= 0.8 * store.budgetAlert,
)
const budgetOverBy = computed(() => Math.max(0, store.estimatedThisCycle - (store.budgetAlert || 0)))

// Stacked banners cause banner-blindness, so we never show more than one. The
// payment problems are mostly facets of one "we can't charge you" state — we
// surface only the single most urgent (severity: paused > can't-charge >
// overdue > declined-but-backup-covered). The budget warning is a separate
// (spend) concern and lives inline on the Estimated-this-cycle card instead.
const billingBanner = computed(() => {
  if (store.creditExpired)
    return {
      key: 'credit-expired',
      theme: 'red',
      title: 'Your credit ran out, so your sites are paused',
      description: 'Add a card to bring them back — nothing was deleted.',
      action: { label: 'Add a card', onClick: () => (addCardOpen.value = true) },
    }
  if (noWorkingMethod.value)
    return {
      key: 'no-method',
      theme: 'red',
      title: 'No working payment method',
      description: 'Every method was declined. Add a working one to avoid suspension.',
      action: { label: 'Update payment method', onClick: openPm },
    }
  if (overdueInvoice.value)
    return {
      key: 'overdue',
      theme: 'red',
      title: `Invoice ${overdueInvoice.value.number} is overdue`,
      description: `${inr(total(overdueInvoice.value))} wasn't covered by your wallet credit. Add credit to settle it and avoid suspension.`,
      action: [
        { label: 'Add credit', onClick: () => (creditOpen.value = true) },
        { label: 'View invoice', onClick: () => (openPanel.value = { type: 'invoice', data: overdueInvoice.value }) },
      ],
    }
  if (declinedPrimary.value && backupMethod.value)
    return {
      key: 'declined',
      theme: 'blue',
      title: 'Primary payment method declined',
      description: `${declinedPrimary.value.label} ${declinedPrimary.value.detail} was declined, so we charged your backup ${backupMethod.value.label} instead. Update it when you can.`,
      action: { label: 'Update payment method', onClick: openPm },
    }
  return null
})
// Every curated region except the US legally expects a tax ID on B2B invoices.
const taxRequired = computed(() => store.billingProfile.taxRegion !== 'US')
const taxMissing = computed(() => taxRequired.value && !store.billingProfile.taxValue)

function statusTheme(status) {
  if (['Unpaid', 'Overdue', 'Failed'].includes(status)) return 'red'
  if (status === 'Paid') return 'green'
  return 'gray'
}

// — Invoice search + status filter (issue #12)
const invoiceQuery = ref('')
const invoiceStatusFilter = ref('all')
const invoiceStatusOptions = computed(() => {
  const statuses = [...new Set(store.invoices.map((inv) => inv.status))]
  return [{ label: 'All statuses', value: 'all' }, ...statuses.map((s) => ({ label: s, value: s }))]
})
const filteredInvoices = computed(() => {
  const q = invoiceQuery.value.trim().toLowerCase()
  return store.invoices.filter((inv) => {
    if (invoiceStatusFilter.value !== 'all' && inv.status !== invoiceStatusFilter.value) return false
    if (!q) return true
    return `${inv.period} ${inv.number}`.toLowerCase().includes(q)
  })
})

// — Card expiry (cards only). 'expired' | 'soon' (< 60 days) | 'ok'.
function expiryState(pm) {
  if (pm.kind !== 'card' || !pm.expiry) return null
  const [mm, yy] = pm.expiry.split('/').map(Number)
  const end = new Date(2000 + yy, mm, 0) // last day of the expiry month
  const days = (end - new Date()) / 86400000
  if (days < 0) return 'expired'
  if (days < 60) return 'soon'
  return 'ok'
}
function expiryLabel(pm) {
  const s = expiryState(pm)
  if (s === 'expired') return `expired ${pm.expiry}`
  if (s === 'soon') return `expires ${pm.expiry}`
  return `exp ${pm.expiry}`
}
function expiryClass(pm) {
  const s = expiryState(pm)
  if (s === 'expired') return 'text-ink-red-8'
  if (s === 'soon') return 'text-ink-amber-8'
  return 'text-ink-gray-5'
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
// Switching between the Billing and Invoices tabs closes the docked panel —
// an invoice opened on one tab shouldn't linger over the other. (#31)
watch(view, () => {
  openPanel.value = null
})

// — Cycle figures: where we are in the 30-day cycle and when it bills.
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
// Wallet credit auto-applies on payment — preview how much for the open invoice.
const walletApplyPreview = computed(() => {
  const inv = openPanel.value?.type === 'invoice' ? openPanel.value.data : null
  if (!inv || inv.status !== 'Unpaid') return 0
  return Math.min(store.walletBalance, total(inv))
})

// — Subscriptions (one per server) — open the server or pause/resume just it.
// Each server opens in its own tab.
function goServer(id) {
  window.open(`/manage/${id}`, '_blank', 'noopener')
}
function toggleServerBilling(srv, suspend) {
  store.setServerSuspended(srv.id, suspend)
  toast.success(suspend ? `${srv.name} paused` : `${srv.name} resumed`)
}
function subMenu(srv) {
  return [
    { label: 'Open server', icon: 'lucide-arrow-up-right', onClick: () => goServer(srv.id) },
    srv.status === 'suspended'
      ? { label: 'Resume billing', icon: 'lucide-play', onClick: () => toggleServerBilling(srv, false) }
      : { label: 'Pause billing', icon: 'lucide-pause', onClick: () => toggleServerBilling(srv, true) },
  ]
}

// — Stop / resume billing (suspend all, never delete)
const allSuspended = computed(() => store.allServers.length > 0 && store.allServers.every((s) => s.status === 'suspended'))
const cancelOpen = ref(false) // opens the "Stop billing" confirm dialog
function resumeBilling() {
  store.resumeBilling()
  toast.success('Billing resumed')
}


// — Payment methods. The add/update flow lives in the shared PaymentSetupDialog
// (also used by the Desk's FC modal); here we just open it with the right intent.
const pmOpen = ref(false)
const editingPm = ref(null) // the method being updated, or null when adding
function openPm() {
  editingPm.value = null
  pmOpen.value = true
}
// "Update" on a declined/expired method — re-enter details to fix it.
function updatePm(pm) {
  editingPm.value = pm
  pmOpen.value = true
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

// — Auto-recharge threshold & amount
const rechargeOpen = ref(false)
const rechargeForm = reactive({ threshold: '', amount: '' })
function openRecharge() {
  rechargeForm.threshold = String(store.rechargeThreshold)
  rechargeForm.amount = String(store.rechargeAmount)
  rechargeOpen.value = true
}
function saveRecharge() {
  store.setRecharge({ threshold: rechargeForm.threshold, amount: rechargeForm.amount })
  toast.success('Auto-recharge updated')
  rechargeOpen.value = false
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
// Treat anyone with existing earnings or a payout account as a developer too,
// so seeded data keeps showing the payout controls (issue #19).
const isMarketplaceDeveloper = computed(
  () => store.marketplaceDeveloper || store.payoutBalance > 0 || store.payoutAccount,
)
function becomeDeveloper() {
  store.becomeMarketplaceDeveloper()
  toast.success("You're a marketplace developer — publish an app to start earning")
}
function savePayoutAccount() {
  store.setPayoutAccount(true)
  toast.success('Payout account connected')
  payoutOpen.value = false
}
function requestPayout() {
  store.requestPayout()
  toast.success('Payout requested')
}

// — Tax region label (shown with the billing contact; edited in that dialog).
const taxRegion = computed(() => taxRegionByCode(store.billingProfile.taxRegion))

// — Billing contact & invoice settings. Split into two dialogs (#14) — email &
// address sit with payment methods; recipient & language sit with invoices — but
// both edit the same billing profile, so they share one form object.
const contactOpen = ref(false)
const invoiceSettingsOpen = ref(false)
const details = reactive({ address: '', billingEmail: '', invoiceRecipient: '', invoiceLanguage: 'en', taxRegion: 'IN', taxValue: '' })
function loadDetails() {
  details.address = store.billingProfile.address
  details.billingEmail = store.billingProfile.billingEmail
  details.invoiceRecipient = store.billingProfile.invoiceRecipient
  details.invoiceLanguage = store.billingProfile.invoiceLanguage
  details.taxRegion = store.billingProfile.taxRegion || 'IN'
  details.taxValue = store.billingProfile.taxValue || ''
}
function openContact() {
  loadDetails()
  contactOpen.value = true
}
function openInvoiceSettings() {
  loadDetails()
  invoiceSettingsOpen.value = true
}
const billingEmailError = computed(() => validateEmail(details.billingEmail, { required: true }))
const recipientError = computed(() => validateEmail(details.invoiceRecipient))
const detailsTaxRegion = computed(() => taxRegionByCode(details.taxRegion))
const detailsTaxError = computed(() => validateTaxId(details.taxRegion, details.taxValue, { required: details.taxRegion !== 'US' }))
function saveDetails(done) {
  if (billingEmailError.value || recipientError.value || detailsTaxError.value) return
  store.setBillingProfile({ ...details, emailBounced: false })
  toast.success('Billing details saved')
  done?.()
}

// — Budget alert
const budgetOpen = ref(false)
const budget = ref('20000')
function openBudget() {
  budget.value = store.budgetAlert ? String(store.budgetAlert) : '20000'
  budgetOpen.value = true
}
function setBudget() {
  store.setBudget(budget.value)
  toast.success(`Budget alert set at ${inr(Number(budget.value))}/cycle`)
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

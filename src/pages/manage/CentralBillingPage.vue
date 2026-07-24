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
              <!-- Estimated this cycle — the stat, with the budget alert as a quiet
                   footer line since the alert is what watches this number. -->
              <section class="flex flex-col rounded-lg border border-outline-gray-2 bg-surface-base p-5">
                <!-- Match the Wallet card's header height (its chevron makes that row
                     24px tall) so both cards' three lines line up row-for-row. -->
                <div class="flex h-6 items-center">
                  <span class="text-sm text-ink-gray-5">Estimated this cycle</span>
                </div>
                <div class="mt-1.5 text-2xl font-semibold tabular-nums text-ink-gray-9">{{ inr(store.estimatedThisCycle) }}</div>
                <div class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <span class="text-ink-gray-5">{{ billingTiming }}</span>
                  <span v-if="store.estimateDeltaPct" class="inline-flex items-center gap-0.5 font-medium" :class="deltaUp ? 'text-ink-amber-8' : 'text-ink-green-6'">
                    <span class="size-3" :class="deltaUp ? 'lucide-arrow-up' : 'lucide-arrow-down'" />
                    {{ Math.abs(store.estimateDeltaPct) }}% vs last month
                  </span>
                </div>
                <Button v-if="hasMethod" class="mt-auto -ml-2 self-start" :class="budgetCrossed ? '!text-ink-red-8' : budgetNear ? '!text-ink-amber-8' : ''" variant="ghost" size="xs" icon-left="lucide-bell" :label="budgetStateText" @click="openBudget" />
              </section>

              <!-- Wallet — balance + how this cycle gets covered, plus auto-recharge
                   as a quiet footer line (it refills the wallet, so it belongs here). -->
              <div
                class="flex flex-col rounded-lg border bg-surface-base p-5 transition-colors"
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
                <!-- Balance -->
                <div class="mt-1.5 text-2xl font-semibold tabular-nums text-ink-gray-9">{{ inr(store.walletBalance) }}</div>
                <!-- Coverage status, right under the balance — always the third line -->
                <p v-if="walletAtRisk" class="mt-1.5 flex items-center gap-1.5 text-xs text-ink-red-8">
                  <span class="lucide-triangle-alert size-3.5 shrink-0" />
                  Insufficient balance
                </p>
                <p v-else-if="walletShort" class="mt-1.5 flex items-center gap-1.5 text-xs text-ink-gray-5">
                  <span class="lucide-credit-card size-3.5 shrink-0 text-ink-gray-4" />
                  Card covers the rest
                </p>
                <p v-else class="mt-1.5 flex items-center gap-1.5 text-xs text-ink-gray-5">
                  <span class="lucide-circle-check size-3.5 shrink-0 text-ink-green-6" />
                  Covers this invoice
                </p>
                <!-- Funding actions, paired — only once there's a method to charge -->
                <div v-if="hasMethod" class="mt-auto flex items-center justify-between gap-2 pt-4">
                  <Button class="-ml-2" variant="ghost" size="xs" :label="store.autoRecharge ? 'Auto-recharge on' : 'Auto-recharge off'" icon-left="lucide-zap" @click="openRecharge" />
                  <Button variant="subtle" size="sm" label="Add credit" icon-left="lucide-plus" @click="creditOpen = true" />
                </div>
              </div>
            </div>

            <!-- Payment methods -->
            <section class="rounded-lg border border-outline-gray-2 bg-surface-base p-5 pt-4">
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
                description="Add a card or UPI to keep your servers running."
              >
                <Button variant="solid" size="sm" label="Add payment method" icon-left="lucide-plus" @click="openPm" />
              </EmptyState>
            </section>

            <!-- Billing contact & tax — its own card; email, address and tax
                 details together (#14). -->
            <section class="rounded-lg border border-outline-gray-2 bg-surface-base p-5">
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
                Billing email is bouncing — update it.
              </button>
              <button v-if="taxMissing" class="mt-2 flex items-center gap-1 text-xs text-ink-amber-8 transition-colors hover:text-ink-amber-4" @click="openContact">
                <span class="lucide-triangle-alert size-3 shrink-0" />
                Add your {{ taxRegion.idLabel }} to make invoices tax-compliant.
              </button>
            </section>

            <!-- Subscriptions (one per server) -->
            <section class="rounded-lg border border-outline-gray-2 bg-surface-base p-5 pt-4">
              <h2 class="text-base font-semibold text-ink-gray-8">Subscriptions</h2>
              <!-- Caps at ~6 rows and scrolls inside the card, so a long fleet
                   doesn't stretch the billing page. -->
              <div class="fc-scroll mt-2 max-h-[23rem] divide-y divide-outline-alpha-gray-1 overflow-y-auto">
                <div v-for="srv in store.allServers" :key="srv.id" class="flex items-center justify-between gap-3 py-3">
                  <div class="flex min-w-0 items-start gap-2.5 text-left">
                    <span class="lucide-server mt-1 size-4 shrink-0 text-ink-gray-5" />
                    <div class="min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="truncate text-base font-medium text-ink-gray-9">{{ srv.name }}</span>
                        <span v-if="srv.status === 'suspended'" class="shrink-0 text-p-xs text-ink-amber-8">Suspended</span>
                      </div>
                      <div class="truncate text-p-sm text-ink-gray-5">{{ store.planOf(srv).name }} · {{ store.regionOf(srv).name }} ({{ store.regionOf(srv).provider }})</div>
                    </div>
                  </div>
                  <div class="flex shrink-0 items-center gap-3">
                    <span class="text-base font-medium tabular-nums" :class="srv.status === 'suspended' ? 'text-ink-gray-4 line-through' : 'text-ink-gray-9'">{{ inr(store.monthlyPriceOf(srv)) }}/mo</span>
                    <Dropdown :options="subMenu(srv)" placement="bottom-end">
                      <button class="rounded p-1 text-ink-gray-5 hover:bg-surface-gray-2" :aria-label="`Actions for ${srv.name}`"><span class="lucide-ellipsis size-4" /></button>
                    </Dropdown>
                  </div>
                </div>
              </div>
            </section>

            <!-- Metered usage — the consumed half of the bill, sibling to
                 Subscriptions above. Every row carries its own allowance, so the
                 amount on the right is always explainable without leaving the
                 page; the bar is the fastest read of "how much room is left".
                 Grouped by service so six meters land as three blocks. -->
            <section v-if="store.meteredGroups.length" class="rounded-lg border border-outline-gray-2 bg-surface-base p-5 pt-4">
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-1.5">
                  <h2 class="text-base font-semibold text-ink-gray-8">Metered usage</h2>
                  <Tooltip text="Charged only past what your plan and add-ons include.">
                    <span class="lucide-info size-3.5 text-ink-gray-4" />
                  </Tooltip>
                </div>
                <span class="text-base font-medium tabular-nums text-ink-gray-9">{{ inr(store.meteredThisCycle) }}</span>
              </div>

              <!-- One row per service: what it is and what it cost. The meters
                   behind it live on the service's own page — this card is for
                   reading the bill, not auditing it. Deliberately the same row
                   shape as Subscriptions above, so the recurring and consumed
                   halves of the bill scan as one list. -->
              <div v-if="billableGroups.length" class="mt-2 divide-y divide-outline-alpha-gray-1">
                <div v-for="group in billableGroups" :key="group.source" class="flex items-center justify-between gap-3 py-3">
                  <component
                    :is="group.to ? 'button' : 'div'"
                    class="group/src flex min-w-0 items-center gap-2.5 text-left"
                    @click="group.to && router.push(group.to)"
                  >
                    <span class="size-4 shrink-0 text-ink-gray-5" :class="group.icon" />
                    <div class="flex min-w-0 items-center gap-1.5">
                      <span class="truncate text-base font-medium text-ink-gray-9" :class="group.to && 'transition-colors group-hover/src:text-ink-gray-7'">{{ group.source }}</span>
                      <span v-if="group.to" class="lucide-arrow-up-right size-3 shrink-0 text-ink-gray-4 opacity-0 transition-opacity group-hover/src:opacity-100" />
                    </div>
                  </component>
                  <span class="shrink-0 text-base font-medium tabular-nums text-ink-gray-9">{{ inr(group.cost) }}</span>
                </div>
              </div>
              <!-- Nothing metered this cycle — point the reader at the add-ons
                   they can switch on rather than leaving an empty card. -->
              <EmptyState
                v-else
                class="mt-4"
                icon="lucide-gauge"
                title="No metered usage"
                description="Turn on an add-on service — email, storage, AI — and its usage shows up here."
              >
                <Button variant="subtle" size="sm" label="Add a service" icon-left="lucide-plus" @click="router.push('/addons')" />
              </EmptyState>
            </section>

            <!-- Marketplace payouts — always shown for discoverability (issue
                 #19). Before you publish anything it's an invitation; once you're
                 a developer it shows your withdrawable earnings. -->
            <section class="rounded-lg border border-outline-gray-2 bg-surface-base p-5">
              <div class="flex items-center gap-2">
                <h2 class="text-base font-semibold text-ink-gray-8">Marketplace payouts</h2>
                <Badge theme="gray" variant="subtle" label="Paid in USD" />
              </div>

              <!-- Not a developer yet — a discoverable way in, not a buried feature. -->
              <template v-if="!isMarketplaceDeveloper">
                <p class="mt-2 text-p-sm text-ink-gray-5">
                  Publish an app and earn a share of every subscription. Paid out in USD.
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
                  No earnings yet.
                </p>
              </template>
            </section>

            <!-- Stop / resume billing — the single global switch. Suspends every
                 server (reversible); nothing is deleted, so it stays calm — a plain
                 card with a single subtle red action, not an alarming red card. -->
            <section v-if="store.allServers.length" class="rounded-lg border border-outline-gray-2 bg-surface-base p-5">
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
          <div>
            <h1 class="text-xl font-semibold text-ink-gray-9">Invoices</h1>
            <!-- The recipient/language control is an icon on the line it edits —
                 it's a settings shortcut, not an action worth a labelled button. -->
            <p class="mt-1 flex flex-wrap items-center gap-x-1.5 text-p-base text-ink-gray-5">
              Sent to {{ store.billingProfile.invoiceRecipient || store.billingProfile.billingEmail || store.user.email }} · in {{ langLabel(store.billingProfile.invoiceLanguage) }}
              <Tooltip text="Edit recipient &amp; language">
                <button class="grid size-6 place-items-center rounded text-ink-gray-4 transition-colors hover:bg-surface-gray-2 hover:text-ink-gray-7" aria-label="Edit invoice recipient and language" @click="openInvoiceSettings">
                  <span class="lucide-pencil size-3.5" />
                </button>
              </Tooltip>
            </p>
          </div>

          <!-- Search + date range + status filter, side by side (issue #12) -->
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
            <!-- Presets carry the real weight here — nobody hunts for an invoice
                 by picking two exact dates, they think in "last 6 months". -->
            <DateRangePicker
              v-model="invoiceRange"
              class="w-44 shrink-0"
              size="sm"
              format="D MMM"
              placeholder="Any date"
              :max="today"
            >
              <template #prefix><span class="lucide-calendar size-4 text-ink-gray-4" /></template>
              <template #actions="{ setRange, clear, close }">
                <button
                  v-for="p in datePresets"
                  :key="p.label"
                  type="button"
                  class="w-full rounded px-2 py-1.5 text-left text-base text-ink-gray-7 hover:bg-surface-gray-2"
                  @click="() => { setRange(p.range()); close() }"
                >
                  {{ p.label }}
                </button>
                <button
                  type="button"
                  class="w-full rounded px-2 py-1.5 text-left text-base text-ink-gray-5 hover:bg-surface-gray-2"
                  @click="() => { clear(); close() }"
                >
                  Any date
                </button>
              </template>
            </DateRangePicker>
            <div class="w-32 shrink-0">
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
              <!-- Badge first, amount last: the amounts form a clean right-
                   aligned column for scanning. No chevron — hover and the
                   active highlight already say "opens". -->
              <div class="flex shrink-0 items-center gap-3">
                <Badge :theme="statusTheme(inv.status)" variant="subtle" :label="inv.status" />
                <span class="tabular-nums text-ink-gray-8">{{ inr(total(inv)) }}</span>
              </div>
            </button>
          </div>
          <!-- Filtered down to nothing — the same empty-state pattern as the
               no-invoices-yet case, with a way back out of the filters. -->
          <EmptyState
            v-if="store.invoices.length && !filteredInvoices.length"
            class="mt-3"
            icon="lucide-search-x"
            title="No invoices match your filters"
            description="Try a wider date range or a different status."
          >
            <Button variant="subtle" size="sm" label="Clear filters" @click="clearInvoiceFilters" />
          </EmptyState>
          <EmptyState
            v-if="!store.invoices.length"
            class="mt-5"
            icon="lucide-receipt"
            title="No invoices yet"
            description="Your first invoice appears here at the end of the cycle."
          />
        </template>
        </div>
      </div>

      <!-- Docked panel — invoice detail OR wallet history -->
      <Transition name="slide">
        <aside v-if="openPanel" class="flex w-[24rem] shrink-0 flex-col border-l border-outline-gray-2 bg-surface-base">
          <!-- Invoice -->
          <template v-if="openPanel.type === 'invoice'">
            <!-- Email / download are the two things you do to any invoice
                 regardless of state, so they live in the header as icons and
                 leave the footer to the one state-dependent action (Pay). -->
            <!-- Header carries all invoice identity: number + status together,
                 so the body never needs a labelled "Status" form row. -->
            <div class="flex items-start justify-between gap-3 border-b border-outline-gray-2 p-4">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="truncate text-base font-semibold text-ink-gray-9">{{ openPanel.data.number }}</span>
                  <Badge :theme="statusTheme(openPanel.data.status)" variant="subtle" :label="openPanel.data.status" />
                </div>
                <div class="text-p-sm text-ink-gray-5">{{ openPanel.data.period }} · Issued {{ openPanel.data.issued }}</div>
              </div>
              <div class="flex shrink-0 items-center gap-0.5">
                <Tooltip text="Email invoice">
                  <button class="grid size-7 place-items-center rounded text-ink-gray-5 transition hover:bg-surface-gray-2 hover:text-ink-gray-7 active:scale-95" aria-label="Email invoice" @click="emailInvoice">
                    <span class="lucide-mail size-4" />
                  </button>
                </Tooltip>
                <Tooltip text="Download PDF">
                  <button class="grid size-7 place-items-center rounded text-ink-gray-5 transition hover:bg-surface-gray-2 hover:text-ink-gray-7 active:scale-95" aria-label="Download PDF" @click="download">
                    <span class="lucide-download size-4" />
                  </button>
                </Tooltip>
                <span class="mx-1 h-4 w-px bg-outline-gray-2" />
                <button class="grid size-7 place-items-center rounded text-ink-gray-5 transition hover:bg-surface-gray-2 active:scale-95" aria-label="Close" @click="openPanel = null">
                  <span class="lucide-x size-4" />
                </button>
              </div>
            </div>

            <!-- Body: a fixed-height receipt list that scrolls on its own, then
                 the cost breakdown and Activity below it. The list height is
                 constant regardless of how many servers or how many breakdowns
                 are expanded, so the totals never shift; Activity opens below and
                 the body scrolls to it. -->
            <div class="flex min-h-0 flex-1 flex-col overflow-y-auto">
              <!-- The one pre-items line, and only in the problem state — the
                   panel's single use of color above the fold. -->
              <p v-if="openPanel.data.overdue" class="flex items-center gap-1.5 px-4 pt-4 text-p-sm text-ink-red-8">
                <span class="lucide-triangle-alert size-3.5 shrink-0" />
                Due {{ openPanel.data.dueDate }} — overdue
              </p>

              <div class="h-80 shrink-0 space-y-4 overflow-y-auto px-4 pt-4">
                <!-- Servers — the eyebrow is a plain section label with its
                     subtotal, not a collapsible node. Each server below expands
                     to its plan breakdown. -->
                <section v-if="invoiceReceipt.servers.length">
                  <div class="mb-1 flex items-center justify-between gap-3 px-1.5">
                    <span class="text-p-xs font-medium uppercase tracking-wide text-ink-gray-5">Servers</span>
                    <span class="text-p-sm tabular-nums text-ink-gray-5">{{ inr(invoiceReceipt.serversTotal) }}</span>
                  </div>
                  <Tree :nodes="invoiceReceipt.servers" node-key="key" guides="none" class="invoice-tree">
                    <template #item-label="{ node }">
                      <span class="truncate" :class="node.segment ? 'text-p-sm text-ink-gray-5' : 'text-sm text-ink-gray-8'">{{ node.label }}</span>
                    </template>
                    <template #item-suffix="{ node }">
                      <span class="shrink-0 pl-3 tabular-nums" :class="node.segment ? 'text-p-sm text-ink-gray-5' : 'text-sm text-ink-gray-8'">{{ inr(node.amount) }}</span>
                    </template>
                  </Tree>
                </section>

                <!-- Add-ons — same shape; each expands to its quantity × rate. -->
                <section v-if="invoiceReceipt.addons.length">
                  <div class="mb-1 flex items-center justify-between gap-3 px-1.5">
                    <span class="text-p-xs font-medium uppercase tracking-wide text-ink-gray-5">Add-ons</span>
                    <span class="text-p-sm tabular-nums text-ink-gray-5">{{ inr(invoiceReceipt.addonsTotal) }}</span>
                  </div>
                  <Tree :nodes="invoiceReceipt.addons" node-key="key" guides="none" class="invoice-tree">
                    <template #item-label="{ node }">
                      <span class="truncate" :class="node.segment ? 'text-p-sm text-ink-gray-5' : 'text-sm text-ink-gray-8'">{{ node.label }}</span>
                    </template>
                    <template #item-suffix="{ node }">
                      <span class="shrink-0 pl-3 tabular-nums" :class="node.segment ? 'text-p-sm text-ink-gray-5' : 'text-sm text-ink-gray-8'">{{ inr(node.amount) }}</span>
                    </template>
                  </Tree>
                </section>
              </div>

              <!-- Cost breakdown + Activity — sit directly below the fixed-height
                   list. Activity opens below and is revealed by scrolling, so the
                   totals above never jump. -->
              <div class="border-t border-outline-gray-2 px-4">
                <dl class="space-y-2 py-3 text-sm">
                  <div class="flex justify-between gap-3"><dt class="text-ink-gray-5">Subtotal</dt><dd class="tabular-nums text-ink-gray-8">{{ inr(subtotal(openPanel.data)) }}</dd></div>
                  <div class="flex justify-between gap-3"><dt class="text-ink-gray-5">GST (18%)</dt><dd class="tabular-nums text-ink-gray-8">{{ inr(tax(openPanel.data)) }}</dd></div>
                  <div v-if="openPanel.data.credits" class="flex justify-between gap-3"><dt class="text-ink-green-6">Credits applied</dt><dd class="tabular-nums text-ink-green-6">−{{ inr(openPanel.data.credits) }}</dd></div>
                  <div class="mt-1 flex justify-between gap-3 border-t border-outline-alpha-gray-1 pt-2.5 font-semibold"><dt class="text-ink-gray-8">Total</dt><dd class="tabular-nums text-ink-gray-9">{{ inr(total(openPanel.data)) }}</dd></div>
                  <!-- Which card settled it — a quiet receipt line, not a form
                       row. Recorded on the invoice at payment time, so history
                       stays true after the method is replaced. -->
                  <div v-if="openPanel.data.status === 'Paid'" class="flex justify-between gap-3 text-p-sm text-ink-gray-5">
                    <dt>Paid with</dt>
                    <dd class="flex min-w-0 items-center gap-1.5">
                      <span class="size-3.5 shrink-0 text-ink-gray-4" :class="paidWithIcon(openPanel.data)" />
                      <span class="truncate">{{ paidWith(openPanel.data) }}</span>
                    </dd>
                  </div>
                  <!-- Wallet credit is auto-applied on payment, so preview it here. -->
                  <template v-if="openPanel.data.status === 'Unpaid' && walletApplyPreview > 0">
                    <div class="flex justify-between gap-3"><dt class="text-ink-green-6">Wallet credit (applied on payment)</dt><dd class="tabular-nums text-ink-green-6">−{{ inr(walletApplyPreview) }}</dd></div>
                    <div class="flex justify-between gap-3 font-semibold"><dt class="text-ink-gray-8">You'll pay</dt><dd class="tabular-nums text-ink-gray-9">{{ inr(total(openPanel.data) - walletApplyPreview) }}</dd></div>
                  </template>
                </dl>

                <!-- Activity — this invoice's own history (issued → charged /
                     declined → overdue → reminder). Timeline, newest first.
                     Folded away entirely: for a settled invoice the log is
                     reference, not news, and "Paid with" above already answers
                     the common question. -->
                <section class="border-t border-outline-gray-1 py-3">
                  <button
                    class="flex w-full items-center gap-1.5 text-left"
                    :aria-expanded="activityExpanded"
                    @click="activityExpanded = !activityExpanded"
                  >
                    <span class="lucide-chevron-right size-3.5 shrink-0 text-ink-gray-5 transition-transform duration-150 ease-out" :class="activityExpanded ? 'rotate-90' : ''" />
                    <h3 class="text-sm font-medium text-ink-gray-8">Activity</h3>
                    <span class="text-p-sm text-ink-gray-5">{{ activityEvents.length }}</span>
                  </button>
                  <ol v-if="activityExpanded" class="relative mt-3">
                    <li v-for="(e, i) in visibleActivity" :key="i" class="relative flex gap-3 pb-4 last:pb-0">
                      <!-- Rail: one continuous line running through the column, with
                           the solid dot sitting on top of it (no outline). The line
                           is dropped on the last row so it doesn't dangle. -->
                      <div class="relative flex w-2.5 shrink-0 justify-center">
                        <span v-if="i < visibleActivity.length - 1" class="absolute left-1/2 top-2 h-[calc(100%+1rem)] w-px -translate-x-1/2 bg-[var(--outline-gray-2)]" />
                        <span class="relative z-10 mt-1 size-2 shrink-0 rounded-full" :class="dotClass(e.tone)" />
                      </div>
                      <div class="min-w-0 flex-1">
                        <div class="flex items-baseline justify-between gap-2">
                          <span class="text-sm font-medium text-ink-gray-8">{{ e.label }}</span>
                          <span class="shrink-0 tabular-nums text-p-xs text-ink-gray-5">{{ e.at }}</span>
                        </div>
                        <p v-if="e.detail" class="mt-0.5 text-p-sm text-ink-gray-5">{{ e.detail }}</p>
                      </div>
                    </li>
                  </ol>
                </section>
              </div>
            </div>

            <!-- The footer now carries only the one state-dependent action;
                 email and download moved to the header. -->
            <div v-if="openPanel.data.status === 'Unpaid'" class="border-t border-outline-gray-2 p-4">
              <!-- Settling an invoice is the helpful way out of an overdue
                   state, not a destructive act — the default solid, not red. -->
              <Button variant="solid" class="w-full" :label="`Pay ${inr(total(openPanel.data) - walletApplyPreview)} now`" icon-left="lucide-credit-card" @click="payInvoice(openPanel.data)" />
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
    <Dialog v-model:open="creditOpen" title="Add credit" size="sm">
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

    <!-- Billing profile — legal contact, address and (country-driven) tax -->
    <Dialog v-model:open="contactOpen" title="Billing profile" size="xl">
      <BillingProfileFields :form="details" v-model:valid="contactValid" />
      <template #actions>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" @click="contactOpen = false" />
          <Button variant="solid" label="Save" :disabled="!contactValid" @click="saveContact(() => (contactOpen = false))" />
        </div>
      </template>
    </Dialog>

    <!-- Invoice settings — recipient & language (paired with invoices) -->
    <Dialog v-model:open="invoiceSettingsOpen" title="Invoice recipient &amp; language" size="md">
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
          <Button variant="solid" label="Save" :disabled="!!recipientError" @click="saveInvoiceSettings(() => (invoiceSettingsOpen = false))" />
        </div>
      </template>
    </Dialog>

    <!-- Budget alert -->
    <Dialog v-model:open="budgetOpen" title="Set a budget alert" size="sm">
      <FormControl v-model="budget" type="number" label="Alert me above (₹)" placeholder="20000" />
      <template #actions>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" @click="budgetOpen = false" />
          <Button variant="solid" label="Set alert" :disabled="!(Number(budget) > 0)" @click="setBudget" />
        </div>
      </template>
    </Dialog>

    <!-- Add payout account -->
    <Dialog v-model:open="payoutOpen" title="Add payout account" size="sm">
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

    <!-- Auto-recharge: turn on / configure / turn off all live here now that the
         card shows a single button instead of a toggle. -->
    <Dialog v-model:open="rechargeOpen" title="Auto-recharge" size="sm">
      <div class="space-y-3">
        <p class="text-p-sm text-ink-gray-6">Auto top-up so a low balance never interrupts service.</p>
        <FormControl v-model="rechargeForm.threshold" type="number" label="Top up when wallet drops below (₹)" placeholder="2000" />
        <FormControl v-model="rechargeForm.amount" type="number" label="Add this much each time (₹)" placeholder="5000" />
      </div>
      <template #actions>
        <div class="flex items-center justify-between gap-2">
          <Button v-if="store.autoRecharge" variant="ghost" theme="red" label="Turn off" @click="disableRecharge" />
          <span v-else />
          <div class="flex gap-2">
            <Button label="Cancel" @click="rechargeOpen = false" />
            <Button variant="solid" :label="store.autoRecharge ? 'Save changes' : 'Turn on'" :disabled="!(Number(rechargeForm.threshold) > 0 && Number(rechargeForm.amount) > 0)" @click="saveRecharge" />
          </div>
        </div>
      </template>
    </Dialog>

    <CancelSubscriptionDialog v-model:open="cancelOpen" />

    <AddCardDialog v-model:open="addCardOpen" />

    <!-- Shared confirm gate for serious actions (pause billing, remove a method) -->
    <ConfirmDialog
      v-model:open="confirmOpen"
      :title="confirmCfg.title"
      :message="confirmCfg.message"
      :theme="confirmCfg.theme"
      :confirm-label="confirmCfg.label"
      @confirm="runConfirm"
    />
  </CentralShell>
</template>

<script setup>
import { computed, nextTick, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Badge, Button, DateRangePicker, Dialog, Dropdown, FormControl, Switch, Tooltip, Tree, dayjs, toast } from 'frappe-ui'
import Alert from '../../components/Alert.vue'
import AddCardDialog from '../../components/AddCardDialog.vue'
import CancelSubscriptionDialog from '../../components/CancelSubscriptionDialog.vue'
import ConfirmDialog from '../../components/ConfirmDialog.vue'
import PaymentSetupDialog from '../../components/PaymentSetupDialog.vue'
import BillingProfileFields from '../../components/BillingProfileFields.vue'
import CentralShell from '../../components/CentralShell.vue'
import EmptyState from '../../components/EmptyState.vue'
import { countryForRegion, regionForCountry, taxRegionByCode } from '../../data/tax'
import { useCloudStore } from '../../stores/cloud'
import { inr, qty, rate, usd } from '../../utils/format'
import { validateEmail } from '../../utils/validate'

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

// The bill leads with what's actually being charged; anything still inside its
// allowance collapses to one line below, so turning on a fourth add-on doesn't
// add three rows of zeroes to the page you check your spend on.
const billableGroups = computed(() => store.meteredGroups.filter((g) => g.cost > 0))

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

// — Spending controls, surfaced as quiet metadata on the card each one governs
// rather than as a section of their own. Auto-recharge refills the wallet, so it
// lives on the Wallet card; the budget alert watches the cycle estimate, so it
// lives on the Estimated card. Both stay caption-quiet and only tint when the
// state is worth noticing.
const walletShort = computed(() => store.walletBalance < store.estimatedThisCycle)
const walletShortfall = computed(() => Math.max(0, store.estimatedThisCycle - store.walletBalance))
// Until there's a method to charge, the funding actions and budget alert stay
// hidden — the page's job is to get a method added first (mirrors the Desk modal).
const hasMethod = computed(() => store.paymentMethods.length > 0)
// Budget alert line — states the relationship to the estimate, not just the raw
// threshold, so the number means something at a glance.
const budgetStateText = computed(() => {
  if (!store.budgetAlert) return 'Set a budget alert'
  if (budgetCrossed.value) return `Over your ${inr(store.budgetAlert)} alert`
  if (budgetNear.value) return `Nearing your ${inr(store.budgetAlert)} alert`
  return `Budget alert at ${inr(store.budgetAlert)}`
})

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
      description: 'All methods declined. Add a working one to avoid suspension.',
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

// Paid is the normal state, so it stays gray — color is reserved for the
// states that need attention. A red Unpaid pops harder against a calm list
// than against a wall of green.
function statusTheme(status) {
  if (['Unpaid', 'Overdue', 'Failed'].includes(status)) return 'red'
  return 'gray'
}

// — Invoice search + date range + status filter (issue #12)
const invoiceQuery = ref('')
const invoiceStatusFilter = ref('all')
const invoiceRange = ref([]) // [fromISO, toISO], empty = any date
const today = dayjs().format('YYYY-MM-DD')
// The ranges people actually reach for when hunting an invoice. Each returns a
// [from, to] dayjs pair for the picker's `setRange`.
const datePresets = [
  { label: 'Last week', range: () => [dayjs().subtract(1, 'week'), dayjs()] },
  { label: 'Last month', range: () => [dayjs().subtract(1, 'month'), dayjs()] },
  { label: 'Last 6 months', range: () => [dayjs().subtract(6, 'month'), dayjs()] },
  { label: 'Last year', range: () => [dayjs().subtract(1, 'year'), dayjs()] },
]
const invoiceStatusOptions = computed(() => {
  const statuses = [...new Set(store.invoices.map((inv) => inv.status))]
  return [{ label: 'All statuses', value: 'all' }, ...statuses.map((s) => ({ label: s, value: s }))]
})
// Invoices carry `issuedISO` for exactly this — comparing display strings like
// "1 Jun 2026" would mean re-parsing them on every keystroke.
function inRange(inv) {
  const [from, to] = invoiceRange.value || []
  if (!from || !to || !inv.issuedISO) return true
  return inv.issuedISO >= from && inv.issuedISO <= to
}
function clearInvoiceFilters() {
  invoiceQuery.value = ''
  invoiceStatusFilter.value = 'all'
  invoiceRange.value = []
}
const filteredInvoices = computed(() => {
  const q = invoiceQuery.value.trim().toLowerCase()
  return store.invoices.filter((inv) => {
    if (invoiceStatusFilter.value !== 'all' && inv.status !== invoiceStatusFilter.value) return false
    if (!inRange(inv)) return false
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
// Escape closes it — but never steals the key from something that owns it:
// an open dialog/popover/dropdown (reka-ui marks every open layer with
// data-dismissable-layer and closes itself), or a field being typed in.
// Registered on capture and only while a panel is open — tied to the state,
// not the component lifecycle, so nothing else's Escape handling (or a stray
// second mounted instance) can leave it pointing at the wrong panel.
function onGlobalKeydown(e) {
  if (e.key !== 'Escape' || !openPanel.value || e.defaultPrevented) return
  if (document.querySelector('[data-dismissable-layer]')) return
  const t = e.target
  if (t instanceof HTMLElement && t.closest('input, textarea, select, [contenteditable="true"]')) {
    t.blur() // first Escape leaves the field, a second closes the panel
    return
  }
  openPanel.value = null
}
watch(openPanel, (open) => {
  if (open) window.addEventListener('keydown', onGlobalKeydown, true)
  else window.removeEventListener('keydown', onGlobalKeydown, true)
})
onUnmounted(() => window.removeEventListener('keydown', onGlobalKeydown, true))
// Switching between the Billing and Invoices tabs closes the docked panel —
// an invoice opened on one tab shouldn't linger over the other. (#31)
watch(view, () => {
  openPanel.value = null
})
// A global-search invoice result deep-links here as ?invoice=INV-… — open that
// invoice's panel on arrival (and on later selections, since one component
// instance serves both billing routes). Registered after the view watcher so it
// wins the same-tick race when the route switches overview → invoices.
watch(
  () => route.query.invoice,
  (number) => {
    if (!number) return
    const inv = store.invoices.find((i) => i.number === number)
    if (inv) openPanel.value = { type: 'invoice', data: inv }
  },
  { immediate: true },
)

// — Cycle figures: where we are in the 30-day cycle and when it bills.
// Time until the next bill — accurate whatever day the account joined the cycle.
// A "day N of 30" count overstates usage for a mid-cycle start (the estimate is
// already prorated), so we show the bill date and how long until it instead.
const billingTiming = computed(() => {
  const now = new Date()
  const due = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const days = Math.max(0, Math.ceil((due - now) / 86400000))
  const date = due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  if (days === 0) return 'Bills today'
  return `Bills ${date} · ${days} day${days === 1 ? '' : 's'} left`
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
// The receipt, split into two eyebrow'd sections — Servers and Add-ons — so the
// recurring and metered halves of the bill read apart. Each line (server or
// add-on) is a single-line row that expands to reveal how its amount was built:
// one plan · days × rate for a steady server, several for a mid-cycle plan
// change, or the quantity × rate behind a metered add-on. Every row expands, so
// the affordance is uniform down the whole list.
//
// Held in a ref (rebuilt when the open invoice changes) rather than a computed:
// the Tree tracks expansion by mutating `node.expanded` in place, so the nodes
// must be reactive for a toggle to re-render — a ref deep-reactivates them, a
// computed's fresh plain objects would swallow the mutation.
const invoiceReceipt = ref({ servers: [], addons: [], serversTotal: 0, addonsTotal: 0 })
function buildInvoiceTree() {
  const inv = openPanel.value?.type === 'invoice' ? openPanel.value.data : null
  if (!inv) {
    invoiceReceipt.value = { servers: [], addons: [], serversTotal: 0, addonsTotal: 0 }
    return
  }
  const items = inv.items || []

  const servers = items
    .filter((it) => it.kind !== 'metered')
    .map((it) => {
      // A steady server has no segments — synthesise its single plan · days ×
      // rate line so it expands to the same shape as one that changed plans.
      const segments =
        it.segments && it.segments.length
          ? it.segments
          : [{ plan: it.plan, days: it.days, perDay: it.perDay, amount: it.amount }]
      return {
        key: it.label,
        label: it.label,
        amount: it.amount,
        expanded: false,
        children: segments.map((s, i) => ({
          key: `${it.label}-${i}`,
          label: `${s.plan} · ${s.days} × ${inr(s.perDay)}/day`,
          amount: s.amount,
          segment: true,
        })),
      }
    })

  const addons = items
    .filter((it) => it.kind === 'metered')
    .map((it) => ({
      key: it.label,
      label: it.label,
      amount: it.amount,
      expanded: false,
      children: [
        {
          key: `${it.label}-m`,
          label: `${qty(it.qty)} ${it.unit} × ${rate(it.rate)}`,
          amount: it.amount,
          segment: true,
        },
      ],
    }))

  const sum = (nodes) => nodes.reduce((t, n) => t + n.amount, 0)
  invoiceReceipt.value = {
    servers,
    addons,
    serversTotal: sum(servers),
    addonsTotal: sum(addons),
  }
}

// Wallet credit auto-applies on payment — preview how much for the open invoice.
const walletApplyPreview = computed(() => {
  const inv = openPanel.value?.type === 'invoice' ? openPanel.value.data : null
  if (!inv || inv.status !== 'Unpaid') return 0
  return Math.min(store.walletBalance, total(inv))
})

// — Invoice activity (the docked panel's history timeline). Derived from the
// invoice's own fields so every invoice gets a coherent log without storing it
// twice; the API will return real events here later. Tone drives the dot colour:
// green = settled, red = a failed/overdue step, gray = neutral.
const primaryMethod = computed(
  () => store.paymentMethods.find((p) => p.primary) || store.paymentMethods[0] || null,
)
const primaryMethodLabel = computed(() =>
  primaryMethod.value ? `${primaryMethod.value.label} ${primaryMethod.value.detail}` : 'your payment method',
)
// `n` days after the invoice was issued, in the same display format.
function sinceIssue(inv, n) {
  if (!inv.issuedISO) return inv.issued
  return dayjs(inv.issuedISO).add(n, 'day').format('D MMM YYYY')
}
function buildActivity(inv) {
  const recipient = store.billingProfile.invoiceRecipient || store.billingProfile.billingEmail || store.user.email
  const card = primaryMethodLabel.value
  // Built oldest-first, then reversed so the newest event leads.
  const events = [
    { label: 'Invoice issued', detail: `Generated for ${inv.period} usage`, at: inv.issued, tone: 'neutral' },
  ]
  if (inv.status === 'Paid') {
    events.push({ label: 'Payment received', detail: `${inr(total(inv))} charged to ${inv.paidWith || card}`, at: inv.issued, tone: 'success' })
  } else if (inv.status === 'Unpaid' || inv.overdue) {
    // Dated off the invoice itself so the log stays coherent whenever the demo
    // is opened — the charge is attempted the day after issue, the reminder a
    // week later.
    events.push({ label: 'Payment failed', detail: `${card} was declined`, at: sinceIssue(inv, 1), tone: 'failed' })
    if (inv.overdue)
      events.push({ label: 'Marked overdue', detail: `Payment due ${inv.dueDate} wasn't received`, at: inv.dueDate, tone: 'failed' })
    events.push({ label: 'Reminder sent', detail: `Payment reminder emailed to ${recipient}`, at: sinceIssue(inv, 8), tone: 'neutral' })
  }
  return events.reverse()
}
const activityEvents = computed(() =>
  openPanel.value?.type === 'invoice' ? buildActivity(openPanel.value.data) : [],
)
// The whole section is folded by default now, so once it's open there's no
// second fold — show the full log.
const activityExpanded = ref(false)
const visibleActivity = computed(() => activityEvents.value)
// Reset the fold and rebuild the receipt tree whenever a different invoice (or
// the wallet) opens — a fresh tree starts with its segments collapsed.
watch(
  () => openPanel.value?.data?.number,
  () => {
    activityExpanded.value = false
    buildInvoiceTree()
  },
  { immediate: true },
)

// — Which method settled the invoice. Prefer what the invoice recorded at
// payment time; fall back to today's primary for older seeded data.
function paidWith(inv) {
  return inv.paidWith || primaryMethodLabel.value
}
function paidWithIcon(inv) {
  return /upi/i.test(paidWith(inv)) ? 'lucide-smartphone' : 'lucide-credit-card'
}
function dotClass(tone) {
  if (tone === 'success') return 'bg-[var(--ink-green-7)]'
  if (tone === 'failed') return 'bg-[var(--ink-red-7)]'
  return 'bg-[var(--ink-gray-4)]'
}

// — Subscriptions (one per server) — open the server or pause/resume just it.
// Each server opens in its own tab.
function goServer(id) {
  window.open(`/manage/${id}`, '_blank', 'noopener')
}
function toggleServerBilling(srv, suspend) {
  // Resuming is safe and instant; pausing takes the server's sites offline, so confirm.
  if (!suspend) {
    store.setServerSuspended(srv.id, false)
    toast.success(`${srv.name} resumed`)
    return
  }
  askConfirm(
    { title: `Pause billing for ${srv.name}?`, message: 'Its sites go offline until you resume. Nothing is deleted.', theme: 'gray', label: 'Pause billing' },
    () => {
      store.setServerSuspended(srv.id, true)
      toast.success(`${srv.name} paused`)
    },
  )
}
function subMenu(srv) {
  const opts = [{ label: 'Open server', icon: 'lucide-arrow-up-right', onClick: () => goServer(srv.id) }]
  // Pausing billing per-server was removed; a suspended server can still be
  // brought back so it never gets stranded.
  if (srv.status === 'suspended') {
    opts.push({ label: 'Resume billing', icon: 'lucide-play', onClick: () => toggleServerBilling(srv, false) })
  }
  return opts
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
  opts.push({ label: 'Remove', icon: 'lucide-trash-2', onClick: () => askRemovePm(pm) })
  return opts
}
function askRemovePm(pm) {
  // Warn harder when it's the last method that can actually be charged.
  const onlyWorking = store.paymentMethods.filter((p) => p.status !== 'declined').length <= 1
  askConfirm(
    {
      title: 'Remove payment method?',
      message: onlyWorking
        ? "This is your only working method — remove it and we can't bill you, so sites may pause."
        : 'Charges will use your other method. You can re-add it anytime.',
      theme: 'red',
      label: 'Remove',
    },
    () => {
      store.removePaymentMethod(pm.id)
      toast.success('Payment method removed')
    },
  )
}

// — Confirm gate shared by the serious billing actions above.
const confirmOpen = ref(false)
const confirmCfg = ref({ title: '', message: '', theme: 'gray', label: 'Confirm' })
let confirmFn = null
function askConfirm(cfg, fn) {
  confirmCfg.value = cfg
  confirmFn = fn
  confirmOpen.value = true
}
function runConfirm() {
  const fn = confirmFn
  confirmFn = null
  fn && fn()
}

// — Wallet
const creditOpen = ref(false)
const creditAmount = ref('5000')
function addCredit() {
  store.addToWallet(creditAmount.value)
  toast.success(`Added ${inr(Number(creditAmount.value))} to your wallet`)
  creditOpen.value = false
}

// Global-search actions deep-link here as ?action=add-card|add-credit and open
// the matching dialog. The param is cleared once handled so the same action can
// be triggered again later (a repeated ?action=… value wouldn't re-fire).
watch(
  () => route.query.action,
  (a) => {
    if (a === 'add-card') openPm()
    else if (a === 'add-credit') creditOpen.value = true
    else return
    const q = { ...route.query }
    delete q.action
    nextTick(() => router.replace({ query: q }))
  },
  { immediate: true },
)

// — Auto-recharge threshold & amount
const rechargeOpen = ref(false)
const rechargeForm = reactive({ threshold: '', amount: '' })
function openRecharge() {
  rechargeForm.threshold = String(store.rechargeThreshold)
  rechargeForm.amount = String(store.rechargeAmount)
  rechargeOpen.value = true
}
function saveRecharge() {
  const wasOn = store.autoRecharge
  store.setRecharge({ threshold: rechargeForm.threshold, amount: rechargeForm.amount })
  if (!wasOn) store.setAutoRecharge(true)
  toast.success(wasOn ? 'Auto-recharge updated' : 'Auto-recharge on')
  rechargeOpen.value = false
}
function disableRecharge() {
  store.setAutoRecharge(false)
  toast.success('Auto-recharge off')
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
  toast.success("You're a marketplace developer")
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
const contactValid = ref(false)
const details = reactive({
  legalName: '', phone: '', billingEmail: '', addressLine1: '', addressLine2: '', city: '', state: '', country: '', pin: '',
  taxValue: '', invoiceRecipient: '', invoiceLanguage: 'en',
})
function loadDetails() {
  const p = store.billingProfile
  details.legalName = p.legalName || ''
  details.phone = p.phone || ''
  details.billingEmail = p.billingEmail || ''
  details.addressLine1 = p.addressLine1 || ''
  details.addressLine2 = p.addressLine2 || ''
  details.city = p.city || ''
  details.state = p.state || ''
  details.country = p.country || countryForRegion(p.taxRegion)
  details.pin = p.pin || ''
  details.taxValue = p.taxValue || ''
  details.invoiceRecipient = p.invoiceRecipient
  details.invoiceLanguage = p.invoiceLanguage
}
function openContact() {
  loadDetails()
  contactOpen.value = true
}
function openInvoiceSettings() {
  loadDetails()
  invoiceSettingsOpen.value = true
}
const recipientError = computed(() => validateEmail(details.invoiceRecipient))
// Billing profile — compose the one-line address for display and derive the tax
// region from the country before saving.
function saveContact(done) {
  if (!contactValid.value) return
  const address = [details.addressLine1, details.addressLine2, details.city, details.state, details.pin]
    .map((s) => (s || '').trim())
    .filter(Boolean)
    .join(', ')
  store.setBillingProfile({
    legalName: details.legalName.trim(),
    phone: details.phone.trim(),
    billingEmail: details.billingEmail.trim(),
    addressLine1: details.addressLine1.trim(),
    addressLine2: details.addressLine2.trim(),
    city: details.city.trim(),
    state: details.state.trim(),
    country: details.country,
    pin: details.pin.trim(),
    address,
    taxRegion: regionForCountry(details.country),
    taxValue: details.taxValue.trim(),
    emailBounced: false,
  })
  toast.success('Billing profile saved')
  done?.()
}
// Invoice recipient & language — its own small save, unrelated to the profile.
function saveInvoiceSettings(done) {
  if (recipientError.value) return
  store.setBillingProfile({
    invoiceRecipient: details.invoiceRecipient.trim(),
    invoiceLanguage: details.invoiceLanguage,
  })
  toast.success('Invoice settings saved')
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

<!-- The invoice tree's structural overrides can't be scoped: frappe-ui's Tree
     sets inheritAttrs:false, so its root never carries this component's scope id
     and scoped selectors (even :deep) can't reach it. A plain block keyed on the
     .invoice-tree class is reliable and specific enough. -->
<style>
.invoice-tree {
  /* Zero indent so a breakdown line's text starts at the same x as its server
     name (the child's own chevron-width spacer lines it up with the parent's
     chevron). The relationship is shown by a vertical rule instead. Row height
     is fixed since every row is a single line. */
  --tree-indent: 0px;
  --tree-row-height: 30px;
}
/* Lighter chevron than the frappe default. */
.invoice-tree [data-slot='toggle'] {
  color: var(--ink-gray-4);
}
/* Vertical rule down an expanded breakdown, sitting under the parent's chevron. */
.invoice-tree [role='group'] {
  position: relative;
}
.invoice-tree [role='group']::before {
  content: '';
  position: absolute;
  left: 16px;
  top: 0;
  bottom: 6px;
  width: 1px;
  background: var(--outline-gray-2);
}
</style>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  /* iOS drawer curve — decelerates hard at the end, so the panel feels like
     it settles rather than stops. The margin animates alongside the slide:
     without it the panel's 24rem of layout width appears/disappears in a
     single frame (worst on close, where the content snapped wide only after
     the slide finished). Margin animation costs layout per frame — the
     accepted tradeoff for a docked (not overlaid) panel. */
  transition:
    transform 300ms cubic-bezier(0.32, 0.72, 0, 1),
    margin-inline-end 300ms cubic-bezier(0.32, 0.72, 0, 1);
}
.slide-enter-from,
.slide-leave-to {
  /* -24rem mirrors the panel's w-[24rem]: net layout width 0 while hidden. */
  transform: translateX(100%);
  margin-inline-end: -24rem;
}
</style>

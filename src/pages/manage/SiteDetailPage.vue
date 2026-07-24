<template>
  <ServerShell v-if="site" :server="server" :crumbs="crumbs" wide>
    <!-- New site is a server-level action, kept here since this page is the
         server's home now. Site-specific actions (Visit, ⋯) live on the page
         header below. -->
    <template #actions>
      <Button variant="solid" size="sm" label="New site" icon-left="lucide-plus" :disabled="server.status !== 'active'" @click="newSiteOpen = true" />
    </template>

    <!-- Split view: the page pane scrolls on its own; the sites list floats
         beside it in the same corner, docked open by default — there's
         always a site open, so the list is this page's "home" affordance.
         Collapsing it hands the full width back to the page. -->
    <div class="relative h-full">
      <div
        ref="scroller"
        class="h-full overflow-y-auto [scrollbar-gutter:stable] transition-[padding] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
        :class="listOpen ? 'lg:pl-[19rem]' : ''"
      >
        <div class="sdl-page mx-auto w-full max-w-[860px] px-4 py-8 sm:px-6">

    <ServerLifecycleBanners :server="server" />

    <!-- Site header — flat identity row: avatar, name + status, version.
         Visit and the ⋯ menu sit on the right; New site is up in the nav. -->
    <div class="flex items-start justify-between gap-4">
      <div class="flex min-w-0 items-center gap-3">
        <SiteIcon size="lg" />
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h1 class="truncate text-2xl font-semibold text-ink-gray-9">{{ site.name }}</h1>
            <Badge v-if="site.status === 'creating'" theme="orange" variant="subtle" label="Setting up…" />
            <Badge v-else-if="site.status === 'restoring'" theme="blue" variant="subtle" label="Restoring…" />
            <Badge v-else-if="site.status === 'moving'" theme="blue" variant="subtle" label="Moving…" />
            <Badge v-else-if="site.status === 'suspended'" theme="orange" variant="subtle" label="Paused" />
            <Badge v-else theme="green" variant="subtle" label="Active" />
          </div>
          <div class="mt-1 text-p-base text-ink-gray-6">{{ createdLabel }}</div>
        </div>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <Button variant="subtle" size="sm" label="Visit" icon-right="lucide-external-link" @click="openSite" />
        <Dropdown :options="siteMenu" placement="bottom-end">
          <Button variant="ghost" size="sm" icon="lucide-ellipsis" aria-label="More actions" />
        </Dropdown>
      </div>
    </div>

    <TabButtons v-model="tab" :buttons="tabs" class="mt-8" />

    <!-- Overview — the site at a glance: apps, backups, usage, domains,
         add-ons and config as a single tab of cards. -->
    <section v-if="tab === 'general'" class="mt-6">
      <!-- Full backups view, reached from the Backups card's "View all". -->
      <div v-if="showAllBackups">
        <button class="mb-4 flex items-center gap-1 text-sm text-ink-gray-6 transition-colors hover:text-ink-gray-9" @click="showAllBackups = false">
          <span class="lucide-chevron-left size-4" /> Back to General
        </button>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="min-w-0">
            <h2 class="text-base font-medium text-ink-gray-8">Backups</h2>
            <div class="mt-0.5 text-p-sm text-ink-gray-5">{{ autoBackups ? 'Taken on a schedule. Keeping 7 daily · 4 weekly · 6 monthly · 1 yearly backups.' : 'Automatic backups are disabled.' }}</div>
          </div>
          <div class="flex items-center gap-2">
            <Button v-if="!autoBackups" variant="subtle" size="sm" label="Enable backups" @click="toggleAutoBackups" />
            <Dropdown v-else :options="scheduleMenu" placement="bottom-end">
              <Button variant="subtle" size="sm" :label="scheduleLabel" icon-right="lucide-chevron-down" />
            </Dropdown>
            <Button variant="subtle" size="sm" label="Backup now" icon-left="lucide-archive" @click="backupNow" />
          </div>
        </div>

        <ListView
          v-if="site.backups.length"
          class="mt-4 fc-listview"
          :style="{ height: `${48 + site.backups.length * 44}px` }"
          :columns="backupColumns"
          :rows="backupRows"
          :options="{ selectable: false, showTooltip: false, rowHeight: 44 }"
          row-key="id"
        >
          <template #cell="{ column, row }">
            <div v-if="column.key === 'date'" class="flex min-w-0 items-center gap-2.5">
              <span class="lucide-archive size-4 shrink-0 text-ink-gray-5" />
              <span class="truncate text-sm font-medium text-ink-gray-8">{{ fmtDateTime(row._b.at) }}</span>
              <Badge v-if="row._b.kind === 'manual'" theme="gray" variant="subtle" label="Manual" />
            </div>
            <span v-else-if="column.key === 'database'" class="text-sm tabular-nums text-ink-gray-7">{{ row._b.database }}</span>
            <span v-else-if="column.key === 'public'" class="text-sm tabular-nums text-ink-gray-6">{{ row._b.public }}</span>
            <span v-else-if="column.key === 'private'" class="text-sm tabular-nums text-ink-gray-6">{{ row._b.private }}</span>
            <span v-else-if="column.key === 'offsite'">
              <span v-if="row._b.offsite" class="lucide-check size-4 text-ink-green-6" />
              <span v-else class="lucide-x size-4 text-ink-gray-4" />
            </span>
            <Dropdown v-else-if="column.key === 'actions'" :options="backupMenu(row._b)" placement="bottom-end">
              <button class="grid size-7 place-items-center rounded text-ink-gray-5 hover:bg-surface-gray-2" aria-label="Backup actions"><span class="lucide-ellipsis size-4" /></button>
            </Dropdown>
          </template>
        </ListView>
        <EmptyState v-else icon="lucide-archive" title="No backups yet" description="First automatic backup runs tonight at 2 AM.">
          <Button variant="subtle" size="sm" label="Backup now" icon-left="lucide-archive" @click="backupNow" />
        </EmptyState>
      </div>

      <div v-else class="sdl-reveal space-y-4">
        <!-- Apps + Daily usage, side by side. -->
        <div class="grid gap-4 sm:grid-cols-2">
          <!-- Apps — a glance at what needs updating and everything installed.
               Both the icons and their labels are click targets; Browse opens
               the marketplace with this site preselected. -->
          <div class="flex flex-col gap-4 rounded-lg border border-outline-gray-1 bg-surface-elevation-1 p-4">
            <div class="flex items-center justify-between gap-3">
              <h2 class="text-base font-medium text-ink-gray-8">Apps</h2>
              <Button variant="ghost" size="sm" label="Browse" icon-right="lucide-chevron-right" @click="installApp" />
            </div>
            <div class="flex flex-1 items-stretch py-2">
              <!-- Updates — click opens a dialog listing what's updatable. -->
              <button v-if="updatableApps.length" class="group flex flex-1 flex-col items-center justify-center gap-2.5 transition-transform duration-150 ease-out active:scale-[0.98]" @click="updatesOpen = true">
                <span class="app-cluster flex h-8 items-center">
                  <AppIcon
                    v-for="(app, i) in updatableApps.slice(0, 3)"
                    :key="app.id"
                    :app-key="app.key"
                    size="smd"
                    class="ring-2 ring-[var(--surface-elevation-1)]"
                    :class="i && '-ml-3'"
                  />
                </span>
                <span class="text-p-sm text-ink-gray-5 transition-colors group-hover:text-ink-gray-8">Updates available</span>
              </button>
              <div v-else class="flex flex-1 flex-col items-center justify-center gap-2.5">
                <span class="flex h-8 items-center"><span class="lucide-circle-check size-6 text-ink-green-5" /></span>
                <span class="text-p-sm text-ink-gray-5">Up to date</span>
              </div>

              <!-- Divider splitting the two glances, per the design. -->
              <span class="w-px self-stretch bg-[var(--outline-gray-2)]" aria-hidden="true" />

              <!-- Installed apps — click opens the full list in a modal. A
                   filled circle closes the stack, carrying the total count. -->
              <button class="group flex flex-1 flex-col items-center justify-center gap-2.5 transition-transform duration-150 ease-out active:scale-[0.98]" @click="allAppsOpen = true">
                <span class="app-cluster flex h-8 items-center">
                  <AppIcon
                    v-for="(app, i) in site.apps.slice(0, 4)"
                    :key="app.id"
                    :app-key="app.key"
                    size="smd"
                    class="ring-2 ring-[var(--surface-elevation-1)]"
                    :class="i && '-ml-3'"
                  />
                  <span v-if="site.apps.length > 4" class="-ml-3 grid size-7 place-items-center rounded-4 bg-surface-gray-4 text-xs font-medium text-ink-gray-6 ring-2 ring-[var(--surface-elevation-1)]">{{ site.apps.length }}</span>
                </span>
                <span class="text-p-sm text-ink-gray-5 transition-colors group-hover:text-ink-gray-8">Installed apps</span>
              </button>
            </div>
          </div>

          <!-- Daily usage — the chart runs edge to edge, per the design. -->
          <div class="flex flex-col overflow-hidden rounded-lg border border-outline-gray-1 bg-surface-elevation-1">
            <div class="flex items-center justify-between gap-3 px-4 pt-4">
              <h2 class="text-base font-medium text-ink-gray-8">Daily usage</h2>
              <Button variant="ghost" size="sm" label="All analytics" icon-right="lucide-chevron-right" @click="goAnalytics" />
            </div>
            <svg :viewBox="`0 0 ${usageW} ${usageH}`" preserveAspectRatio="none" class="mt-auto block h-16 w-full text-ink-blue-5">
              <defs>
                <linearGradient id="sdl-usage-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="currentColor" stop-opacity="0.28" />
                  <stop offset="100%" stop-color="currentColor" stop-opacity="0" />
                </linearGradient>
              </defs>
              <path :d="usageArea" fill="url(#sdl-usage-fill)" />
              <path :d="usageLine" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
            </svg>
          </div>
        </div>

        <!-- Backups summary (wider padding than the other cards, per the design) -->
        <div class="rounded-lg border border-outline-gray-1 bg-surface-elevation-1 px-6 py-4">
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-base font-medium text-ink-gray-8">Backups</h2>
            <div class="flex items-center gap-1">
              <!-- Back up now moves into the empty state's CTA while there are no backups. -->
              <Button v-if="recentBackups.length" variant="ghost" size="sm" icon="lucide-plus" aria-label="Back up now" @click="backupNow" />
              <Dropdown :options="backupsCardMenu" placement="bottom-end">
                <Button variant="ghost" size="sm" icon="lucide-ellipsis" aria-label="More backup options" />
              </Dropdown>
            </div>
          </div>
          <div v-if="recentBackups.length" class="mt-4">
            <div class="grid grid-cols-[1.7fr_1fr_1fr_1fr_2rem] items-center gap-3 border-b border-outline-alpha-gray-1 pb-2 text-p-sm text-ink-gray-5">
              <span>Backup</span>
              <span>Database</span>
              <span>Public</span>
              <span>Private</span>
              <span />
            </div>
            <div v-for="b in recentBackups" :key="b.id" class="grid grid-cols-[1.7fr_1fr_1fr_1fr_2rem] items-center gap-3 border-b border-outline-alpha-gray-1 py-3 last:border-b-0">
              <div class="flex min-w-0 items-start gap-2.5">
                <span class="lucide-archive mt-0.5 size-4 shrink-0 text-ink-gray-5" />
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium text-ink-gray-8">{{ backupDay(b.at) }}</span>
                    <Badge v-if="b.offsite" theme="gray" variant="subtle" size="sm" label="Offsite" />
                  </div>
                  <div class="mt-0.5 text-p-sm text-ink-gray-5">{{ backupTime(b.at) }}</div>
                </div>
              </div>
              <span class="text-sm tabular-nums text-ink-gray-7">{{ b.database }}</span>
              <span class="text-sm tabular-nums text-ink-gray-6">{{ b.public }}</span>
              <span class="text-sm tabular-nums text-ink-gray-6">{{ b.private }}</span>
              <Dropdown :options="backupMenu(b)" placement="bottom-end">
                <button class="grid size-7 place-items-center rounded text-ink-gray-5 hover:bg-surface-gray-2" aria-label="Backup actions"><span class="lucide-ellipsis size-4" /></button>
              </Dropdown>
            </div>
          </div>
          <EmptyState v-else icon="lucide-archive" title="No backups yet" description="First automatic backup runs tonight at 2 AM.">
            <Button variant="subtle" size="sm" label="Back up now" icon-left="lucide-archive" @click="backupNow" />
          </EmptyState>
        </div>

        <!-- Domains + Add on services -->
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="flex flex-col rounded-lg border border-outline-gray-1 bg-surface-elevation-1 p-4">
            <div class="flex items-center justify-between gap-3">
              <h2 class="text-base font-medium text-ink-gray-8">Domains</h2>
              <Button variant="ghost" size="sm" icon="lucide-plus" aria-label="Add domain" @click="addDomainOpen = true" />
            </div>
            <!-- Primary host stays vertically centred in whatever height the
                 card ends up (it stretches to match its grid neighbour). -->
            <div class="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
              <div class="flex items-center gap-2">
                <span class="lucide-globe size-4 shrink-0 text-ink-gray-5" />
                <span class="truncate text-base font-medium text-ink-gray-8">{{ site.name }}</span>
              </div>
              <Badge theme="gray" variant="subtle" size="md" label="Primary" />
            </div>

            <!-- Custom domains, with inline DNS setup when they need it. -->
            <div v-for="d in site.domains" :key="d.id" class="mt-4 border-t border-outline-alpha-gray-1 pt-4">
              <div class="flex items-center gap-2.5">
                <span class="lucide-link size-4 shrink-0 text-ink-gray-5" />
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="truncate text-sm font-medium text-ink-gray-8">{{ d.name }}</span>
                    <Badge v-if="d.status === 'verifying'" theme="orange" variant="subtle" size="sm" label="Checking DNS…" />
                    <Badge v-else-if="d.status === 'failed'" theme="red" variant="subtle" size="sm" label="Failed" />
                    <Badge v-else-if="d.status === 'pending'" theme="orange" variant="subtle" size="sm" label="Setup needed" />
                  </div>
                  <div v-if="d.ssl" class="mt-0.5 flex items-center gap-1 text-p-sm text-ink-green-6"><span class="lucide-lock size-3" /> SSL active</div>
                  <div v-else-if="d.status === 'failed'" class="mt-0.5 text-p-sm text-ink-red-8">Records not found yet — recheck and retry.</div>
                  <div v-else-if="d.status === 'pending'" class="mt-0.5 text-p-sm text-ink-gray-5">Add the DNS records below, then verify.</div>
                  <div v-else class="mt-0.5 text-p-sm text-ink-gray-5">SSL issues once DNS checks out</div>
                </div>
                <Button v-if="d.status === 'verifying'" variant="subtle" size="sm" label="Verifying…" loading disabled />
                <Button v-else-if="d.status === 'pending'" variant="subtle" size="sm" label="Verify" @click="verifyDomain(d)" />
                <Button v-else-if="d.status === 'failed'" variant="subtle" size="sm" label="Retry" @click="verifyDomain(d)" />
              </div>

              <template v-if="['pending', 'failed', 'verifying'].includes(d.status) && d.dnsRecords?.length">
                <div class="mt-3 overflow-hidden rounded-lg border border-outline-gray-1">
                  <div class="grid grid-cols-[3rem_1fr_1fr] gap-2 border-b border-outline-alpha-gray-1 bg-surface-gray-1 px-2.5 py-1.5 text-p-sm font-medium text-ink-gray-5">
                    <span>Type</span><span>Host</span><span>Value</span>
                  </div>
                  <div v-for="(rec, i) in d.dnsRecords" :key="i" class="grid grid-cols-[3rem_1fr_1fr] gap-2 border-b border-outline-alpha-gray-1 px-2.5 py-1.5 font-mono text-p-sm text-ink-gray-7 last:border-b-0">
                    <span>{{ rec.type }}</span>
                    <span class="flex min-w-0 items-center gap-1">
                      <span class="truncate">{{ rec.host }}</span>
                      <Button variant="ghost" size="xs" icon="lucide-copy" :aria-label="`Copy host ${rec.host}`" @click="copyValue(rec.host)" />
                    </span>
                    <span class="flex min-w-0 items-center gap-1">
                      <span class="truncate">{{ rec.value }}</span>
                      <Button variant="ghost" size="xs" icon="lucide-copy" :aria-label="`Copy value ${rec.value}`" @click="copyValue(rec.value)" />
                    </span>
                  </div>
                </div>
              </template>
            </div>
          </div>

          <div class="rounded-lg border border-outline-gray-1 bg-surface-elevation-1 p-4">
            <div class="flex items-center justify-between gap-3">
              <h2 class="text-base font-medium text-ink-gray-8">Add on services</h2>
              <!-- The add button lives in the empty state's CTA while empty, so
                   it's withheld from the header until there's a list to add to. -->
              <Button v-if="site.addons?.length" variant="ghost" size="sm" icon="lucide-plus" aria-label="Add service" @click="addService" />
            </div>
            <EmptyState v-if="!site.addons?.length" icon="lucide-blocks" title="No add-on services yet.">
              <Button variant="subtle" size="sm" label="Add service" icon-left="lucide-plus" @click="addService" />
            </EmptyState>
          </div>
        </div>

        <!-- Config -->
        <div class="rounded-lg border border-outline-gray-1 bg-surface-elevation-1 p-4">
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-base font-medium text-ink-gray-8">Config</h2>
            <div class="flex items-center gap-1">
              <Button variant="ghost" size="sm" icon="lucide-rotate-cw" aria-label="Refresh" @click="toast.success('Refreshed')" />
              <Button variant="ghost" size="sm" icon="lucide-plus" aria-label="Add config" @click="addConfig" />
            </div>
          </div>
          <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div v-for="row in configRows" :key="row.key" class="group relative rounded-lg border border-outline-gray-1 p-3">
              <div class="flex items-start justify-between gap-2">
                <span class="min-w-0 truncate text-p-sm font-medium text-ink-gray-8">{{ row.key }}</span>
                <span v-if="row.key !== 'db_name'" class="-mr-1 -mt-1 shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  <Dropdown :options="configMenu(row)" placement="bottom-end">
                    <button class="grid size-6 place-items-center rounded text-ink-gray-5 hover:bg-surface-gray-3" :aria-label="`Edit ${row.key}`"><span class="lucide-ellipsis size-4" /></button>
                  </Dropdown>
                </span>
              </div>
              <div class="mt-2 truncate font-mono text-p-sm text-ink-gray-6">{{ row.value }}</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Settings — flat rows divided by hairlines, no card chrome. -->
    <section v-else class="sdl-reveal mt-6 space-y-9">
      <!-- General -->
      <div>
        <h2 class="text-base font-semibold text-ink-gray-8">General</h2>
        <div class="mt-1">
          <div v-for="opt in configOptions" :key="opt.key" class="flex flex-wrap items-center justify-between gap-4 border-b border-outline-alpha-gray-1 py-4 last:border-b-0">
            <div class="min-w-0">
              <div class="text-sm font-medium text-ink-gray-8">{{ opt.label }}</div>
              <div class="mt-0.5 text-sm text-ink-gray-5">{{ opt.desc }}</div>
            </div>
            <Switch :modelValue="site.config[opt.key]" @update:modelValue="toggle(opt)" />
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div>
        <h2 class="text-base font-semibold text-ink-gray-8">Actions</h2>
        <div class="mt-1">
          <div v-for="a in siteActions" :key="a.label" class="flex flex-wrap items-center justify-between gap-3 border-b border-outline-alpha-gray-1 py-4 last:border-b-0">
            <div class="min-w-0">
              <div class="text-sm font-medium text-ink-gray-8">{{ a.label }}</div>
              <div class="mt-0.5 text-sm text-ink-gray-5">{{ a.desc }}</div>
            </div>
            <Button variant="subtle" size="sm" :label="a.action" @click="a.onClick" />
          </div>
        </div>
      </div>

      <!-- Danger -->
      <div>
        <h2 class="text-base font-semibold text-ink-gray-8">Danger</h2>
        <div class="mt-1">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-outline-alpha-gray-1 py-4">
            <div class="min-w-0">
              <div class="text-sm font-medium text-ink-gray-8">Migrate site</div>
              <div class="mt-0.5 text-sm text-ink-gray-5">Runs bench migrate for this site without taking a backup first.</div>
            </div>
            <Button variant="subtle" theme="red" label="Migrate" @click="migrateSite" />
          </div>
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-outline-alpha-gray-1 py-4">
            <div class="min-w-0">
              <div class="text-sm font-medium text-ink-gray-8">Reset this site</div>
              <div class="mt-0.5 text-sm text-ink-gray-5">Wipes the database back to a fresh install. Apps stay; all your data is removed.</div>
            </div>
            <Button variant="subtle" theme="red" label="Reset site" @click="resetOpen = true" />
          </div>
          <div class="flex flex-wrap items-center justify-between gap-3 py-4">
            <div class="min-w-0">
              <div class="text-sm font-medium text-ink-red-8">Drop this site</div>
              <div class="mt-0.5 text-sm text-ink-gray-5">Permanently deletes {{ site.name }} and all its data. Backups are kept for 30 days after.</div>
            </div>
            <Button variant="subtle" theme="red" label="Drop site" @click="dropOpen = true" />
          </div>
        </div>
      </div>
    </section>
        </div>
      </div>

      <!-- The split's left column — the full list of the server's sites.
           Selecting swaps the page instantly; minimize gives the width back. -->
      <SitesPanel v-model:open="listOpen" :server="server" :active-site-id="site.id" @select="goSite" />
    </div>

    <!-- Apps with an update available, opened from the Apps card. -->
    <Dialog v-model:open="updatesOpen" title="Updates available" size="sm">
      <div class="-mt-1">
        <div v-for="app in updatableApps" :key="app.id" class="flex items-center gap-3 border-b border-outline-alpha-gray-1 py-3 last:border-b-0">
          <AppIcon :app-key="app.key" size="md" class="shrink-0" />
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-medium text-ink-gray-8">{{ app.name }}</div>
            <div class="flex items-center gap-1 text-p-sm text-ink-gray-5">
              <span>{{ app.version }}</span>
              <span class="lucide-arrow-right size-3" />
              <span class="font-medium text-ink-green-6">{{ store.appUpdate(app) }}</span>
            </div>
          </div>
          <Button size="sm" variant="subtle" label="Update" @click="updateApp(app)" />
        </div>
      </div>
      <template #actions>
        <div class="flex justify-end gap-2">
          <Button label="Close" @click="updatesOpen = false" />
          <Button variant="solid" label="Update all" @click="updateAllApps(); updatesOpen = false" />
        </div>
      </template>
    </Dialog>

    <!-- All apps installed on this site, opened from the Apps card. -->
    <Dialog v-model:open="allAppsOpen" title="Installed apps" size="md">
      <div class="-mt-1">
        <div v-for="app in site.apps" :key="app.id" class="flex items-center gap-3 border-b border-outline-alpha-gray-1 py-3 last:border-b-0">
          <AppIcon :app-key="app.key" size="md" class="shrink-0" />
          <div class="flex min-w-0 flex-1 items-center justify-between gap-2">
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="truncate text-sm font-medium text-ink-gray-8">{{ app.name }}</span>
                <span class="shrink-0 text-p-sm text-ink-gray-5">{{ app.version }}</span>
                <template v-if="store.appUpdate(app)">
                  <span class="lucide-arrow-right size-3 shrink-0 text-ink-gray-4" />
                  <span class="shrink-0 text-p-sm font-medium text-ink-green-6">{{ store.appUpdate(app) }}</span>
                </template>
              </div>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <Button v-if="store.appUpdate(app)" size="sm" variant="subtle" label="Update" @click="updateApp(app)" />
              <Dropdown :options="appMenu(app)" placement="bottom-end">
                <Button size="sm" variant="ghost" icon="lucide-more-vertical" aria-label="More" />
              </Dropdown>
            </div>
          </div>
        </div>
      </div>
      <template #actions>
        <div class="flex justify-between gap-2">
          <Button label="Browse marketplace" icon-left="lucide-store" @click="installApp" />
          <Button variant="subtle" label="Done" @click="allAppsOpen = false" />
        </div>
      </template>
    </Dialog>

    <NewSiteDialog v-model:open="newSiteOpen" :server="server" />
    <MoveSiteDialog v-model:open="moveOpen" :site="site" :server="server" :required-version="moveVersion" @moved="onMoved" />
    <AddDomainDialog v-model:open="addDomainOpen" :site="site" />
    <DropSiteDialog v-model:open="dropOpen" :site="site" @confirm="dropSite" />

    <!-- Custom backup schedule (issue #40) -->
    <Dialog v-model:open="customOpen" title="Custom backup schedule" size="sm">
      <div class="space-y-4">
        <FormControl v-model="custom.frequency" type="select" label="Frequency" :options="frequencyOptions" />
        <FormControl v-if="custom.frequency === 'weekly'" v-model="custom.day" type="select" label="Day of week" :options="dayOptions" />
        <div>
          <label class="mb-1.5 block text-p-sm text-ink-gray-5">Time</label>
          <TimePicker v-model="customTime" placeholder="Select time" />
        </div>
        <p class="text-p-sm text-ink-gray-5">Kept 30 days. Times shown in your timezone.</p>
      </div>
      <template #actions>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" @click="customOpen = false" />
          <Button variant="solid" label="Save schedule" @click="saveCustomSchedule" />
        </div>
      </template>
    </Dialog>
    <ConfirmDialog
      v-model:open="uninstallOpen"
      theme="red"
      :title="`Uninstall ${pendingApp?.name}?`"
      :message="`It comes off ${site.name}. Its data stays in your backups for 30 days.`"
      confirm-label="Uninstall"
      @confirm="uninstall"
    />
    <ConfirmDialog
      v-model:open="restoreOpen"
      title="Restore this backup?"
      :message="`${site.name} reverts to ${pendingBackup ? fmtDateTime(pendingBackup.at) : ''}. Down for about a minute.`"
      confirm-label="Restore"
      @confirm="restore"
    />
    <ConfirmDialog
      v-model:open="deactivateOpen"
      :title="site.status === 'suspended' ? 'Reactivate this site?' : 'Deactivate this site?'"
      :message="site.status === 'suspended' ? `${site.name} comes back online.` : `${site.name} goes offline. Nothing is deleted and you can reactivate anytime.`"
      :confirm-label="site.status === 'suspended' ? 'Reactivate' : 'Deactivate'"
      @confirm="deactivate"
    />
    <ConfirmDialog
      v-model:open="resetOpen"
      theme="red"
      title="Reset this site?"
      :message="`Wipes ${site.name}'s database to a fresh install. We back up first, but all data is removed. Can't be undone.`"
      confirm-label="Reset site"
      @confirm="resetSite"
    />

  </ServerShell>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Badge, Button, Dialog, Dropdown, FormControl, ListView, Switch, TabButtons, TimePicker, toast } from 'frappe-ui'
import AddDomainDialog from '../../components/AddDomainDialog.vue'
import AppIcon from '../../components/AppIcon.vue'
import ConfirmDialog from '../../components/ConfirmDialog.vue'
import EmptyState from '../../components/EmptyState.vue'
import ServerShell from '../../components/ServerShell.vue'
import SiteIcon from '../../components/SiteIcon.vue'
import SitesPanel from '../../components/SitesPanel.vue'
import DropSiteDialog from '../../components/DropSiteDialog.vue'
import MoveSiteDialog from '../../components/MoveSiteDialog.vue'
import NewSiteDialog from '../../components/NewSiteDialog.vue'
import ServerLifecycleBanners from '../../components/ServerLifecycleBanners.vue'
import { backupCustomLabel, useCloudStore } from '../../stores/cloud'
import { fmtDateTime } from '../../utils/format'
import { sitesByAttention, sitesPanelOpen } from '../../utils/sites'

const store = useCloudStore()
const route = useRoute()
const router = useRouter()

const server = computed(() => store.findServer(route.params.serverId))
const site = computed(() => server.value?.sites.find((s) => s.id === route.params.siteId))

const movedAway = ref(false)
watchEffect(() => {
  if (movedAway.value) return
  if (!server.value) router.replace('/')
  else if (!site.value) router.replace(`/manage/${server.value.id}`)
})

const tab = ref('general')
const tabs = [
  { label: 'Overview', value: 'general' },
  { label: 'Settings', value: 'settings' },
]

// The breadcrumb tracks the path into the site. The active tab is already shown
// by the TabButtons right below, so it stays out of the trail — only genuine
// drill-downs (e.g. the full backups view) get appended.
const crumbs = computed(() => {
  const base = `/manage/${server.value.id}`
  const trail = [
    { label: 'Sites', route: base },
    { label: site.value.name, route: `${base}/sites/${site.value.id}` },
  ]
  if (tab.value === 'general' && showAllBackups.value) trail.push({ label: 'Backups' })
  return trail
})

// The Backups card drills into a full backups view in place; reset it whenever
// we leave General or switch sites.
const showAllBackups = ref(false)
watch(tab, (t) => {
  if (t !== 'general') showAllBackups.value = false
})

// — Split view. Session-only open state (sitesPanelOpen); landing here on a
// desktop viewport docks it open (playing the pill → panel morph if it was
// collapsed). The active tab is deliberately NOT reset when switching sites
// — walking the list comparing one tab is the hot path.
const listOpen = sitesPanelOpen
const scroller = ref(null)

function goSite(s) {
  if (s.id !== site.value.id) router.push(`/manage/${server.value.id}/sites/${s.id}`)
}

// New site, same component instance: switching is an instant content swap —
// only the scroll position resets. The backups drill-down closes too.
watch(
  () => route.params.siteId,
  () => {
    showAllBackups.value = false
    if (scroller.value) scroller.value.scrollTop = 0
  },
)

onMounted(() => {
  if (!listOpen.value && window.matchMedia('(min-width: 1024px)').matches) listOpen.value = true
  window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

// There's no map to leave for anymore — a site is always open here. Esc just
// collapses the list back to its pill (if it's open); ↑/↓ walk the sites in
// the list's attention-first order.
function onKeydown(e) {
  if (e.defaultPrevented || !server.value || !site.value) return
  const t = e.target
  const typing = t instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable)
  if (e.key === 'Escape') {
    if (t.closest?.('[role="dialog"], [role="menu"]')) return
    if (typing) {
      t.blur()
      return
    }
    if (listOpen.value) listOpen.value = false
  } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !typing && listOpen.value) {
    const list = sitesByAttention(server.value.sites)
    const i = list.findIndex((s) => s.id === site.value.id)
    const next = list[i + (e.key === 'ArrowDown' ? 1 : -1)]
    if (i >= 0 && next) {
      e.preventDefault()
      router.replace(`/manage/${server.value.id}/sites/${next.id}`)
    }
  }
}

const addDomainOpen = ref(false)
function verifyDomain(d) {
  store.verifyDomain(site.value.id, d.id)
  toast('Checking DNS — this can take a few minutes')
}
function copyValue(text) {
  navigator.clipboard?.writeText(text)
  toast.success('Copied')
}
function addService() {
  toast('In the real thing, this opens the add-on services catalogue')
}
function goAnalytics() {
  router.push(`/manage/${server.value.id}/analytics`)
}
const dropOpen = ref(false)
const deactivateOpen = ref(false)
const resetOpen = ref(false)
const newSiteOpen = ref(false)

// — Header identity + actions
// In the mockup, "Visit" routes to the in-app view rather than the real
// domain (site.name is a real-looking URL).
function openSite() {
  router.push('/app')
}
// Install app → the server Marketplace, with this site preselected.
function installApp() {
  router.push(`/manage/${server.value.id}/marketplace?site=${site.value.id}`)
}
function loginAsAdmin() {
  toast.success(`Opening ${site.value.name} as Administrator…`)
}
const siteMenu = computed(() => [
  { label: 'Log in as administrator', icon: 'lucide-log-in', onClick: loginAsAdmin },
  { label: 'Backup now', icon: 'lucide-archive', onClick: backupNow },
  {
    label: site.value.status === 'suspended' ? 'Reactivate site' : 'Deactivate site',
    icon: 'lucide-power',
    onClick: () => (deactivateOpen.value = true),
  },
])

// — Apps (installed on this site). The Overview card surfaces two glances:
// what's updatable (a popover) and the full installed list (a modal).
const allAppsOpen = ref(false)
const updatesOpen = ref(false)
const updatableApps = computed(() => site.value.apps.filter((a) => store.appUpdate(a)))
function updateAllApps() {
  const names = updatableApps.value.map((a) => a.name)
  updatableApps.value.forEach((app) => store.updateApp(site.value.id, app.key))
  toast.promise(Promise.resolve(), {
    loading: 'Updating apps…',
    success: names.length > 1 ? `Updating ${names.length} apps…` : `Updating ${names[0]}…`,
    error: 'Update failed',
  })
}
const uninstallOpen = ref(false)
const pendingApp = ref(null)
function updateApp(app) {
  const to = store.appUpdate(app)
  toast.promise(store.updateApp(site.value.id, app.key), {
    loading: `Updating ${app.name}…`,
    success: `${app.name} updated to ${to}`,
    error: 'Update failed',
  })
}
function askUninstall(app) {
  pendingApp.value = app
  uninstallOpen.value = true
}
// The overflow always shows (so the dots are there even for a single app);
// Uninstall is withheld for the last app, since a site needs at least one.
function appMenu(app) {
  const opts = [
    { label: 'View changelog', icon: 'lucide-file-text', onClick: () => toast('In the real thing, this opens the changelog') },
    { label: 'Documentation', icon: 'lucide-book-open', onClick: () => toast('In the real thing, this opens the docs') },
  ]
  if (site.value.apps.length > 1) opts.push({ label: 'Uninstall', icon: 'lucide-trash-2', onClick: () => askUninstall(app) })
  return opts
}
function uninstall() {
  const name = pendingApp.value.name
  toast.promise(store.uninstallApp(site.value.id, pendingApp.value.key), {
    loading: `Uninstalling ${name}…`,
    success: `${name} uninstalled`,
    error: 'Uninstall failed',
  })
}

// — Version / move (a version change IS a move to another server)
const moveOpen = ref(false)
const moveVersion = ref(null)
// Header subtitle: when the site was created and by whom (falls back to the
// account owner for sites made through the UI, which carry no explicit creator).
const createdLabel = computed(() => {
  const by = site.value.createdBy || store.user?.name
  const on = new Date(site.value.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return by ? `Created ${on} by ${by}` : `Created ${on}`
})

function onMoved(target) {
  movedAway.value = true
  router.replace(`/manage/${target.id}/sites/${route.params.siteId}`).then(() => (movedAway.value = false))
}

// — Backups
// Once enabled, the schedule is picked from a dropdown (Daily / Weekly / Custom),
// with Disable backups turning automatic backups back off.
const scheduleLabel = computed(() => {
  const s = site.value?.backupSchedule
  if (s === 'weekly') return 'Weekly, Sunday 2:00 AM'
  if (s === 'custom') return backupCustomLabel(site.value.backupCustom)
  return 'Daily, 2:00 AM'
})
const scheduleMenu = computed(() => [
  { label: 'Daily, 2:00 AM', onClick: () => setSchedule('daily') },
  { label: 'Weekly, Sunday 2:00 AM', onClick: () => setSchedule('weekly') },
  { label: 'Custom…', onClick: () => setSchedule('custom') },
  { label: 'Disable backups', onClick: toggleAutoBackups },
])
function setSchedule(v) {
  // 'Custom' opens a dialog rather than saving a preset straight away (issue #40).
  if (v === 'custom') {
    custom.frequency = site.value?.backupCustom?.frequency || 'weekly'
    custom.day = site.value?.backupCustom?.day ?? 0
    custom.hour = site.value?.backupCustom?.hour ?? 2
    customOpen.value = true
    return
  }
  const p = store.setBackupSchedule(site.value.id, v)
  if (p) toast.promise(p, { loading: 'Saving…', success: 'Backup schedule updated', error: 'Could not save' })
}

// Custom backup schedule dialog (issue #40)
const customOpen = ref(false)
const custom = reactive({ frequency: 'weekly', day: 0, hour: 2 })
const frequencyOptions = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
]
const dayOptions = [
  { label: 'Sunday', value: 0 }, { label: 'Monday', value: 1 }, { label: 'Tuesday', value: 2 },
  { label: 'Wednesday', value: 3 }, { label: 'Thursday', value: 4 }, { label: 'Friday', value: 5 },
  { label: 'Saturday', value: 6 },
]
// TimePicker speaks 'HH:mm'; the backup model stores a whole-hour integer.
const customTime = computed({
  get: () => `${String(custom.hour).padStart(2, '0')}:00`,
  set: (v) => {
    custom.hour = v ? Number(v.split(':')[0]) : 0
  },
})
function saveCustomSchedule() {
  const payload = {
    frequency: custom.frequency,
    day: custom.frequency === 'weekly' ? Number(custom.day) : null,
    hour: Number(custom.hour),
  }
  const p = store.setBackupSchedule(site.value.id, 'custom', payload)
  customOpen.value = false
  if (p) toast.promise(p, { loading: 'Saving…', success: 'Backup schedule updated', error: 'Could not save' })
}
function backupNow() {
  toast.promise(store.backupNow(site.value.id), {
    loading: 'Backing up…',
    success: 'Backed up just now',
    error: 'Backup failed',
  })
}
// Automatic backups are off by default (matches the implementation); the toggle
// flips the state so the subtitle and button label track it.
const autoBackups = ref(false)
function toggleAutoBackups() {
  autoBackups.value = !autoBackups.value
  toast.success(autoBackups.value ? 'Automatic backups enabled' : 'Automatic backups disabled')
}
// The Backups card's ⋯ menu — the auto-backup toggle lives here so the card
// header stays compact.
const backupsCardMenu = computed(() => [
  { label: 'Backup history', icon: 'lucide-history', onClick: () => (showAllBackups.value = true) },
  {
    label: autoBackups.value ? 'Disable auto backups' : 'Enable auto backups',
    icon: autoBackups.value ? 'lucide-calendar-x' : 'lucide-calendar-clock',
    onClick: toggleAutoBackups,
  },
])
function download() {
  toast('In the real thing, this downloads the backup')
}
// Per-backup overflow: download each artifact, or delete the backup.
function backupMenu(b) {
  return [
    { label: 'Restore', icon: 'lucide-rotate-ccw', onClick: () => askRestore(b) },
    { label: 'Download Database', icon: 'lucide-download', onClick: download },
    { label: 'Download Public', icon: 'lucide-download', onClick: download },
    { label: 'Download Private', icon: 'lucide-download', onClick: download },
    { label: 'Download Config', icon: 'lucide-download', onClick: download },
    { label: 'Delete backup', icon: 'lucide-trash-2', onClick: () => deleteBackup(b) },
  ]
}
function deleteBackup(b) {
  const i = site.value.backups.findIndex((x) => x.id === b.id)
  if (i >= 0) site.value.backups.splice(i, 1)
  toast.success('Backup deleted')
}
const restoreOpen = ref(false)
const pendingBackup = ref(null)
function askRestore(b) {
  pendingBackup.value = b
  restoreOpen.value = true
}
function restore() {
  toast.promise(store.restoreBackup(site.value.id, pendingBackup.value.id), {
    loading: 'Restoring — back in a minute…',
    success: 'Restored successfully',
    error: 'Restore failed — your current data is untouched',
  })
}

// — Backups table shaping (shared by the General summary and the full view).
const backupColumns = [
  { label: 'Date', key: 'date', width: 2 },
  { label: 'Database', key: 'database', width: 1 },
  { label: 'Public', key: 'public', width: 1 },
  { label: 'Private', key: 'private', width: 1 },
  { label: 'Offsite', key: 'offsite', width: 1 },
  { label: '', key: 'actions', width: '52px', align: 'right' },
]
// Split the single stored size into the implementation's Database/Public/Private
// columns (public/private are small static values in the mock); offsite defaults on
// for the recent set so the summary reads like the design.
function shapeBackup(b, i) {
  return {
    ...b,
    database: b.database || b.size || '894 KB',
    public: b.public || '894 KB',
    private: b.private || '894 KB',
    offsite: b.offsite ?? i < 3,
  }
}
const backupRows = computed(() => site.value.backups.map((b, i) => ({ id: b.id, _b: shapeBackup(b, i) })))
// The General card shows just the three most recent backups.
const recentBackups = computed(() => site.value.backups.slice(0, 3).map(shapeBackup))

// Relative label for the summary rows — fresh backups read "Just now" /
// "5 min ago" / "2 hours ago", older ones fall back to Today / Yesterday / date.
function backupDay(ts) {
  const d = new Date(ts)
  const now = new Date()
  const secs = Math.round((now - d) / 1000)
  if (secs < 45) return 'Just now'
  if (secs < 3600) return `${Math.max(1, Math.round(secs / 60))} min ago`
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((startOf(now) - startOf(d)) / 86400000)
  if (days === 0) {
    const h = Math.round(secs / 3600)
    return `${h} hour${h === 1 ? '' : 's'} ago`
  }
  if (days === 1) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
// The clock time always sits under the relative label, so every row is two
// lines tall — a fresh "Just now" backup doesn't shrink the row and jump the
// page when you switch to a site whose latest backup is older.
function backupTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()
}

// — Daily usage sparkline. A stable, hand-tuned series so the curve reads like
// the design; drawn as an area + line into a fixed viewBox.
const usageW = 800
const usageH = 60
const usageData = [3, 4, 3, 4, 5, 8, 5, 4, 6, 4, 5, 4, 5, 11, 6, 4, 4, 4]
const usagePoints = computed(() => {
  const max = Math.max(...usageData)
  const step = usageW / (usageData.length - 1)
  return usageData.map((v, i) => [i * step, usageH - 4 - (v / max) * (usageH - 10)])
})
const usageLine = computed(() => usagePoints.value.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' '))
const usageArea = computed(() => `${usageLine.value} L${usageW} ${usageH} L0 ${usageH} Z`)

// — Settings: friendly toggles
const configOptions = [
  { key: 'maintenance', label: 'Maintenance mode', desc: 'Visitors see a "back soon" page while you work.' },
  { key: 'scheduler', label: 'Background jobs', desc: 'Scheduled emails, reports and automations.' },
  { key: 'devMode', label: 'Developer mode', desc: 'Lets developers customise doctypes on this site.' },
]
function toggle(opt) {
  store.toggleSiteConfig(site.value.id, opt.key)
  toast.success(`${opt.label} turned ${site.value.config[opt.key] ? 'on' : 'off'}`)
}

// — Config card: raw site_config.json as key/value tiles.
// Mirrors the implementation's site_config.json view: the db name plus the two
// secrets (masked). Add config appends more.
const configRows = computed(() => {
  const dbName = '_' + site.value.id.replace(/[^a-z0-9]/gi, '').slice(0, 12)
  return [
    { key: 'db_name', value: dbName },
    { key: 'installed_apps', value: JSON.stringify(site.value.apps.map((a) => a.key)) },
    { key: 'encryption_key', value: '••••••' },
  ]
})
function addConfig() {
  toast('In the real thing, this adds a new config key')
}
function configMenu(c) {
  return [
    { label: 'Edit', icon: 'lucide-pencil', onClick: () => toast(`In the real thing, this edits ${c.key}`) },
    { label: 'Remove', icon: 'lucide-trash-2', onClick: () => toast.success(`Removed ${c.key}`) },
  ]
}

// — Site actions (the general actions that live at the site level)
const siteActions = computed(() => [
  { label: 'Clear cache', desc: 'Clear this site’s cache if something looks stale.', action: 'Clear', onClick: () => toast.success('Cache cleared') },
])

// — Danger
function dropSite({ backup } = {}) {
  const sid = server.value.id
  if (backup) store.backupNow(site.value.id).catch(() => {})
  store.dropSite(sid, site.value.id)
  toast.success(backup ? 'Final backup taken — site deleted' : 'Site deleted')
  router.replace(`/manage/${sid}`)
}
function deactivate() {
  site.value.status = site.value.status === 'suspended' ? 'live' : 'suspended'
  toast.success(site.value.status === 'suspended' ? 'Site deactivated' : 'Site reactivated')
}
function resetSite() {
  toast.success('Resetting — a fresh database will be ready in a minute')
}
function migrateSite() {
  toast.success('Running bench migrate — this can take a minute')
}
</script>

<style scoped>
/* First paint of the pane: a quiet rise-in. Switching sites reuses this
   component instance, so the hot path swaps with no animation at all. */
.sdl-page {
  animation: sdl-page-in 200ms cubic-bezier(0.23, 1, 0.32, 1) both;
}
@keyframes sdl-page-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
}

/* Cards/groups settle in with a short stagger when a tab is landed on. Keyed to
   mount (v-if/v-else per tab), so it plays on arrival and tab switches — never
   on the site-switch hot path, where the section is patched in place. */
.sdl-reveal > * {
  animation: sdl-rise 360ms cubic-bezier(0.23, 1, 0.32, 1) both;
}
.sdl-reveal > *:nth-child(1) {
  animation-delay: 30ms;
}
.sdl-reveal > *:nth-child(2) {
  animation-delay: 85ms;
}
.sdl-reveal > *:nth-child(3) {
  animation-delay: 140ms;
}
.sdl-reveal > *:nth-child(4) {
  animation-delay: 195ms;
}
.sdl-reveal > *:nth-child(5) {
  animation-delay: 250ms;
}
.sdl-reveal > *:nth-child(n + 6) {
  animation-delay: 300ms;
}
@keyframes sdl-rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}

/* Overlapping app stack: hovering a logo lifts it and brings it fully forward,
   so you can pick out the app under the cursor even when it's partly covered by
   the next one. Kept to a 2px lift — this is a frequent hover, not a showpiece. */
.app-cluster > * {
  position: relative;
  transition: transform 140ms cubic-bezier(0.23, 1, 0.32, 1);
}
@media (hover: hover) and (pointer: fine) {
  .app-cluster > *:hover {
    transform: translateY(-2px);
    z-index: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sdl-page {
    animation: none;
  }
  /* Keep the fade for comprehension, drop the movement. */
  .sdl-reveal > * {
    animation: sdl-fade 240ms ease both;
    animation-delay: 0ms !important;
  }
  /* Keep the z-index reveal (identifies the app), drop the lift. */
  .app-cluster > *:hover {
    transform: none;
  }
}
@keyframes sdl-fade {
  from {
    opacity: 0;
  }
}
</style>

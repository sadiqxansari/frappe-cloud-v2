<template>
  <ServerShell v-if="site" :server="server" :crumbs="crumbs">
    <template #actions>
      <Button v-if="hasUpdates" variant="solid" label="Updates available" icon-left="lucide-circle-arrow-up" @click="updatesOpen = true" />
    </template>

    <!-- Site header — the site name is its URL, so the subheader carries other
         facts; the dotted locator map fills the right and balances it. -->
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <h1 class="truncate text-xl font-semibold text-ink-gray-9">{{ site.name }}</h1>
          <Badge v-if="site.status === 'creating'" theme="orange" variant="subtle" label="Setting up…" />
          <Badge v-else-if="site.status === 'restoring'" theme="blue" variant="subtle" label="Restoring…" />
          <Badge v-else-if="site.status === 'moving'" theme="blue" variant="subtle" label="Moving…" />
          <Badge v-else-if="site.status === 'suspended'" theme="orange" variant="subtle" label="Paused" />
          <Badge v-else theme="green" variant="subtle" label="Live" />
        </div>
        <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-gray-5">
          <span class="inline-flex items-center gap-1.5 text-ink-green-3"><span class="lucide-lock size-3.5" /> SSL active</span>
          <span class="inline-flex items-center gap-1.5"><span class="lucide-box size-3.5" /> {{ versionLabel }}</span>
        </div>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="subtle" size="sm" label="Back up now" icon-left="lucide-archive" @click="backupNow" />
          <Button variant="subtle" size="sm" label="Install app" icon-left="lucide-plus" @click="browseMarketplace" />
        </div>
      </div>
      <div class="hidden h-24 w-60 shrink-0 overflow-hidden rounded-lg sm:block">
        <WorldMap :focus="server.regionId" class="h-full w-full" />
      </div>
    </div>

    <TabButtons v-model="tab" :buttons="tabs" class="mt-6" />

    <!-- Apps -->
    <section v-if="tab === 'apps'" class="mt-3">
      <div class="divide-y divide-outline-gray-1">
        <div v-for="app in site.apps" :key="app.id" class="flex items-center gap-3 py-3.5">
          <AppIcon :app-key="app.key" size="md" />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-ink-gray-9">{{ app.name }}</span>
              <span class="text-sm text-ink-gray-4">{{ app.version }}</span>
            </div>
            <div v-if="store.appUpdate(app)" class="text-sm text-ink-blue-3">{{ store.appUpdate(app) }} is available</div>
          </div>
          <Button v-if="store.appUpdate(app)" variant="subtle" size="sm" label="Update" @click="updateApp(app)" />
          <Button v-if="site.apps.length > 1" variant="ghost" size="sm" label="Uninstall" @click="askUninstall(app)" />
        </div>
      </div>
    </section>

    <!-- Backups -->
    <section v-else-if="tab === 'backups'" class="mt-5 space-y-4">
      <div class="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-outline-gray-2 bg-surface-white p-4">
        <div class="w-44">
          <FormControl
            type="select"
            label="Automatic backups"
            :modelValue="site.backupSchedule"
            :options="scheduleOptions"
            @update:modelValue="setSchedule"
          />
        </div>
        <div class="flex items-center gap-3">
          <span class="text-sm text-ink-gray-5">Kept for 30 days.</span>
          <Button variant="subtle" size="sm" label="Back up now" icon-left="lucide-archive" @click="backupNow" />
        </div>
      </div>

      <div v-if="site.backups.length" class="divide-y divide-outline-gray-1 rounded-xl border border-outline-gray-2 bg-surface-white">
        <div v-for="b in site.backups" :key="b.id" class="flex items-center gap-3 p-4">
          <span class="lucide-archive size-4 shrink-0 text-ink-gray-5" />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-ink-gray-9">{{ fmtDateTime(b.at) }}</span>
              <Badge v-if="b.kind === 'manual'" theme="gray" variant="subtle" label="Manual" />
            </div>
            <div class="text-sm text-ink-gray-5">{{ b.size }}</div>
          </div>
          <Button variant="ghost" size="sm" label="Download" @click="download" />
          <Button variant="ghost" size="sm" label="Restore" @click="askRestore(b)" />
        </div>
      </div>
      <EmptyState v-else icon="lucide-archive" title="No backups yet" description="The first automatic backup runs tonight at 2 AM. You can also back up now.">
        <Button variant="subtle" size="sm" label="Back up now" icon-left="lucide-archive" @click="backupNow" />
      </EmptyState>
    </section>

    <!-- Config — the raw site_config.json, as an editable key/value table. -->
    <section v-else-if="tab === 'config'" class="mt-5">
      <div class="flex items-center justify-between gap-2">
        <p class="text-sm text-ink-gray-5">Keys passed to this site's <span class="font-mono text-ink-gray-7">site_config.json</span>.</p>
        <div class="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon="lucide-rotate-cw" aria-label="Refresh" @click="toast.success('Refreshed')" />
          <Button variant="subtle" size="sm" label="Add config" icon-left="lucide-plus" @click="addConfig" />
        </div>
      </div>

      <div class="mt-3 overflow-hidden rounded-xl border border-outline-gray-2 bg-surface-white">
        <div class="grid grid-cols-[1fr_1fr_6rem_2rem] gap-3 border-b border-outline-gray-2 bg-surface-gray-1 px-4 py-2 text-xs font-medium text-ink-gray-5">
          <div>Config name</div>
          <div>Value</div>
          <div>Type</div>
          <div />
        </div>
        <div
          v-for="c in configRows"
          :key="c.key"
          class="grid grid-cols-[1fr_1fr_6rem_2rem] items-center gap-3 border-b border-outline-gray-1 px-4 py-2.5 text-sm last:border-b-0"
        >
          <div class="min-w-0">
            <div class="truncate font-medium text-ink-gray-8">{{ c.label || c.key }}</div>
            <div v-if="c.label" class="truncate font-mono text-xs text-ink-gray-4">{{ c.key }}</div>
          </div>
          <div class="min-w-0 truncate font-mono text-xs text-ink-gray-7">{{ c.value }}</div>
          <div><Badge theme="gray" variant="subtle" :label="c.type" /></div>
          <Dropdown :options="configMenu(c)" placement="bottom-end">
            <button class="grid size-7 place-items-center rounded text-ink-gray-5 hover:bg-surface-gray-2" :aria-label="`Edit ${c.key}`"><span class="lucide-ellipsis size-4" /></button>
          </Dropdown>
        </div>
      </div>
    </section>

    <!-- Settings -->
    <section v-else class="mt-5 space-y-6">
      <!-- General -->
      <div>
        <h2 class="text-sm font-semibold text-ink-gray-8">General</h2>
        <div class="mt-2 divide-y divide-outline-gray-1 rounded-xl border border-outline-gray-2 bg-surface-white">
          <div class="flex items-center justify-between gap-4 p-4">
            <div>
              <div class="text-sm font-medium text-ink-gray-9">Frappe version</div>
              <div class="mt-0.5 text-sm text-ink-gray-5">{{ versionLabel }} — set by the server this site runs on.</div>
            </div>
            <Button variant="subtle" size="sm" label="Change version" @click="openVersionMove" />
          </div>
          <div v-for="opt in configOptions" :key="opt.key" class="flex items-center justify-between gap-4 p-4">
            <div>
              <div class="text-sm font-medium text-ink-gray-9">{{ opt.label }}</div>
              <div class="mt-0.5 text-sm text-ink-gray-5">{{ opt.desc }}</div>
            </div>
            <Switch :modelValue="site.config[opt.key]" @update:modelValue="toggle(opt)" />
          </div>
        </div>
      </div>

      <!-- Domains -->
      <div>
        <h2 class="text-sm font-semibold text-ink-gray-8">Domains</h2>
        <div class="mt-2 divide-y divide-outline-gray-1 rounded-xl border border-outline-gray-2 bg-surface-white">
          <div class="flex items-center gap-3 p-4">
            <span class="lucide-globe size-4 shrink-0 text-ink-gray-5" />
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="truncate text-sm font-medium text-ink-gray-9">{{ site.name }}</span>
                <Badge theme="gray" variant="subtle" label="Included" />
              </div>
              <div class="mt-0.5 flex items-center gap-1 text-sm text-ink-green-3"><span class="lucide-lock size-3" /> SSL active</div>
            </div>
          </div>
          <div v-for="d in site.domains" :key="d.id" class="p-4">
            <div class="flex items-center gap-3">
              <span class="lucide-link size-4 shrink-0 text-ink-gray-5" />
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="truncate text-sm font-medium text-ink-gray-9">{{ d.name }}</span>
                  <Badge v-if="d.status === 'verifying'" theme="orange" variant="subtle" label="Checking DNS…" />
                  <Badge v-else-if="d.status === 'failed'" theme="red" variant="subtle" label="Verification failed" />
                  <Badge v-else-if="d.status === 'pending'" theme="orange" variant="subtle" label="DNS setup needed" />
                </div>
                <div v-if="d.ssl" class="mt-0.5 flex items-center gap-1 text-sm text-ink-green-3"><span class="lucide-lock size-3" /> SSL active</div>
                <div v-else-if="d.status === 'failed'" class="mt-0.5 text-sm text-ink-red-4">We couldn't find these records yet — double-check them and retry.</div>
                <div v-else-if="d.status === 'pending'" class="mt-0.5 text-sm text-ink-gray-5">Add these records at your DNS provider, then verify.</div>
                <div v-else class="mt-0.5 text-sm text-ink-gray-5">SSL is issued once DNS checks out</div>
              </div>
              <Button v-if="d.status === 'verifying'" variant="subtle" size="sm" label="Verifying…" loading disabled />
              <Button v-else-if="d.status === 'pending'" variant="solid" size="sm" label="Verify" icon-left="lucide-check" @click="verifyDomain(d)" />
              <Button v-else-if="d.status === 'failed'" variant="subtle" size="sm" label="Retry" icon-left="lucide-refresh-cw" @click="verifyDomain(d)" />
            </div>

            <!-- Records to add at the DNS provider — stay visible through the
                 verifying check, until SSL is active. -->
            <template v-if="['pending', 'failed', 'verifying'].includes(d.status) && d.dnsRecords?.length">
              <div class="mt-3 overflow-hidden rounded-lg border border-outline-gray-2">
                <div class="grid grid-cols-[4rem_1fr_1fr] gap-3 border-b border-outline-gray-1 bg-surface-gray-1 px-3 py-2 text-xs font-medium text-ink-gray-5">
                  <span>Type</span><span>Host</span><span>Value</span>
                </div>
                <div v-for="(rec, i) in d.dnsRecords" :key="i" class="grid grid-cols-[4rem_1fr_1fr] gap-3 border-b border-outline-gray-1 px-3 py-2 font-mono text-xs text-ink-gray-7 last:border-b-0">
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
              <p class="mt-2 flex items-start gap-1.5 text-xs text-ink-gray-5">
                <span class="lucide-info mt-px size-3 shrink-0" />
                Add these at your DNS provider, then verify. DNS changes can take up to an hour to propagate — we keep checking in the background.
              </p>
            </template>
          </div>
        </div>
        <Button variant="subtle" size="sm" label="Use your own domain" icon-left="lucide-plus" class="mt-3" @click="addDomainOpen = true" />
      </div>

      <!-- Site actions -->
      <div>
        <h2 class="text-sm font-semibold text-ink-gray-8">Actions</h2>
        <div class="mt-2 divide-y divide-outline-gray-1 rounded-xl border border-outline-gray-2 bg-surface-white">
          <div v-for="a in siteActions" :key="a.label" class="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <div class="text-sm font-medium text-ink-gray-9">{{ a.label }}</div>
              <div class="mt-0.5 text-sm text-ink-gray-5">{{ a.desc }}</div>
            </div>
            <Button variant="subtle" size="sm" :label="a.action" @click="a.onClick" />
          </div>
        </div>
      </div>

      <!-- Danger -->
      <div>
        <h2 class="text-sm font-semibold text-ink-gray-8">Danger</h2>
        <div class="mt-2 space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-outline-gray-2 bg-surface-white p-4">
            <div>
              <div class="text-sm font-medium text-ink-gray-9">Deactivate this site</div>
              <div class="mt-0.5 text-sm text-ink-gray-5">Takes {{ site.name }} offline without deleting anything. Reactivate anytime.</div>
            </div>
            <Button variant="subtle" :label="site.status === 'suspended' ? 'Reactivate site' : 'Deactivate site'" @click="deactivateOpen = true" />
          </div>
          <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-outline-gray-2 bg-surface-white p-4">
            <div>
              <div class="text-sm font-medium text-ink-gray-9">Reset this site</div>
              <div class="mt-0.5 text-sm text-ink-gray-5">Wipes the database back to a fresh install. Apps stay; all your data is removed.</div>
            </div>
            <Button variant="subtle" theme="red" label="Reset site" @click="resetOpen = true" />
          </div>
          <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-outline-red-1 bg-surface-white p-4">
            <div>
              <div class="text-sm font-medium text-ink-gray-9">Drop this site</div>
              <div class="mt-0.5 text-sm text-ink-gray-5">Permanently deletes {{ site.name }} and all its data. Backups are kept for 30 days after.</div>
            </div>
            <Button variant="solid" theme="red" label="Drop site" @click="dropOpen = true" />
          </div>
        </div>
      </div>
    </section>

    <MoveSiteDialog v-model:open="moveOpen" :site="site" :server="server" :required-version="moveVersion" @moved="onMoved" />
    <AddDomainDialog v-model:open="addDomainOpen" :site="site" />
    <DropSiteDialog v-model:open="dropOpen" :site="site" @confirm="dropSite" />
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
      :message="`${site.name} goes back to ${pendingBackup ? fmtDateTime(pendingBackup.at) : ''} and will be unavailable for a minute while we restore it.`"
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
      :message="`${site.name}'s database is wiped back to a fresh install. We take a backup first, but all current data is removed. This can't be undone.`"
      confirm-label="Reset site"
      @confirm="resetSite"
    />

    <!-- Updates across all apps on this site -->
    <Dialog v-model:open="updatesOpen">
      <template #title><span class="text-xl font-semibold text-ink-gray-9">Updates available</span></template>
      <div class="space-y-2.5">
        <div v-for="app in updatableApps" :key="app.id" class="flex items-center gap-3 rounded-lg border border-outline-gray-2 p-3">
          <AppIcon :app-key="app.key" size="md" />
          <div class="min-w-0 flex-1">
            <div class="text-sm font-medium text-ink-gray-9">{{ app.name }}</div>
            <div class="text-sm text-ink-gray-5">
              <span class="font-mono">{{ app.version }}</span>
              <span class="lucide-arrow-right mx-1 inline-block size-3 align-middle" />
              <span class="font-mono text-ink-green-3">{{ store.appUpdate(app) }}</span>
            </div>
          </div>
          <Button variant="subtle" size="sm" label="Update" @click="updateApp(app)" />
        </div>
        <p v-if="!updatableApps.length" class="py-2 text-center text-sm text-ink-gray-5">Everything's up to date.</p>
      </div>
      <template #actions>
        <div class="flex justify-end gap-2">
          <Button label="Close" @click="updatesOpen = false" />
          <Button variant="solid" label="Update all" :disabled="!updatableApps.length" @click="updateAll" />
        </div>
      </template>
    </Dialog>
  </ServerShell>
</template>

<script setup>
import { computed, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Badge, Button, Dialog, Dropdown, FormControl, Switch, TabButtons, toast } from 'frappe-ui'
import AddDomainDialog from '../../components/AddDomainDialog.vue'
import AppIcon from '../../components/AppIcon.vue'
import ConfirmDialog from '../../components/ConfirmDialog.vue'
import EmptyState from '../../components/EmptyState.vue'
import ServerShell from '../../components/ServerShell.vue'
import WorldMap from '../../components/WorldMap.vue'
import DropSiteDialog from '../../components/DropSiteDialog.vue'
import MoveSiteDialog from '../../components/MoveSiteDialog.vue'
import { versionById } from '../../data/catalog'
import { useCloudStore } from '../../stores/cloud'
import { fmtDateTime } from '../../utils/format'

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

const crumbs = computed(() => [
  { label: 'Sites', route: `/manage/${server.value.id}` },
  { label: site.value.name, route: route.fullPath },
])

const tab = ref('apps')
const tabs = [
  { label: 'Apps', value: 'apps' },
  { label: 'Backups', value: 'backups' },
  { label: 'Config', value: 'config' },
  { label: 'Settings', value: 'settings' },
]

const addDomainOpen = ref(false)
function verifyDomain(d) {
  store.verifyDomain(site.value.id, d.id)
  toast('Checking DNS — this can take a few minutes')
}
function copyValue(text) {
  navigator.clipboard?.writeText(text)
  toast.success('Copied')
}
const dropOpen = ref(false)
const deactivateOpen = ref(false)
const resetOpen = ref(false)
const updatesOpen = ref(false)

// Install app → the server Marketplace, with this site preselected (§9).
function browseMarketplace() {
  router.push(`/manage/${server.value.id}/marketplace?site=${site.value.id}`)
}

// — Version / move (a version change IS a move to another server)
const moveOpen = ref(false)
const moveVersion = ref(null)
const versionLabel = computed(() => versionById(server.value.version).label)

function openVersionMove() {
  moveVersion.value = null
  moveOpen.value = true
}
function onMoved(target) {
  movedAway.value = true
  router.replace(`/manage/${target.id}/sites/${route.params.siteId}`).then(() => (movedAway.value = false))
}

// — Apps
const uninstallOpen = ref(false)
const pendingApp = ref(null)
const updatableApps = computed(() => site.value.apps.filter((a) => store.appUpdate(a)))
const hasUpdates = computed(() => updatableApps.value.length > 0)
function updateApp(app) {
  const to = store.appUpdate(app)
  toast.promise(store.updateApp(site.value.id, app.key), {
    loading: `Updating ${app.name}…`,
    success: `${app.name} updated to ${to}`,
    error: 'Update failed',
  })
}
function updateAll() {
  const apps = updatableApps.value.slice()
  apps.forEach((a) => store.updateApp(site.value.id, a.key).catch(() => {}))
  toast.success(`Updating ${apps.length} app${apps.length > 1 ? 's' : ''}…`)
  updatesOpen.value = false
}
function askUninstall(app) {
  pendingApp.value = app
  uninstallOpen.value = true
}
function uninstall() {
  const name = pendingApp.value.name
  toast.promise(store.uninstallApp(site.value.id, pendingApp.value.key), {
    loading: `Uninstalling ${name}…`,
    success: `${name} uninstalled`,
    error: 'Uninstall failed',
  })
}

// — Backups
const scheduleOptions = [
  { label: 'Daily, 2 AM', value: 'daily' },
  { label: 'Weekly, Sunday', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
]
function setSchedule(v) {
  const p = store.setBackupSchedule(site.value.id, v)
  if (p) toast.promise(p, { loading: 'Saving…', success: 'Backup schedule updated', error: 'Could not save' })
}
function backupNow() {
  toast.promise(store.backupNow(site.value.id), {
    loading: 'Backing up…',
    success: 'Backed up just now',
    error: 'Backup failed',
  })
}
function download() {
  toast('In the real thing, this downloads the backup')
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

// — Settings: friendly toggles
const configOptions = [
  { key: 'maintenance', label: 'Maintenance mode', desc: 'Visitors see a calm "back soon" page while you work.' },
  { key: 'scheduler', label: 'Background jobs', desc: 'Scheduled emails, reports and automations.' },
  { key: 'devMode', label: 'Developer mode', desc: 'Lets developers customise doctypes on this site.' },
]
function toggle(opt) {
  store.toggleSiteConfig(site.value.id, opt.key)
  toast.success(`${opt.label} turned ${site.value.config[opt.key] ? 'on' : 'off'}`)
}

// — Config tab: raw key/value table
const configRows = computed(() => {
  const dbName = '_' + site.value.id.replace(/[^a-z0-9]/gi, '').slice(0, 12)
  return [
    { key: 'db_name', value: dbName, type: 'String' },
    { key: 'db_type', value: 'mariadb', type: 'String' },
    { key: 'db_password', value: '•••••••', type: 'Password' },
    { key: 'mail_login', label: 'Mail login', value: `notifications@${site.value.name}`, type: 'String' },
    { key: 'mail_server', label: 'Mail server', value: 'smtp.frappemail.com', type: 'String' },
    { key: 'mail_port', label: 'Mail port', value: '587', type: 'String' },
    { key: 'maintenance_mode', value: site.value.config.maintenance ? '1' : '0', type: 'Boolean' },
    { key: 'scheduler_enabled', value: site.value.config.scheduler ? 'true' : 'false', type: 'Boolean' },
    { key: 'developer_mode', value: site.value.config.devMode ? '1' : '0', type: 'Boolean' },
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
  { label: 'Clear cache', desc: 'Flush this site’s cache if something looks stale.', action: 'Clear', onClick: () => toast.success('Cache cleared') },
  { label: 'Database users', desc: 'Manage who can connect to this site’s database.', action: 'Manage', onClick: () => toast('In the real thing, this manages database users') },
  { label: 'Email notifications', desc: 'Choose which alerts this site sends out.', action: 'Manage', onClick: () => toast('In the real thing, this opens notification settings') },
  { label: 'Transfer site', desc: 'Move this site to another team.', action: 'Transfer', onClick: () => toast('In the real thing, this starts a transfer') },
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
</script>

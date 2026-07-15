<template>
  <SettingsDialog v-if="server" v-model="open" v-model:tab="tab" :shortcut="false" size="4xl">
    <!-- bare Dialog has no chrome, so we provide the close affordance. -->
    <Button class="absolute right-4 top-4 z-20" variant="ghost" icon="lucide-x" aria-label="Close" @click="open = false" />

    <SettingsSidebar>
      <SettingsNavGroup label="Server">
        <SettingsNavItem v-for="s in sections" :key="s.value" :value="s.value">
          <template #prefix>
            <span :class="[s.icon, 'size-4 shrink-0 text-ink-gray-6']" />
          </template>
          {{ s.label }}
        </SettingsNavItem>
      </SettingsNavGroup>
    </SettingsSidebar>

    <SettingsContent>
      <!-- Git Settings -->
      <SettingsPanel class="gap-6" value="github">
        <SettingsHeader title="Git Settings" description="Connect a GitHub account to install private apps." />
        <SettingsBody>
          <div class="space-y-6">
            <Alert v-if="!github.connected" theme="blue" title="Connect GitHub" :dismissible="false">
              <template #description>
                Install private apps and browse your repos. Paste a token with <code class="text-xs">repo</code> scope below.
              </template>
            </Alert>

            <!-- Connected summary. -->
            <div v-if="github.connected" class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p class="text-sm font-medium text-ink-gray-8">Connected as {{ github.username }}</p>
                <p class="text-p-sm text-ink-gray-5">GitHub · personal access token</p>
              </div>
              <div class="flex items-center gap-2">
                <Button variant="subtle" label="Verify" @click="verifyGithub" />
                <Button variant="subtle" theme="red" label="Disconnect" @click="disconnectGithub" />
              </div>
            </div>

            <!-- Credentials — username + token, always editable. -->
            <div class="space-y-4">
              <FormControl v-model="github.username" type="text" label="GitHub username" placeholder="octocat" />
              <FormControl v-model="github.token" type="password" label="Personal access token" placeholder="ghp_…" />
              <div class="flex justify-end">
                <Button variant="solid" :label="github.connected ? 'Update token' : 'Verify & connect'" :disabled="!github.username || !github.token" @click="connectGithub" />
              </div>
            </div>
          </div>
        </SettingsBody>
      </SettingsPanel>

      <!-- S3 Bucket -->
      <SettingsPanel class="gap-6" value="s3-bucket">
        <SettingsHeader title="S3 Bucket" description="Send offsite backups and snapshots to an S3-compatible bucket." />
        <SettingsBody>
          <div class="space-y-6">
            <template v-if="!s3.connected">
              <Alert theme="blue" title="Why connect S3?" :dismissible="false">
                <template #description>Connect an S3-compatible bucket to send offsite backups and snapshots.</template>
              </Alert>
              <div class="grid grid-cols-2 gap-4">
                <FormControl v-model="s3.bucket" label="Bucket name" />
                <FormControl v-model="s3.region" label="Region" placeholder="us-east-1" />
                <FormControl v-model="s3.accessKey" label="Access key ID" />
                <FormControl v-model="s3.secretKey" type="password" label="Secret access key" />
                <FormControl v-model="s3.endpoint" class="col-span-2" label="Endpoint (optional)" placeholder="https://s3.amazonaws.com" />
              </div>
              <div class="flex justify-end">
                <Button variant="solid" label="Connect" :disabled="!s3.bucket || !s3.accessKey || !s3.secretKey" @click="connectS3" />
              </div>
            </template>
            <div v-else class="divide-y divide-outline-gray-1">
              <SettingsRow title="Connected bucket" :description="`Backups upload to ${s3.bucket} (${s3.region || 'default region'}).`">
                <Button variant="subtle" theme="red" label="Disconnect" @click="disconnectS3" />
              </SettingsRow>
            </div>
          </div>
        </SettingsBody>
      </SettingsPanel>

      <!-- Backup -->
      <SettingsPanel class="gap-6" value="backup">
        <SettingsHeader title="Backup" description="How many backups to keep before old ones are pruned." />
        <SettingsBody>
          <div class="space-y-6">
            <Alert theme="blue" title="How retention works" :dismissible="false">
              <template #description>
                Old backups are pruned automatically after every backup. FIFO keeps the newest N runs; GFS keeps recent
                daily, weekly, monthly and yearly backups. The most recent backup is always kept.
              </template>
            </Alert>

            <FormControl v-model="backup.scheme" type="select" label="Retention scheme" :options="retentionSchemes" />

            <div v-if="backup.scheme === 'gfs'" class="grid grid-cols-2 gap-4">
              <FormControl v-model="backup.daily" type="number" label="Daily" />
              <FormControl v-model="backup.weekly" type="number" label="Weekly" />
              <FormControl v-model="backup.monthly" type="number" label="Monthly" />
              <FormControl v-model="backup.yearly" type="number" label="Yearly" />
            </div>
            <FormControl v-else v-model="backup.keep" type="number" label="Keep newest" description="Number of most recent backups to keep." />

            <div class="flex justify-end">
              <Button variant="solid" label="Save" @click="saveBackup" />
            </div>
          </div>
        </SettingsBody>
      </SettingsPanel>

      <!-- Audit -->
      <SettingsPanel class="gap-6" value="audit">
        <SettingsHeader title="Audit" description="A record of changes made to this server." />
        <SettingsBody>
          <div v-if="!auditLog.length" class="rounded-xl border border-dashed border-outline-gray-2 py-16 text-center text-p-sm text-ink-gray-5">
            Nothing has been logged yet.
          </div>
          <div v-else class="divide-y divide-outline-gray-1">
            <div v-for="(e, i) in auditLog" :key="i" class="flex items-center justify-between gap-4 py-2.5">
              <span class="text-sm text-ink-gray-8">{{ e.action }}</span>
              <span class="text-xs text-ink-gray-5">{{ e.at }}</span>
            </div>
          </div>
        </SettingsBody>
      </SettingsPanel>

      <!-- Workers -->
      <SettingsPanel class="gap-6" value="workers">
        <SettingsHeader title="Workers" description="Background job workers and the queues each group serves.">
          <template #actions>
            <Button variant="subtle" icon-left="lucide-plus" label="Add" @click="addWorkerGroup" />
          </template>
        </SettingsHeader>
        <SettingsBody>
          <div class="space-y-4">
            <div v-for="(g, i) in workerGroups" :key="i" class="flex items-end gap-3">
              <div class="w-28 space-y-1.5">
                <p v-if="i === 0" class="text-sm font-medium text-ink-gray-7">No of Workers</p>
                <FormControl v-model="g.count" type="number" />
              </div>
              <div class="flex-1 space-y-1.5">
                <p v-if="i === 0" class="text-sm font-medium text-ink-gray-7">Queues</p>
                <FormControl v-model="g.queues" placeholder="default, short, long" />
              </div>
              <Button variant="subtle" icon="lucide-x" :disabled="workerGroups.length === 1" @click="workerGroups.splice(i, 1)" />
            </div>
            <div class="flex justify-end">
              <Button variant="solid" label="Save Changes" @click="saveWorkers" />
            </div>
          </div>
        </SettingsBody>
      </SettingsPanel>

      <!-- Firewall -->
      <SettingsPanel class="gap-6" value="firewall">
        <SettingsHeader title="Firewall" description="Control who can reach this server and its sites." />
        <SettingsBody>
          <div class="space-y-6">
            <div class="divide-y divide-outline-gray-1">
              <SettingsRow title="Enable firewall" description="Restrict who can reach Pilot and deployed sites; off means open.">
                <Switch v-model="fw.enabled" />
              </SettingsRow>
              <SettingsRow v-if="fw.enabled" title="Block by default" description="Only allowed IPs below can reach the server; off allows all except blocked ones.">
                <Switch v-model="fw.blockByDefault" />
              </SettingsRow>
            </div>

            <Alert v-if="lockoutRisk" theme="yellow" title="Heads up" :dismissible="false">
              <template #description>
                Everyone is blocked by default. Add an <b>Allow</b> rule for your own IP
                (<span class="font-mono text-xs">{{ myIp }}</span>) or you’ll lock yourself out.
              </template>
            </Alert>

            <div v-if="fw.enabled">
              <div class="flex items-center justify-between pb-2">
                <p class="text-xs font-medium uppercase tracking-wide text-ink-gray-5">Rules</p>
                <Button variant="ghost" size="sm" icon-left="lucide-plus" label="Add rule" @click="addFwRule" />
              </div>
              <div class="divide-y divide-outline-gray-1">
                <div v-for="r in fw.rules" :key="r.id" class="flex items-center justify-between gap-3 py-2.5">
                  <div class="flex items-center gap-2">
                    <Badge :theme="r.action === 'Allow' ? 'green' : 'red'" variant="subtle" :label="r.action" />
                    <span class="font-mono text-sm text-ink-gray-8">{{ r.ip }}</span>
                    <span class="text-sm text-ink-gray-5">· port {{ r.port }}</span>
                  </div>
                  <Button variant="ghost" size="sm" icon="lucide-trash-2" @click="removeFwRule(r)" />
                </div>
                <p v-if="!fw.rules.length" class="py-2.5 text-sm text-ink-gray-5">No rules yet.</p>
              </div>
            </div>
          </div>
        </SettingsBody>
      </SettingsPanel>

      <!-- SSH Keys -->
      <SettingsPanel class="gap-6" value="ssh-keys">
        <SettingsHeader title="SSH Keys" description="Keys that can open an SSH session to this server.">
          <template #actions>
            <Button variant="subtle" icon-left="lucide-plus" label="Add" @click="addSshKey" />
          </template>
        </SettingsHeader>
        <SettingsBody>
          <div v-if="!sshKeys.length" class="rounded-xl border border-dashed border-outline-gray-2 py-12 text-center text-p-sm text-ink-gray-5">
            No SSH keys.
          </div>
          <div v-else class="divide-y divide-outline-gray-1">
            <div v-for="k in sshKeys" :key="k.fingerprint" class="flex items-center justify-between gap-4 py-3">
              <div class="flex min-w-0 flex-col gap-0.5">
                <span class="truncate text-sm font-medium leading-5 text-ink-gray-8">{{ k.name }}</span>
                <button class="max-w-full truncate text-left font-mono text-xs leading-4 text-ink-gray-5 hover:text-ink-gray-7" title="Click to copy" @click="copy(k.fingerprint)">
                  {{ k.fingerprint }}
                </button>
              </div>
              <Button variant="ghost" size="sm" theme="red" icon="lucide-trash-2" @click="removeSshKey(k)" />
            </div>
          </div>
        </SettingsBody>
      </SettingsPanel>

      <!-- System Info -->
      <SettingsPanel class="gap-6" value="system-info">
        <SettingsHeader title="System Info" description="Hardware and runtime versions on this server." />
        <SettingsBody>
          <div class="space-y-6">
            <div>
              <p class="mb-1 text-xs font-medium uppercase tracking-wide text-ink-gray-5">System</p>
              <div class="divide-y divide-outline-gray-1">
                <div v-for="(value, label) in systemRows" :key="label" class="flex items-center justify-between py-2.5">
                  <span class="text-sm text-ink-gray-7">{{ label }}</span>
                  <span class="text-sm text-ink-gray-9">{{ value }}</span>
                </div>
              </div>
            </div>
            <div>
              <p class="mb-1 text-xs font-medium uppercase tracking-wide text-ink-gray-5">Runtime</p>
              <div class="divide-y divide-outline-gray-1">
                <div v-for="(value, label) in runtimeRows" :key="label" class="flex items-center justify-between py-2.5">
                  <span class="text-sm text-ink-gray-7">{{ label }}</span>
                  <span class="text-sm text-ink-gray-9">{{ value }}</span>
                </div>
              </div>
            </div>
          </div>
        </SettingsBody>
      </SettingsPanel>
    </SettingsContent>
  </SettingsDialog>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import {
  Badge,
  Button,
  FormControl,
  SettingsBody,
  SettingsContent,
  SettingsDialog,
  SettingsHeader,
  SettingsNavGroup,
  SettingsNavItem,
  SettingsPanel,
  SettingsRow,
  SettingsSidebar,
  Switch,
  toast,
} from 'frappe-ui'
import Alert from './Alert.vue'

const props = defineProps({
  server: { type: Object, default: null },
})
const open = defineModel('open', { type: Boolean, default: false })

// Tabs mirror pilot's server settings modal, in the same order.
const sections = [
  { label: 'Git Settings', value: 'github', icon: 'lucide-git-branch' },
  { label: 'S3 Bucket', value: 's3-bucket', icon: 'lucide-archive' },
  { label: 'Backup', value: 'backup', icon: 'lucide-database-backup' },
  { label: 'Audit', value: 'audit', icon: 'lucide-scroll-text' },
  { label: 'Workers', value: 'workers', icon: 'lucide-server-cog' },
  { label: 'Firewall', value: 'firewall', icon: 'lucide-shield' },
  { label: 'SSH Keys', value: 'ssh-keys', icon: 'lucide-key-round' },
  { label: 'System Info', value: 'system-info', icon: 'lucide-info' },
]
const tab = ref('github')

// — Git
const github = reactive({ connected: false, username: '', token: '' })
function connectGithub() {
  github.connected = true
  toast.success('GitHub connected')
}
function verifyGithub() {
  toast.success('GitHub connection is healthy')
}
function disconnectGithub() {
  github.connected = false
  github.token = ''
  toast.success('GitHub disconnected')
}

// — S3 bucket
const s3 = reactive({ connected: false, bucket: '', region: '', accessKey: '', secretKey: '', endpoint: '' })
function connectS3() {
  s3.connected = true
  toast.success('S3 bucket connected')
}
function disconnectS3() {
  s3.connected = false
  toast.success('S3 bucket disconnected')
}

// — Backup retention
const retentionSchemes = [
  { label: 'GFS (daily / weekly / monthly / yearly)', value: 'gfs' },
  { label: 'FIFO (keep newest N)', value: 'fifo' },
]
const backup = reactive({ scheme: 'gfs', daily: 7, weekly: 4, monthly: 6, yearly: 1, keep: 10 })
function saveBackup() {
  toast.success('Backup retention saved')
}

// — Audit (empty until the server logs something)
const auditLog = ref([])

// — Workers
const workerGroups = reactive([{ count: 2, queues: 'default, short, long' }])
function addWorkerGroup() {
  workerGroups.push({ count: 1, queues: '' })
}
function saveWorkers() {
  toast.success('Worker configuration saved')
}

// — Firewall
const myIp = '203.0.113.42'
const fw = reactive({
  enabled: true,
  blockByDefault: true,
  rules: [
    { id: 1, action: 'Allow', ip: '203.0.113.42', port: 22 },
    { id: 2, action: 'Allow', ip: '0.0.0.0/0', port: 443 },
  ],
})
let nextRuleId = 3
const lockoutRisk = computed(
  () => fw.enabled && fw.blockByDefault && !fw.rules.some((r) => r.action === 'Allow' && r.port === 22),
)
function addFwRule() {
  fw.rules.push({ id: nextRuleId++, action: 'Allow', ip: '0.0.0.0/0', port: 80 })
  toast.success('Rule added')
}
function removeFwRule(r) {
  const i = fw.rules.indexOf(r)
  if (i >= 0) fw.rules.splice(i, 1)
}

// — SSH keys
const sshKeys = ref([{ name: 'ops@thinkpad', fingerprint: 'SHA256:aZ1cVr8kQm2Xp9LtN4hUeW7sYd0oBfG3jKq6RvT ops@thinkpad' }])
function addSshKey() {
  sshKeys.value.push({ name: 'deploy@ci', fingerprint: 'SHA256:Hb4mQ2eR9tZ0pXvN7sYd1oCfG8jKq3RvTuW6aL deploy@ci' })
  toast.success('SSH key added')
}
function removeSshKey(k) {
  sshKeys.value = sshKeys.value.filter((x) => x !== k)
  toast.success('SSH key removed')
}

// — System info
const systemRows = {
  OS: 'Ubuntu 22.04.4 LTS',
  Kernel: '5.15.0-105-generic',
  vCPUs: '4',
  RAM: '8 GB',
  'Disk size': '160 GB',
}
const runtimeRows = computed(() => ({
  Frappe: props.server?.build || '—',
  Python: '3.11.9',
  Node: '20.14.0',
  MariaDB: '10.6.18',
  Redis: '7.2.4',
}))

function copy(text) {
  navigator.clipboard?.writeText(text)
  toast.success('Copied')
}
</script>

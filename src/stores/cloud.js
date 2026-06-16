import { defineStore } from 'pinia'
import { APP_CATALOG, TEAM_SIZE_TO_PLAN, appByKey, planById, regionById, versionById } from '../data/catalog'
import { makeProcesses } from '../data/system'
import { fmtDateTime, slugify } from '../utils/format'

let n = 1000
const uid = (prefix) => `${prefix}-${n++}`

const BUILT_IN_PERMISSIONS = {
  'role-owner':   { administrator: true,  createSites: true,  marketplace: true,  webhooks: true,  billing: true },
  'role-admin':   { administrator: false, createSites: true,  marketplace: true,  webhooks: true,  billing: false },
  'role-billing': { administrator: false, createSites: false, marketplace: false, webhooks: false, billing: true },
  'role-member':  { administrator: false, createSites: false, marketplace: false, webhooks: false, billing: false },
}
function defaultPermissions() {
  return { administrator: false, createSites: false, marketplace: false, webhooks: false, billing: false }
}

// Average daily credit burn in $ — used for the "covers about X days" hint.
export const DAILY_BURN = 1.75
export const LOW_CREDIT_THRESHOLD = 5
// Billing runs on a monthly cycle; per-day figures are an informational
// breakdown of the monthly price (price ÷ 30), not a daily deduction.
export const CYCLE_DAYS = 30

const HOUR = 3600 * 1000
const DAY = 24 * HOUR

function makeApp(key) {
  const meta = appByKey(key)
  return { id: uid('app'), key, name: meta.name, version: meta.version }
}

// A site is identified by its subdomain — there is no separate friendly name.
// `subdomain` is the slug; `name` is the full address shown everywhere.
function makeSite(subdomain, appKeys, status = 'live') {
  const slug = slugify(subdomain)
  return {
    id: uid('site'),
    subdomain: slug,
    name: slug + '.frappe.cloud',
    createdAt: Date.now(),
    status, // 'live' | 'creating' | 'restoring' | 'moving' | 'suspended'
    apps: appKeys.map(makeApp),
    domains: [], // custom domains; the primary one is `name`
    config: { maintenance: false, scheduler: true, devMode: false },
    backupSchedule: 'daily', // 'daily' | 'weekly' | 'monthly'
    backups: [], // { id, at, size, kind: 'auto' | 'manual' }
  }
}

function makeBackup(agoMs, size, kind = 'auto') {
  return { id: uid('bak'), at: Date.now() - agoMs, size, kind }
}

function makeServer(opts = {}) {
  return {
    id: uid('srv'),
    name: 'My Server',
    regionId: 'aws-mumbai',
    version: 'v15', // a server runs one Frappe version; sites inherit it
    planId: 'business',
    status: 'active', // 'provisioning' | 'active'
    creditBalance: 25,
    creditTotal: 25,
    inboundIp: '13.200.157.65',
    outboundIp: '13.200.157.66',
    createdAt: Date.now() - 20 * DAY,
    sites: [],
    // Resource picture; disk scales with the plan so resizes stay sensible.
    health: { cpuPct: 15, memUsedGb: 1.2, memTotalGb: 1.9, diskFrac: 0.24 },
    processes: makeProcesses(),
    firewallRules: [
      { id: uid('fw'), name: 'HTTPS', port: 443, action: 'Allow', enabled: true },
      { id: uid('fw'), name: 'HTTP', port: 80, action: 'Allow', enabled: true },
      { id: uid('fw'), name: 'SSH', port: 22, action: 'Allow', enabled: true },
    ],
    sshKeys: [{ id: uid('key'), name: 'work-laptop', fingerprint: 'SHA256:aX9k…Q2x' }],
    // Plan up/downgrades over time — shown on the server's Settings page.
    planHistory: [],
    ...opts,
  }
}

function recentUsage() {
  return [
    { date: 'Jun 9', amount: 1.75, note: 'Daily server usage' },
    { date: 'Jun 8', amount: 1.75, note: 'Daily server usage' },
    { date: 'Jun 7', amount: 1.75, note: 'Daily server usage' },
    { date: 'Jun 6', amount: 1.75, note: 'Daily server usage' },
  ]
}

function makeEvent(agoMs, title, { tag = 'server', status = 'success', detail = null } = {}) {
  return { id: uid('act'), at: Date.now() - agoMs, title, tag, status, detail }
}

function baseState() {
  return {
    scenario: 'fresh', // 'fresh' | 'grown'
    user: { id: 'u-1', name: '', email: '', company: '', role: 'individual' },
    servers: [],
    members: [],
    // Account-wide roles you define, then assign to people on the Team.
    roles: [
      { id: 'role-owner',   name: 'Owner',   desc: 'Full access, including billing and team', system: true, permissions: { ...BUILT_IN_PERMISSIONS['role-owner'] } },
      { id: 'role-admin',   name: 'Admin',   desc: 'Create and manage servers, sites and apps', system: true, permissions: { ...BUILT_IN_PERMISSIONS['role-admin'] } },
      { id: 'role-billing', name: 'Billing', desc: 'View invoices and manage payment', system: true, permissions: { ...BUILT_IN_PERMISSIONS['role-billing'] } },
      { id: 'role-member',  name: 'Member',  desc: 'View-only access to servers and sites', system: true, permissions: { ...BUILT_IN_PERMISSIONS['role-member'] } },
    ],
    team: { name: 'My team', avatar: null },
    usage: [],
    activity: [], // newest first — humanized history of everything done here
    cardOnFile: false,
    autoRecharge: false,
    upiAutopay: false,
    // Prepaid Wallet (₹) — the monthly invoice draws from this first.
    walletBalance: 0,
    walletHistory: [], // { id, date, type: 'topup'|'charge'|'bonus', label, amount } — amount signed
    // Prioritized payment methods — primary is charged first, the rest are
    // automatic fallbacks. No user-facing gateway choice (auto by currency).
    paymentMethods: [],
    invoices: [], // { number, period, issued, status, items:[{label,plan,days,perDay,amount}] }
    payoutBalance: 0, // marketplace earnings available to withdraw (USD)
    lastCycleTotal: 0, // previous cycle's charge, for the "vs last month" stat
    billingProfile: {
      taxRegion: 'IN',
      taxValue: '',
      address: '',
      billingEmail: '',
      invoiceRecipient: '',
      invoiceLanguage: 'en',
    },
    // Account-level developer credentials (Central → Settings → Developer).
    apiKey: 'fc_live_8f2a91c4e7b0d35a',
    accountSshKeys: [],
    webhooks: [],
    creditExpired: false,
    structureRevealed: false,
    explainerDismissed: false,
    currentSiteId: null,
    currentServerId: null, // last server entered — keeps sidebar context
    busy: 0, // in-flight work; drives the top progress bar
    onboarding: { appKey: 'erpnext', teamSize: 'small', planId: 'business', subdomain: '', regionId: 'aws-mumbai' },
  }
}

function freshState() {
  return baseState()
}

function grownState() {
  const s = baseState()
  s.scenario = 'grown'
  s.user = { id: 'u-1', name: 'Rahul Mehta', email: 'rahul@mycompany.in', role: 'individual' }

  const company = makeSite('My Company', ['erpnext', 'hr'])
  company.backups = [
    makeBackup(10 * HOUR, '412 MB'),
    makeBackup(34 * HOUR, '408 MB'),
    makeBackup(58 * HOUR, '405 MB'),
  ]
  const shop = makeSite('My Shop', ['erpnext', 'crm'])
  shop.backups = [makeBackup(10 * HOUR, '96 MB')]

  const server = makeServer({
    name: 'atlas-web-01',
    creditBalance: 18,
    sites: [company, shop],
    planHistory: [
      { id: uid('ph'), date: '10 Jun 2026', from: 'Starter', to: 'Business', direction: 'upgrade' },
      { id: uid('ph'), date: '2 Mar 2026', from: 'Standard', to: 'Starter', direction: 'downgrade' },
    ],
  })
  const euServer = makeServer({
    name: 'atlas-eu-01',
    regionId: 'hetzner-nuremberg',
    planId: 'standard',
    creditBalance: 21,
    creditTotal: 25,
    sites: [makeSite('EU Staging', ['erpnext'])],
    health: { cpuPct: 9, memUsedGb: 0.8, memTotalGb: 1.0, diskFrac: 0.2 },
  })
  const sgServer = makeServer({
    name: 'atlas-sg-01',
    regionId: 'aws-singapore',
    creditBalance: 16,
    sites: [makeSite('APAC Shop', ['erpnext', 'crm'])],
    health: { cpuPct: 22, memUsedGb: 1.4, memTotalGb: 1.9, diskFrac: 0.31 },
  })
  const usServer = makeServer({
    name: 'atlas-us-01',
    regionId: 'do-nyc',
    planId: 'growth',
    creditBalance: 38,
    creditTotal: 50,
    sites: [makeSite('US Marketing', ['erpnext'])],
    health: { cpuPct: 18, memUsedGb: 1.1, memTotalGb: 3.0, diskFrac: 0.16 },
    planHistory: [
      { id: uid('ph'), date: '28 Apr 2026', from: 'Business', to: 'Growth', direction: 'upgrade' },
    ],
  })
  // A server that's fallen over — shows the red map pin + "Broken" state.
  const brokenServer = makeServer({
    name: 'atlas-build-01',
    regionId: 'oracle-jeddah',
    planId: 'starter',
    status: 'broken',
    creditBalance: 4,
    creditTotal: 25,
    sites: [makeSite('Build Box', ['erpnext'])],
    health: { cpuPct: 0, memUsedGb: 0, memTotalGb: 1.0, diskFrac: 0.42 },
  })
  s.servers = [server, euServer, sgServer, usServer, brokenServer]
  s.cardOnFile = true // a paid user — no trial credit badge
  s.billingProfile = {
    taxRegion: 'IN',
    taxValue: '29ABCDE1234F1Z5',
    address: '4th Floor, Prestige Tech Park, Bengaluru, KA 560103',
    billingEmail: 'billing@mycompany.in',
    invoiceRecipient: 'accounts@mycompany.in',
    invoiceLanguage: 'en',
  }
  s.team = { name: "Rahul's team", avatar: null }
  s.roles.push({ id: 'role-support', name: 'Support', desc: 'View-only access plus can create sites', permissions: { ...defaultPermissions(), createSites: true } })
  // Wallet — prepaid balance the monthly invoice draws from.
  s.walletBalance = 8400
  s.walletHistory = [
    { id: uid('wtx'), date: '1 Jun 2026', type: 'charge', label: 'May 2026 invoice', amount: -6798 },
    { id: uid('wtx'), date: '20 May 2026', type: 'topup', label: 'Added credit', amount: 10000 },
    { id: uid('wtx'), date: '1 May 2026', type: 'charge', label: 'April 2026 invoice', amount: -4850 },
    { id: uid('wtx'), date: '12 Apr 2026', type: 'bonus', label: 'Referral bonus', amount: 500 },
    { id: uid('wtx'), date: '1 Apr 2026', type: 'charge', label: 'March 2026 invoice', amount: -2410 },
  ]
  // Prioritized payment methods — Visa primary, UPI as automatic fallback.
  s.paymentMethods = [
    { id: uid('pm'), kind: 'card', label: 'Visa', detail: '•••• 4242', primary: true },
    { id: uid('pm'), kind: 'upi', label: 'UPI', detail: 'rahul@okhdfc', primary: false },
  ]
  // Past invoices with per-day line items (30-day cycle).
  s.invoices = [
    {
      number: 'INV-2026-0005', period: 'May 2026', issued: '1 Jun 2026', status: 'Paid', credits: 1000,
      items: [
        { label: 'atlas-web-01', plan: 'Business', days: 30, perDay: 137, amount: 4110 },
        { label: 'atlas-eu-01', plan: 'Standard', days: 30, perDay: 55, amount: 1650 },
      ],
    },
    {
      number: 'INV-2026-0004', period: 'April 2026', issued: '1 May 2026', status: 'Paid', credits: 500,
      items: [{ label: 'atlas-web-01', plan: 'Business', days: 30, perDay: 137, amount: 4110 }],
    },
    {
      number: 'INV-2026-0003', period: 'March 2026', issued: '1 Apr 2026', status: 'Paid', credits: 0,
      items: [{ label: 'atlas-web-01', plan: 'Standard', days: 30, perDay: 68, amount: 2040 }],
    },
  ]
  s.payoutBalance = 0
  s.lastCycleTotal = 14100 // makes this cycle's estimate read ~+15%
  s.members = [
    { id: uid('mem'), name: 'Rahul Mehta',  email: 'rahul@mycompany.in', roles: [{ roleId: 'role-owner', resourceId: null }] },
    { id: uid('mem'), name: 'Sara Khan',    email: 'sara@mycompany.in',  roles: [{ roleId: 'role-admin', resourceId: null }] },
    { id: uid('mem'), name: 'Priya Patel',  email: 'priya@mycompany.in', roles: [{ roleId: 'role-billing', resourceId: null }] },
    { id: uid('mem'), name: 'Dev Sharma',   email: 'dev@mycompany.in',   roles: [{ roleId: 'role-support', resourceId: null }] },
    { id: uid('mem'), name: 'Arjun Singh',  email: 'arjun@mycompany.in', roles: [{ roleId: 'role-member', resourceId: null }], invited: true, inviteExpired: false },
    { id: uid('mem'), name: 'Riya Shah',   email: 'riya@mycompany.in',  roles: [{ roleId: 'role-member', resourceId: null }], invited: true, inviteExpired: true },
  ]
  s.usage = recentUsage()
  s.activity = [
    makeEvent(10 * HOUR, 'Backed up myshop.frappe.cloud', { tag: 'backup', detail: 'Database 84 MB · files 12 MB. Kept for 30 days.' }),
    makeEvent(10 * HOUR + 60000, 'Backed up mycompany.frappe.cloud', { tag: 'backup', detail: 'Database 361 MB · files 51 MB. Kept for 30 days.' }),
    makeEvent(30 * HOUR, 'Updated your server to the latest Frappe release', { tag: 'server', detail: 'frappe v15.4.1 → v15.4.2 across both sites. No issues found.' }),
    makeEvent(2 * DAY, 'Installed Frappe CRM on myshop.frappe.cloud', { tag: 'app' }),
    makeEvent(3 * DAY, 'Created myshop.frappe.cloud', { tag: 'site' }),
    makeEvent(4 * DAY, "Couldn't install Frappe Insights on mycompany.frappe.cloud", {
      tag: 'app',
      status: 'failed',
      detail: 'Insights needs more memory than the Starter plan had at the time. The server has since been resized — installing again will work.',
    }),
    makeEvent(5 * DAY, 'Resized your server from Starter to Business', { tag: 'server' }),
    makeEvent(12 * DAY, 'Created mycompany.frappe.cloud', { tag: 'site' }),
  ]
  s.structureRevealed = true
  s.currentSiteId = server.sites[0].id
  return s
}

export const useCloudStore = defineStore('cloud', {
  state: freshState,

  getters: {
    // The individual's (only) server.
    server: (s) => s.servers[0] || null,

    allServers: (s) => s.servers,

    findServer() {
      return (id) => this.allServers.find((srv) => srv.id === id) || null
    },

    serverOfSite() {
      return (siteId) => this.allServers.find((srv) => srv.sites.some((st) => st.id === siteId)) || null
    },

    findSite() {
      return (siteId) => {
        for (const srv of this.allServers) {
          const site = srv.sites.find((st) => st.id === siteId)
          if (site) return site
        }
        return null
      }
    },

    currentSite() {
      return this.findSite(this.currentSiteId)
    },

    // The server whose section is pinned in the sidebar — survives visits to
    // Servers / Marketplace / Billing so context isn't lost.
    currentServer() {
      return this.currentServerId ? this.findServer(this.currentServerId) : null
    },

    // Account-wide credit across the user's servers.
    accountCredit() {
      return this.servers.reduce((sum, srv) => sum + srv.creditBalance, 0)
    },

    accountCreditTotal() {
      return this.servers.reduce((sum, srv) => sum + srv.creditTotal, 0)
    },

    // Trial = no card on file yet. The credit badge only shows for these users.
    isTrial: (s) => !s.cardOnFile,

    planOf: () => (server) => planById(server.planId),

    regionOf: () => (server) => regionById(server.regionId),

    // What this server actually costs in its region.
    monthlyPriceOf: () => (server) => {
      const base = planById(server.planId).priceMonthly
      return Math.round((base * regionById(server.regionId).priceFactor) / 50) * 50
    },

    // Informational per-day rate (monthly ÷ 30) — not a daily charge.
    perDayOf() {
      return (server) => Math.round(this.monthlyPriceOf(server) / CYCLE_DAYS)
    },

    // This cycle's estimated charge — every active (non-suspended) server.
    estimatedThisCycle() {
      return this.servers.reduce(
        (sum, srv) => (srv.status === 'suspended' ? sum : sum + this.monthlyPriceOf(srv)),
        0,
      )
    },

    // How this cycle's estimate compares to last cycle, as a signed %.
    estimateDeltaPct() {
      if (!this.lastCycleTotal) return 0
      return Math.round(((this.estimatedThisCycle - this.lastCycleTotal) / this.lastCycleTotal) * 100)
    },

    recommendedPlanId: (s) => TEAM_SIZE_TO_PLAN[s.onboarding.teamSize] || 'business',

    // One legible resource picture per server; disk scales with the plan.
    healthOf: () => (server) => {
      const plan = planById(server.planId)
      const diskTotal = parseInt(plan.specs.disk) || 50
      const diskUsed = Math.max(Math.round(diskTotal * server.health.diskFrac * 10) / 10, 0.5)
      const cpuPct = server.health.cpuPct
      const memPct = Math.round((server.health.memUsedGb / server.health.memTotalGb) * 100)
      const diskPct = Math.round((diskUsed / diskTotal) * 100)
      return {
        cpuPct,
        memPct,
        diskPct,
        memUsed: server.health.memUsedGb,
        memTotal: server.health.memTotalGb,
        diskUsed,
        diskTotal,
        ok: cpuPct < 80 && memPct < 85 && diskPct < 85,
      }
    },

    membersForRole() {
      return (roleId) => this.members.filter((m) => m.roles?.some((r) => r.roleId === roleId))
    },

    // The calm "update available" affordance — version on the site vs catalog.
    appUpdate: () => (app) => {
      const meta = appByKey(app.key)
      return meta && meta.latestVersion !== app.version ? meta.latestVersion : null
    },

    lastBackupOf: () => (site) => site.backups[0] || null,
  },

  actions: {
    loadScenario(name) {
      const states = {
        fresh: freshState,
        grown: grownState,
      }
      this.$state = (states[name] || freshState)()
    },

    // Runs `fn` after a short, realistic delay while the top progress bar
    // shows. Returns a promise so callers can `toast.promise(...)` on it.
    _work(fn, ms = 850) {
      this.busy++
      return new Promise((resolve) => {
        setTimeout(() => {
          let result
          try {
            result = fn()
          } finally {
            this.busy = Math.max(0, this.busy - 1)
          }
          resolve(result)
        }, ms)
      })
    },

    // Humanized history. Returns the entry id so async work can flip it later.
    logActivity(title, { tag = 'server', status = 'success', detail = null } = {}) {
      const entry = { id: uid('act'), at: Date.now(), title, tag, status, detail }
      this.activity.unshift(entry)
      return entry.id
    },

    flipActivity(id, { title, status = 'success', detail } = {}) {
      const entry = this.activity.find((e) => e.id === id)
      if (!entry) return
      entry.status = status
      if (title) entry.title = title
      if (detail !== undefined) entry.detail = detail
    },

    signUp(name, email) {
      this.user.name = name
      this.user.email = email
    },

    setTeamSize(size) {
      this.onboarding.teamSize = size
      this.onboarding.planId = TEAM_SIZE_TO_PLAN[size] || 'business'
    },

    choosePlan(planId) {
      this.onboarding.planId = planId
    },

    provisionServer() {
      if (this.server) return
      this.servers = [
        makeServer({
          planId: this.onboarding.planId,
          regionId: this.onboarding.regionId,
          status: 'provisioning',
        }),
      ]
      this.logActivity('Setting up your server', { tag: 'server', status: 'running' })
    },

    // A second (third…) server. The activity entry carries the price —
    // a new server is a new recurring charge, and the history should say so.
    addServer({ name, planId, regionId, version }) {
      const srv = makeServer({
        name: name || `My server ${this.servers.length + 1}`,
        planId: planId || 'business',
        regionId: regionId || 'aws-mumbai',
        version: version || 'v15',
        status: 'provisioning',
      })
      this.servers.push(srv)
      const actId = this.logActivity(
        `Setting up ${srv.name} in ${regionById(srv.regionId).name} (${versionById(srv.version).label}, ₹${this.monthlyPriceOf(srv).toLocaleString('en-IN')}/month)`,
        { tag: 'server', status: 'running' },
      )
      setTimeout(() => {
        const live = this.findServer(srv.id)
        if (live) live.status = 'active'
        this.flipActivity(actId, { title: `${srv.name} is ready` })
      }, 3500)
      return srv
    },

    // The architecture's "Move" primitive: a site relocates to another
    // server — which is also how a site changes Frappe version.
    moveSite(siteId, targetServerId) {
      const from = this.serverOfSite(siteId)
      const target = this.findServer(targetServerId)
      if (!from || !target || from.id === target.id) return null
      const i = from.sites.findIndex((st) => st.id === siteId)
      const [site] = from.sites.splice(i, 1)
      site.status = 'moving'
      target.sites.push(site)
      if (target.sites.length === 2) {
        this.structureRevealed = true
      }
      const actId = this.logActivity(`Moving ${site.name} to ${target.name}`, {
        tag: 'site',
        status: 'running',
      })
      setTimeout(() => {
        const live = target.sites.find((st) => st.id === siteId)
        if (live) live.status = 'live'
        this.flipActivity(actId, {
          title: `Moved ${site.name} to ${target.name}`,
          detail: `Now running ${versionById(target.version).label}. The address didn't change — visitors never noticed.`,
        })
      }, 5000)
      return site
    },

    completeProvisioning() {
      const srv = this.server
      if (!srv || srv.status === 'active') return
      srv.status = 'active'
      const running = this.activity.find((e) => e.status === 'running')
      if (running) this.flipActivity(running.id, { title: 'Server ready' })
      const subdomain = (this.onboarding.subdomain || '').trim() || 'mysite'
      const site = makeSite(subdomain, [this.onboarding.appKey])
      srv.sites.push(site)
      this.currentSiteId = site.id
      this.logActivity(`Created ${site.name}`, { tag: 'site' })
      this.logActivity(`Installed ${site.apps[0].name} on ${site.name}`, { tag: 'app' })
      const firstName = (this.user.name || '').split(' ')[0] || 'My'
      this.team.name = `${firstName}'s team`
      this.members = [
        { id: uid('mem'), name: this.user.name, email: this.user.email, roles: [{ roleId: 'role-owner', resourceId: null }] },
      ]
    },

    createSite(serverId, subdomain, appKey) {
      const srv = this.findServer(serverId)
      if (!srv) return null
      const site = makeSite(subdomain, [appKey], 'creating')
      srv.sites.push(site)
      // The signature moment: the second site gently reveals the structure.
      if (srv.sites.length === 2) {
        this.structureRevealed = true
        this.explainerDismissed = false
      }
      const actId = this.logActivity(`Creating ${site.name}`, { tag: 'site', status: 'running' })
      setTimeout(() => {
        // Re-resolve through reactive state — mutating the raw object
        // captured above wouldn't trigger a re-render.
        const live = srv.sites.find((st) => st.id === site.id)
        if (live) live.status = 'live'
        this.flipActivity(actId, { title: `Created ${site.name}` })
      }, 3500)
      return site
    },

    addApp(siteId, appKey) {
      return this._work(() => {
        const site = this.findSite(siteId)
        if (!site || site.apps.some((a) => a.key === appKey)) return null
        const app = makeApp(appKey)
        site.apps.push(app)
        this.logActivity(`Installed ${app.name} on ${site.name}`, { tag: 'app' })
        return app
      }, 1100)
    },

    uninstallApp(siteId, appKey) {
      return this._work(() => {
        const site = this.findSite(siteId)
        if (!site) return
        const i = site.apps.findIndex((a) => a.key === appKey)
        if (i === -1) return
        const [app] = site.apps.splice(i, 1)
        this.logActivity(`Uninstalled ${app.name} from ${site.name}`, { tag: 'app' })
      })
    },

    // Developer path: install straight from a GitHub repo.
    addCustomApp(siteId, { repo, branch }) {
      return this._work(() => {
        const site = this.findSite(siteId)
        if (!site) return null
        const tail = (repo.split('/').pop() || 'app').replace(/\.git$/, '')
        const name = tail.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        const app = { id: uid('app'), key: `gh-${slugify(tail)}`, name, version: branch || 'develop' }
        site.apps.push(app)
        this.logActivity(`Installed ${name} from GitHub on ${site.name}`, {
          tag: 'app',
          detail: `${repo} · ${branch || 'develop'} branch`,
        })
        return app
      }, 1400)
    },

    updateApp(siteId, appKey) {
      return this._work(() => {
        const site = this.findSite(siteId)
        const app = site?.apps.find((a) => a.key === appKey)
        const latest = this.appUpdate(app)
        if (!app || !latest) return
        app.version = latest
        this.logActivity(`Updated ${app.name} to ${latest} on ${site.name}`, { tag: 'app' })
      })
    },

    openSite(siteId) {
      this.currentSiteId = siteId
    },

    dropSite(serverId, siteId) {
      const srv = this.findServer(serverId)
      if (!srv) return
      const i = srv.sites.findIndex((st) => st.id === siteId)
      if (i === -1) return
      const [site] = srv.sites.splice(i, 1)
      if (this.currentSiteId === siteId) this.currentSiteId = srv.sites[0]?.id || null
      this.logActivity(`Deleted ${site.name}`, {
        tag: 'site',
        detail: 'Its backups are kept for 30 days in case you need them back.',
      })
    },

    backupNow(siteId) {
      return this._work(() => {
        const site = this.findSite(siteId)
        if (!site) return null
        const size = `${400 + site.apps.length * 6 + site.backups.length * 2} MB`
        const backup = { id: uid('bak'), at: Date.now(), size, kind: 'manual' }
        site.backups.unshift(backup)
        this.logActivity(`Backed up ${site.name}`, {
          tag: 'backup',
          detail: `Manual backup · ${size}. Kept for 30 days.`,
        })
        return backup
      }, 1400)
    },

    restoreBackup(siteId, backupId) {
      const site = this.findSite(siteId)
      const backup = site?.backups.find((b) => b.id === backupId)
      if (!site || !backup) return
      site.status = 'restoring'
      const actId = this.logActivity(`Restoring ${site.name} from the ${fmtDateTime(backup.at)} backup`, {
        tag: 'backup',
        status: 'running',
      })
      setTimeout(() => {
        const live = this.findSite(siteId)
        if (live) live.status = 'live'
        this.flipActivity(actId, { title: `Restored ${site.name} from the ${fmtDateTime(backup.at)} backup` })
      }, 3000)
    },

    setBackupSchedule(siteId, schedule) {
      const site = this.findSite(siteId)
      if (!site || site.backupSchedule === schedule) return
      site.backupSchedule = schedule
      return this._work(() => {
        const label = { daily: 'daily at 2 AM', weekly: 'weekly on Sundays', monthly: 'monthly' }[schedule]
        this.logActivity(`Set ${site.name} to back up ${label}`, { tag: 'backup' })
      }, 600)
    },

    toggleSiteConfig(siteId, key) {
      const site = this.findSite(siteId)
      if (!site) return
      site.config[key] = !site.config[key]
      const labels = { maintenance: 'maintenance mode', scheduler: 'background jobs', devMode: 'developer mode' }
      this.logActivity(`Turned ${site.config[key] ? 'on' : 'off'} ${labels[key]} on ${site.name}`, { tag: 'config' })
    },

    addDomain(siteId, name) {
      const site = this.findSite(siteId)
      if (!site) return null
      const domain = { id: uid('dom'), name, status: 'verifying', ssl: false }
      site.domains.push(domain)
      const actId = this.logActivity(`Checking DNS for ${name}`, { tag: 'domain', status: 'running' })
      setTimeout(() => {
        const live = this.findSite(siteId)?.domains.find((d) => d.id === domain.id)
        if (live) {
          live.status = 'active'
          live.ssl = true
        }
        this.flipActivity(actId, {
          title: `Connected ${name}`,
          detail: 'DNS verified and an SSL certificate was issued automatically.',
        })
      }, 4000)
      return domain
    },

    restartProcess(serverId, name) {
      const srv = this.findServer(serverId)
      const proc = srv?.processes.find((p) => p.name === name)
      if (!proc) return
      proc.status = 'restarting'
      const actId = this.logActivity(`Restarting the ${name} service`, { tag: 'process', status: 'running' })
      setTimeout(() => {
        const live = this.findServer(serverId)?.processes.find((p) => p.name === name)
        if (live) {
          live.status = 'running'
          live.uptime = 'just now'
        }
        this.flipActivity(actId, { title: `Restarted the ${name} service` })
      }, 2000)
    },

    resizeServer(serverId, planId) {
      const srv = this.findServer(serverId)
      if (!srv || srv.planId === planId) return
      const fromPlan = planById(srv.planId)
      const toPlan = planById(planId)
      const direction = toPlan.priceMonthly >= fromPlan.priceMonthly ? 'upgrade' : 'downgrade'
      return this._work(() => {
        srv.planId = planId
        srv.planHistory.unshift({
          id: uid('ph'),
          date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
          from: fromPlan.name,
          to: toPlan.name,
          direction,
        })
        this.logActivity(`Resized ${srv.name} from ${fromPlan.name} to ${toPlan.name}`, { tag: 'server' })
      }, 1400)
    },

    renameServer(serverId, name) {
      const srv = this.findServer(serverId)
      if (!srv || !name.trim()) return
      const old = srv.name
      srv.name = name.trim()
      this.logActivity(`Renamed ${old} to ${srv.name}`, { tag: 'server' })
    },

    restartServer(serverId) {
      const srv = this.findServer(serverId)
      if (!srv) return null
      return this._work(() => {
        this.logActivity(`Restarted ${srv.name}`, { tag: 'server' })
      }, 1500)
    },

    // A whole-server Frappe version change (up or down). Every site on the
    // server migrates to the new version — same transient as a site move.
    changeServerVersion(serverId, version) {
      const srv = this.findServer(serverId)
      if (!srv || srv.version === version) return null
      const from = versionById(srv.version).label
      const to = versionById(version).label
      srv.version = version
      const affected = srv.sites.filter((s) => s.status === 'live')
      affected.forEach((s) => (s.status = 'moving'))
      const actId = this.logActivity(`Changing ${srv.name} from ${from} to ${to}`, {
        tag: 'server',
        status: 'running',
      })
      setTimeout(() => {
        const live = this.findServer(serverId)
        if (live) live.sites.forEach((s) => { if (s.status === 'moving') s.status = 'live' })
        this.flipActivity(actId, {
          title: `Changed ${srv.name} to ${to}`,
          detail: affected.length
            ? `All ${affected.length} site${affected.length === 1 ? '' : 's'} now run ${to}. Their addresses didn't change.`
            : `${srv.name} now runs ${to}.`,
        })
      }, 4000)
      return srv
    },

    setServerSuspended(serverId, on) {
      const srv = this.findServer(serverId)
      if (!srv) return
      srv.status = on ? 'suspended' : 'active'
      for (const s of srv.sites) {
        if (on && s.status === 'live') s.status = 'suspended'
        else if (!on && s.status === 'suspended') s.status = 'live'
      }
      this.logActivity(on ? `Suspended ${srv.name}` : `Resumed ${srv.name}`, { tag: 'server' })
    },

    duplicateServer(serverId) {
      const srv = this.findServer(serverId)
      if (!srv) return null
      return this.addServer({
        name: `Copy of ${srv.name}`,
        planId: srv.planId,
        regionId: srv.regionId,
        version: srv.version,
      })
    },

    dropServer(serverId) {
      const i = this.servers.findIndex((s) => s.id === serverId)
      if (i === -1) return
      const [srv] = this.servers.splice(i, 1)
      if (this.currentServerId === serverId) this.currentServerId = null
      this.logActivity(`Dropped ${srv.name} and its sites`, {
        tag: 'server',
        detail: 'Backups are kept for 30 days.',
      })
    },

    // — Firewall
    addFirewallRule(serverId, { name, port, action }) {
      const srv = this.findServer(serverId)
      if (!srv) return
      srv.firewallRules.push({ id: uid('fw'), name, port: Number(port) || 0, action: action || 'Allow', enabled: true })
      this.logActivity(`Added firewall rule ${name} (port ${port}) on ${srv.name}`, { tag: 'server' })
    },
    toggleFirewallRule(serverId, ruleId) {
      const r = this.findServer(serverId)?.firewallRules.find((x) => x.id === ruleId)
      if (r) r.enabled = !r.enabled
    },
    removeFirewallRule(serverId, ruleId) {
      const srv = this.findServer(serverId)
      if (!srv) return
      const i = srv.firewallRules.findIndex((x) => x.id === ruleId)
      if (i !== -1) srv.firewallRules.splice(i, 1)
    },

    // — SSH keys
    addSshKey(serverId, { name }) {
      const srv = this.findServer(serverId)
      if (!srv) return
      srv.sshKeys.push({ id: uid('key'), name: name || 'new-key', fingerprint: 'SHA256:' + Math.random().toString(36).slice(2, 10) + '…' })
      this.logActivity(`Added SSH key ${name} on ${srv.name}`, { tag: 'server' })
    },
    removeSshKey(serverId, keyId) {
      const srv = this.findServer(serverId)
      if (!srv) return
      const i = srv.sshKeys.findIndex((k) => k.id === keyId)
      if (i !== -1) srv.sshKeys.splice(i, 1)
    },

    // — Billing
    addCredit(amount) {
      const srv = this.servers[0]
      const amt = Number(amount) || 0
      if (!srv || amt <= 0) return
      srv.creditBalance += amt
      srv.creditTotal += amt
      if (this.creditExpired && srv.creditBalance > 0) this.setCreditExpired(false)
      this.logActivity(`Added $${amt} credit`, { tag: 'billing' })
    },
    setAutoRecharge(on) {
      this.autoRecharge = on
      this.logActivity(on ? 'Turned on auto-recharge' : 'Turned off auto-recharge', { tag: 'billing' })
    },
    setUpiAutopay(on) {
      this.upiAutopay = on
      this.logActivity(on ? 'Set up UPI autopay' : 'Turned off UPI autopay', { tag: 'billing' })
    },
    setBillingProfile(patch) {
      this.billingProfile = { ...this.billingProfile, ...patch }
      this.logActivity('Updated billing details', { tag: 'billing' })
    },
    requestPayout() {
      const amt = this.payoutBalance
      this.payoutBalance = 0
      this.logActivity('Requested a marketplace payout', { tag: 'billing' })
      return amt
    },

    // — Wallet (₹ prepaid balance the monthly invoice draws from)
    addToWallet(amount) {
      const amt = Number(amount) || 0
      if (amt <= 0) return
      this.walletBalance += amt
      this.walletHistory.unshift({
        id: uid('wtx'),
        date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        type: 'topup',
        label: 'Added credit',
        amount: amt,
      })
      this.logActivity(`Added ₹${amt.toLocaleString('en-IN')} to your wallet`, { tag: 'billing' })
    },

    // — Payment methods (prioritized; primary charged first)
    addPaymentMethod(pm) {
      const first = this.paymentMethods.length === 0
      this.paymentMethods.push({ id: uid('pm'), primary: first, ...pm })
      this.logActivity(`Added a payment method (${pm.label || pm.kind})`, { tag: 'billing' })
    },
    removePaymentMethod(id) {
      const i = this.paymentMethods.findIndex((p) => p.id === id)
      if (i === -1) return
      const [removed] = this.paymentMethods.splice(i, 1)
      // If we removed the primary, promote the next one in line.
      if (removed.primary && this.paymentMethods.length) this.paymentMethods[0].primary = true
    },
    setPrimaryMethod(id) {
      const target = this.paymentMethods.find((p) => p.id === id)
      if (!target) return
      this.paymentMethods.forEach((p) => (p.primary = p.id === id))
      // Move the primary to the front so order reflects priority.
      this.paymentMethods.sort((a, b) => (b.primary === true) - (a.primary === true))
      this.logActivity(`Made ${target.label} ${target.detail} the primary payment method`, { tag: 'billing' })
    },

    // — Analytics
    setMetricAlert(serverId, { metric, threshold }) {
      const srv = this.findServer(serverId)
      if (!srv) return
      this.logActivity(`Set ${metric} alert at ${threshold}% on ${srv.name}`, { tag: 'server' })
    },

    addCard() {
      return this._work(() => {
        this.cardOnFile = true
        this.logActivity('Added a card ending 4242', { tag: 'billing' })
        // Adding a card instantly revives paused sites.
        if (this.creditExpired) this.setCreditExpired(false)
      })
    },

    // Demo: what running out of credit actually does — sites pause, data
    // stays, everything comes back the moment there's a way to pay.
    setCreditExpired(on) {
      this.creditExpired = on
      for (const srv of this.servers) {
        if (on) {
          srv.creditBalance = 0
          for (const site of srv.sites) {
            if (site.status === 'live') site.status = 'suspended'
          }
        } else {
          srv.creditBalance = Math.max(srv.creditTotal - 7, 3)
          for (const site of srv.sites) {
            if (site.status === 'suspended') site.status = 'live'
          }
        }
      }
      if (on) {
        this.logActivity('Credit ran out — your sites are paused', {
          tag: 'billing',
          status: 'failed',
          detail: 'Nothing is deleted. Add a card and your sites come back in seconds, exactly as they were.',
        })
      } else {
        this.logActivity('Sites are back up', { tag: 'billing' })
      }
    },

    dismissExplainer() {
      this.explainerDismissed = true
    },

    inviteMember(email, roleId = 'role-member', resourceId = null) {
      const name = email.split('@')[0].replace(/[._-]/g, ' ')
      this.members.push({ id: uid('mem'), name, email, roles: [{ roleId, resourceId }], invited: true, inviteExpired: false })
    },
    setMemberRoles(memberId, roles) {
      const m = this.members.find((x) => x.id === memberId)
      if (m) m.roles = roles
    },
    resendInvite() {},
    transferOwnership(fromId, toId) {
      const from = this.members.find((x) => x.id === fromId)
      const to = this.members.find((x) => x.id === toId)
      if (!from || !to) return
      from.roles = from.roles.filter((r) => r.roleId !== 'role-owner')
      if (!from.roles.length) from.roles.push({ roleId: 'role-admin', resourceId: null })
      to.roles = [{ roleId: 'role-owner', resourceId: null }, ...to.roles.filter((r) => r.roleId !== 'role-owner')]
    },
    revokeMember(memberId) {
      const i = this.members.findIndex((x) => x.id === memberId)
      if (i !== -1) this.members.splice(i, 1)
    },

    // — Roles
    addRole({ name, desc, permissions }) {
      this.roles.push({ id: uid('role'), name, desc: desc || 'Custom role', permissions: permissions ?? defaultPermissions() })
    },
    removeRole(roleId) {
      const i = this.roles.findIndex((r) => r.id === roleId && !r.system)
      if (i !== -1) this.roles.splice(i, 1)
    },

    setTeamName(name) {
      if (name.trim()) this.team.name = name.trim()
    },
    setTeamAvatar(dataUrl) {
      this.team.avatar = dataUrl
    },
    setRolePermission(roleId, key, value) {
      const r = this.roles.find((x) => x.id === roleId && !x.system)
      if (r) r.permissions[key] = value
    },

    // — Developer (account-level)
    regenerateApiKey() {
      const hex = '0123456789abcdef'
      let k = 'fc_live_'
      for (let i = 0; i < 16; i++) k += hex[Math.floor(Math.random() * 16)]
      this.apiKey = k
      this.logActivity('Regenerated API secret', { tag: 'config' })
    },
    addAccountSshKey({ name }) {
      this.accountSshKeys.push({
        id: uid('key'),
        name: name || 'new-key',
        fingerprint: 'SHA256:' + Math.random().toString(36).slice(2, 12),
        addedAt: Date.now(),
      })
    },
    removeAccountSshKey(id) {
      const i = this.accountSshKeys.findIndex((k) => k.id === id)
      if (i !== -1) this.accountSshKeys.splice(i, 1)
    },
    addWebhook({ url }) {
      this.webhooks.push({ id: uid('wh'), url, status: 'active' })
    },
    removeWebhook(id) {
      const i = this.webhooks.findIndex((w) => w.id === id)
      if (i !== -1) this.webhooks.splice(i, 1)
    },
  },
})

export { APP_CATALOG }

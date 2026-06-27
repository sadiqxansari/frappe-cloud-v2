import { defineStore } from 'pinia'
import { toast } from 'frappe-ui'
import { APP_CATALOG, PLANS, TEAM_SIZE_TO_PLAN, appByKey, latestBuildFor, planById, regionById, versionById } from '../data/catalog'

// Onboarding leads with the cheapest plan (lowest monthly price).
const CHEAPEST_PLAN_ID = PLANS.reduce((a, b) => (b.priceMonthly < a.priceMonthly ? b : a), PLANS[0]).id
import { BACKGROUND_JOBS, makeProcesses } from '../data/system'
import { fmtDateTime, slugify, usdToDisplay } from '../utils/format'

let n = 1000
const uid = (prefix) => `${prefix}-${n++}`

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Human label for a custom backup schedule (issue #40).
export function backupCustomLabel(custom) {
  if (!custom) return 'Custom'
  const time = `${String(custom.hour ?? 2).padStart(2, '0')}:00`
  if (custom.frequency === 'daily') return `Daily, ${time}`
  if (custom.frequency === 'monthly') return `Monthly, ${time}`
  return `Weekly, ${WEEKDAYS[custom.day ?? 0]} ${time}`
}

// Migration progress is simulated on a wall-clock: each of the 3 steps takes
// MIGRATION_STEP_MS, and completedSteps is derived from elapsed time rather
// than a chain of setTimeouts. This survives background-tab throttling and a
// page refresh (startedAt persists; on reload we recompute and catch up).
const MIGRATION_STEP_MS = 8000
const MIGRATION_TOTAL_STEPS = 3

// Sidebar collapse is one account-wide preference, remembered across pages and
// reloads (issue #3) — never derived per-page. Defaults to collapsed when unset.
function sidebarPref() {
  if (typeof localStorage === 'undefined') return true
  const v = localStorage.getItem('fc.sidebarCollapsed')
  return v === null ? true : v === 'true'
}

// Colour theme is the other account-wide preference. 'system' follows the OS;
// 'light'/'dark' pin it. Applied to the document root in App.vue.
function themePref() {
  if (typeof localStorage === 'undefined') return 'system'
  return localStorage.getItem('fc.theme') || 'system'
}

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

// The DNS records a user must add at their provider to point a custom domain at
// us: an A record to our inbound IP, plus a TXT challenge we verify ownership
// with. Host is the subdomain label ('@' for an apex domain).
function dnsRecordsFor(name, inboundIp) {
  const host = name.split('.').slice(0, -2).join('.') || '@'
  const challengeHost = host === '@' ? '_frappe-challenge' : `_frappe-challenge.${host}`
  // Deterministic pseudo-token (djb2) so the same domain always shows the same
  // challenge — no Math.random, which would change on every render.
  const token = [...name].reduce((a, c) => (a * 33 + c.charCodeAt(0)) >>> 0, 5381).toString(16)
  return [
    { type: 'A', host, value: inboundIp },
    { type: 'TXT', host: challengeHost, value: `fc-verify=${token}` },
  ]
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
    domains: [], // custom domains added on top of the default `name` host
    // The domain shown in the address bar; everything else 301-redirects to it.
    // `null` means the default `*.frappe.cloud` host is primary.
    primaryDomain: null,
    config: { maintenance: false, scheduler: true, devMode: false },
    backupSchedule: 'daily', // 'daily' | 'weekly' | 'monthly'
    backups: [], // { id, at, size, kind: 'auto' | 'manual' }
  }
}

function makeBackup(agoMs, size, kind = 'auto') {
  return { id: uid('bak'), at: Date.now() - agoMs, size, kind }
}

function makeServer(opts = {}) {
  const version = opts.version || 'v15'
  return {
    id: uid('srv'),
    name: 'My Server',
    regionId: 'aws-mumbai',
    version, // a server runs one Frappe version; sites inherit it
    build: latestBuildFor(version), // installed patch build; behind latest ⇒ update available (#24)
    scheduledUpdate: null, // { at, skipFailing } once the owner schedules updates (#42)
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
    // Account-wide preferences — see sidebarPref() / themePref().
    sidebarCollapsed: sidebarPref(),
    theme: themePref(), // 'system' | 'light' | 'dark'
    // Teams the signed-in user belongs to; the switcher (issue #7) flips
    // `currentTeamId`. `team` (getter) resolves to the active one.
    teams: [{ id: 'team-1', name: 'My team', avatar: null }],
    currentTeamId: 'team-1',
    usage: [],
    activity: [], // newest first — humanized history of everything done here
    // Background jobs shown on the server's Tasks page. Seeded with history;
    // real actions (install, update, SSL, …) unshift fresh entries via logTask.
    jobs: BACKGROUND_JOBS.map((j) => ({ ...j, steps: j.steps.map((s) => ({ ...s })) })),
    jobSeq: 5822, // next job id, continuing the seeded run numbers
    cardOnFile: false,
    // Settlement is automatic, not a user choice: wallet credit is used first
    // (prepaid), and whatever it doesn't cover is charged to the primary method
    // (postpaid fallback).
    autoRecharge: false,
    // When the wallet falls below `rechargeThreshold`, top it up by
    // `rechargeAmount` from the primary method (falling back to a backup).
    rechargeThreshold: 2000,
    rechargeAmount: 5000,
    // Cycle-estimate alert threshold (₹), or null when not set.
    budgetAlert: null,
    upiAutopay: false,
    // Prepaid Wallet (₹) — the monthly invoice draws from this first.
    walletBalance: 0,
    walletHistory: [], // { id, date, type: 'topup'|'charge'|'bonus', label, amount } — amount signed
    // Prioritized payment methods — primary is charged first, the rest are
    // automatic fallbacks. No user-facing gateway choice (auto by currency).
    paymentMethods: [],
    invoices: [], // { number, period, issued, status, items:[{label,plan,days,perDay,amount}] }
    marketplaceDeveloper: false, // enrolled as a marketplace app publisher (issue #19)
    payoutBalance: 0, // marketplace earnings available to withdraw (USD)
    payoutAccount: false, // a bank/recipient must be set up before a payout
    lastCycleTotal: 0, // previous cycle's charge, for the "vs last month" stat
    billingProfile: {
      taxRegion: 'IN',
      taxValue: '',
      address: '',
      billingEmail: '',
      invoiceRecipient: '',
      invoiceLanguage: 'en',
    },
    // Account-level developer credentials (Server → Settings → Developer).
    apiKey: 'fc_live_8f2a91c4e7b0d35a',
    accountSshKeys: [],
    webhooks: [],
    // Your unique referral code (Refer & Earn, in the profile modal).
    referralCode: '917eaaa5',
    // Linked Frappe Partner referral code, or '' when none.
    partnerCode: '',
    creditExpired: false,
    // Edge mode — a single demo toggle that pushes the whole account onto the
    // unhappy path: every action fails (see `_work`) and the data overlay
    // (see `setEdgeMode`) seeds worst-case states across surfaces.
    edgeMode: false,
    structureRevealed: false,
    // Sticky graduation flag (decision 9): flips true the moment a 2nd server
    // exists and never reverts — even if you later drop back to one. Drives the
    // Desk-vs-Central landing rule, so the home doesn't yank back and forth.
    centralUnlocked: false,
    // One-shot note shown on the next Central landing right after graduation.
    graduationNotice: false,
    explainerDismissed: false,
    currentSiteId: null,
    currentServerId: null, // last server entered — keeps sidebar context
    // Round-trip redirects (return-to-origin). The FC modal *launches*; some
    // actions redirect out (Pay → gateway, Upgrade → Server) and must bring the
    // user back where they were. This holds { label, path } while away; the
    // destination renders a ReturnBar, and completeAndReturn() routes back.
    returnContext: null,
    busy: 0, // in-flight work; drives the top progress bar
    onboarding: { appKey: 'erpnext', teamSize: 'small', planId: CHEAPEST_PLAN_ID, subdomain: '', regionId: 'aws-mumbai' },
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
    build: '15.78.1', // a patch behind latest — shows the "update available" flow (#24)
    planHistory: [
      { id: uid('ph'), date: '10 Jun 2026', from: 'Starter', to: 'Business', direction: 'upgrade' },
      { id: uid('ph'), date: '2 Mar 2026', from: 'Standard', to: 'Starter', direction: 'downgrade' },
      { id: uid('ph'), date: '14 Jan 2026', from: 'Growth', to: 'Standard', direction: 'downgrade' },
      { id: uid('ph'), date: '20 Nov 2025', from: 'Standard', to: 'Growth', direction: 'upgrade' },
      { id: uid('ph'), date: '3 Sep 2025', from: 'Starter', to: 'Standard', direction: 'upgrade' },
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
    planId: 'starter',
    creditBalance: 25,
    creditTotal: 25,
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
  s.teams = [
    { id: 'team-1', name: "Rahul's team", avatar: null },
    { id: 'team-2', name: 'Acme Innovations', avatar: null },
    { id: 'team-3', name: 'Side Projects', avatar: null },
  ]
  s.currentTeamId = 'team-1'
  // Create-sites is reserved for Admin roles (issue #7), so Support is view-only.
  s.roles.push({ id: 'role-support', name: 'Support', desc: 'View-only access to servers and sites', permissions: { ...defaultPermissions() } })
  // Wallet — prepaid balance the monthly invoice draws from.
  s.walletBalance = 8400
  s.walletHistory = [
    { id: uid('wtx'), date: '1 Jun 2026', type: 'charge', label: 'May 2026 invoice', amount: -6798 },
    { id: uid('wtx'), date: '20 May 2026', type: 'topup', label: 'Added credit', amount: 10000 },
    { id: uid('wtx'), date: '1 May 2026', type: 'charge', label: 'April 2026 invoice', amount: -4850 },
    { id: uid('wtx'), date: '12 Apr 2026', type: 'bonus', label: 'Referral bonus', amount: 500 },
    { id: uid('wtx'), date: '1 Apr 2026', type: 'charge', label: 'March 2026 invoice', amount: -2410 },
  ]
  s.budgetAlert = 20000 // alert when the cycle estimate crosses this
  // Exactly one primary + one backup. Primary is used first (charge or top-up),
  // the backup only if the primary fails. Visa expires soon — surfaced inline.
  s.paymentMethods = [
    { id: uid('pm'), kind: 'card', label: 'Visa', detail: '•••• 4242', expiry: '07/26', primary: true },
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
    {
      number: 'INV-2026-0002', period: 'February 2026', issued: '1 Mar 2026', status: 'Paid', credits: 0,
      items: [{ label: 'atlas-web-01', plan: 'Standard', days: 28, perDay: 68, amount: 1904 }],
    },
    {
      number: 'INV-2026-0001', period: 'January 2026', issued: '1 Feb 2026', status: 'Paid', credits: 0,
      items: [{ label: 'atlas-web-01', plan: 'Standard', days: 31, perDay: 68, amount: 2108 }],
    },
    {
      number: 'INV-2025-0012', period: 'December 2025', issued: '1 Jan 2026', status: 'Paid', credits: 0,
      items: [{ label: 'atlas-web-01', plan: 'Starter', days: 31, perDay: 40, amount: 1240 }],
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
  s.centralUnlocked = true // a fleet operator — Central has long been home
  s.currentSiteId = server.sites[0].id
  return s
}

// — Ravi: a solo, non-technical owner. One server, one site, one bill. He lives
// inside his app's Desk; the FC modal is his whole console (decision 2). Indian
// (₹ display), a paying customer (no trial badge). His site carries Frappe HR,
// which is a patch behind — so "App updates" has something to show.
function soloState() {
  const s = baseState()
  s.scenario = 'solo'
  s.user = { id: 'u-1', name: 'Ravi Kumar', email: 'ravi@ravibakes.in', role: 'individual' }

  const site = makeSite('ravibakes', ['erpnext', 'hr'])
  site.backups = [makeBackup(9 * HOUR, '128 MB'), makeBackup(33 * HOUR, '126 MB')]

  const server = makeServer({
    name: 'My Server',
    planId: 'business',
    regionId: 'aws-mumbai',
    creditBalance: 18,
    creditTotal: 25,
    sites: [site],
  })
  s.servers = [server]
  // A brand-new solo owner, still on trial credit — he hasn't set up billing
  // yet. His first "Add credit" runs the one-time billing FTU before any
  // gateway top-up (decision 5), reusing Central's billing-details + card flow.
  s.cardOnFile = false
  s.walletBalance = 0
  s.walletHistory = []
  s.paymentMethods = []
  s.billingProfile = {
    taxRegion: 'IN', taxValue: '', address: '',
    billingEmail: '', invoiceRecipient: '', invoiceLanguage: 'en',
  }
  s.teams = [{ id: 'team-1', name: "Ravi's team", avatar: null }]
  s.currentTeamId = 'team-1'
  s.members = [
    { id: uid('mem'), name: 'Ravi Kumar', email: 'ravi@ravibakes.in', roles: [{ roleId: 'role-owner', resourceId: null }] },
  ]
  s.invoices = [] // no billing history yet — still on trial credit
  s.activity = [
    makeEvent(9 * HOUR, 'Backed up ravibakes.frappe.cloud', { tag: 'backup', detail: 'Database 118 MB · files 10 MB. Kept for 30 days.' }),
    makeEvent(6 * DAY, 'Installed Frappe HR on ravibakes.frappe.cloud', { tag: 'app' }),
    makeEvent(12 * DAY, 'Created ravibakes.frappe.cloud', { tag: 'site' }),
  ]
  s.structureRevealed = false
  s.currentSiteId = site.id
  return s
}

export const useCloudStore = defineStore('cloud', {
  state: freshState,

  getters: {
    // The active team — every team-scoped surface reads identity from here.
    team: (s) => s.teams.find((t) => t.id === s.currentTeamId) || s.teams[0],

    // The individual's (only) server.
    server: (s) => s.servers[0] || null,

    allServers: (s) => s.servers,

    // How many servers the account has — forks the whole home experience.
    // 1 server (any number of sites) = Desk-home + FC modal; 2+ = Central-home
    // (decision 1). Many sites stay one bill, so they stay simple.
    serverCount: (s) => s.servers.length,
    isSingleServer: (s) => s.servers.length <= 1,

    // Whether the signed-in person may launch the Frappe Cloud modal from the
    // Desk. In production the Desk login is a *site* user; only those linked to
    // an FC member with billing/admin rights see it (decision 10). Mocked true
    // here — the demo personas are all the account owner. (Cross-site SSO that
    // resolves Desk session → FC member is the main production unknown.)
    canManageBilling: () => true,

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

    // One-currency display (decision 8). Indian accounts see ₹ everywhere; the
    // rest see $. Prices are already stored in ₹; only the $ credit needs
    // converting, so a single user never sees ₹ next to $.
    displayCurrency: (s) => (s.billingProfile.taxRegion === 'IN' ? 'INR' : 'USD'),

    // India sees Card + UPI (Stripe/Razorpay); elsewhere Card only (Stripe/PayPal).
    isIndia: (s) => s.billingProfile.taxRegion === 'IN',

    // Account credit rendered in the user's display currency (a number; format
    // with `money(creditDisplay, displayCurrency)`).
    creditDisplay() {
      return usdToDisplay(this.accountCredit, this.displayCurrency)
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

    // Always the cheapest plan — onboarding recommends starting small.
    recommendedPlanId: () => CHEAPEST_PLAN_ID,

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
        solo: soloState,
      }
      this.$state = (states[name] || freshState)()
    },

    // One account-wide sidebar preference, persisted so it survives page
    // switches and reloads (issue #3).
    setSidebarCollapsed(on) {
      this.sidebarCollapsed = on
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('fc.sidebarCollapsed', on ? 'true' : 'false')
      }
    },

    // Colour theme preference, persisted like the sidebar. App.vue watches
    // `theme` and applies it to the document root.
    setTheme(value) {
      this.theme = value
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('fc.theme', value)
      }
    },

    // — Teams. The switcher (issue #7) just flips the active team; in this
    // prototype the team is an identity, so switching is instant.
    switchTeam(id) {
      if (!this.teams.some((t) => t.id === id)) return
      this.currentTeamId = id
    },
    createTeam(name) {
      const t = { id: uid('team'), name: (name || '').trim() || 'New team', avatar: null }
      this.teams.push(t)
      this.currentTeamId = t.id
      return t
    },

    // Runs `fn` after a short, realistic delay while the top progress bar
    // shows. Returns a promise so callers can `toast.promise(...)` on it.
    _work(fn, ms = 850) {
      this.busy++
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          this.busy = Math.max(0, this.busy - 1)
          // Edge mode makes every action fail, so callers surface their error
          // toast + retry affordance. Callers wrap this in `toast.promise`.
          if (this.edgeMode) {
            reject(new Error('Something went wrong on our end. Please try again.'))
            return
          }
          try {
            resolve(fn())
          } catch (e) {
            reject(e)
          }
        }, ms)
      })
    },

    // Humanized history. Returns the entry id so async work can flip it later.
    logActivity(title, { tag = 'server', status = 'success', detail = null } = {}) {
      const entry = { id: uid('act'), at: Date.now(), title, tag, status, detail }
      this.activity.unshift(entry)
      return entry.id
    },

    // Record a background job for the Tasks page. Defaults to a single-step
    // success; pass `steps` for a richer breakdown (the Install/SSL flows do).
    logTask(name, { site = null, status = 'success', duration = null, steps = null } = {}) {
      const job = {
        id: `job-${this.jobSeq++}`,
        name,
        site,
        status,
        startedMinsAgo: 0,
        duration,
        steps: steps || [{ name, status, duration }],
      }
      this.jobs.unshift(job)
      return job.id
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

    setPartnerCode(code) {
      this.partnerCode = (code || '').trim()
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
      // Graduation (decision 9): crossing into a 2nd server makes Central home —
      // sticky from here on — and queues a one-time note for the next Central
      // landing. Self-initiated, because server creation is Central-only.
      if (this.servers.length === 2 && !this.centralUnlocked) {
        this.centralUnlocked = true
        this.graduationNotice = true
      }
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

    // A site can start with one or more apps (#35). `appKeys` is an array.
    createSite(serverId, subdomain, appKeys) {
      const srv = this.findServer(serverId)
      if (!srv) return null
      const keys = (Array.isArray(appKeys) ? appKeys : [appKeys]).filter(Boolean)
      const site = makeSite(subdomain, keys, 'creating')
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
        // The activity entry is the in-app notification; a toast confirms it too. (#35)
        this.flipActivity(actId, { title: `Created ${site.name}` })
        toast.success(`${site.name} is live`)
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
        this.logTask('Install App', {
          site: site.name,
          status: 'success',
          duration: '34s',
          steps: [
            { name: 'Resolve app dependencies', status: 'success', duration: '3s' },
            { name: 'Build assets', status: 'success', duration: '29s' },
            { name: 'Run migrations', status: 'success', duration: '2s' },
          ],
        })
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
        this.logTask('Uninstall App', { site: site.name, status: 'success', duration: '12s' })
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
        const from = app.version
        app.version = latest
        this.logActivity(`Updated ${app.name} to ${latest} on ${site.name}`, { tag: 'app' })
        this.logTask('Update App', {
          site: site.name,
          status: 'success',
          duration: '41s',
          steps: [
            { name: `Fetch ${app.name} ${latest}`, status: 'success', duration: '4s' },
            { name: 'Build assets', status: 'success', duration: '33s' },
            { name: `Migrate ${from} → ${latest}`, status: 'success', duration: '4s' },
          ],
        })
      })
    },

    openSite(siteId) {
      this.currentSiteId = siteId
    },

    // — Round-trip redirects (return-to-origin). The router is passed in to
    // avoid a circular import (router.js already imports this store).
    // `redirectWithReturn` stamps the origin, then navigates out; the
    // destination shows a ReturnBar. `completeAndReturn` routes back to the
    // stored origin, clears the context, and confirms with a toast.
    redirectWithReturn(router, target, ctx) {
      this.returnContext = ctx || null
      router.push(target)
    },
    completeAndReturn(router, message) {
      const ctx = this.returnContext
      this.returnContext = null
      router.push(ctx?.path || '/')
      if (message) toast.success(message)
    },
    clearReturnContext() {
      this.returnContext = null
    },

    // Acknowledge the one-time "you now have two servers" note (decision 9).
    dismissGraduationNotice() {
      this.graduationNotice = false
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
      if (!site || !backup) return Promise.resolve()
      site.status = 'restoring'
      const edge = this.edgeMode
      const actId = this.logActivity(`Restoring ${site.name} from the ${fmtDateTime(backup.at)} backup`, {
        tag: 'backup',
        status: 'running',
      })
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          const live = this.findSite(siteId)
          if (live) live.status = 'live' // the live site is always brought back up
          if (edge) {
            this.flipActivity(actId, {
              title: `Restore failed for ${site.name}`, status: 'failed',
              detail: 'The restore couldn’t complete. Your current data is untouched — try again or pick another backup.',
            })
            reject(new Error('Restore failed'))
          } else {
            this.flipActivity(actId, { title: `Restored ${site.name} from the ${fmtDateTime(backup.at)} backup` })
            resolve()
          }
        }, 3000)
      })
    },

    // `custom` (issue #40) is { frequency, day, hour } — stored on the site and
    // used to build a human label. Presets ignore it.
    setBackupSchedule(siteId, schedule, custom = null) {
      const site = this.findSite(siteId)
      if (!site) return
      if (schedule === 'custom') {
        site.backupCustom = custom
      } else if (site.backupSchedule === schedule) {
        return
      }
      site.backupSchedule = schedule
      return this._work(() => {
        const presets = { daily: 'daily at 2 AM', weekly: 'weekly on Sundays', monthly: 'monthly' }
        const label = schedule === 'custom' ? backupCustomLabel(custom) : presets[schedule]
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

    // Adding a domain does NOT auto-verify — we hand back the DNS records the
    // user must add at their provider and wait for them to verify. (#22)
    addDomain(siteId, name) {
      const site = this.findSite(siteId)
      if (!site) return null
      const inboundIp = this.serverOfSite(siteId)?.inboundIp || '13.200.157.65'
      const domain = { id: uid('dom'), name, status: 'pending', ssl: false, dnsRecords: dnsRecordsFor(name, inboundIp) }
      site.domains.push(domain)
      this.logActivity(`Added ${name} — awaiting DNS verification`, { tag: 'domain' })
      return domain
    },

    // Run DNS verification for a custom domain — used both for the first
    // "Verify" and for a "Retry" after a failure. In Edge mode it keeps failing
    // (the records still don't resolve); otherwise it connects and issues SSL.
    verifyDomain(siteId, domainId) {
      const d = this.findSite(siteId)?.domains.find((x) => x.id === domainId)
      if (!d) return
      d.status = 'verifying'
      const edge = this.edgeMode
      const actId = this.logActivity(`Checking DNS for ${d.name}`, { tag: 'domain', status: 'running' })
      setTimeout(() => {
        const live = this.findSite(siteId)?.domains.find((x) => x.id === domainId)
        if (!live) return
        if (edge) {
          live.status = 'failed'
          this.flipActivity(actId, {
            title: `DNS check failed for ${live.name}`, status: 'failed',
            detail: 'The records still don’t resolve. Double-check them with your DNS provider — changes can take up to an hour.',
          })
          this.logTask('Verify Domain', {
            site: live.name, status: 'failed', duration: '6s',
            steps: [
              { name: 'Look up DNS records', status: 'success', duration: '1s' },
              { name: 'Verify records resolve', status: 'failed', duration: '5s' },
            ],
          })
        } else {
          live.status = 'active'
          live.ssl = true
          this.flipActivity(actId, { title: `Connected ${live.name}` })
          this.logTask('Obtain SSL Certificate', {
            site: live.name, status: 'success', duration: '14s',
            steps: [
              { name: 'Verify DNS records', status: 'success', duration: '2s' },
              { name: 'Request certificate', status: 'success', duration: '9s' },
              { name: 'Install certificate', status: 'success', duration: '3s' },
            ],
          })
        }
      }, 2500)
    },

    // Promote a connected domain to primary — others 301-redirect to it.
    // `domainId === null` hands primary back to the default `*.frappe.cloud` host.
    setPrimaryDomain(siteId, domainId) {
      const site = this.findSite(siteId)
      if (!site) return
      site.primaryDomain = domainId
      const name = domainId ? site.domains.find((d) => d.id === domainId)?.name : site.name
      this.logActivity(`Made ${name} the primary domain for ${site.name}`, { tag: 'domain' })
    },

    // Unlink a custom domain — immediate, like the platforms (Vercel et al.):
    // the site stops resolving at that address and we drop its SSL. The DNS
    // records at the user's provider are theirs to clean up. The default
    // `*.frappe.cloud` host isn't a domain entry, so it can never land here.
    unlinkDomain(siteId, domainId) {
      const site = this.findSite(siteId)
      if (!site) return
      const i = site.domains.findIndex((d) => d.id === domainId)
      if (i === -1) return
      const [d] = site.domains.splice(i, 1)
      // If the primary was just removed, fall back to the default host.
      if (site.primaryDomain === domainId) site.primaryDomain = null
      this.logActivity(`Unlinked ${d.name} from ${site.name}`, { tag: 'domain' })
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

    // Migration is in-place — the same server entry changes status rather than
    // spawning a second one. `scheduledAt` (ISO string) defers the actual move.
    migrateServer(serverId, { planId, regionId, scheduledAt } = {}) {
      const srv = this.findServer(serverId)
      if (!srv) return
      // Clear any live timer before replacing the migration. A _tick/_schedule
      // restored from localStorage is just a stale number from a previous page
      // load, so clearing it here is a harmless no-op in this context.
      this._clearMigrationTimers(srv)
      srv.migration = {
        fromRegionId: srv.regionId,
        fromPlanId: srv.planId,
        toRegionId: regionId,
        toPlanId: planId || srv.planId,
        scheduledAt: scheduledAt || null,
        completedSteps: 0,
        paused: false,
        startedAt: null, // set when the move actually begins (after any schedule)
        elapsedBeforePause: 0, // banked run time, so pause/resume stays accurate
        _tick: null, // setInterval id (transient; recreated, never trusted from storage)
        _schedule: null, // setTimeout id for a deferred (scheduled) start
        _actId: null,
      }
      if (scheduledAt) {
        srv.status = 'migration-scheduled'
        // Demo: treat the scheduled time as at most 8 s away so reviewers
        // can observe the flow without waiting for a real future timestamp.
        const msUntil = Math.min(Math.max(new Date(scheduledAt) - Date.now(), 1000), 8000)
        srv.migration._schedule = setTimeout(() => this._runMigration(serverId), msUntil)
      } else {
        this._runMigration(serverId)
      }
    },

    _runMigration(serverId) {
      const srv = this.findServer(serverId)
      if (!srv?.migration) return
      srv.status = 'migrating'
      srv.sites.forEach((s) => { s.status = 'moving' })
      const fromRegion = regionById(srv.migration.fromRegionId)
      const toRegion = regionById(srv.migration.toRegionId)
      const actId = this.logActivity(
        `Migrating ${srv.name} from ${fromRegion.name} to ${toRegion.name}`,
        { tag: 'server', status: 'running' },
      )
      srv.migration._actId = actId
      srv.migration.startedAt = Date.now()
      srv.migration.elapsedBeforePause = 0
      this._startMigrationTick(serverId)
    },

    _clearMigrationTimers(srv) {
      const mig = srv?.migration
      if (!mig) return
      if (mig._tick) clearInterval(mig._tick)
      if (mig._schedule) clearTimeout(mig._schedule)
      mig._tick = null
      mig._schedule = null
    },

    // Drive progress from a single 1 s interval that recomputes from the clock.
    // Resilient to throttling/refresh because the source of truth is elapsed
    // time, not the number of times a callback happened to fire.
    _startMigrationTick(serverId) {
      const srv = this.findServer(serverId)
      if (!srv?.migration || srv.migration.paused) return
      this._clearMigrationTimers(srv)
      this.syncMigration(serverId) // catch up immediately (may finalize)
      if (!srv.migration) return // syncMigration completed it
      srv.migration._tick = setInterval(() => this.syncMigration(serverId), 1000)
    },

    // Recompute completedSteps from wall-clock elapsed time and finalize when
    // the full duration has passed. Safe to call any time (tick, focus, reload).
    syncMigration(serverId) {
      const srv = this.findServer(serverId)
      const mig = srv?.migration
      if (!mig || !mig.startedAt) return
      const elapsed = mig.elapsedBeforePause + (mig.paused ? 0 : Date.now() - mig.startedAt)
      const steps = Math.max(0, Math.min(MIGRATION_TOTAL_STEPS, Math.floor(elapsed / MIGRATION_STEP_MS)))
      if (steps !== mig.completedSteps) mig.completedSteps = steps
      if (steps >= MIGRATION_TOTAL_STEPS) {
        this._clearMigrationTimers(srv)
        this._completeMigration(serverId)
      }
    },

    // After a refresh the store is restored from localStorage but live timers
    // are not — re-arm any in-flight or scheduled migration from persisted state.
    resumeMigrations() {
      this.allServers.forEach((srv) => {
        const mig = srv.migration
        if (!mig) return
        mig._tick = null
        mig._schedule = null
        if (srv.status === 'migrating' && mig.startedAt) {
          this._startMigrationTick(srv.id)
        } else if (srv.status === 'migration-scheduled' && mig.scheduledAt) {
          const msUntil = Math.min(Math.max(new Date(mig.scheduledAt) - Date.now(), 1000), 8000)
          mig._schedule = setTimeout(() => this._runMigration(srv.id), msUntil)
        }
      })
    },

    _completeMigration(serverId) {
      const srv = this.findServer(serverId)
      if (!srv?.migration) return
      const toRegion = regionById(srv.migration.toRegionId)
      const toPlanId = srv.migration.toPlanId
      const fromPlanId = srv.migration.fromPlanId
      const actId = srv.migration._actId
      srv.regionId = srv.migration.toRegionId
      srv.planId = toPlanId
      srv.sites.forEach((s) => { if (s.status === 'moving') s.status = 'live' })
      if (toPlanId !== fromPlanId) {
        const fromPlan = planById(fromPlanId)
        const toPlan = planById(toPlanId)
        const direction = toPlan.priceMonthly >= fromPlan.priceMonthly ? 'upgrade' : 'downgrade'
        srv.planHistory.unshift({
          id: uid('ph'),
          date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
          from: fromPlan.name,
          to: toPlan.name,
          direction,
        })
      }
      srv.migration = null
      srv.status = 'active'
      if (actId) {
        this.flipActivity(actId, {
          title: `Migrated ${srv.name} to ${toRegion.name}`,
          detail: `Now running in ${toRegion.name} (${toRegion.provider}). Site URLs didn't change — visitors never noticed.`,
        })
      }
    },

    pauseMigration(serverId) {
      const srv = this.findServer(serverId)
      const mig = srv?.migration
      if (!mig || mig.paused) return
      // Bank the run time accumulated so far, then stop the clock.
      if (mig.startedAt) mig.elapsedBeforePause += Date.now() - mig.startedAt
      mig.paused = true
      this._clearMigrationTimers(srv)
    },

    resumeMigration(serverId) {
      const srv = this.findServer(serverId)
      const mig = srv?.migration
      if (!mig || !mig.paused) return
      mig.paused = false
      mig.startedAt = Date.now() // elapsedBeforePause already holds the banked time
      this._startMigrationTick(serverId)
    },

    cancelMigration(serverId) {
      const srv = this.findServer(serverId)
      if (!srv) return
      this._clearMigrationTimers(srv)
      srv.migration = null
      srv.status = 'active'
      srv.sites.forEach((s) => { if (s.status === 'moving') s.status = 'live' })
      this.logActivity(`Cancelled migration for ${srv.name}`, { tag: 'server' })
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

    // Server-level patch update — apply the latest build *within* the current
    // major (e.g. 15.78.1 → 15.78.4). Unlike a version change this doesn't move
    // anyone across majors; a backup is taken and sites blip briefly. (#24)
    updateServer(serverId) {
      const srv = this.findServer(serverId)
      if (!srv) return null
      const to = latestBuildFor(srv.version)
      if (srv.build === to) return null
      const from = srv.build
      const actId = this.logActivity(`Updating ${srv.name} to Frappe ${to}`, {
        tag: 'server',
        status: 'running',
      })
      return this._work(() => {
        const live = this.findServer(serverId)
        if (live) live.build = to
        this.flipActivity(actId, {
          title: `Updated ${srv.name} to Frappe ${to}`,
          detail: `${from} → ${to} across ${srv.sites.length} site${srv.sites.length === 1 ? '' : 's'}. A backup was taken first.`,
          status: 'success',
        })
      }, 1800)
    },

    // Update a chosen set of app updates across the server's sites, together in
    // one run (issue #42). `refs` is [{ siteId, appKey }].
    updateApps(serverId, refs = [], { skipFailing = false } = {}) {
      const srv = this.findServer(serverId)
      if (!srv || !refs.length) return null
      const n = refs.length
      const actId = this.logActivity(`Updating ${n} app${n === 1 ? '' : 's'} on ${srv.name}`, { tag: 'app', status: 'running' })
      return this._work(() => {
        const live = this.findServer(serverId)
        if (live) live.scheduledUpdate = null // applying clears any pending schedule
        for (const j of refs) {
          const app = this.findSite(j.siteId)?.apps.find((a) => a.key === j.appKey)
          const latest = app && this.appUpdate(app)
          if (app && latest) app.version = latest
        }
        this.flipActivity(actId, {
          title: `Updated ${n} app${n === 1 ? '' : 's'} on ${srv.name}`,
          detail: `${skipFailing ? 'Failing patches skipped. ' : ''}A backup was taken first.`,
          status: 'success',
        })
      }, 2000)
    },
    // Schedule app updates for later (issue #42).
    scheduleServerUpdate(serverId, { at, skipFailing = false }) {
      const srv = this.findServer(serverId)
      if (!srv || !at) return
      srv.scheduledUpdate = { at, skipFailing }
      this.logActivity(`Scheduled app updates for ${srv.name}`, { tag: 'app', detail: `Runs ${at}${skipFailing ? ' · skips failing patches' : ''}.` })
    },
    cancelScheduledUpdate(serverId) {
      const srv = this.findServer(serverId)
      if (!srv || !srv.scheduledUpdate) return
      srv.scheduledUpdate = null
      this.logActivity(`Cancelled scheduled updates for ${srv.name}`, { tag: 'server' })
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

    // Stop billing by *suspending* every server (its sites go offline). Nothing
    // is deleted — this is fully reversible via resumeBilling(). Returns the
    // names that were actually suspended (already-suspended ones are skipped).
    stopBilling() {
      const suspended = []
      this.servers.forEach((srv) => {
        if (srv.status === 'suspended') return
        srv.status = 'suspended'
        srv.sites.forEach((st) => { if (st.status === 'live') st.status = 'suspended' })
        suspended.push(srv.name)
      })
      this.logActivity('Stopped billing — suspended all servers', {
        tag: 'billing',
        detail: 'Sites are offline until you resume. Usage up to today is billed in your next invoice. Nothing was deleted.',
      })
      return { suspended }
    },

    // Resume billing by bringing every suspended server (and its sites) back.
    resumeBilling() {
      const resumed = []
      this.servers.forEach((srv) => {
        if (srv.status !== 'suspended') return
        srv.status = 'active'
        srv.sites.forEach((st) => { if (st.status === 'suspended') st.status = 'live' })
        resumed.push(srv.name)
      })
      this.logActivity('Resumed billing — brought all servers back online', { tag: 'billing' })
      return { resumed }
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
    setBudget(amount) {
      const amt = Number(amount)
      this.budgetAlert = amt > 0 ? amt : null
      this.logActivity(this.budgetAlert ? `Set a budget alert at ₹${this.budgetAlert.toLocaleString('en-IN')}` : 'Cleared the budget alert', { tag: 'billing' })
    },
    setAutoRecharge(on) {
      this.autoRecharge = on
      this.logActivity(on ? 'Turned on auto-recharge' : 'Turned off auto-recharge', { tag: 'billing' })
    },
    setRecharge({ threshold, amount }) {
      if (Number(threshold) > 0) this.rechargeThreshold = Number(threshold)
      if (Number(amount) > 0) this.rechargeAmount = Number(amount)
      this.logActivity('Updated auto-recharge settings', { tag: 'billing' })
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
    setPayoutAccount(on) {
      this.payoutAccount = on
      if (on) this.logActivity('Connected a payout bank account', { tag: 'billing' })
    },
    // Enrol as a marketplace developer so payouts become relevant (issue #19).
    becomeMarketplaceDeveloper() {
      this.marketplaceDeveloper = true
      this.logActivity('Became a marketplace developer', { tag: 'billing' })
    },

    // Net amount still owed on an invoice (subtotal + 18% GST − credits already
    // applied). Shared by the panel preview and payInvoice so they never drift.
    invoiceDue(inv) {
      const subtotal = inv.items.reduce((s, i) => s + i.amount, 0)
      const tax = Math.round(subtotal * 0.18)
      return subtotal + tax - (inv.credits || 0)
    },

    // Settle an outstanding invoice. Wallet credit is *always* applied first,
    // then the remainder goes to the primary method (auto-falling back to a
    // backup). Goes through `_work`, so Edge mode makes it fail (and rolls back,
    // since the mutation only runs on success) and the page shows the retry toast.
    payInvoice(number) {
      return this._work(() => {
        const inv = this.invoices.find((i) => i.number === number)
        if (!inv) return
        const fromWallet = Math.min(this.walletBalance, this.invoiceDue(inv))
        if (fromWallet > 0) {
          this.walletBalance -= fromWallet
          inv.credits = (inv.credits || 0) + fromWallet
          this.walletHistory.unshift({
            id: uid('wtx'),
            date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
            type: 'charge', label: `Applied to ${number}`, amount: -fromWallet,
          })
        }
        inv.status = 'Paid'
        inv.overdue = false
        this.logActivity(`Paid invoice ${number}`, { tag: 'billing' })
      }, 1200)
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

    // — Payment methods. One is primary (used first); the rest are automatic
    // fallbacks, tried in order. You can add as many as you like.
    addPaymentMethod(pm) {
      const first = this.paymentMethods.length === 0
      this.paymentMethods.push({ id: uid('pm'), primary: first, ...pm })
      this.logActivity(`Added a payment method (${pm.label || pm.kind})`, { tag: 'billing' })
    },
    // A gateway (Stripe/Razorpay/PayPal) collects the real card/UPI — we only
    // record the kind and which gateway. Shared by the in-page Razorpay checkout
    // and the redirect gateway page.
    addPaymentMethodViaGateway({ kind, gateway, editingId = null }) {
      const label = kind === 'upi' ? 'UPI' : 'Card'
      const detail = `via ${gateway}`
      if (editingId) this.updatePaymentMethod(editingId, { kind, label, detail, status: null })
      else this.addPaymentMethod({ kind, label, detail, gateway })
    },
    updatePaymentMethod(id, patch) {
      const pm = this.paymentMethods.find((p) => p.id === id)
      if (!pm) return
      Object.assign(pm, patch)
      this.logActivity(`Updated ${pm.label} ${pm.detail}`, { tag: 'billing' })
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

    // The single "Edge mode" demo toggle. ON loads the grown baseline, overlays
    // worst-case problem-data across every surface, then flips `edgeMode` so all
    // `_work` actions also fail. OFF restores the clean grown baseline.
    setEdgeMode(on) {
      this.loadScenario('grown') // clean baseline first (resets edgeMode → false)
      if (!on) return

      // — Server lifecycle: one suspended for billing, the broken one stays.
      const sg = this.servers.find((s) => s.name === 'atlas-sg-01')
      if (sg) {
        sg.status = 'suspended'
        sg.sites.forEach((st) => { if (st.status === 'live') st.status = 'suspended' })
      }

      // — Payment: *every* method declined, so nothing can be charged — not the
      // primary, not the backup, not auto-recharge. This is the true worst case
      // that justifies the overdue invoice and suspended server below. (A primary
      // declining while a backup still works is a milder, non-blocking state the
      // billing page handles separately — see CentralBillingPage.)
      this.paymentMethods.forEach((p) => { p.status = 'declined' })
      this.autoRecharge = true

      // — Wallet won't cover the next invoice.
      this.walletBalance = 1240

      // — An overdue, unpaid invoice at the top of the list.
      this.invoices.unshift({
        number: 'INV-2026-0006', period: 'June 2026', issued: '1 Jun 2026',
        status: 'Unpaid', overdue: true, dueDate: '8 Jun 2026', credits: 0,
        items: [
          { label: 'atlas-web-01', plan: 'Business', days: 30, perDay: 137, amount: 4110 },
          { label: 'atlas-eu-01', plan: 'Standard', days: 30, perDay: 55, amount: 1650 },
        ],
      })

      // — Marketplace earnings, but no payout account to send them to.
      this.marketplaceDeveloper = true
      this.payoutBalance = 480
      this.payoutAccount = false

      // — Tax ID required for the region but missing; invoice email bouncing.
      this.billingProfile.taxValue = ''
      this.billingProfile.emailBounced = true

      // — A custom domain whose DNS never verified (show the exact records).
      const site = this.servers[0]?.sites[0]
      if (site) {
        site.domains.push({
          id: uid('dom'), name: 'shop.mycompany.in', status: 'failed', ssl: false,
          dnsRecords: [
            { type: 'A', host: 'shop', value: this.servers[0].inboundIp },
            { type: 'TXT', host: '_frappe-challenge.shop', value: 'fc-verify=8f2a91c4e7b0' },
          ],
        })
      }

      // — A webhook that keeps failing delivery.
      this.webhooks.push({
        id: uid('wh'), url: 'https://hooks.mycompany.in/fc', status: 'failing',
        lastError: '500 from endpoint · last 6 attempts failed',
      })

      this.edgeMode = true
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
      if (!m) return
      m.roles = roles
      // Owner is exclusive across the team — only one at a time (issue #7).
      if (roles.some((r) => r.roleId === 'role-owner')) this._demoteOtherOwners(memberId)
    },
    // Assign an existing team member to a role directly — no invite (issue #7).
    // Owner replaces all other roles and demotes the previous owner.
    addMemberToRole(roleId, memberId, resourceId = null) {
      const m = this.members.find((x) => x.id === memberId)
      if (!m) return
      // Already holds this role for this exact scope — nothing to add.
      if (m.roles?.some((r) => r.roleId === roleId && (r.resourceId || null) === (resourceId || null))) return
      if (roleId === 'role-owner') {
        m.roles = [{ roleId: 'role-owner', resourceId: null }]
        this._demoteOtherOwners(memberId)
      } else {
        m.roles = [...(m.roles || []), { roleId, resourceId: resourceId || null }]
      }
    },
    // Strip Owner from everyone but `keepId`, leaving them Admin so they keep
    // useful access. Keeps the "one owner" invariant whenever owner is granted.
    _demoteOtherOwners(keepId) {
      for (const m of this.members) {
        if (m.id === keepId) continue
        if (m.roles?.some((r) => r.roleId === 'role-owner')) {
          m.roles = m.roles.filter((r) => r.roleId !== 'role-owner')
          if (!m.roles.length) m.roles.push({ roleId: 'role-admin', resourceId: null })
        }
      }
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
    // Send a test delivery. Goes through `_work`, so Edge mode keeps it failing;
    // otherwise it recovers the webhook to a healthy state.
    testWebhook(id) {
      return this._work(() => {
        const w = this.webhooks.find((x) => x.id === id)
        if (!w) return
        w.status = 'active'
        delete w.lastError
        this.logActivity(`Sent a test event to ${w.url}`, { tag: 'config' })
      }, 1000)
    },
    removeWebhook(id) {
      const i = this.webhooks.findIndex((w) => w.id === id)
      if (i !== -1) this.webhooks.splice(i, 1)
    },
  },
})

export { APP_CATALOG }

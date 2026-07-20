// Seed data for the DB analyzer (Dev tools). Two levels: a server-wide storage
// picture (what's eating the disk — usually binary logs) and a per-site
// database blob (tables, slow queries, indexes). Everything is generated
// deterministically from ids so numbers stay put across reloads, and cached as
// reactive objects so actions (kill, optimize, purge, drop) survive
// drilling in and out of a site. Scenario switches remount the app, so the
// cache never needs invalidating.

import { reactive } from 'vue'
import { APP_CATALOG } from './catalog'

// — Deterministic PRNG: hash an id string into a mulberry32 generator.
function seedFrom(str) {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return h >>> 0
}

function rng(seedStr) {
  let a = seedFrom(seedStr)
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = (r, arr) => arr[Math.floor(r() * arr.length)]
const between = (r, lo, hi) => lo + r() * (hi - lo)
const round1 = (v) => Math.round(v * 10) / 10

// ————————————————————————————————————————————————————————————— site level —

const TABLE_POOL = [
  'tabVersion', 'tabGL Entry', 'tabError Log', 'tabActivity Log',
  'tabSales Invoice', 'tabStock Ledger Entry', 'tabCommunication',
  'tabEmail Queue', 'tabNotification Log', 'tabFile', 'tabItem',
  'tabTimesheet', 'tabLead', 'tabSingles',
]

const SLOW_QUERY_POOL = [
  'SELECT … FROM `tabGL Entry` WHERE `account` LIKE ?',
  'SELECT … FROM `tabVersion` WHERE `ref_doctype` = ? ORDER BY `creation` DESC',
  'SELECT COUNT(*) FROM `tabError Log`',
  'SELECT * FROM `tabStock Ledger Entry` WHERE `item_code` = ? ORDER BY `posting_date`',
  'SELECT … FROM `tabCommunication` WHERE `reference_name` = ? AND `communication_type` = ?',
  'UPDATE `tabEmail Queue` SET `status` = ? WHERE `modified` < ?',
]

const INDEX_SUGGESTIONS = [
  { table: 'tabGL Entry', columns: ['account', 'posting_date'], reason: 'Filtered often with no covering index' },
  { table: 'tabSales Invoice', columns: ['customer', 'status'], reason: 'Frequent filter, full scans observed' },
  { table: 'tabCommunication', columns: ['reference_name'], reason: 'Joined on every timeline load' },
  { table: 'tabStock Ledger Entry', columns: ['item_code', 'warehouse'], reason: 'Range scans on every stock report' },
]

const FULL_SCAN_QUERY_POOL = [
  { digest: 'SELECT * FROM `tabItem` WHERE `disabled` = 0', table: 'tabItem' },
  { digest: 'SELECT … FROM `tabFile` WHERE `attached_to_name` = ?', table: 'tabFile' },
  { digest: 'SELECT COUNT(*) FROM `tabNotification Log` WHERE `for_user` = ?', table: 'tabNotification Log' },
  { digest: 'SELECT * FROM `tabLead` WHERE `status` = ?', table: 'tabLead' },
]

const REDUNDANT_INDEX_POOL = [
  { table: 'tabSales Invoice', index: 'customer_idx', redundantWith: 'customer_status_idx' },
  { table: 'tabGL Entry', index: 'account_idx', redundantWith: 'account_posting_date_idx' },
]

function makeSiteDb(site) {
  const r = rng(site.id)
  const appFactor = 1 + (site.apps?.length || 1) * 0.6

  const tableCount = 5 + Math.floor(r() * 3)
  const names = [...TABLE_POOL].sort(() => r() - 0.5).slice(0, tableCount)
  const tables = names
    .map((name) => {
      const dataMb = Math.round(between(r, 8, 180) * appFactor)
      return {
        name,
        rows: Math.round(dataMb * between(r, 2500, 9000)),
        dataMb,
        indexMb: Math.round(dataMb * between(r, 0.12, 0.4)),
        // Deleted/updated rows leave space behind; only some tables have much.
        claimableMb: r() < 0.55 ? Math.round(dataMb * between(r, 0.05, 0.3)) : 0,
      }
    })
    .sort((a, b) => b.dataMb - a.dataMb)

  const sum = (key) => tables.reduce((a, t) => a + t[key], 0)
  const slowCount = 2 + Math.floor(r() * 3)
  // Time-consuming/full-scan queries and index suggestions all read from
  // performance_schema, unlike slow queries (the slow query log) — so a site
  // whose server has it turned off still gets a useful slow-query list, just
  // not the deeper analysis.
  const perfSchemaEnabled = r() < 0.8
  return {
    siteId: site.id,
    siteName: site.name,
    dbName: '_' + seedFrom(site.id).toString(16).padStart(8, '0') + seedFrom(site.name).toString(16).slice(0, 8),
    size: { dataMb: sum('dataMb'), indexMb: sum('indexMb'), claimableMb: sum('claimableMb') },
    tables,
    perfSchemaEnabled,
    slowQueries: [...SLOW_QUERY_POOL]
      .sort(() => r() - 0.5)
      .slice(0, slowCount)
      .map((digest) => {
        const calls = Math.round(between(r, 800, 20000))
        const avgMs = Math.round(between(r, 250, 950))
        return { digest, calls, avgMs, rowsAvg: Math.round(between(r, 1, 6000)), totalSec: Math.round((calls * avgMs) / 1000) }
      })
      .sort((a, b) => b.totalSec - a.totalSec),
    timeConsumingQueries: [...SLOW_QUERY_POOL]
      .sort(() => r() - 0.5)
      .slice(0, 2 + Math.floor(r() * 2))
      .map((digest) => {
        const calls = Math.round(between(r, 2000, 40000))
        const avgMs = Math.round(between(r, 50, 400))
        return { digest, calls, avgMs, totalSec: Math.round((calls * avgMs) / 1000) }
      })
      .sort((a, b) => b.totalSec - a.totalSec),
    fullTableScanQueries: [...FULL_SCAN_QUERY_POOL]
      .sort(() => r() - 0.5)
      .slice(0, 1 + Math.floor(r() * 2))
      .map((q) => ({ ...q, rowsExamined: Math.round(between(r, 5000, 400000)), calls: Math.round(between(r, 50, 2000)) }))
      .sort((a, b) => b.rowsExamined - a.rowsExamined),
    suggestedIndexes: [...INDEX_SUGGESTIONS]
      .sort(() => r() - 0.5)
      .slice(0, 1 + Math.floor(r() * 2))
      .map((s) => ({ ...s, estGainPct: Math.round(between(r, 25, 80)) })),
    redundantIndexes:
      r() < 0.5 ? [{ ...pick(r, REDUNDANT_INDEX_POOL), sizeMb: Math.round(between(r, 4, 30)) }] : [],
    unusedIndexes:
      r() < 0.7
        ? [{ table: pick(r, names), name: 'owner_creation_idx', sizeMb: Math.round(between(r, 3, 24)), lastUsed: 'never' }]
        : [],
  }
}

export const dbFileMb = (db) => db.size.dataMb + db.size.indexMb + db.size.claimableMb

// ——————————————————————————————————————————————————————————— server level —

// Partition the server's used disk into named buckets. Databases are the real
// sum of the site databases; binary logs take the lion's share of what's left
// (that's the production reality this tool exists to surface).
// The schemas MariaDB keeps for itself. They consume real disk and show up in
// the database list like any other — but they're not sites, so they can't be
// drilled into. `mysql` (grants, plugins) is the heavy one; `sys` is a sliver.
function makeSystemDbs(server) {
  const r = rng(server.id + ':sysdb')
  const defs = [
    { name: 'mysql', lo: 620, hi: 1100 },
    { name: 'performance_schema', lo: 160, hi: 400 },
    { name: 'sys', lo: 4, hi: 20 },
  ]
  return defs.map((d) => ({
    siteId: null,
    siteName: d.name,
    dbName: d.name,
    system: true,
    size: { dataMb: Math.round(between(r, d.lo, d.hi)), indexMb: 0, claimableMb: 0 },
    tables: [],
  }))
}

function makeServerStorage(server, siteDbs, disk) {
  const r = rng(server.id + ':storage')
  const used = disk.used
  const systemDbs = makeSystemDbs(server)
  const databases = [...siteDbs, ...systemDbs].reduce((a, db) => a + dbFileMb(db), 0) / 1024

  const os = round1(Math.min(7, used * 0.28))
  const mariadbCore = round1(Math.min(3, used * 0.05))
  const systemFiles = round1(Math.min(0.4, used * 0.02))
  const errorLog = 0.013
  const slowLog = 0.006
  const binlogIndexes = 0.002

  let rest = Math.max(used - os - mariadbCore - systemFiles - errorLog - slowLog - binlogIndexes - databases, used * 0.1)
  const hasSites = siteDbs.length > 0
  const apps = round1(rest * (hasSites ? between(r, 0.14, 0.2) : 0.3))
  const siteFiles = hasSites ? round1(rest * between(r, 0.16, 0.24)) : 0
  const logs = round1(rest * between(r, 0.04, 0.08))
  // Binlog absorbs the remainder so all buckets sum exactly to `used`.
  const binlog = round1(rest - apps - siteFiles - logs)

  // Per-app split of the apps bucket: frappe plus every app installed on any site.
  const appKeys = ['frappe', ...new Set(siteDbs.flatMap((db) => db.appKeys || []))]
  const appWeights = appKeys.map((k) => between(rng(server.id + k), 0.5, 1.5))
  const weightSum = appWeights.reduce((a, w) => a + w, 0)
  const appChildren = appKeys.map((key, i) => ({
    label: key === 'frappe' ? 'Frappe Framework' : APP_CATALOG.find((a) => a.key === key)?.name || key,
    appKey: key,
    gb: round1((apps * appWeights[i]) / weightSum),
  }))

  // Each site's file footprint splits the way the real storage tree does:
  // private files dominate, then backups, then a sliver of logs.
  const siteChildren = siteDbs.map((db) => {
    const total = siteFiles / siteDbs.length
    const rr = rng(db.siteId + ':files')
    const privateFiles = total * between(rr, 0.55, 0.75)
    const backups = total * between(rr, 0.15, 0.3)
    return {
      label: db.siteName,
      icon: 'lucide-globe',
      gb: round1(total),
      children: [
        { label: 'Private files', gb: round1(privateFiles) },
        { label: 'Backups', gb: round1(backups) },
        { label: 'Logs', gb: round1(Math.max(total - privateFiles - backups, 0)) },
      ],
    }
  })

  return {
    buckets: { os, binlog, databases: round1(databases), mariadbCore, systemFiles, errorLog, slowLog, binlogIndexes, apps, siteFiles, logs },
    appChildren,
    siteChildren,
    systemDbs,
  }
}

// Queries a live connection might be running. Fast ones dominate; a couple are
// heavy enough to matter. The lock pair below is kept separate so it always
// forms a chain regardless of how the random pool falls.
const ACTIVE_QUERIES = [
  { command: 'Query', state: 'Sending data', info: 'SELECT name FROM `tabSales Invoice` WHERE docstatus = 1 …', time: '0.02s' },
  { command: 'Query', state: 'Sending data', info: 'SELECT COUNT(*) FROM `tabError Log`', time: '0.31s' },
  { command: 'Query', state: 'statistics', info: 'SELECT … FROM `tabStock Ledger Entry` WHERE warehouse = ?', time: '0.5s' },
  { command: 'Query', state: 'Sending data', info: 'SELECT … FROM `tabItem` WHERE disabled = 0', time: '0.08s' },
]
// A heavy query only busy servers surface — kept out of the fast pool so quiet
// single-site boxes never randomly flag one and can read as genuinely healthy.
const HEAVY_QUERY = { command: 'Query', state: 'Copying to tmp table', info: 'SELECT … FROM `tabCommunication` GROUP BY reference_doctype', time: '7s' }
// The lock chain: a long read holds a row a write is waiting on. makeServerLocks
// keys off these exact rows, so they're injected deterministically.
const BLOCKING_QUERY = { command: 'Query', state: 'Sending data', info: 'SELECT * FROM `tabGL Entry` WHERE account LIKE … ORDER BY posting_date', time: '12s' }
const WAITING_QUERY = { command: 'Query', state: 'updating', info: 'UPDATE `tabSingles` SET value = … WHERE …', time: '9s' }

// A server's process list scales with its sites: each keeps a small pool of
// connections, mostly idle (Sleep), a few running a query. A busy server shows
// dozens — which is exactly what the site filter exists to cut through.
function makeServerProcesses(server, siteDbs) {
  const r = rng(server.id + ':proc')
  if (!siteDbs.length) return []

  // Connection ids are unique and monotonic (an autoincrementing counter in
  // MariaDB), so step forward by a positive gap each row.
  let id = 4088 + Math.round(between(r, 0, 40))
  const rows = []
  const push = (db, q) => {
    id += 1 + Math.round(between(r, 0, 8))
    rows.push({ id, user: 'frappe', siteId: db?.siteId ?? null, db: db?.dbName ?? 'system', ...q })
  }

  siteDbs.forEach((db) => {
    const pool = 1 + Math.floor(r() * 2) // 1–2 connections per site
    for (let c = 0; c < pool; c++) {
      // Idle Sleep times start at 20s so they never collide with the 12s
      // blocking read that makeServerLocks looks up.
      if (r() < 0.6) push(db, { command: 'Sleep', state: '', info: '', time: Math.round(between(r, 20, 800)) + 's' })
      else push(db, pick(r, ACTIVE_QUERIES))
    }
  })

  // Contention is a load phenomenon: only servers carrying real traffic
  // (≥2 sites) get the lock chain. Quiet single-site regional/staging boxes
  // stay clean, so their Diagnostics collapse to a healthy state.
  if (siteDbs.length >= 2) {
    push(pick(r, siteDbs), HEAVY_QUERY)
    const target = pick(r, siteDbs)
    push(target, BLOCKING_QUERY)
    push(target, WAITING_QUERY)
  }
  return rows
}

// The binary log files behind the `binlog` bucket. MariaDB rolls a new file at
// ~1 GB, so model 700 MB–1 GB files, oldest first (.000001). Sizes sum to the
// binlog bucket, so removing files and shrinking the bucket stay in lockstep.
function makeServerBinlogs(server, binlogGb) {
  const totalMb = Math.round(binlogGb * 1024)
  if (totalMb <= 0) return []
  const r = rng(server.id + ':binlog')
  const files = []
  let remaining = totalMb
  while (remaining > 0 && files.length < 400) {
    const size = Math.min(remaining, Math.round(between(r, 700, 1024)))
    files.push({ sizeMb: size })
    remaining -= size
  }
  const count = files.length
  return files.map((f, i) => {
    const daysAgo = count - 1 - i // last file is newest
    return {
      name: 'mysql-bin.' + String(i + 1).padStart(6, '0'),
      sizeMb: f.sizeMb,
      date: daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo} days ago`,
    }
  })
}

function makeServerLocks(processes) {
  // One believable lock chain: the long-running query blocks a write.
  const blocking = processes.find((p) => p.time === '12s')
  const waiting = processes.find((p) => p.state === 'updating')
  if (!blocking || !waiting) return []
  return [
    {
      waitingId: waiting.id,
      waitingQuery: 'UPDATE `tabStock Ledger Entry` SET qty_after_transaction = …',
      blockingId: blocking.id,
      blockingQuery: 'SELECT … FROM `tabBin` FOR UPDATE',
      waitedFor: '8s',
      siteId: waiting.siteId,
      db: waiting.db,
    },
  ]
}

// —————————————————————————————————————————————————————————————— the cache —

const siteCache = new Map()
const serverCache = new Map()

export function getSiteDbData(site) {
  if (!siteCache.has(site.id)) {
    const db = makeSiteDb(site)
    db.appKeys = (site.apps || []).map((a) => a.key)
    siteCache.set(site.id, reactive(db))
  }
  return siteCache.get(site.id)
}

// `disk` is the store's healthOf() picture ({ diskUsed, diskTotal }) so the
// analyzer's totals agree with ServerHealth and Central.
export function getServerDbData(server, liveSites, disk) {
  if (!serverCache.has(server.id)) {
    const siteDbs = liveSites.map(getSiteDbData)
    const storage = makeServerStorage(server, siteDbs, { used: disk.diskUsed, total: disk.diskTotal })
    const processes = makeServerProcesses(server, siteDbs)
    serverCache.set(
      server.id,
      reactive({
        ...storage,
        processes,
        locks: makeServerLocks(processes),
        binlogs: makeServerBinlogs(server, storage.buckets.binlog),
      })
    )
  }
  return serverCache.get(server.id)
}

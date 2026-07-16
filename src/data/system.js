// Under-the-hood seed data for the Developer tools area (Tier 3).
// Real names on purpose — anyone opening this area is technical. The rest of
// the product never mentions these.

export function makeProcesses() {
  return [
    { name: 'web', desc: 'Serves your sites', status: 'running', cpu: '0.2%', memory: '161 MB', uptime: '2 days' },
    { name: 'scheduler', desc: 'Runs background jobs', status: 'running', cpu: '0.0%', memory: '54 MB', uptime: '2 days' },
    { name: 'worker', desc: 'Processes queued work', status: 'running', cpu: '0.1%', memory: '83 MB', uptime: '2 days' },
    { name: 'socketio', desc: 'Realtime updates', status: 'running', cpu: '0.0%', memory: '36 MB', uptime: '2 days' },
    { name: 'redis-cache', desc: 'In-memory cache', status: 'running', cpu: '0.1%', memory: '26 MB', uptime: '2 days' },
    { name: 'redis-queue', desc: 'Job queue store', status: 'running', cpu: '0.1%', memory: '8 MB', uptime: '2 days' },
    { name: 'database', desc: 'MariaDB', status: 'running', cpu: '0.3%', memory: '624 MB', uptime: '2 days' },
  ]
}

export const LOG_FILES = [
  { file: 'web.error.log', size: '6.1 MB', lines: 83826, kind: 'error', modifiedMinsAgo: 12 },
  { file: 'web.log', size: '18.9 MB', lines: 290264, kind: 'access', modifiedMinsAgo: 2 },
  { file: 'database.log', size: '59.5 KB', lines: 1833, kind: 'system', modifiedMinsAgo: 65 },
  { file: 'scheduler.log', size: '8.0 MB', lines: 83648, kind: 'system', modifiedMinsAgo: 4 },
  { file: 'worker.log', size: '5.5 MB', lines: 78136, kind: 'system', modifiedMinsAgo: 9 },
  { file: 'redis-cache.log', size: '53.2 KB', lines: 553, kind: 'system', modifiedMinsAgo: 380 },
  { file: 'redis-queue.log', size: '360.1 KB', lines: 4772, kind: 'system', modifiedMinsAgo: 31 },
  { file: 'socketio.log', size: '1.5 KB', lines: 32, kind: 'system', modifiedMinsAgo: 1410 },
  { file: 'socketio.error.log', size: '0 B', lines: 0, kind: 'error', modifiedMinsAgo: 5760 },
  { file: 'redis-cache.error.log', size: '0 B', lines: 0, kind: 'error', modifiedMinsAgo: 5760 },
  { file: 'redis-queue.error.log', size: '0 B', lines: 0, kind: 'error', modifiedMinsAgo: 5760 },
]

// Deterministic fake log lines, varied per file name.
export function logLines(file) {
  // Honor the file's metadata: empty files have no lines; large files are
  // capped so the viewer's "showing last N of M" truncation note is real.
  const meta = LOG_FILES.find((f) => f.file === file)
  if (meta && meta.lines === 0) return []
  const count = Math.min(meta?.lines || 40, 400)
  const stamp = (i) => {
    const d = new Date(Date.now() - (count - i) * 90000)
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    const ss = String(d.getSeconds()).padStart(2, '0')
    return `${hh}:${mm}:${ss}`
  }
  const lines = []
  for (let i = 0; i < count; i++) {
    if (file.includes('error') && i % 9 === 4) {
      lines.push(`${stamp(i)} [ERROR] TimeoutError: response took longer than 30s (job retried)`)
    } else if (file.startsWith('web')) {
      const paths = ['/api/method/ping', '/app/sales-invoice', '/api/method/frappe.client.get_list', '/assets/frappe/dist/js/app.js', '/app/item', '/api/method/run_doc_method']
      lines.push(`${stamp(i)} [INFO] 127.0.0.1 "GET ${paths[i % paths.length]} HTTP/1.1" 200`)
    } else if (file.startsWith('scheduler')) {
      const jobs = ['hourly.sync_emails', 'daily.send_reminders', 'all.cleanup_expired_sessions', 'hourly.update_exchange_rates']
      lines.push(`${stamp(i)} [INFO] enqueued ${jobs[i % jobs.length]}`)
    } else if (file.startsWith('worker')) {
      lines.push(`${stamp(i)} [INFO] job ${1000 + i * 7} finished in ${(0.2 + (i % 5) * 0.3).toFixed(1)}s`)
    } else if (file.startsWith('database')) {
      lines.push(`${stamp(i)} [Note] InnoDB: checkpoint completed (LSN ${882000 + i * 311})`)
    } else if (file.startsWith('redis')) {
      lines.push(`${stamp(i)} * Background saving terminated with success`)
    } else {
      lines.push(`${stamp(i)} [INFO] connection established (sid ${4200 + i})`)
    }
  }
  return lines
}

// The DB analyzer's seed data lives in ./dbAnalyzer.js — generated per-server
// and per-site rather than kept as a static blob here.

// Sample schema for the SQL Playground's table browser — enough to write a query
// against without leaving the page.
export const DB_TABLES = [
  { name: 'tabUser', columns: ['name', 'email', 'enabled', 'creation', 'modified'] },
  { name: 'tabSales Invoice', columns: ['name', 'customer', 'grand_total', 'status', 'posting_date'] },
  { name: 'tabGL Entry', columns: ['name', 'account', 'debit', 'credit', 'posting_date'] },
  { name: 'tabItem', columns: ['name', 'item_name', 'item_group', 'stock_uom'] },
  { name: 'tabVersion', columns: ['name', 'ref_doctype', 'docname', 'data', 'creation'] },
]

// Background jobs (the "Tasks" dev-tools page). Mirrors Frappe Cloud's agent
// job history: each run has a type, an outcome, when it ran, how long it took,
// and the ordered steps it went through. Real-sounding job names on purpose —
// this area is for technical users.
export const BACKGROUND_JOBS = [
  {
    id: 'job-5821', name: 'Backup Site', site: 'mycompany.frappe.cloud', status: 'success',
    startedMinsAgo: 7, duration: '48s',
    steps: [
      { name: 'Enqueue backup', status: 'success', duration: '0.2s' },
      { name: 'Dump database', status: 'success', duration: '31s' },
      { name: 'Archive files', status: 'success', duration: '14s' },
      { name: 'Upload to offsite storage', status: 'success', duration: '2.6s' },
    ],
  },
  {
    id: 'job-5820', name: 'Update Site Configuration', site: 'mycompany.frappe.cloud', status: 'running',
    startedMinsAgo: 1, duration: null,
    steps: [
      { name: 'Validate configuration', status: 'success', duration: '0.4s' },
      { name: 'Apply to site', status: 'running', duration: null },
      { name: 'Reload services', status: 'pending', duration: null },
    ],
  },
  {
    id: 'job-5817', name: 'Install App', site: 'shop.frappe.cloud', status: 'failed',
    startedMinsAgo: 34, duration: '1m 12s',
    steps: [
      { name: 'Resolve app dependencies', status: 'success', duration: '3s' },
      { name: 'Build assets', status: 'success', duration: '58s' },
      { name: 'Run migrations', status: 'failed', duration: '11s' },
    ],
  },
  {
    id: 'job-5810', name: 'Deploy Bench', site: null, status: 'success',
    startedMinsAgo: 96, duration: '4m 31s',
    steps: [
      { name: 'Clone repositories', status: 'success', duration: '22s' },
      { name: 'Build image', status: 'success', duration: '3m 40s' },
      { name: 'Roll out', status: 'success', duration: '29s' },
    ],
  },
  {
    id: 'job-5804', name: 'Restore Site', site: 'mycompany.frappe.cloud', status: 'success',
    startedMinsAgo: 220, duration: '2m 03s',
    steps: [
      { name: 'Download backup', status: 'success', duration: '18s' },
      { name: 'Restore database', status: 'success', duration: '1m 33s' },
      { name: 'Restore files', status: 'success', duration: '12s' },
    ],
  },
  {
    id: 'job-5799', name: 'Migrate Site', site: 'shop.frappe.cloud', status: 'success',
    startedMinsAgo: 410, duration: '1m 47s',
    steps: [
      { name: 'Take pre-migration backup', status: 'success', duration: '41s' },
      { name: 'Run patches', status: 'success', duration: '58s' },
      { name: 'Clear cache', status: 'success', duration: '8s' },
    ],
  },
]

export const SYSTEM_INFO = [
  { label: 'Process manager', value: 'systemd' },
  { label: 'HTTP port', value: '8000' },
  { label: 'SocketIO port', value: '9000' },
  { label: 'Python', value: '3.14' },
  { label: 'Node', value: '22' },
  { label: 'MariaDB', value: '11.4' },
  { label: 'Redis', value: '7.2' },
  { label: 'Bench', value: 'v5.27' },
  { label: 'Region', value: 'Mumbai' },
]

// The runtime versions worth showing a Frappe Cloud user: language/engine
// versions they need for compatibility, not the platform's internal ports or
// process manager. Looked up from SYSTEM_INFO by label.
export const RUNTIME_LABELS = ['Python', 'Node', 'MariaDB', 'Redis']

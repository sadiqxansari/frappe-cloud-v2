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

// Sample schema for the SQL Playground's table browser. Columns carry their
// SQL type so the browser can render the COLUMN / TYPE grid the real Pilot
// shows. Sequence tables (`*_id_seq`) all share MariaDB's 8-column shape, so
// that's factored out. `DB_TABLE_COUNT` stands in for the true table count a
// live site would report (the schema below is a representative slice of it).
const SEQ_COLUMNS = [
  { name: 'next_not_cached_value', type: 'bigint(21)' },
  { name: 'minimum_value', type: 'bigint(21)' },
  { name: 'maximum_value', type: 'bigint(21)' },
  { name: 'start_value', type: 'bigint(21)' },
  { name: 'increment', type: 'bigint(21)' },
  { name: 'cache_size', type: 'bigint(21) unsigned' },
  { name: 'cycle_option', type: 'tinyint(1) unsigned' },
  { name: 'cycle_count', type: 'bigint(21)' },
]

const seq = (name) => ({ name, columns: SEQ_COLUMNS })

export const DB_TABLE_COUNT = 394

export const DB_TABLES = [
  {
    name: '__Auth',
    columns: [
      { name: 'doctype', type: 'varchar(140)' },
      { name: 'name', type: 'varchar(140)' },
      { name: 'fieldname', type: 'varchar(140)' },
      { name: 'password', type: 'text' },
      { name: 'encrypted', type: 'int(1)' },
    ],
  },
  {
    name: '__UserSettings',
    columns: [
      { name: 'user', type: 'varchar(180)' },
      { name: 'doctype', type: 'varchar(180)' },
      { name: 'data', type: 'longtext' },
    ],
  },
  {
    name: '__global_search',
    columns: [
      { name: 'doctype', type: 'varchar(100)' },
      { name: 'name', type: 'varchar(140)' },
      { name: 'title', type: 'text' },
      { name: 'content', type: 'longtext' },
      { name: 'route', type: 'text' },
      { name: 'published', type: 'int(1)' },
    ],
  },
  seq('case_followup_id_seq'),
  seq('case_id_seq'),
  seq('crm_product_sync_issue_id_seq'),
  seq('crm_task_id_seq'),
  seq('crm_view_settings_id_seq'),
  seq('drive_entity_log_id_seq'),
  seq('drive_favourite_id_seq'),
  seq('family_reintegration_id_seq'),
  seq('food_drop_off_detail_id_seq'),
  seq('gp_comment_id_seq'),
  seq('gp_custom_emoji_id_seq'),
  {
    name: 'tabUser',
    columns: [
      { name: 'name', type: 'varchar(140)' },
      { name: 'email', type: 'varchar(140)' },
      { name: 'enabled', type: 'int(1)' },
      { name: 'creation', type: 'datetime(6)' },
      { name: 'modified', type: 'datetime(6)' },
    ],
  },
  {
    name: 'tabSales Invoice',
    columns: [
      { name: 'name', type: 'varchar(140)' },
      { name: 'customer', type: 'varchar(140)' },
      { name: 'grand_total', type: 'decimal(21,9)' },
      { name: 'status', type: 'varchar(140)' },
      { name: 'posting_date', type: 'date' },
    ],
  },
  {
    name: 'tabGL Entry',
    columns: [
      { name: 'name', type: 'varchar(140)' },
      { name: 'account', type: 'varchar(140)' },
      { name: 'debit', type: 'decimal(21,9)' },
      { name: 'credit', type: 'decimal(21,9)' },
      { name: 'posting_date', type: 'date' },
    ],
  },
  {
    name: 'tabItem',
    columns: [
      { name: 'name', type: 'varchar(140)' },
      { name: 'item_name', type: 'varchar(140)' },
      { name: 'item_group', type: 'varchar(140)' },
      { name: 'stock_uom', type: 'varchar(140)' },
    ],
  },
  {
    name: 'tabVersion',
    columns: [
      { name: 'name', type: 'varchar(140)' },
      { name: 'ref_doctype', type: 'varchar(140)' },
      { name: 'docname', type: 'varchar(140)' },
      { name: 'data', type: 'longtext' },
      { name: 'creation', type: 'datetime(6)' },
    ],
  },
]

// Background jobs (the "Tasks" dev-tools page). Mirrors Frappe Cloud's agent
// job history: each run has a type, an outcome, when it ran, how long it took,
// and the ordered steps it went through. Real-sounding job names on purpose —
// this area is for technical users.
export const BACKGROUND_JOBS = [
  {
    id: '20260713-124517-5821ba', name: 'Backup Site', site: 'mycompany.frappe.cloud', status: 'success',
    startedMinsAgo: 7, duration: '48s',
    steps: [
      { name: 'Enqueue backup', status: 'success', duration: '0.2s', log: 'Scheduling backup for mycompany.frappe.cloud\nBackup job queued (priority: default)' },
      { name: 'Dump database', status: 'success', duration: '31s', log: 'mysqldump: dumping _a1b2c3d4e5 (142 tables)\nWriting database.sql.gz ... 218.4 MB\nDatabase dump complete' },
      { name: 'Archive files', status: 'success', duration: '14s', log: 'Archiving public files ... 84.1 MB\nArchiving private files ... 12.7 MB\nfiles.tar written' },
      { name: 'Upload to offsite storage', status: 'success', duration: '2.6s', log: 'Uploading to s3://frappe-cloud-backups/mumbai/\n✔ database.sql.gz\n✔ files.tar\nBackup available in Recent backups' },
    ],
  },
  {
    id: '20260713-125102-5820cd', name: 'Update Site Configuration', site: 'mycompany.frappe.cloud', status: 'running',
    startedMinsAgo: 1, duration: null,
    steps: [
      { name: 'Validate configuration', status: 'success', duration: '0.4s', log: 'Parsing site_config.json\n✔ 3 keys changed, 0 invalid' },
      { name: 'Apply to site', status: 'running', duration: null, log: 'Writing site_config.json ...' },
      { name: 'Reload services', status: 'pending', duration: null, log: '' },
    ],
  },
  {
    id: '20260713-121809-5817ef', name: 'Install App', site: 'shop.frappe.cloud', status: 'failed',
    startedMinsAgo: 34, duration: '1m 12s',
    steps: [
      { name: 'Resolve app dependencies', status: 'success', duration: '3s', log: 'Resolving hrms@version-15\n✔ frappe, erpnext already present\n✔ dependency tree resolved' },
      { name: 'Build assets', status: 'success', duration: '58s', log: 'yarn run v1.22.22\n$ node esbuild --production --apps hrms\nDONE  Total Build Time: 41.2s\n✔ Application Assets Linked' },
      { name: 'Run migrations', status: 'failed', duration: '11s', log: 'Executing hrms.patches.v15_0.migrate_leaves\nTraceback (most recent call last):\n  File "apps/frappe/frappe/migrate.py", line 142, in migrate\npymysql.err.OperationalError: (1213, \'Deadlock found when trying to get lock\')\nMigration aborted — no changes committed' },
    ],
  },
  {
    id: '20260713-111233-5810ab', name: 'Deploy Bench', site: null, status: 'success',
    startedMinsAgo: 96, duration: '4m 31s',
    steps: [
      { name: 'Clone repositories', status: 'success', duration: '22s', log: 'Cloning frappe (version-15) ...\nCloning erpnext (version-15) ...\n✔ 2 repositories at target commits' },
      { name: 'Build image', status: 'success', duration: '3m 40s', log: 'Building container image bench-0f3a...\nStep 14/18 : RUN bench build --production\n✔ image built: registry.frappe.cloud/bench-0f3a' },
      { name: 'Roll out', status: 'success', duration: '29s', log: 'Pulling image on server ...\nRestarting web, socketio, workers\n✔ Deploy live' },
    ],
  },
  {
    id: '20260713-091845-5804dc', name: 'Restore Site', site: 'mycompany.frappe.cloud', status: 'success',
    startedMinsAgo: 220, duration: '2m 03s',
    steps: [
      { name: 'Download backup', status: 'success', duration: '18s', log: 'Fetching backup 20260712-2200 from offsite storage\n✔ database.sql.gz (214.9 MB)\n✔ files.tar (95.2 MB)' },
      { name: 'Restore database', status: 'success', duration: '1m 33s', log: 'Dropping existing tables ...\nImporting database.sql.gz (142 tables)\n✔ database restored' },
      { name: 'Restore files', status: 'success', duration: '12s', log: 'Extracting files.tar\n✔ public and private files restored' },
    ],
  },
  {
    id: '20260713-060421-5799fa', name: 'Migrate Site', site: 'shop.frappe.cloud', status: 'success',
    startedMinsAgo: 410, duration: '1m 47s',
    steps: [
      { name: 'Take pre-migration backup', status: 'success', duration: '41s', log: 'Snapshotting site before migration\n✔ backup 20260713-0557 stored' },
      { name: 'Run patches', status: 'success', duration: '58s', log: 'Executing 17 patches\n✔ all patches applied\nBuilding search index' },
      { name: 'Clear cache', status: 'success', duration: '8s', log: 'Clearing redis cache\n✔ website and app cache cleared' },
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

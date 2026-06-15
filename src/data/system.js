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
  const stamp = (i) => {
    const d = new Date(Date.now() - (40 - i) * 90000)
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    const ss = String(d.getSeconds()).padStart(2, '0')
    return `${hh}:${mm}:${ss}`
  }
  const lines = []
  for (let i = 0; i < 40; i++) {
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

export const DB_STATS = {
  size: '624 MB',
  tables: 412,
  connections: 3,
  processList: [
    { id: 4112, query: 'SELECT name FROM tabSales Invoice WHERE…', time: '0.02s' },
    { id: 4108, query: 'UPDATE tabSingles SET value = …', time: '0.01s' },
    { id: 4101, query: 'Sleep', time: '4s' },
  ],
}

export const SYSTEM_INFO = [
  { label: 'Process manager', value: 'systemd' },
  { label: 'HTTP port', value: '8000' },
  { label: 'SocketIO port', value: '9000' },
  { label: 'Python', value: '3.14' },
  { label: 'Node', value: '22' },
  { label: 'MariaDB', value: '11.4' },
  { label: 'Bench', value: 'v5.27' },
  { label: 'Region', value: 'Mumbai' },
]

import { ref } from 'vue'
import { toast } from 'frappe-ui'
import { planById } from '../data/catalog'

// Shared open-state for the "All sites" pill ⇄ panel on the site page, so it
// stays open (or collapsed) while walking between sites. Session-only on
// purpose; a fresh load starts at the pill.
export const sitesPanelOpen = ref(false)

// Sites that need eyes come first, so they never hide in the overflow.
const ATTENTION = { broken: 0, suspended: 1, creating: 2, restoring: 2, moving: 2, live: 3 }
export function sitesByAttention(sites) {
  return [...sites].sort(
    (a, b) => (ATTENTION[a.status] ?? 3) - (ATTENTION[b.status] ?? 3) || a.name.localeCompare(b.name),
  )
}

export function siteStatusVar(site) {
  if (site.status === 'broken') return 'var(--ink-red-7)'
  if (site.status === 'live') return 'var(--ink-green-7)'
  return 'var(--ink-amber-7)'
}
export function statusLabel(site) {
  return { live: 'Active', broken: 'Broken', creating: 'Setting up…', restoring: 'Restoring…', moving: 'Moving…', suspended: 'Paused' }[site.status] || site.status
}
export function statusTheme(site) {
  if (site.status === 'live') return 'green'
  if (site.status === 'broken') return 'red'
  return 'orange'
}
export function appsLabel(site) {
  const n = site.apps?.length ?? 0
  return n === 1 ? '1 app' : `${n} apps`
}

// No real per-site disk metric in the data model yet — a stable hash of the
// site's id stands in for one, so the same site always shows the same size
// instead of jumping around on every render.
export function siteStorageGb(site) {
  const hash = [...site.id].reduce((a, c) => (a * 33 + c.charCodeAt(0)) >>> 0, 5381)
  const base = 0.4 + ((hash % 1000) / 1000) * 2 // spread ~0.4–2.4 GB
  return Math.round((base + (site.apps?.length ?? 0) * 0.6) * 10) / 10
}

// The disk this server's sites share — its plan's base disk plus any bought
// add-on. This is the honest denominator for a per-site storage bar: a single
// site is only a slice of the whole disk, so the bar always shows real
// headroom (unlike scaling to the heaviest site, which pins it to 100%).
export function serverDiskGb(server) {
  const specs = server.planId === 'custom' && server.customSpec ? server.customSpec : planById(server.planId)?.specs
  return (specs?.disk ?? 40) + (server.diskAddonGb ?? 0)
}

// The per-site overflow menu shared by map cards and panel rows.
export function siteRowOptions(site, { store, router }) {
  return [
    { label: 'Open site', icon: 'lucide-arrow-up-right', onClick: () => { store.openSite(site.id); router.push('/app') } },
    {
      label: 'Backup now',
      icon: 'lucide-archive',
      onClick: () => toast.promise(store.backupNow(site.id), { loading: 'Backing up…', success: 'Backed up just now', error: 'Backup failed' }),
    },
  ]
}

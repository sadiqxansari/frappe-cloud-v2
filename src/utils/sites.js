import { ref } from 'vue'
import { toast } from 'frappe-ui'

// One shared open-state for the "All sites" pill ⇄ panel. The map and the
// site page render the panel in the same corner, so sharing the state means
// crossing between them reads as the panel standing still — and Esc's chain
// works: site page → map (panel still open) → pill. Session-only on purpose;
// a fresh load starts at the pill.
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

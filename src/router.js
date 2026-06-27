import { createRouter, createWebHistory } from 'vue-router'
import { useCloudStore } from './stores/cloud'

const routes = [
  { path: '/', name: 'home', component: { render: () => null } },
  { path: '/setup', redirect: '/setup/account' },
  { path: '/setup/account', component: () => import('./pages/setup/AccountStep.vue') },
  { path: '/setup/app', component: () => import('./pages/setup/AppStep.vue') },
  { path: '/setup/server', component: () => import('./pages/setup/ServerStep.vue') },
  { path: '/setup/provisioning', component: () => import('./pages/setup/ProvisioningStep.vue') },
  { path: '/app', component: () => import('./pages/app/AppShell.vue') },
  // Mock payment gateway — the Pay round-trip's destination (returns to origin).
  { path: '/pay', name: 'pay', component: () => import('./pages/GatewayPage.vue') },
  // Central (account-level) — Servers / Billing / Users. No Marketplace here (D1).
  { path: '/servers', name: 'servers', component: () => import('./pages/manage/ServersPage.vue') },
  { path: '/servers/new', name: 'new-server', component: () => import('./pages/manage/NewServerPage.vue') },
  { path: '/billing', name: 'billing', component: () => import('./pages/manage/CentralBillingPage.vue') },
  { path: '/billing/invoices', name: 'billing-invoices', component: () => import('./pages/manage/CentralBillingPage.vue') },
  { path: '/billing/limit-tiers', name: 'billing-limit-tiers', component: () => import('./pages/manage/LimitTiersPage.vue') },
  { path: '/settings', name: 'central-settings', component: () => import('./pages/manage/CentralSettingsPage.vue') },
  { path: '/users', redirect: '/settings' },
  // Server (operational) level. Marketplace lives here, scoped to the server.
  { path: '/manage/:serverId?', name: 'server-overview', component: () => import('./pages/manage/OverviewPage.vue') },
  { path: '/manage/:serverId/sites/:siteId', name: 'site-detail', component: () => import('./pages/manage/SiteDetailPage.vue') },
  { path: '/manage/:serverId/analytics', name: 'server-analytics', component: () => import('./pages/manage/AnalyticsPage.vue') },
  // Settings moved into a modal on the brand dropdown; keep old links working.
  { path: '/manage/:serverId/settings', redirect: (to) => `/manage/${to.params.serverId}` },
  // Billing is account-level now — old per-server links land on Central billing.
  { path: '/manage/:serverId/billing', redirect: '/billing' },
  { path: '/manage/:serverId/marketplace', name: 'server-marketplace', component: () => import('./pages/manage/MarketplacePage.vue') },
  { path: '/manage/:serverId/developer', redirect: (to) => `/manage/${to.params.serverId}/developer/logs` },
  { path: '/manage/:serverId/developer/logs', name: 'server-logs', component: () => import('./pages/manage/LogsPage.vue') },
  { path: '/manage/:serverId/developer/database', name: 'server-database', component: () => import('./pages/manage/DatabasePage.vue') },
  { path: '/manage/:serverId/developer/sql', name: 'server-sql', component: () => import('./pages/manage/SqlPlaygroundPage.vue') },
  { path: '/manage/:serverId/developer/tasks', name: 'server-tasks', component: () => import('./pages/manage/TasksPage.vue') },
  // Migration progress screen — standalone tab, opened from the server list.
  { path: '/migration/:serverId', name: 'migration', component: () => import('./pages/manage/MigrationPage.vue') },
  // Legacy redirects.
  { path: '/account', redirect: '/billing' },
  { path: '/marketplace', redirect: '/servers' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  const store = useCloudStore()

  if (to.path === '/') {
    if (!store.server) return '/setup/account'
    // The landing fork (decisions 1 & 9): a single-server owner lives in the
    // Desk; a fleet operator — or anyone who's ever graduated to a 2nd server
    // (sticky `centralUnlocked`) — lands in Central, their home for the fleet.
    if (store.centralUnlocked || store.serverCount >= 2) return '/servers'
    return '/app'
  }

  // Screens that need at least one server to exist.
  const central = ['/servers', '/settings', '/users', '/account']
  const needsServer = to.path === '/app' || to.path === '/pay' || to.path.startsWith('/manage') || to.path.startsWith('/billing') || central.includes(to.path)
  if (needsServer && !store.allServers.length) return '/'
})

export default router

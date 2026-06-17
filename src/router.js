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
  // Central (account-level) — Servers / Billing / Users. No Marketplace here (D1).
  { path: '/servers', name: 'servers', component: () => import('./pages/manage/ServersPage.vue') },
  { path: '/servers/new', name: 'new-server', component: () => import('./pages/manage/NewServerPage.vue') },
  { path: '/billing', name: 'billing', component: () => import('./pages/manage/CentralBillingPage.vue') },
  { path: '/billing/invoices', name: 'billing-invoices', component: () => import('./pages/manage/CentralBillingPage.vue') },
  { path: '/settings', name: 'central-settings', component: () => import('./pages/manage/CentralSettingsPage.vue') },
  { path: '/users', redirect: '/settings' },
  // Server (operational) level. Marketplace lives here, scoped to the server.
  { path: '/manage/:serverId?', name: 'server-overview', component: () => import('./pages/manage/OverviewPage.vue') },
  { path: '/manage/:serverId/sites/:siteId', name: 'site-detail', component: () => import('./pages/manage/SiteDetailPage.vue') },
  { path: '/manage/:serverId/analytics', name: 'server-analytics', component: () => import('./pages/manage/AnalyticsPage.vue') },
  { path: '/manage/:serverId/settings', name: 'server-settings', component: () => import('./pages/manage/ServerSettingsPage.vue') },
  // Billing is account-level now — old per-server links land on Central billing.
  { path: '/manage/:serverId/billing', redirect: '/billing' },
  { path: '/manage/:serverId/marketplace', name: 'server-marketplace', component: () => import('./pages/manage/MarketplacePage.vue') },
  { path: '/manage/:serverId/developer', redirect: (to) => `/manage/${to.params.serverId}/developer/logs` },
  { path: '/manage/:serverId/developer/logs', name: 'server-logs', component: () => import('./pages/manage/LogsPage.vue') },
  { path: '/manage/:serverId/developer/database', name: 'server-database', component: () => import('./pages/manage/DatabasePage.vue') },
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
    return '/servers'
  }

  // Screens that need at least one server to exist.
  const central = ['/servers', '/settings', '/users', '/account']
  const needsServer = to.path === '/app' || to.path.startsWith('/manage') || to.path.startsWith('/billing') || central.includes(to.path)
  if (needsServer && !store.allServers.length) return '/'
})

export default router

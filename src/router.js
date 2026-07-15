import { createRouter, createWebHistory } from 'vue-router'
import { useCloudStore } from './stores/cloud'

const routes = [
  { path: '/', name: 'home', component: { render: () => null } },
  // Auth surface (mocked — no backend). MinimalAuthShell, no stepper.
  { path: '/login', name: 'login', component: () => import('./pages/auth/LoginPage.vue') },
  { path: '/signup', name: 'signup', component: () => import('./pages/auth/SignupPage.vue') },
  { path: '/signup/verify', name: 'signup-verify', component: () => import('./pages/auth/VerifyEmailPage.vue') },
  { path: '/forgot-password', name: 'forgot-password', component: () => import('./pages/auth/ForgotPasswordPage.vue') },
  // Old signup links now land on the new signup route.
  { path: '/setup', redirect: '/signup' },
  { path: '/setup/account', redirect: '/signup' },
  { path: '/setup/app', component: () => import('./pages/setup/SiteSetupPage.vue') },
  // The server/plan step is gone from onboarding (the server is implied on the
  // site-setup screen, matching Central) — keep old links working.
  { path: '/setup/server', redirect: '/setup/app' },
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
    // Not signed in ⇒ start the funnel. A signed-in but server-less account
    // (a non-product signup that hasn't created a site yet) lands in Central,
    // whose empty state invites them to add their first server.
    if (!store.isAuthed) return '/signup'
    if (!store.server) return '/servers'
    // The landing fork (decisions 1 & 9): a single-server owner lives in the
    // Desk; a fleet operator — or anyone who's ever graduated to a 2nd server
    // (sticky `centralUnlocked`) — lands in Central, their home for the fleet.
    if (store.centralUnlocked || store.serverCount >= 2) return '/servers'
    return '/app'
  }

  // The Desk, the pay round-trip, and per-server surfaces can't exist without a
  // server; bounce a server-less visitor to Central (if signed in) or signup.
  const needsServer = to.path === '/app' || to.path === '/pay' || to.path.startsWith('/manage')
  if (needsServer && !store.allServers.length) return store.isAuthed ? '/servers' : '/signup'

  // Central (account-level) surfaces exist for a server-less account too, so
  // they only require sign-in — not a server.
  const central = ['/servers', '/settings', '/users', '/account']
  const needsAuth = to.path.startsWith('/billing') || central.includes(to.path)
  if (needsAuth && !store.isAuthed) return '/signup'
})

export default router

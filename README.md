# Frappe Cloud V2 — UX prototype

A clickable front-end prototype of the Frappe Cloud V2 experience. No backend,
no auth, no payments — everything runs on dummy data in a Pinia store.

## Run it

```sh
npm install
npm run dev
```

## Demo scenarios

Use the **Demo** pill in the bottom-right corner to switch state at any time.

_Individual_
- **Fresh — first run** — brand-new user; walks sign up → app pick (with an
  editable site name) → server recommendation → provisioning → lands in the app.
- **Grown — two sites** — established user with two sites, so the revealed
  structure (server → sites → apps) is demoable without walking the flow.

_Partner_
- **First run** — brand-new partner; walks partner sign up → welcome
  (how pooled billing works) → an empty Central → guided "add your first
  customer" (which spins up that customer's server + first site).
- **Established — 3 customers** — partner with pooled credit and three
  customers wrapping the same inner screens.

_Toggle_
- **Low credit** — drops the balance to $3 so the calm "add a card"
  prompt appears on Manage.

Switching scenarios resets all state. Reloading the page also resets to Fresh.

## The console (merged bench)

The Manage surface **is** the bench, redesigned. Every console page wraps
`src/components/ConsoleLayout.vue` — a frappe-ui `Sidebar` (Overview · Sites ·
Activity · Billing, plus an "Advanced → Developer tools" section) and a top
navbar with `Breadcrumbs`. Tiered disclosure throughout:

- **Tier 1 (always visible):** health verdict, sites, backups + restore,
  domains + SSL, humanized activity, billing.
- **Tier 2 (one click):** CPU/memory/disk graphs behind the health verdict,
  site settings as three plain switches (maintenance, background jobs,
  developer mode) instead of raw `site_config.json`.
- **Tier 3 (Developer tools):** processes (restart behind a confirm), logs
  (empties hidden, severity badges), database (graceful states, never a raw
  error), system facts. Real names on purpose — this area is for developers.

## Map of the flows

| Flow | Where |
| --- | --- |
| A. First run | `src/pages/setup/*` |
| B. App shell + Manage door | `src/pages/app/AppShell.vue` |
| C. Console: Overview / Sites / Activity / Billing | `src/pages/manage/{Overview,Sites,Activity,Billing}Page.vue` |
| D. Site detail (Apps · Domains · Backups · Settings · Danger) | `src/pages/manage/SiteDetailPage.vue` |
| E. Developer tools (Processes · Logs · Database · System) | `src/pages/manage/DeveloperToolsPage.vue` + `src/data/system.js` |
| F. Second site / structure reveal | `src/stores/cloud.js` (`createSite`) + SitesPage |
| G. Low credit → add a card | Overview/Billing banner + `src/components/AddCardDialog.vue` |
| H. Account layer (team, billing) | `src/pages/account/AccountPage.vue` |
| I. Partner shell | `src/pages/partner/*` |
| J. Partner first run | `src/pages/setup/Partner*Step.vue` → empty `CustomersPage` → `src/components/AddCustomerDialog.vue` |

Destructive paths are gated: delete-site requires typing the site's name,
uninstall/restore/restart get a calm confirm. Everything an action does is
logged to the humanized **Activity** feed ("Backed up myshop.frappe.cloud",
never `backup-site site=…`).

Site names are user-chosen everywhere they're created — first run (`AppStep`),
New site, and Add customer — each with a live `*.frappe.cloud` subdomain preview.

## Console IA — two levels in one sidebar

The sidebar is **Central + a pinned server**, so you never lose context:

- **Central (always visible):** Servers (Customers for partners) · Marketplace ·
  **Billing** · **Users** (IAM). These are account-level — `CentralBillingPage`
  (one balance, payment method, per-server spend with **Resize**, invoices) and
  `UsersPage` (members, roles, what each can do).
- **Pinned server section:** the moment you enter a server it's pinned below
  (Overview · Sites · Activity · Developer tools) and *stays* while you visit
  Marketplace/Billing/etc. (`store.currentServerId`). The hand-rolled sidebar
  collapses by clicking its right edge; the logo never shrinks; the avatar/account
  sits at the bottom.
- **Primary actions live in the top navbar** (the `#actions` slot): New server,
  New site, Add customer, Add server, Invite — not in the page body.

## Sites are identified by their address

There is no invented "site name" — a site **is** its subdomain
(`mycompany.frappe.cloud`). Creation flows ask for a *site address*; the
subdomain is the identity everywhere (`site.subdomain` + `site.name`).

## Servers, versions and regions (per the architecture)

The architecture maps one **bench per VM**, plans sized by the VM, separate
VMs per Frappe version, and cluster management per region+provider pair —
internal, never user-facing. What that means in the UI:

- **Servers page** (`/servers`) — servers are a first-class list with
  "New server" (`NewServerDialog`). Provider and region are a **card grid**
  (`ProviderRegionPicker`): 4 providers (AWS · Hetzner · Frappe · Oracle Cloud),
  each with its own regions (flags, some `Beta`); version pick incl. v14 and
  Nightly; full size ladder (3 featured + "More sizes"). Pricing follows the
  provider (`priceFor`).
- **A server runs one version** (`server.version`); sites inherit it. Changing
  a site's version is never a dropdown — it's a guided **move**
  (`MoveSiteDialog`): pick the target version, then an existing server on it
  or a new one. A new server shows an amber cost callout and puts the price
  on the commit button ("Create server & move — ₹X/mo") — a new VM is a new
  recurring charge and the UI says so before the click.
- **Pricing follows the provider** (`priceFor`); plans stay outcome-named.
  Onboarding defaults to Mumbai (AWS) with a quiet "Change" reveal.
- The **$25 signup credit is once per account**, not per server — only the
  first-run flow mentions it.

## Marketplace

A sidebar **Marketplace tab** (`MarketplacePage.vue`) for exploring — search,
real logos, install counts, flat rows (no cards) — installs via a site picker
that disables incompatible/already-installed sites. From a site's Apps tab the
same catalog opens scoped to that site (`AddAppDialog.vue`) with version-compat
gating ("Needs Version 16" + guided move). Developers get a quiet
"Install from GitHub" path (repo + branch → `addCustomApp`).

## Demo toggles

**Low credit** (calm banner) and **Credit expired** — sites pause with red
"Paused" badges, a plain-words banner explains nothing is deleted, and adding
a card revives everything instantly (`setCreditExpired`).

App icons are the real product marks in `src/assets/apps/` (rendered by
`AppIcon.vue`, letter-tile fallback for unknown/GitHub apps). Dummy data and
copy live in `src/data/catalog.js` (plans, regions, versions, app catalog +
`latestVersion`/`compat`/`installs`), `src/data/system.js` (Tier-3 seeds) and
`src/stores/cloud.js` (scenario seeds, actions, activity log).

> **Partner billing model** (the report's biggest open question — who pays /
> who controls) is *assumed* here as: partner manages customers, each customer
> server carries $25 credit pooled into one partner balance, partner earns a
> 15% margin. Swap the model by editing the partner seeds + `addCustomer` /
> `partnerCommission` in `src/stores/cloud.js`.

## Notes

- Built with **frappe-ui `1.0.0-beta.4`** (the espresso-era API: `frappe-ui/tailwind`
  preset, ink/surface/outline tokens, lucide icons, flat Dialog props). The
  `beta` npm tag matches the local `~/Dev/frappe-ui` checkout.
- Icons are `lucide-*` strings/classes throughout — feather names are
  deprecated in the beta.
- Prices are in ₹ and credit in $, exactly as the design spec frames them.
- The Vite config uses `frappe-ui/vite` with all Frappe-backend integrations
  disabled; it provides the `~icons/lucide/*` virtual modules the library's
  own components import.

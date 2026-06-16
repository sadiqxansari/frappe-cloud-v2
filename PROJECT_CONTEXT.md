# FC V2 — Project Context

Clickable Frappe Cloud V2 UX prototype. **This repo (`frappe-cloud-v2-next`) is the current working copy** — a fork started 2026-06-13, duplicated from the original `~/Dev/frappe-cloud-v2` (kept as a snapshot). Spec lives at `~/Dev/FC-V2-PROTOTYPE-SPEC.md`; the states spec/catalog at `~/.claude/plans/wiggly-cooking-pretzel.md`. Run `npm run dev`.

## Stack & conventions (carried from the original build)

- Vue 3 `<script setup>` + Vite + Pinia (dummy-data store `src/stores/cloud.js`) + Vue Router. Pinned **frappe-ui@1.0.0-beta.4** deliberately (matches the local frappe-ui checkout; npm `latest` is older). Keep the `frappe-ui/vite` plugin enabled (its components import `~icons/lucide/*`); `frappe-ui/style.css` is the single CSS entry.
- Copy rules: never "bench"/"VM" in the UI (say **"Server"**); prices in ₹, credit in $; raw compute/db specs only behind a "details / raw specs" reveal. Radius: `rounded-lg` (≤8px) for small, `rounded-xl` (12px) for large cards only.
- Destructive actions = type-to-confirm (`DropSiteDialog`) or `ConfirmDialog`. Mutating actions are async via `store._work(fn, ms)` + `toast.promise`; `store.busy` drives a thin top progress bar.
- **frappe-ui Alert themes are only `yellow` / `blue` / `red` / `green`** — `amber` / `orange` silently render with no background ("ghost" alert).
- Gotcha: beta.4 `FormControl type=select` renders a reka-ui combobox (no native `<select>`) — synthetic `.click()` won't select options in tests; real pointer events work.

## Rebuild direction (why the fork exists)

- Driven by the **`FINAL AI SITEMAP`** (FigJam `2OajVQCFcOP0O4Vz8X3nwW`, node `46:949`): a Central → Server → Site IA where each node lists its quick actions. Central UI design in Figma `ue3YoCwlx9z7S4sdQYO2pY` node `79:21846` (servers-list with world map; new-server flow zooms world→provider→region; Server overview = sites grid + right specs/usage panel).
- **One Vue app, two layout shells**: `CentralShell` (servers map+list, billing, users, marketplace) and `ServerShell` (overview, sites, dev tools); `currentServerId` clears on return to Central.
- **Region map = stylized dotted SVG + scripted zoom** (`RegionMap.vue`, no map library); needs region `{x,y}` coords + DigitalOcean in `src/data/catalog.js`.
- **Every sitemap quick action is wired** to a real mock effect (state change / dialog / toast), not just navigation.
- Personas: **fresh / grown / credit-expired** (Partner + Low-credit removed). Onboarding: provider/region card-grid removed from `ServerStep` → moved into the "Compare plans" modal as dropdowns. Sitemap defaults: restart at server+site level; keep processes list; app-update asks "this site / all sites"; keep Move site; Restore primary in Backups; Tasks/logs combine server+site with a filter.
- Build phases tracked as tasks 1–9 (spec §12); Phase 1 (fork + strip) complete.

## Edge / error / empty states (complete & verified)

Single **"Edge mode" demo toggle** in `DemoSwitch.vue` drives the unhappy path — `store.edgeMode` + `setEdgeMode(on)` loads the grown baseline then overlays worst-case data (declined card, overdue invoice, suspended server, no payout account, failed domain DNS, bouncing email, blank tax ID), and `_work()` rejects so every async action fails → retry. The `fresh` persona owns empty states.

Added reusable `EmptyState.vue` / `ErrorState.vue` + `src/utils/validate.js` (tax / email / port / url / ssh). Wired across billing, Overview lifecycle banners, deploy-fail, domain verify, firewall SSH-lockout, DB query-error / zero-rows, drop-site, restore, marketplace, logs, central settings.

**Discoverability rule:** every problem state must show an inline fix path, not just a label. Don't chain co-occurring alerts with `v-else-if` (they hide each other) — use independent `v-if` and/or put the fix on the relevant card.

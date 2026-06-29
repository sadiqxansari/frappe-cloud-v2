# Plan redesign + schedule polish — spec

_FC V2 prototype. Two independent workstreams. Copy follows the FC voice & copy guide (calm operator, sentence case, shortest familiar term, ₹ prices / $ credit, near-zero emoji)._

---

## Workstream 1 — Plans: 3 curated + 1 fully custom

### Why
Seven plans (Hobby → Heavy) is a wall of SKUs, and the list will only grow. Collapse to **three curated plans plus a fully customizable fourth**, so the common case is one of three clear picks and the power case is "dial in exactly what you want."

### The four options
| id | name | best for | vCPU | RAM | Storage | ₹/mo (base) |
|----|------|----------|------|-----|---------|-------------|
| `starter` | Starter | 1–3 people | 2 | 4 GB | 40 GB | 1,900 (**recommended**) |
| `business` | Business | teams of 5–25 | 4 | 8 GB | 75 GB | 4,100 (**most picked**) |
| `enterprise` | Enterprise | teams of 25+ | 8 | 16 GB | 160 GB | 8,200 |
| `custom` | Custom | "you set the specs" | slider | slider | slider | per-unit total |

- **No more `Hobby / Standard / Growth / Busy / Heavy`.** No `featured` / `enterprise` flag, no Standard/Enterprise split.
- **Remove the "Product warranty" column/tick** from the Change-plan dialog entirely.

### Custom plan — the model
- User controls three resources with **sliders, live in the picker** (not a separate screen): **CPU (vCPU)**, **Memory (GB)**, **Storage (GB)**.
- Price = **per-unit × quantity, summed**, then region-factored and rounded like every other price.
- Curated plans are priced a touch **below** the equivalent custom build — picking a named plan is honest value, Custom is the escape hatch.

```
UNIT_PRICING = { vcpu: 500/mo, memory: 250/mo per GB, disk: 7/mo per GB }   // ₹, pre-region
CUSTOM_LIMITS = {
  vcpu:   { min: 1,  max: 32,   step: 1,  label: 'CPU',     unit: 'vCPU' },
  memory: { min: 1,  max: 128,  step: 1,  label: 'Memory',  unit: 'GB'   },
  disk:   { min: 10, max: 1000, step: 10, label: 'Storage', unit: 'GB'   },
}
CUSTOM_DEFAULT = { vcpu: 4, memory: 8, disk: 80 }     // ≈ ₹4,560/mo, sits next to Business
```

### Data changes — `src/data/catalog.js`
1. Replace `PLANS` with the three curated objects. **`specs` becomes numeric**: `{ vcpu, memory, disk, database }` (vCPU count + GB). Add `bestFor` (short audience line) and a `popular` flag on Business.
2. Add `CUSTOM_PLAN` (id `custom`, name, blurb, `bestFor`), `UNIT_PRICING`, `CUSTOM_LIMITS`, `CUSTOM_DEFAULT`.
3. `ALL_PLANS = [...PLANS, CUSTOM_PLAN]`; `planById` resolves from `ALL_PLANS`.
4. Drop `FEATURED_PLANS`, `STANDARD_PLANS`, `ENTERPRISE_PLANS`. `TEAM_SIZE_TO_PLAN`: `solo→starter, small→business, large→enterprise`.
5. `customMonthly(spec)` → summed per-unit. `priceFor(planId, regionId, customSpec)` branches: custom → `customMonthly`, else `plan.priceMonthly`; same region-factor + round.
6. `fmtSpec(key, val)` → `"2 vCPU" | "8 GB RAM" | "75 GB SSD"` for display; specs are numbers now.

### Store changes — `src/stores/cloud.js`
- Servers carry an optional **`customSpec`** (`{ vcpu, memory, disk }`), set only when `planId === 'custom'`.
- Add getter **`specsOf(server)`** → `customSpec` when custom, else `planById.specs`. Re-point `healthOf` (disk total) and any `parseInt(specs.disk)` at numeric specs / `specsOf`.
- `monthlyPriceOf(server)` passes `server.customSpec` into `priceFor`.
- `resizeServer(serverId, planId, customSpec?)`, `migrateServer(... toCustomSpec)`, `addServer`/`provisionServer` thread `customSpec`.
- **Reseed**: every seeded `planId: 'standard'` → `'starter'` (specs match); plan names in seeded `invoices` / `planHistory` strings updated (`Standard → Starter`). Keep `business`.
- `CHEAPEST_PLAN_ID` / `recommendedPlanId` → `starter`.

### New reusable component — `src/components/PlanPicker.vue`
The single source of truth for choosing a plan, used by every plan surface.
- Props: `v-model:planId`, `v-model:customSpec`, `regionId`, optional `currentPlanId`/`currentSpec` (for "Current" badge), `layout` (`'cards'` default | `'rows'` compact for NewServerPage).
- Renders the 3 curated plans + a **Custom** option. Each shows name, `bestFor`, the three specs (via `fmtSpec`), region-aware ₹/mo, and badges (`Recommended` on Starter, `Most picked` on Business, `Current`).
- Selecting **Custom expands an inline panel** in place: three **frappe-ui `Slider`s** (CPU / Memory / Storage) — note `Slider` v-model is an **array**, so wrap each value `[n]` and read `[0]`. Each row: label, live value (`4 vCPU`), slider, and the running **total ₹/mo** updating as you drag. Small caption: "Billed by the day. Resize anytime."
- Emits selection upward; no store writes inside the component.

### Wiring the plan surfaces
- **`ChangePlanDialog.vue`** — replace the 7-row ladder + warranty column with `<PlanPicker>`. Keep region picker, billing affordability checks (`priceFor` now takes `customSpec`), the review/migration step, scheduler. `doResize`/`doMigrate` pass `customSpec`.
- **`pages/setup/ServerStep.vue`** — recommended card stays; "Compare plans" dialog body becomes `<PlanPicker>`. Drop "Show all N sizes" / `FEATURED_PLANS`. Keep the "Free while your $25 credit lasts" framing.
- **`pages/manage/NewServerPage.vue`** — plan list becomes `<PlanPicker layout="rows">`. Pass `customSpec` to `addServer`.
- **Display-only** (`SystemInfoDialog`, `FcManageModal`, `OverviewPage`, `ServersPage`): show resolved specs/price via `specsOf` / `monthlyPriceOf`; render `Custom` as the plan name when `planId === 'custom'`.

---

## Workstream 2 — Schedule pickers: obvious presets + frappe-ui date/time

### Why
Today's schedulers are a bare `datetime-local` (UpdateServerDialog) and split `date`+`time` FormControls (ChangePlanDialog). Apple's move: offer a few **obvious named times** first (Tonight, Tomorrow morning…), with **Custom** as the escape hatch that opens a real **frappe-ui `DateTimePicker`**.

### New reusable component — `src/components/ScheduleField.vue`
- `v-model` = an ISO-ish local datetime string (`YYYY-MM-DD HH:mm:ss`, the format frappe-ui `DateTimePicker` emits) or `''` when "now".
- Presets as selectable chips/rows, each resolving to a concrete future datetime:
  - **Tonight** — today 22:00 (skip if already past → hidden)
  - **Tomorrow morning** — tomorrow 09:00
  - **This weekend** — upcoming Saturday 09:00
  - **Custom…** — reveals a frappe-ui **`DateTimePicker`** (`:min` = now)
- Selected preset shows a resolved human label ("Tonight, 10:00 PM"). Only future times offered; past presets drop out.
- Pure UI: emits the chosen datetime; parent owns persistence.

### Wiring
- **`UpdateServerDialog.vue`** — replace the raw `<input type="datetime-local">` (+ "Schedule for later" checkbox) with the checkbox revealing `<ScheduleField>`. `scheduleServerUpdate({ at })` gets the resolved string. `fmt()` already formats it.
- **`ChangePlanDialog.vue`** — replace the side-by-side `date`+`time` FormControls with `<ScheduleField>`; `doMigrate` sends the single `scheduledAt`. Drop `scheduledDate/Time`, `minScheduleTime`, `scheduledInPast` (ScheduleField guarantees future).
- **`SiteDetailPage.vue` backups** — recurring, not one-shot, so keep the frequency model but upgrade the custom-schedule dialog's **hour `select` → frappe-ui `TimePicker`**, and keep the preset frequencies. (Lighter touch; the preset pattern already exists here.)

### Copy (voice guide)
- Presets: "Tonight", "Tomorrow morning", "This weekend", "Custom…". Toggle label stays "Schedule for later".
- Confirmation toasts unchanged in shape: "Updates scheduled for {when}", "Migration scheduled for {when}". Resolved `{when}` via existing `fmt`/`toLocaleString`.

---

## Build order
1. `catalog.js` data model + pricing helpers.
2. `cloud.js` store (specsOf, customSpec threading, reseed standard→starter, pricing).
3. `PlanPicker.vue` (+ inline custom sliders).
4. Wire ChangePlanDialog, ServerStep, NewServerPage, display surfaces.
5. `ScheduleField.vue`; wire UpdateServerDialog + ChangePlanDialog; TimePicker in SiteDetailPage backups.
6. Verify in preview: onboarding compare, change-plan (curated + custom drag), new server, schedule-update presets. No console errors.

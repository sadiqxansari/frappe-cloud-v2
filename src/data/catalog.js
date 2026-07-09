// Static catalogs — plans, regions, versions and installable apps.

// Three curated plans plus a fully custom fourth. Curated plans are the common
// case (one of three clear picks); Custom is the escape hatch where the user
// dials in CPU, memory and storage with sliders (see PlanPicker). `specs` are
// numeric now — vCPU count and GB — formatted for display via `fmtSpec`.
// `bestFor` is the short audience line; `recommended` drives the onboarding
// suggestion; `popular` marks the one most teams pick.
export const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    priceMonthly: 1900,
    bestFor: 'For 1–3 people',
    blurb: 'A small site or a side project, comfortably.',
    features: ['Runs one app for a small team', 'Daily backups', 'Email support'],
    specs: { vcpu: 2, memory: 4, disk: 40, database: 1 },
    recommended: true,
  },
  {
    id: 'business',
    name: 'Business',
    priceMonthly: 4100,
    bestFor: 'For teams of 5–25',
    blurb: 'ERPNext for a growing team, with room for a few apps.',
    features: ['Comfortable for daily ERPNext use', 'Daily backups and monitoring', 'Room for a few apps'],
    specs: { vcpu: 4, memory: 8, disk: 75, database: 2 },
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceMonthly: 8200,
    bestFor: 'For teams of 25+',
    blurb: 'Heavy, busy workloads for a larger team.',
    features: ['Built for heavy, busy workloads', 'Daily backups and monitoring', 'Priority support'],
    specs: { vcpu: 8, memory: 16, disk: 160, database: 4 },
  },
]

// The custom plan isn't a fixed size — the user sets vCPU, memory and storage
// with sliders, and the price is summed per unit (see UNIT_PRICING). It carries
// no fixed `specs`; the chosen config lives on the server as `customSpec`.
export const CUSTOM_PLAN = {
  id: 'custom',
  name: 'Custom',
  bestFor: 'You set the specs',
  blurb: 'Dial in exactly the CPU, memory and storage you need.',
  custom: true,
}

export const ALL_PLANS = [...PLANS, CUSTOM_PLAN]

// Per-unit monthly price (₹, before the region factor) for a custom build.
// Curated plans are priced a touch below the equivalent custom total, so a
// named plan is honest value and Custom is the escape hatch.
export const UNIT_PRICING = { vcpu: 500, memory: 250, disk: 7 }

// Compute is a fixed ladder of vCPU counts. The slider rides this list.
export const COMPUTE_SIZES = [0.125, 0.25, 0.5, 1, 2, 4, 8, 16, 32, 64, 128, 256]

// Memory pairs with vCPU within a supported band, set as GB of RAM per vCPU.
// 2× (compute), 4× (balanced), 8× (memory-heavy) — anything outside isn't a
// buildable shape (a stray ratio strands the host's other resource). DEFAULT
// is what a fresh pick and a slider move land on.
export const MEMORY_RATIOS = [2, 4, 8]
export const DEFAULT_RATIO = 2
// Shown in the memory menu — ratios outside MEMORY_RATIOS render disabled so
// the supported band is visible, not hidden.
export const MEMORY_RATIOS_SHOWN = [1, 2, 4, 8, 16]

// Memory options for a vCPU count: the value (GB), its ratio, and whether it's
// a supported shape. Used to build the memory dropdown.
export function memoryOptionsFor(vcpu) {
  return MEMORY_RATIOS_SHOWN.map((ratio) => ({
    memory: vcpu * ratio,
    ratio,
    supported: MEMORY_RATIOS.includes(ratio),
  }))
}

// The supported memory range (GB) for a vCPU count — for menu hint copy.
export function memoryRangeFor(vcpu) {
  return { min: vcpu * MEMORY_RATIOS[0], max: vcpu * MEMORY_RATIOS[MEMORY_RATIOS.length - 1] }
}

// Storage is the one independently-set dimension — a number stepper bounded
// by min/max/step. (Compute lives in COMPUTE_SIZES above.)
export const CUSTOM_LIMITS = {
  disk: { min: 10, max: 1000, step: 10, label: 'Storage', unit: 'GB' },
}

// Common storage sizes for the quick-pick dropdown; the stepper still nudges
// by 10 GB for anything in between.
export const DISK_CHOICES = [10, 20, 50, 100, 200, 500, 1000]

// Pretty vCPU label — sub-1 cores read as fractions (⅛, ¼, ½).
const VCPU_FRACTIONS = { 0.125: '⅛', 0.25: '¼', 0.5: '½' }
export function fmtVcpu(v) {
  return VCPU_FRACTIONS[v] || String(v)
}

// Where the custom sliders start — sits right next to Business.
export const CUSTOM_DEFAULT = { vcpu: 4, memory: 8, disk: 80 }

// Sum the per-unit prices for a custom resource picture.
export function customMonthly(spec = CUSTOM_DEFAULT) {
  return (
    spec.vcpu * UNIT_PRICING.vcpu +
    spec.memory * UNIT_PRICING.memory +
    spec.disk * UNIT_PRICING.disk
  )
}

// Human label for a numeric spec value.
export function fmtSpec(key, val) {
  if (val == null) return '—'
  if (key === 'vcpu') return `${fmtVcpu(val)} vCPU`
  if (key === 'memory') return `${val} GB RAM`
  if (key === 'disk') return `${val} GB SSD`
  if (key === 'database') return `${val} GB DB`
  return String(val)
}

// Cluster management stays internal. Users pick a provider and a region —
// each provider runs its own set of regions, and pricing follows the
// provider (it's mostly a cost difference). `mono`/`tile` render a small
// brand monogram in the picker.
export const PROVIDERS = [
  { id: 'aws', name: 'Amazon Web Services', short: 'AWS', mono: 'AWS', tile: 'bg-surface-gray-3 text-ink-gray-8', priceFactor: 1 },
  { id: 'hetzner', name: 'Hetzner', short: 'Hetzner', mono: 'H', tile: 'bg-surface-red-2 text-ink-red-8', priceFactor: 0.8 },
  { id: 'frappe', name: 'Frappe', short: 'Frappe', mono: 'F', tile: 'bg-surface-gray-8 text-ink-base', priceFactor: 0.7 },
  { id: 'oracle', name: 'Oracle Cloud', short: 'Oracle', mono: 'O', tile: 'bg-surface-amber-2 text-ink-amber-8', priceFactor: 0.95 },
  { id: 'digitalocean', name: 'DigitalOcean', short: 'DO', mono: 'DO', tile: 'bg-surface-blue-2 text-ink-blue-8', priceFactor: 0.9 },
]

// Each region belongs to a provider; some are still in beta.
// `lat`/`lng` are the real coordinates WorldMap projects onto the dotted SVG.
// (`x`/`y` are legacy coords from the old hand-drawn map, kept harmlessly.)
// `lat`/`lng` are the real city coordinates — WorldMap projects them onto the
// dotted SVG (equirectangular). `x`/`y` remain for the legacy RegionMap zoom.
export const REGIONS = [
  { id: 'aws-mumbai', providerId: 'aws', name: 'Mumbai, India', flag: '🇮🇳', x: 702, y: 197, lat: 19.07, lng: 72.87 },
  { id: 'aws-sydney', providerId: 'aws', name: 'Sydney, Australia', flag: '🇦🇺', x: 905, y: 360, lat: -33.87, lng: 151.21 },
  { id: 'aws-zurich', providerId: 'aws', name: 'Zurich, Switzerland', flag: '🇨🇭', x: 521, y: 120, lat: 47.37, lng: 8.54 },
  { id: 'aws-singapore', providerId: 'aws', name: 'Singapore', flag: '🇸🇬', x: 786, y: 248, lat: 1.35, lng: 103.82 },
  { id: 'aws-frankfurt', providerId: 'aws', name: 'Frankfurt, Germany', flag: '🇩🇪', x: 524, y: 113, lat: 50.11, lng: 8.68 },
  { id: 'aws-virginia', providerId: 'aws', name: 'N. Virginia, USA', flag: '🇺🇸', x: 285, y: 146, lat: 39.04, lng: -77.49 },
  { id: 'aws-london', providerId: 'aws', name: 'London, UK', flag: '🇬🇧', x: 500, y: 109, lat: 51.51, lng: -0.13 },
  { id: 'aws-capetown', providerId: 'aws', name: 'Cape Town, South Africa', flag: '🇿🇦', x: 551, y: 344, lat: -33.92, lng: 18.42 },
  { id: 'aws-jakarta', providerId: 'aws', name: 'Jakarta, Indonesia', flag: '🇮🇩', x: 794, y: 268, lat: -6.21, lng: 106.85 },
  { id: 'aws-uae', providerId: 'aws', name: 'United Arab Emirates', flag: '🇦🇪', x: 640, y: 178, lat: 25.20, lng: 55.27 },
  { id: 'hetzner-falkenstein', providerId: 'hetzner', name: 'Falkenstein, Germany', flag: '🇩🇪', x: 534, y: 111, lat: 50.48, lng: 12.37 },
  { id: 'hetzner-nuremberg', providerId: 'hetzner', name: 'Nuremberg, Germany', flag: '🇩🇪', beta: true, x: 530, y: 114, lat: 49.45, lng: 11.08 },
  { id: 'frappe-navimumbai', providerId: 'frappe', name: 'Navi Mumbai, India', flag: '🇮🇳', beta: true, x: 704, y: 198, lat: 19.03, lng: 73.03 },
  { id: 'oracle-jeddah', providerId: 'oracle', name: 'Jeddah, Saudi Arabia', flag: '🇸🇦', x: 609, y: 190, lat: 21.49, lng: 39.19 },
  { id: 'oracle-johannesburg', providerId: 'oracle', name: 'Johannesburg, South Africa', flag: '🇿🇦', x: 578, y: 323, lat: -26.20, lng: 28.05 },
  { id: 'do-nyc', providerId: 'digitalocean', name: 'New York, USA', flag: '🇺🇸', x: 294, y: 137, lat: 40.71, lng: -74.01 },
  { id: 'do-ams', providerId: 'digitalocean', name: 'Amsterdam, Netherlands', flag: '🇳🇱', x: 514, y: 104, lat: 52.37, lng: 4.90 },
  { id: 'do-blr', providerId: 'digitalocean', name: 'Bangalore, India', flag: '🇮🇳', x: 715, y: 214, lat: 12.97, lng: 77.59 },
  { id: 'do-sfo', providerId: 'digitalocean', name: 'San Francisco, USA', flag: '🇺🇸', x: 165, y: 150, lat: 37.77, lng: -122.42 },
]

// A server runs one Frappe version; sites inherit it. Moving a site to a
// different version means moving it to a server running that version.
export const VERSIONS = [
  { id: 'v15', label: 'Version 15', note: 'Stable — what most teams run' },
  { id: 'v16', label: 'Version 16', note: 'Latest features, newest apps' },
  { id: 'v14', label: 'Version 14', note: 'Older — for apps that need it' },
  { id: 'nightly', label: 'Nightly', note: 'Develop branch — for testing only' },
]

// The newest patch build available within each major. A server below this has a
// server-level "update" (a patch within the same version, distinct from a
// cross-version "change"). See issue #24.
export const LATEST_BUILDS = {
  v15: '15.78.4',
  v16: '16.0.0-beta.3',
  v14: '14.92.6',
  nightly: 'develop',
}
export function latestBuildFor(version) {
  return LATEST_BUILDS[version] || '—'
}

// `version` is what a fresh install gets; `latestVersion` (when ahead) drives
// the calm "Update available" affordance on a site's Apps tab. `compat` lists
// the server versions an app runs on — mismatches surface in the marketplace
// as "Needs Version X" with a guided move.
export const APP_CATALOG = [
  {
    key: 'erpnext',
    installs: '221k',
    name: 'ERPNext',
    version: 'v15',
    latestVersion: 'v15',
    tagline: 'Accounting, inventory and orders — the core of your business',
    compat: ['v15', 'v16'],
    letter: 'E',
    tile: 'bg-surface-blue-2 text-ink-blue-8',
  },
  {
    key: 'hr',
    installs: '96k',
    name: 'Frappe HR',
    version: 'v15',
    latestVersion: 'v15.2',
    tagline: 'Payroll, leave and your whole team in one place',
    compat: ['v15', 'v16'],
    letter: 'H',
    tile: 'bg-surface-green-2 text-ink-green-6',
  },
  {
    key: 'crm',
    installs: '74k',
    name: 'Frappe CRM',
    version: 'v1.5',
    latestVersion: 'v1.6',
    tagline: 'Leads and deals, without the spreadsheet',
    compat: ['v15', 'v16'],
    letter: 'C',
    tile: 'bg-surface-amber-2 text-ink-amber-8',
  },
  {
    key: 'helpdesk',
    installs: '41k',
    name: 'Helpdesk',
    version: 'v1.2',
    latestVersion: 'v1.2',
    tagline: 'Customer support tickets, kept tidy',
    compat: ['v15', 'v16'],
    letter: 'D',
    tile: 'bg-surface-red-2 text-ink-red-8',
  },
  {
    key: 'drive',
    installs: '38k',
    name: 'Frappe Drive',
    version: 'v0.9',
    latestVersion: 'v0.9',
    tagline: 'Files and documents for your team',
    compat: ['v15', 'v16'],
    letter: 'F',
    tile: 'bg-surface-gray-2 text-ink-gray-7',
  },
  {
    key: 'insights',
    installs: '52k',
    name: 'Frappe Insights',
    version: 'v3.1',
    latestVersion: 'v3.1',
    tagline: 'Dashboards and reports from the data you already have',
    compat: ['v15', 'v16'],
    letter: 'I',
    tile: 'bg-surface-blue-2 text-ink-blue-8',
  },
  {
    key: 'builder',
    installs: '29k',
    name: 'Frappe Builder',
    version: 'v1.0',
    latestVersion: 'v1.0',
    tagline: 'Build your website by dragging things where you want them',
    compat: ['v16'],
    letter: 'B',
    tile: 'bg-surface-gray-2 text-ink-gray-7',
  },
  {
    key: 'lending',
    installs: '12k',
    name: 'Frappe Lending',
    version: 'v0.1',
    latestVersion: 'v0.1',
    tagline: 'Loans, EMIs and repayments, tracked properly',
    compat: ['v15', 'v16'],
    letter: 'L',
    tile: 'bg-surface-green-2 text-ink-green-6',
  },
  {
    key: 'lms',
    installs: '33k',
    name: 'Frappe Learning',
    version: 'v2.4',
    latestVersion: 'v2.4',
    tagline: 'Courses and training for your team or your customers',
    compat: ['v15', 'v16'],
    letter: 'L',
    tile: 'bg-surface-amber-2 text-ink-amber-8',
  },
  {
    key: 'mail',
    installs: '8k',
    name: 'Frappe Mail',
    version: 'v0.2',
    latestVersion: 'v0.2',
    tagline: 'Email for your team, on your own domain',
    compat: ['v16'],
    letter: 'M',
    tile: 'bg-surface-blue-2 text-ink-blue-8',
  },
  {
    key: 'school',
    installs: '17k',
    name: 'Frappe Education',
    version: 'v1.1',
    latestVersion: 'v1.1',
    tagline: 'Run a school — admissions to report cards',
    compat: ['v15'],
    letter: 'S',
    tile: 'bg-surface-red-2 text-ink-red-8',
  },

  // — Mock catalog (prototype only). These fill out the marketplace's category
  // sections so the browse experience feels real; they install through the same
  // flow as the apps above (letter-tile icons, no bundled logo asset).
  { key: 'manufacturing', installs: '19k', name: 'Frappe Manufacturing', version: 'v15', latestVersion: 'v15', tagline: 'Production planning and the shop floor, connected', compat: ['v15', 'v16'], letter: 'M', tile: 'bg-surface-amber-2 text-ink-amber-8' },
  { key: 'nonprofit', installs: '6k', name: 'Frappe NonProfit', version: 'v15', latestVersion: 'v15', tagline: 'Donors, grants and members in one place', compat: ['v15'], letter: 'N', tile: 'bg-surface-green-2 text-ink-green-6' },
  { key: 'healthcare', installs: '23k', name: 'Frappe Healthcare', version: 'v15', latestVersion: 'v15', tagline: 'Patients, appointments and records', compat: ['v15', 'v16'], letter: 'H', tile: 'bg-surface-red-2 text-ink-red-8' },
  { key: 'agriculture', installs: '4k', name: 'Frappe Agriculture', version: 'v15', latestVersion: 'v15', tagline: 'Crops, land and harvest cycles, tracked', compat: ['v15'], letter: 'A', tile: 'bg-surface-green-2 text-ink-green-6' },

  { key: 'gameplan', installs: '27k', name: 'Gameplan', version: 'v1.0', latestVersion: 'v1.0', tagline: "Team discussions that don't get lost", compat: ['v15', 'v16'], letter: 'G', tile: 'bg-surface-blue-2 text-ink-blue-8' },
  { key: 'wiki', installs: '14k', name: 'Frappe Wiki', version: 'v1.0', latestVersion: 'v1.0', tagline: 'A knowledge base your team will actually use', compat: ['v15', 'v16'], letter: 'W', tile: 'bg-surface-gray-2 text-ink-gray-7' },
  { key: 'print-designer', installs: '15k', name: 'Print Designer', version: 'v1.2', latestVersion: 'v1.2', tagline: 'Design pixel-perfect invoices and forms', compat: ['v16'], letter: 'P', tile: 'bg-surface-amber-2 text-ink-amber-8' },
  { key: 'raven', installs: '22k', name: 'Raven', version: 'v1.6', latestVersion: 'v1.6', tagline: 'Team chat, right inside Frappe', compat: ['v15', 'v16'], letter: 'R', tile: 'bg-surface-blue-2 text-ink-blue-8' },
  { key: 'notes', installs: '9k', name: 'Frappe Notes', version: 'v0.4', latestVersion: 'v0.4', tagline: 'Quick notes and to-dos, synced', compat: ['v15', 'v16'], letter: 'N', tile: 'bg-surface-gray-2 text-ink-gray-7' },

  { key: 'whatsapp', installs: '31k', name: 'WhatsApp Integration', version: 'v2.1', latestVersion: 'v2.1', tagline: 'Send and receive WhatsApp messages', compat: ['v15', 'v16'], letter: 'W', tile: 'bg-surface-green-2 text-ink-green-6' },
  { key: 'twilio', installs: '13k', name: 'Twilio', version: 'v1.3', latestVersion: 'v1.3', tagline: 'SMS and voice from your workflows', compat: ['v15', 'v16'], letter: 'T', tile: 'bg-surface-red-2 text-ink-red-8' },
  { key: 'slack', installs: '18k', name: 'Slack Notifications', version: 'v1.1', latestVersion: 'v1.1', tagline: 'Push alerts to your Slack channels', compat: ['v15', 'v16'], letter: 'S', tile: 'bg-surface-amber-2 text-ink-amber-8' },
  { key: 'shopify', installs: '16k', name: 'Shopify Connector', version: 'v2.0', latestVersion: 'v2.0', tagline: 'Sync orders and inventory with Shopify', compat: ['v15', 'v16'], letter: 'S', tile: 'bg-surface-green-2 text-ink-green-6' },
  { key: 'google-workspace', installs: '20k', name: 'Google Workspace', version: 'v1.4', latestVersion: 'v1.4', tagline: 'Calendar, contacts and drive sync', compat: ['v15', 'v16'], letter: 'G', tile: 'bg-surface-blue-2 text-ink-blue-8' },
  { key: 'zapier', installs: '11k', name: 'Zapier', version: 'v1.0', latestVersion: 'v1.0', tagline: 'Connect Frappe to thousands of apps', compat: ['v15', 'v16'], letter: 'Z', tile: 'bg-surface-amber-2 text-ink-amber-8' },
  { key: 'webhooks-plus', installs: '7k', name: 'Webhooks Plus', version: 'v0.8', latestVersion: 'v0.8', tagline: 'Fire events to any external service', compat: ['v16'], letter: 'W', tile: 'bg-surface-gray-2 text-ink-gray-7' },

  { key: 'razorpay', installs: '45k', name: 'Razorpay', version: 'v2.3', latestVersion: 'v2.3', tagline: 'Accept payments across India', compat: ['v15', 'v16'], letter: 'R', tile: 'bg-surface-blue-2 text-ink-blue-8' },
  { key: 'stripe', installs: '39k', name: 'Stripe Payments', version: 'v2.1', latestVersion: 'v2.1', tagline: 'Cards and wallets, worldwide', compat: ['v15', 'v16'], letter: 'S', tile: 'bg-surface-blue-2 text-ink-blue-8' },
  { key: 'paypal', installs: '26k', name: 'PayPal', version: 'v1.7', latestVersion: 'v1.7', tagline: 'The wallet your customers already have', compat: ['v15', 'v16'], letter: 'P', tile: 'bg-surface-blue-2 text-ink-blue-8' },
  { key: 'mpesa', installs: '10k', name: 'M-Pesa', version: 'v1.0', latestVersion: 'v1.0', tagline: 'Mobile money for East Africa', compat: ['v15'], letter: 'M', tile: 'bg-surface-green-2 text-ink-green-6' },
  { key: 'gocardless', installs: '8k', name: 'GoCardless', version: 'v1.2', latestVersion: 'v1.2', tagline: 'Recurring bank debits, automated', compat: ['v15', 'v16'], letter: 'G', tile: 'bg-surface-amber-2 text-ink-amber-8' },
  { key: 'paytm', installs: '12k', name: 'Paytm', version: 'v1.5', latestVersion: 'v1.5', tagline: 'UPI and wallet payments', compat: ['v15'], letter: 'P', tile: 'bg-surface-blue-2 text-ink-blue-8' },
  { key: 'braintree', installs: '5k', name: 'Braintree', version: 'v1.0', latestVersion: 'v1.0', tagline: "PayPal's full-stack payments", compat: ['v16'], letter: 'B', tile: 'bg-surface-gray-2 text-ink-gray-7' },

  { key: 'swagger', installs: '21k', name: 'Swagger UI', version: 'v1.1', latestVersion: 'v1.1', tagline: 'Explore your API interactively', compat: ['v15', 'v16'], letter: 'S', tile: 'bg-surface-green-2 text-ink-green-6' },
  { key: 'press', installs: '9k', name: 'Frappe Press', version: 'v0.3', latestVersion: 'v0.3', tagline: 'Self-host the Frappe Cloud dashboard', compat: ['v16'], letter: 'P', tile: 'bg-surface-gray-2 text-ink-gray-7' },
  { key: 'frappe-types', installs: '7k', name: 'Frappe Types', version: 'v0.6', latestVersion: 'v0.6', tagline: 'TypeScript types for your DocTypes', compat: ['v15', 'v16'], letter: 'T', tile: 'bg-surface-blue-2 text-ink-blue-8' },
  { key: 'data-migration', installs: '6k', name: 'Data Migration Tool', version: 'v1.0', latestVersion: 'v1.0', tagline: 'Move data between sites safely', compat: ['v15', 'v16'], letter: 'D', tile: 'bg-surface-amber-2 text-ink-amber-8' },
  { key: 'api-logs', installs: '5k', name: 'API Logger', version: 'v0.9', latestVersion: 'v0.9', tagline: 'Trace every request and response', compat: ['v15', 'v16'], letter: 'A', tile: 'bg-surface-red-2 text-ink-red-8' },
  { key: 'webhook-tester', installs: '4k', name: 'Webhook Tester', version: 'v0.5', latestVersion: 'v0.5', tagline: 'Inspect incoming webhooks live', compat: ['v16'], letter: 'W', tile: 'bg-surface-gray-2 text-ink-gray-7' },
  { key: 'sql-notebook', installs: '8k', name: 'SQL Notebook', version: 'v1.0', latestVersion: 'v1.0', tagline: 'Query your database in a notebook', compat: ['v15', 'v16'], letter: 'S', tile: 'bg-surface-blue-2 text-ink-blue-8' },

  { key: 'india-compliance', installs: '24k', name: 'India Compliance', version: 'v15', latestVersion: 'v15', tagline: 'GST, e-invoicing and returns', compat: ['v15', 'v16'], letter: 'I', tile: 'bg-surface-amber-2 text-ink-amber-8' },
  { key: 'kenya-csf', installs: '3k', name: 'Kenya CSF', version: 'v15', latestVersion: 'v15', tagline: 'Country-specific functions for Kenya', compat: ['v15'], letter: 'K', tile: 'bg-surface-red-2 text-ink-red-8' },
  { key: 'uae-vat', installs: '7k', name: 'UAE VAT', version: 'v15', latestVersion: 'v15', tagline: 'VAT filing for the Emirates', compat: ['v15', 'v16'], letter: 'U', tile: 'bg-surface-green-2 text-ink-green-6' },
  { key: 'ksa-zatca', installs: '6k', name: 'KSA ZATCA', version: 'v15', latestVersion: 'v15', tagline: 'ZATCA e-invoicing for Saudi Arabia', compat: ['v15', 'v16'], letter: 'K', tile: 'bg-surface-green-2 text-ink-green-6' },
  { key: 'us-payroll', installs: '9k', name: 'US Payroll', version: 'v15', latestVersion: 'v15', tagline: 'Federal and state payroll tax', compat: ['v15'], letter: 'U', tile: 'bg-surface-blue-2 text-ink-blue-8' },
  { key: 'germany-datev', installs: '4k', name: 'Germany DATEV', version: 'v16', latestVersion: 'v16', tagline: 'DATEV export for German accounting', compat: ['v16'], letter: 'G', tile: 'bg-surface-gray-2 text-ink-gray-7' },
  { key: 'brazil-nfe', installs: '5k', name: 'Brazil NF-e', version: 'v15', latestVersion: 'v15', tagline: 'Electronic invoicing for Brazil', compat: ['v15'], letter: 'B', tile: 'bg-surface-amber-2 text-ink-amber-8' },
  { key: 'nigeria-firs', installs: '3k', name: 'Nigeria FIRS', version: 'v15', latestVersion: 'v15', tagline: 'FIRS e-invoicing compliance', compat: ['v15', 'v16'], letter: 'N', tile: 'bg-surface-green-2 text-ink-green-6' },
]


// Marketplace categories, shaped for the FormControl type="select" filter.
export const APP_CATEGORIES = [
  { label: 'Integrations', value: 'integrations' },
  { label: 'Utility', value: 'utility' },
  { label: 'Payments', value: 'payments' },
  { label: 'Business', value: 'business' },
  { label: 'Dev Tools', value: 'dev-tools' },
  { label: 'Localization', value: 'localisation' },
]

// Which category each catalog app falls under (drives the marketplace filter).
const APP_CATEGORY = {
  erpnext: 'business',
  hr: 'business',
  crm: 'business',
  helpdesk: 'utility',
  drive: 'utility',
  insights: 'utility',
  builder: 'dev-tools',
  lending: 'payments',
  lms: 'business',
  mail: 'integrations',
  school: 'business',
  manufacturing: 'business',
  nonprofit: 'business',
  healthcare: 'business',
  agriculture: 'business',
  gameplan: 'utility',
  wiki: 'utility',
  'print-designer': 'utility',
  raven: 'utility',
  notes: 'utility',
  whatsapp: 'integrations',
  twilio: 'integrations',
  slack: 'integrations',
  shopify: 'integrations',
  'google-workspace': 'integrations',
  zapier: 'integrations',
  'webhooks-plus': 'integrations',
  razorpay: 'payments',
  stripe: 'payments',
  paypal: 'payments',
  mpesa: 'payments',
  gocardless: 'payments',
  paytm: 'payments',
  braintree: 'payments',
  swagger: 'dev-tools',
  press: 'dev-tools',
  'frappe-types': 'dev-tools',
  'data-migration': 'dev-tools',
  'api-logs': 'dev-tools',
  'webhook-tester': 'dev-tools',
  'sql-notebook': 'dev-tools',
  'india-compliance': 'localisation',
  'kenya-csf': 'localisation',
  'uae-vat': 'localisation',
  'ksa-zatca': 'localisation',
  'us-payroll': 'localisation',
  'germany-datev': 'localisation',
  'brazil-nfe': 'localisation',
  'nigeria-firs': 'localisation',
}

export function categoryOf(key) {
  return APP_CATEGORY[key] || null
}

// The Frappe app each marketplace app is primarily built to extend. Most apps
// are standalone apps on the framework; the rest bolt onto ERPNext (payments,
// country compliance, trade add-ons) or Frappe HR. Drives the marketplace's
// "Works with" filter. Anything unmapped works with the framework itself.
const APP_WORKS_WITH = {
  lending: 'ERPNext',
  manufacturing: 'ERPNext',
  nonprofit: 'ERPNext',
  agriculture: 'ERPNext',
  'print-designer': 'ERPNext',
  shopify: 'ERPNext',
  razorpay: 'ERPNext',
  stripe: 'ERPNext',
  paypal: 'ERPNext',
  mpesa: 'ERPNext',
  gocardless: 'ERPNext',
  paytm: 'ERPNext',
  braintree: 'ERPNext',
  'india-compliance': 'ERPNext',
  'kenya-csf': 'ERPNext',
  'uae-vat': 'ERPNext',
  'ksa-zatca': 'ERPNext',
  'germany-datev': 'ERPNext',
  'brazil-nfe': 'ERPNext',
  'nigeria-firs': 'ERPNext',
  'us-payroll': 'Frappe HR',
}

export function worksWithOf(key) {
  return APP_WORKS_WITH[key] || 'Frappe Framework'
}

// Apps built and maintained by Frappe itself, vs. third-party/community apps —
// drives the marketplace's "From Frappe" / "Community" grouping.
const FRAPPE_APP_KEYS = new Set([
  'erpnext', 'hr', 'crm', 'helpdesk', 'drive', 'insights', 'builder', 'lending',
  'lms', 'mail', 'school', 'manufacturing', 'nonprofit', 'healthcare', 'agriculture',
  'gameplan', 'wiki', 'print-designer', 'raven', 'notes',
])
export function isFrappeApp(key) {
  return FRAPPE_APP_KEYS.has(key)
}

export const TEAM_SIZE_TO_PLAN = {
  solo: 'starter',
  small: 'business',
  large: 'enterprise',
}

export function planById(id) {
  return ALL_PLANS.find((p) => p.id === id)
}

export function appByKey(key) {
  return APP_CATALOG.find((a) => a.key === key)
}

export function providerById(id) {
  return PROVIDERS.find((p) => p.id === id) || PROVIDERS[0]
}

export function regionsOf(providerId) {
  return REGIONS.filter((r) => r.providerId === providerId)
}

// Resolved region: includes its provider's short name and price factor.
export function regionById(id) {
  const region = REGIONS.find((r) => r.id === id) || REGIONS[0]
  const provider = providerById(region.providerId)
  return { ...region, provider: provider.short, priceFactor: provider.priceFactor }
}

export function versionById(id) {
  return VERSIONS.find((v) => v.id === id) || VERSIONS[0]
}

// Monthly price for a plan in a region, rounded to a tidy number.
// Pricing follows the provider behind the region. For the custom plan, pass the
// chosen resource picture as `customSpec`; the total is summed per unit.
export function priceFor(planId, regionId, customSpec) {
  const base = planId === 'custom' ? customMonthly(customSpec) : planById(planId).priceMonthly
  const factor = regionById(regionId).priceFactor
  return Math.round((base * factor) / 50) * 50
}

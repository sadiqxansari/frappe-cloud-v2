// Static catalogs — plans, regions, versions and installable apps.
// Plan copy leads with plain outcomes; raw specs only ever render
// behind a "details" toggle (see design principle: legible transparency).

// The full size ladder, in ascending price order. `featured` plans are the
// three we lead with in onboarding — the rest live behind "More sizes"
// (progressive disclosure, not a wall of SKUs). `recommended` drives the
// onboarding suggestion. `enterprise` marks the top tier (Product Warranty
// included) that the Change-plan dialog reveals behind its "Enterprise plans"
// toggle; keeping it a separate flag preserves the ascending-price ladder.
export const PLANS = [
  {
    id: 'hobby',
    name: 'Hobby',
    priceMonthly: 410,
    blurb: 'The smallest, cheapest way to get started. Resize the moment you need more.',
    features: ['Great for a first site or a side project', 'Daily backups', 'Community support'],
    specs: { compute: '30 min/day', database: '250 MB', disk: '2 GB' },
    featured: true,
    recommended: true,
  },
  {
    id: 'starter',
    name: 'Starter',
    priceMonthly: 820,
    blurb: 'For trying things out or running something small on the side.',
    features: ['Runs one app for 1–2 people', 'Daily backups', 'Email support'],
    specs: { compute: '1 hour/day', database: '500 MB', disk: '5 GB' },
    featured: true,
    recommended: false,
  },
  {
    id: 'standard',
    name: 'Standard',
    priceMonthly: 2050,
    blurb: 'One busy app, or a couple of small ones.',
    features: ['Good for small teams', 'Daily backups', 'Email support'],
    specs: { compute: '2 hours/day', database: '1 GB', disk: '25 GB' },
    featured: false,
    recommended: false,
  },
  {
    id: 'business',
    name: 'Business',
    priceMonthly: 4100,
    blurb: 'Comfortably runs ERPNext for a small team, with daily backups and monitoring.',
    features: ['Good for teams of 2–25 people', 'Daily backups and monitoring', 'Room for a few apps'],
    specs: { compute: '4 hours/day', database: '2 GB', disk: '50 GB' },
    featured: true,
    recommended: false,
  },
  {
    id: 'growth',
    name: 'Growth',
    priceMonthly: 6150,
    blurb: 'Headroom for several apps and more people.',
    features: ['Good for teams of 10–40 people', 'Daily backups and monitoring', 'Several apps, comfortably'],
    specs: { compute: '6 hours/day', database: '3 GB', disk: '75 GB' },
    featured: false,
    recommended: false,
    enterprise: true,
  },
  {
    id: 'busy',
    name: 'Busy',
    priceMonthly: 8200,
    blurb: 'For bigger teams and heavier day-to-day use.',
    features: ['Good for teams of 25 and up', 'Daily backups and monitoring', 'Plenty of headroom to grow'],
    specs: { compute: '8 hours/day', database: '4 GB', disk: '100 GB' },
    featured: false,
    recommended: false,
    enterprise: true,
  },
  {
    id: 'heavy',
    name: 'Heavy',
    priceMonthly: 12300,
    blurb: 'The biggest teams and the heaviest loads.',
    features: ['Good for 50+ people', 'Daily backups and monitoring', 'Priority support'],
    specs: { compute: '12 hours/day', database: '8 GB', disk: '200 GB' },
    featured: false,
    recommended: false,
    enterprise: true,
  },
]

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
]


// Marketplace categories, shaped for the FormControl type="select" filter.
export const APP_CATEGORIES = [
  { label: 'Integrations', value: 'integrations' },
  { label: 'Utility', value: 'utility' },
  { label: 'Payments', value: 'payments' },
  { label: 'Business', value: 'business' },
  { label: 'Dev tools', value: 'dev-tools' },
  { label: 'Localisation', value: 'localisation' },
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
}

export function categoryOf(key) {
  return APP_CATEGORY[key] || null
}

export const TEAM_SIZE_TO_PLAN = {
  solo: 'starter',
  small: 'business',
  large: 'busy',
}

export function planById(id) {
  return PLANS.find((p) => p.id === id)
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

export const FEATURED_PLANS = PLANS.filter((p) => p.featured)

// Change-plan grouping: standard tier shows by default, enterprise tier
// (Product Warranty included) reveals behind the toggle. Both keep PLANS'
// ascending-price order, so the combined list stays a monotonic ladder.
export const STANDARD_PLANS = PLANS.filter((p) => !p.enterprise)
export const ENTERPRISE_PLANS = PLANS.filter((p) => p.enterprise)

// Monthly price for a plan in a region, rounded to a tidy number.
// Pricing follows the provider behind the region.
export function priceFor(planId, regionId) {
  const base = planById(planId).priceMonthly
  const factor = regionById(regionId).priceFactor
  return Math.round((base * factor) / 50) * 50
}

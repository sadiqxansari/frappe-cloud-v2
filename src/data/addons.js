// Add-ons — platform services you buy by consumption rather than by the month.
// A server subscription is a fixed ₹/mo (see PLANS in catalog.js); an add-on is
// a rate times however much you used. That difference is the whole reason they
// bill differently and live on their own pages.
//
// One entry feeds three surfaces, so the shape has to serve all of them:
//   · the /addons catalogue card      → name, tagline, icon, priceLine, to
//   · the metered row on Billing      → meters[] (included, rate, unit)
//   · the service's own page          → everything above plus its own config
//
// Rates are in paise-free ₹ (project rule: prices in ₹, credit in $). `included`
// is the monthly allowance that costs nothing — the thing every usage bar is
// measured against.

export const ADDONS = [
  {
    key: 'ai',
    name: 'AI inference',
    icon: 'lucide-sparkles',
    to: '/addons/ai',
    tagline: 'Open models on Frappe hardware, through an OpenAI-compatible API.',
    // What the card shows before you know anything else about it.
    priceLine: 'From ₹40 per million tokens',
    // Why you would turn it on, in the user's terms — not the feature list.
    blurb: 'Summarise documents, draft replies, classify tickets. Your data stays on Frappe hardware and is never used for training.',
    meters: [
      { key: 'tokensIn', label: 'Input tokens', unit: 'M tokens', rateUnit: 'million tokens', included: 1, rate: 40 },
      { key: 'tokensOut', label: 'Output tokens', unit: 'M tokens', rateUnit: 'million tokens', included: 0.5, rate: 60 },
    ],
  },
  {
    key: 'storage',
    name: 'Object storage',
    icon: 'lucide-hard-drive',
    to: '/addons/storage',
    tagline: 'S3-compatible buckets for file uploads, backups and static assets.',
    // "Downloads are free", not "no egress fees" — the shortest familiar term
    // beats the industry one, and this is the number people compare on.
    priceLine: '₹2 per GB-month · downloads are free',
    blurb: 'Move file uploads and backups off the server disk, so growing storage never forces a plan upgrade. Works with any S3 client.',
    // Writes and reads are priced separately and an order of magnitude apart —
    // that's the shape every S3-compatible vendor uses, and folding them into
    // one "requests" number would hide the expensive half.
    meters: [
      { key: 'stored', label: 'Stored', unit: 'GB-months', included: 10, rate: 2 },
      { key: 'writes', label: 'Writes', unit: 'M requests', rateUnit: 'million requests', included: 1, rate: 300 },
      { key: 'reads', label: 'Reads', unit: 'M requests', rateUnit: 'million requests', included: 10, rate: 30 },
    ],
  },
  {
    key: 'email',
    name: 'Email sending',
    icon: 'lucide-mail',
    to: '/addons/email',
    tagline: 'Send mail from your own domain. DKIM and SPF handled for you.',
    priceLine: '3,000 free, then ₹0.08 per email',
    blurb: 'Invoices, password resets and notifications that land in the inbox instead of spam. Bounces and complaints are tracked for you.',
    meters: [
      { key: 'sent', label: 'Emails sent', unit: 'emails', included: 3000, rate: 0.08 },
    ],
  },
  {
    key: 'pdf',
    name: 'PDF rendering',
    icon: 'lucide-file-text',
    to: '/addons/pdf',
    tagline: 'PDFs from your print formats, rendered off your server.',
    priceLine: '1,000 free, then ₹0.20 per document',
    blurb: 'Invoices and reports that match the browser exactly, with real fonts and clean page breaks. Big runs stop competing with your site for CPU.',
    // Every vendor in this category bills per document and every user assumes
    // per page. Saying it once, plainly, next to the meter costs nothing and
    // prevents the single most common billing surprise in the category.
    meterNote: 'One PDF is one document, whatever its page count.',
    meters: [
      { key: 'documents', label: 'Documents', unit: 'documents', included: 1000, rate: 0.2 },
    ],
  },
]

// Deliverability thresholds. These are the industry's de-facto numbers — every
// major provider warns at roughly the same rates and suspends at roughly the
// same rates — so showing them beats inventing our own.
export const EMAIL_THRESHOLDS = {
  bounce: { review: 5, paused: 10 },
  complaint: { review: 0.1, paused: 0.5 },
}

// One chip instead of two percentages: whichever rate is worse decides. Someone
// who just wants to know "will my mail land" should not have to compare numbers
// against thresholds in their head.
export function emailHealth({ bounceRate = 0, complaintRate = 0 } = {}) {
  const { bounce, complaint } = EMAIL_THRESHOLDS
  if (bounceRate >= bounce.paused || complaintRate >= complaint.paused) return 'paused'
  if (bounceRate >= bounce.review || complaintRate >= complaint.review) return 'review'
  return 'healthy'
}

// The records a domain needs before it can send. Values are per-domain, so the
// UI fills in the host from the domain name.
export function dnsRecordsFor(domain) {
  return [
    { type: 'TXT', name: '@', value: 'v=spf1 include:mail.frappe.cloud ~all', purpose: 'SPF', key: 'spf' },
    { type: 'TXT', name: `fc._domainkey.${domain.name}`, value: 'v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEB…', purpose: 'DKIM', key: 'dkim' },
    { type: 'CNAME', name: `bounces.${domain.name}`, value: 'feedback.mail.frappe.cloud', purpose: 'Return path', key: 'returnPath' },
  ]
}

// Models available on the AI add-on. Open weights only — that's the point of
// running them on Frappe hardware rather than proxying someone else's API. Rates
// are ₹ per million tokens; embedding and guard models have no output charge, so
// their `out` is null and the UI shows a single rate.
export const AI_MODELS = [
  {
    id: 'llama-3-3-70b',
    name: 'llama-3.3-70b-instruct',
    kind: 'Text generation',
    blurb: 'The default. Best quality for drafting, summarising and reasoning.',
    context: '128K',
    in: 40,
    out: 60,
  },
  {
    id: 'llama-3-2-3b',
    name: 'llama-3.2-3b-instruct',
    kind: 'Text generation',
    blurb: 'Small and fast. Good for classification and short replies at volume.',
    context: '128K',
    in: 6,
    out: 9,
  },
  {
    id: 'e5-mistral-7b',
    name: 'e5-mistral-7b-instruct',
    kind: 'Embedding',
    blurb: 'Turns documents into vectors for search and similarity.',
    context: '32K',
    in: 5,
    out: null,
  },
  {
    id: 'llama-guard-3-8b',
    name: 'llama-guard-3-8b',
    kind: 'Guard',
    blurb: 'Screens prompts and replies for unsafe content before they reach users.',
    context: '8K',
    in: 5,
    out: null,
  },
]

// The two things a server plan includes an allowance of. They meter exactly like
// add-ons — and land in the same billing table — but they belong to the server
// subscription, so there's nothing to switch on and no page of their own. The
// allowance is per server, so a fleet gets proportionally more before it pays.
// "Backups", not "Backup storage": next to the Object storage add-on, two rows
// with "storage" in the name read as the same thing.
export const SERVER_METERS = [
  { key: 'bandwidth', label: 'Bandwidth', unit: 'TB', includedPerServer: 1, rate: 800 },
  { key: 'backups', label: 'Backups', unit: 'GB-months', includedPerServer: 50, rate: 3 },
]

// What follows "₹40 per …". Naive de-pluralising is right for `emails` →
// `email`, but wrong for magnitude units — "₹40/M token" reads like a typo — so
// those carry an explicit `rateUnit`.
export function rateUnitOf(meter) {
  return meter.rateUnit || meter.unit.replace(/s$/, '')
}

export function addonByKey(key) {
  return ADDONS.find((a) => a.key === key) || null
}

// Overage cost for one meter: only what's past the included allowance is charged.
export function meterCost(meter, used) {
  return Math.max(0, used - meter.included) * meter.rate
}

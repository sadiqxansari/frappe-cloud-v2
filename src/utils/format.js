export function inr(n) {
  return '₹' + n.toLocaleString('en-IN')
}

export function usd(n) {
  const v = Number.isInteger(n) ? n : n.toFixed(2)
  return '$' + v
}

// One currency per user, never mixed (decision 8). The backend keeps prices in
// ₹ and credit in $, but a given user only ever *sees* one of them: Indian
// users (the demo personas) see ₹ everywhere, everyone else $. `money` formats
// in a chosen currency; `usdToDisplay` converts a $ figure into that currency
// so a screen never shows "₹4,100 due · balance $12". Rate is a demo constant.
const USD_TO_INR = 83

export function money(amount, currency = 'INR') {
  return currency === 'USD' ? usd(amount) : inr(Math.round(amount))
}

export function usdToDisplay(usdAmount, currency = 'INR') {
  return currency === 'USD' ? usdAmount : Math.round(usdAmount * USD_TO_INR)
}

export function slugify(s) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 24) || 'site'
  )
}

// "just now" / "4m ago" / "3h ago" / "yesterday" / "Jun 8"
export function timeAgo(ts) {
  const diff = Date.now() - ts
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  return fmtDate(ts)
}

export function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function fmtDateTime(ts) {
  const d = new Date(ts)
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${date}, ${time}`
}

// Shared size formatting for the DB analyzer views.

// GB in, human string out — sub-GB values read better in MB.
export function fmtGb(gb) {
  if (gb >= 100) return `${Math.round(gb)} GB`
  if (gb >= 1) return `${(Math.round(gb * 10) / 10).toFixed(1)} GB`
  const mb = gb * 1024
  return mb >= 1 ? `${Math.round(mb)} MB` : `${Math.round(mb * 1024)} KB`
}

export function fmtMb(mb) {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`
}

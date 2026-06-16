// Lightweight, presentational validators for the prototype's forms. Each
// returns an error string when the value is invalid, or '' when it's fine —
// so a FormControl can bind `:error` and a submit button can disable on truthy.
// These mirror real-world formats closely enough to demo inline validation;
// they are not authoritative.

const TAX_PATTERNS = {
  IN: { re: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{3}$/, hint: '15 characters, e.g. 29ABCDE1234F1Z5' },
  EU: { re: /^[A-Z]{2}[0-9A-Z]{8,12}$/, hint: 'Country prefix + number, e.g. DE123456789' },
  GB: { re: /^GB[0-9A-Z]{9,12}$/, hint: 'e.g. GB123456789' },
  US: { re: /^[0-9]{2}-?[0-9]{7}$/, hint: '9 digits, e.g. 12-3456789' },
  AE: { re: /^[0-9]{15}$/, hint: '15 digits' },
  AU: { re: /^[0-9]{11}$/, hint: '11 digits' },
  SG: { re: /^[0-9]{9}[A-Z]$/, hint: 'e.g. 201912345A' },
}

// `required` lets a caller demand a value (B2B regions that legally need an ID).
export function validateTaxId(region, value, { required = false } = {}) {
  const v = (value || '').trim().toUpperCase()
  if (!v) return required ? 'A tax ID is required for this region.' : ''
  const rule = TAX_PATTERNS[region]
  if (rule && !rule.re.test(v)) return `Doesn't look right — ${rule.hint}.`
  return ''
}

export function validateEmail(value, { required = false } = {}) {
  const v = (value || '').trim()
  if (!v) return required ? 'An email is required.' : ''
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'Enter a valid email address.'
}

export function validatePort(value, { required = true } = {}) {
  const v = String(value ?? '').trim()
  if (!v) return required ? 'A port is required.' : ''
  if (!/^[0-9]+$/.test(v)) return 'Port must be a number.'
  const n = Number(v)
  return n >= 1 && n <= 65535 ? '' : 'Port must be between 1 and 65535.'
}

export function validateUrl(value, { required = false } = {}) {
  const v = (value || '').trim()
  if (!v) return required ? 'A URL is required.' : ''
  try {
    const u = new URL(v)
    return u.protocol === 'https:' || u.protocol === 'http:' ? '' : 'URL must start with http:// or https://.'
  } catch {
    return 'Enter a valid URL, e.g. https://example.com/hook.'
  }
}

export function validateSshKey(value, { required = false } = {}) {
  const v = (value || '').trim()
  if (!v) return required ? 'Paste a public key.' : ''
  return /^(ssh-(rsa|ed25519|dss)|ecdsa-sha2-)\s+[A-Za-z0-9+/=]+/.test(v)
    ? ''
    : 'Doesn’t look like a public key (expected ssh-ed25519 / ssh-rsa …).'
}

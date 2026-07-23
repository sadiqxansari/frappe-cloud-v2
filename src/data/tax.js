// Curated tax regions for the billing profile. Picking a region swaps the
// tax-ID field's label and placeholder to match that country's format — the
// same pattern Stripe Tax uses, trimmed to the markets Frappe Cloud serves.
export const TAX_REGIONS = [
  { region: 'IN', country: 'India', idLabel: 'GSTIN', placeholder: '29ABCDE1234F1Z5' },
  { region: 'EU', country: 'European Union', idLabel: 'VAT number', placeholder: 'DE123456789' },
  { region: 'US', country: 'United States', idLabel: 'EIN', placeholder: '12-3456789' },
  { region: 'GB', country: 'United Kingdom', idLabel: 'VAT number', placeholder: 'GB123456789' },
  { region: 'AE', country: 'United Arab Emirates', idLabel: 'TRN', placeholder: '100123456700003' },
  { region: 'AU', country: 'Australia', idLabel: 'ABN', placeholder: '12345678901' },
  { region: 'SG', country: 'Singapore', idLabel: 'GST reg. no.', placeholder: '201912345A' },
]

export function taxRegionByCode(code) {
  return TAX_REGIONS.find((r) => r.region === code) || TAX_REGIONS[0]
}

// Options shaped for frappe-ui's FormControl type="select".
export const TAX_REGION_OPTIONS = TAX_REGIONS.map((r) => ({
  label: `${r.country} (${r.idLabel})`,
  value: r.region,
}))

// Countries offered in the billing profile. `region` ties a country to its
// tax-ID format (and to India-specific billing: UPI + INR). A null region means
// no tax-ID field is shown for that country — currency and tax both follow from
// the country, so the profile never asks for them separately.
export const BILLING_COUNTRIES = [
  { code: 'IN', name: 'India', currency: 'INR', region: 'IN' },
  { code: 'US', name: 'United States', currency: 'USD', region: 'US' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', region: 'GB' },
  { code: 'DE', name: 'Germany', currency: 'EUR', region: 'EU' },
  { code: 'FR', name: 'France', currency: 'EUR', region: 'EU' },
  { code: 'NL', name: 'Netherlands', currency: 'EUR', region: 'EU' },
  { code: 'IE', name: 'Ireland', currency: 'EUR', region: 'EU' },
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED', region: 'AE' },
  { code: 'AU', name: 'Australia', currency: 'AUD', region: 'AU' },
  { code: 'SG', name: 'Singapore', currency: 'SGD', region: 'SG' },
  { code: 'CA', name: 'Canada', currency: 'CAD', region: null },
  { code: 'JP', name: 'Japan', currency: 'JPY', region: null },
]

// A leading blank is the "Select country" placeholder, so nothing is chosen
// until the reader picks — which is what reveals the tax field.
export const COUNTRY_OPTIONS = [
  { label: 'Select country', value: '' },
  ...BILLING_COUNTRIES.map((c) => ({ label: c.name, value: c.code })),
]

export function countryByCode(code) {
  return BILLING_COUNTRIES.find((c) => c.code === code) || null
}

// The tax-region config for a country's region, or null when it has none — this
// is what makes the tax-ID field appear only once a taxed country is picked.
export function taxForCountry(code) {
  const region = countryByCode(code)?.region
  return region ? taxRegionByCode(region) : null
}

export function regionForCountry(code) {
  return countryByCode(code)?.region || ''
}

// A representative country for a stored region, so a profile saved before we
// collected a country still shows one selected.
export function countryForRegion(region) {
  return BILLING_COUNTRIES.find((c) => c.region === region)?.code || ''
}

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

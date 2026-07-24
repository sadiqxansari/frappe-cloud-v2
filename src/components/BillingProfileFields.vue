<template>
  <!-- The billing profile's fields, shared by every place that collects them
       (payment setup, the billing page's editor) so there's one form, one
       layout. Currency and tax both follow from the country, so neither is a
       field of its own — the tax-ID input simply appears once a taxed country
       is chosen. -->
  <div class="space-y-6">
    <section>
      <h3 class="mb-3 text-sm font-semibold text-ink-gray-8">Contact</h3>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormControl v-model="form.legalName" type="text" label="Legal name" placeholder="Acme Technologies Pvt. Ltd." required />
        <div>
          <FormControl v-model="form.billingEmail" type="text" label="Billing email" placeholder="billing@company.com" />
          <p v-if="form.billingEmail && emailError" class="mt-1 text-p-xs text-ink-red-8">{{ emailError }}</p>
        </div>
        <FormControl v-model="form.phone" type="text" label="Phone" placeholder="+91 98765 43210" />
      </div>
    </section>

    <section>
      <h3 class="mb-3 text-sm font-semibold text-ink-gray-8">Address</h3>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormControl v-model="form.addressLine1" type="text" label="Address line 1" placeholder="Street address" required />
        <FormControl v-model="form.addressLine2" type="text" label="Address line 2" placeholder="Suite, floor (optional)" />
        <FormControl v-model="form.city" type="text" label="City" required />
        <FormControl v-model="form.country" type="select" label="Country" :options="COUNTRY_OPTIONS" required />
        <FormControl v-model="form.state" type="text" label="State" />
        <FormControl v-model="form.pin" type="text" label="PIN code" />
      </div>
    </section>

    <!-- Tax — appears only once a taxed country is chosen; its label and
         placeholder match that country's format (GSTIN, VAT, EIN, …). -->
    <section v-if="taxConfig">
      <h3 class="mb-3 text-sm font-semibold text-ink-gray-8">Tax</h3>
      <div class="sm:max-w-[calc(50%-0.5rem)]">
        <FormControl v-model="form.taxValue" type="text" :label="taxConfig.idLabel" :placeholder="taxConfig.placeholder" />
        <p v-if="form.taxValue && taxError" class="mt-1 text-p-xs text-ink-red-8">{{ taxError }}</p>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, watchEffect } from 'vue'
import { FormControl } from 'frappe-ui'
import { COUNTRY_OPTIONS, regionForCountry, taxForCountry } from '../data/tax'
import { validateEmail, validateTaxId } from '../utils/validate'

// The parent owns the reactive form object; binding straight to its fields keeps
// a single source of truth and avoids a prop/emit round-trip per keystroke.
const props = defineProps({
  form: { type: Object, required: true },
})
// Two-way flag the parent reads to enable its Save/Next button.
const valid = defineModel('valid', { type: Boolean, default: false })

const taxConfig = computed(() => taxForCountry(props.form.country))
const emailError = computed(() => validateEmail(props.form.billingEmail))
const taxError = computed(() =>
  taxConfig.value ? validateTaxId(regionForCountry(props.form.country), props.form.taxValue, { required: false }) : '',
)

// Valid = the *-marked fields are filled and any optional value that was entered
// (email, tax id) is well-formed.
watchEffect(() => {
  const f = props.form
  valid.value =
    !!f.legalName?.trim() &&
    !!f.addressLine1?.trim() &&
    !!f.city?.trim() &&
    !!f.country &&
    !emailError.value &&
    !taxError.value
})
</script>

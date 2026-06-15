<template>
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
    <FormControl type="select" label="Provider" v-model="providerModel" :options="providerOptions" />
    <FormControl type="select" label="Region" v-model="regionId" :options="regionOptions" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { FormControl } from 'frappe-ui'
import { PROVIDERS, regionById, regionsOf } from '../data/catalog'

// v-model is the region id; the provider is derived from it.
const regionId = defineModel({ type: String, required: true })

const providerId = ref(regionById(regionId.value).providerId)

// Changing provider snaps the region to that provider's first region.
const providerModel = computed({
  get: () => providerId.value,
  set: (id) => {
    providerId.value = id
    regionId.value = regionsOf(id)[0].id
  },
})

const providerOptions = computed(() => PROVIDERS.map((p) => ({ label: p.name, value: p.id })))
const regionOptions = computed(() =>
  regionsOf(providerId.value).map((r) => ({ label: r.beta ? `${r.name} (Beta)` : r.name, value: r.id })),
)
</script>

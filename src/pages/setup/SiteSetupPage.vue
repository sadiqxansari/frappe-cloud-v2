<template>
  <MinimalAuthShell>
    <div class="flex items-center gap-2">
      <img v-if="app && logo" :src="logo" alt="" class="size-6 shrink-0 rounded-4" />
      <h1 class="text-xl font-semibold text-ink-gray-8">
        {{ app ? `Set up ${app.name} on your site` : 'Set up your site' }}
      </h1>
    </div>

    <form class="mt-6" novalidate @submit.prevent="create">
      <FormControl
        ref="addressEl"
        v-model="subdomainInput"
        type="text"
        size="md"
        label="Site address"
        placeholder="yourcompany"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        class="site-address"
      >
        <template #suffix>
          <span class="text-base text-ink-gray-4">.frappe.cloud</span>
        </template>
      </FormControl>

      <!-- Live preview of the full URL + availability -->
      <div class="mt-2 flex min-h-5 items-center gap-1.5 text-p-sm">
        <template v-if="slug">
          <span class="lucide-check size-4 shrink-0 text-ink-green-7" />
          <span class="text-ink-gray-6">
            <span class="font-medium text-ink-gray-8">{{ slug }}.frappe.cloud</span> is available
          </span>
        </template>
        <span v-else class="text-ink-gray-4">Lowercase letters, numbers and hyphens.</span>
      </div>

      <!-- The server is implied — these three lines carry it, so there's no
           separate plan/region step (matches Central's onboarding). -->
      <ul class="mt-5 space-y-2.5 text-p-sm text-ink-gray-6">
        <li class="flex items-center gap-2">
          <span class="lucide-server size-4 shrink-0" aria-hidden="true" />
          Runs on its own private server near you.
        </li>
        <li class="flex items-center gap-2">
          <span class="lucide-gift size-4 shrink-0" aria-hidden="true" />
          Free with your $25 credits.
        </li>
        <li class="flex items-center gap-2">
          <span class="lucide-pencil-line size-4 shrink-0" aria-hidden="true" />
          Change plan anytime.
        </li>
      </ul>

      <Button
        type="submit"
        variant="solid"
        size="md"
        class="mt-6 w-full"
        :loading="loading"
        :disabled="!slug"
        label="Create my site"
      />
    </form>
  </MinimalAuthShell>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button, FormControl } from 'frappe-ui'
import MinimalAuthShell from '../../components/MinimalAuthShell.vue'
import { appByKey, isFrappeApp } from '../../data/catalog'
import { useCloudStore } from '../../stores/cloud'

// Product marks live alongside AppIcon's; a bare 24px logo (no tile) matches
// Central's SiteNamePage header exactly.
const logos = import.meta.glob('../../assets/apps/*.png', { eager: true, import: 'default' })

const route = useRoute()
const router = useRouter()
const store = useCloudStore()

// The product a signup arrived with (e.g. ?product=erpnext). Unknown/missing
// keys fall back to the generic "Set up your site" copy — no icon, no name.
const product = computed(() => (route.query.product ? String(route.query.product) : ''))
const app = computed(() => (product.value && isFrappeApp(product.value) ? appByKey(product.value) : null))
const appKey = computed(() => (app.value ? product.value : 'erpnext'))
const logo = computed(() => (app.value ? logos[`../../assets/apps/${product.value}.png`] || null : null))

const subdomainInput = ref(store.onboarding.subdomain)
const addressEl = ref(null)
const loading = ref(false)

// Subdomains allow hyphens (just not leading/trailing). Empty ⇒ '' so the
// availability hint and Create button stay off until something's typed.
const slug = computed(() =>
  subdomainInput.value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30),
)

onMounted(() => nextTick(() => addressEl.value?.$el?.querySelector('input')?.focus()))

function create() {
  if (!slug.value || loading.value) return
  // Commit the choices, spin up the server (defaults: cheapest plan + nearest
  // region), then move to provisioning. A brief spinner beat mirrors Central,
  // which shows a loader while the site is created.
  loading.value = true
  store.onboarding.appKey = appKey.value
  store.onboarding.subdomain = slug.value
  store.provisionServer()
  setTimeout(
    () => router.push({ path: '/setup/provisioning', query: product.value ? { product: product.value } : {} }),
    600,
  )
}
</script>

<style scoped>
/* The frappe-ui suffix slot is sized for an icon; widen the input's right
   padding so ".frappe.cloud" never overlaps what the user types. */
.site-address :deep(input) {
  padding-inline-end: 6.75rem;
}
</style>

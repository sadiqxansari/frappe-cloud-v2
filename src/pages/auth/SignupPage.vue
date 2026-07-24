<template>
  <MinimalAuthShell>
    <h1 class="text-xl font-semibold text-ink-gray-8">Create your account</h1>
    <p v-if="app" class="mt-1 text-p-sm text-ink-gray-5">
      A couple of minutes from here to running {{ app.name }}.
    </p>

    <form class="mt-6 space-y-4" novalidate @submit.prevent="signup">
      <ValidatedFormControl
        v-model="fullName"
        label="Full name"
        autocomplete="name"
        placeholder="Your full name"
        autofocus
        :validator="(v) => validateRequired(v, 'Full name')"
        :submitted="submitted"
      />
      <ValidatedFormControl
        v-model="email"
        label="Work email"
        type="email"
        autocomplete="email"
        placeholder="name@company.com"
        :validator="(v) => validateEmail(v, { required: true })"
        :submitted="submitted"
      />
      <Transition name="error-fade">
        <ErrorMessage v-if="error" :message="error" />
      </Transition>
      <Button type="submit" variant="solid" size="md" class="mt-2 w-full" :loading="loading" label="Continue" />
    </form>

    <p class="mt-3 text-center text-p-xs text-ink-gray-5">
      No credit card. You start with $25 in free credit.
    </p>

    <p class="mt-4 text-center text-p-sm text-ink-gray-5">
      Already have an account?
      <RouterLink class="font-medium text-ink-gray-8 hover:text-ink-gray-9" to="/login">
        Sign in
      </RouterLink>
    </p>
  </MinimalAuthShell>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button, ErrorMessage } from 'frappe-ui'
import MinimalAuthShell from '../../components/MinimalAuthShell.vue'
import ValidatedFormControl from '../../components/ValidatedFormControl.vue'
import { validateEmail, validateRequired } from '../../utils/validate'
import { appByKey, isFrappeApp } from '../../data/catalog'
import { useCloudStore } from '../../stores/cloud'

const store = useCloudStore()
const route = useRoute()
const router = useRouter()

// Product signups arrive from the marketing site with ?product=<appKey>; carry
// it through verification so onboarding stays app-aware. When a known product
// came along, the subtitle names it; plain signup shows no subtitle.
const product = computed(() => (route.query.product ? String(route.query.product) : ''))
const app = computed(() => (product.value && isFrappeApp(product.value) ? appByKey(product.value) : null))

const fullName = ref('')
const email = ref('')
const submitted = ref(false)
const loading = ref(false)
const error = ref('')

// A stale error describes the last attempt; drop it once the user edits the form.
watch([fullName, email], () => {
  error.value = ''
})

function signup() {
  submitted.value = true
  error.value = ''
  if (validateRequired(fullName.value, 'Full name') || validateEmail(email.value, { required: true })) return

  // Persist name + email now so the verify page and later steps have them.
  store.signUp(fullName.value.trim(), email.value.trim())
  router.push({
    path: '/signup/verify',
    query: { email: email.value.trim(), ...(product.value ? { product: product.value } : {}) },
  })
}
</script>

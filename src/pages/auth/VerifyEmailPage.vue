<template>
  <MinimalAuthShell>
    <h1 class="text-xl font-semibold text-ink-gray-8">Verify your email</h1>
    <p class="mt-1 text-p-sm text-ink-gray-5">
      Enter the 6-digit code we sent to
      <span class="font-medium text-ink-gray-8">{{ email || 'your email address' }}</span>.
    </p>

    <form class="mt-6 space-y-4" @submit.prevent="verify">
      <OtpInput v-model="otp" :disabled="loading" @complete="verify" />
      <p class="text-p-sm text-ink-gray-5">Demo — any 6 digits work.</p>

      <Transition name="error-fade">
        <ErrorMessage v-if="error" :message="error" />
      </Transition>

      <Button
        type="submit"
        variant="solid"
        size="md"
        class="w-full"
        :loading="loading"
        :disabled="otp.length !== 6"
        label="Verify and continue"
      />
    </form>

    <div class="mt-4 flex items-center justify-between text-p-sm">
      <button
        type="button"
        class="font-medium text-ink-gray-8 transition-colors hover:text-ink-gray-9"
        @click="router.push({ path: '/signup', query: product ? { product } : {} })"
      >
        Use a different email
      </button>
      <button
        type="button"
        class="font-medium text-ink-gray-8 transition-colors hover:text-ink-gray-9"
        @click="resend"
      >
        Resend code
      </button>
    </div>
  </MinimalAuthShell>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button, ErrorMessage, toast } from 'frappe-ui'
import MinimalAuthShell from '../../components/MinimalAuthShell.vue'
import OtpInput from '../../components/OtpInput.vue'
import { useCloudStore } from '../../stores/cloud'

const route = useRoute()
const router = useRouter()
const store = useCloudStore()

// Prefer the address passed from signup; fall back to the one already stored.
const email = computed(() => (route.query.email ? String(route.query.email) : store.user.email))
// The product an app-aware signup arrived with; carried on into site setup.
const product = computed(() => (route.query.product ? String(route.query.product) : ''))

const otp = ref('')
const loading = ref(false)
const error = ref('')

watch(otp, (v) => {
  if (v) error.value = ''
})

function verify() {
  if (loading.value || otp.value.length !== 6) return
  // Mock: no backend, so hold a brief spinner beat before navigating — mirrors
  // Central, where the button shows a loader while the code is checked.
  loading.value = true
  setTimeout(() => {
    // Two funnels diverge here. A product signup continues into app-aware site
    // setup; a plain signup is done — drop straight into the Central dashboard,
    // where the empty state invites them to spin up their first server.
    if (product.value) {
      router.push({ path: '/setup/app', query: { product: product.value } })
    } else {
      router.push('/servers')
    }
  }, 700)
}

function resend() {
  otp.value = ''
  toast.success(`New code sent to ${email.value}`)
}
</script>

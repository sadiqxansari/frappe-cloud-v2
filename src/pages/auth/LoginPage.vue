<template>
  <MinimalAuthShell>
    <!-- Two-factor challenge — mirrors Central's "verify your login" step. -->
    <template v-if="challenge">
      <h1 class="text-xl font-semibold text-ink-gray-8">Verify your login</h1>
      <p class="mt-1 text-p-sm text-ink-gray-5">
        Enter the verification code sent to
        <span class="font-medium text-ink-gray-8">{{ email }}</span>.
      </p>

      <form class="mt-6 space-y-4" @submit.prevent="submitOtp">
        <OtpInput v-model="otp" :disabled="loading" @complete="submitOtp" />
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
          label="Continue"
        />
        <Button
          type="button"
          variant="outline"
          size="md"
          class="w-full"
          :disabled="loading"
          label="Cancel"
          @click="cancelChallenge"
        />
      </form>
    </template>

    <!-- Credentials -->
    <template v-else>
      <h1 class="text-xl font-semibold text-ink-gray-8">Welcome back</h1>

      <form class="mt-6 space-y-4" novalidate @submit.prevent="submitPassword">
        <ValidatedFormControl
          v-model="email"
          label="Work email"
          type="email"
          autocomplete="username"
          placeholder="name@company.com"
          :validator="(v) => validateEmail(v, { required: true })"
          :submitted="submitted"
        />
        <div>
          <ValidatedFormControl
            v-model="password"
            label="Password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            placeholder="Enter your password"
            :validator="(v) => validateRequired(v, 'Password')"
            :submitted="submitted"
          >
            <template #suffix>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                :label="showPassword ? 'Hide password' : 'Show password'"
                :icon="showPassword ? 'lucide-eye-off' : 'lucide-eye'"
                @click="showPassword = !showPassword"
              />
            </template>
          </ValidatedFormControl>
          <div class="mt-2 text-right">
            <RouterLink class="text-p-sm text-ink-gray-5 transition-colors hover:text-ink-gray-8" to="/forgot-password">
              Forgot password?
            </RouterLink>
          </div>
        </div>

        <Button type="submit" variant="solid" size="md" class="w-full" :loading="loading" :disabled="isFormDisabled" label="Sign in" />
        <Transition name="error-fade">
          <ErrorMessage v-if="formError" class="text-center" :message="formError" />
        </Transition>
      </form>

      <p class="mt-4 text-center text-p-sm text-ink-gray-5">
        New to Frappe Cloud?
        <RouterLink class="font-medium text-ink-gray-8 hover:text-ink-gray-9" to="/signup">
          Create an account
        </RouterLink>
      </p>
    </template>
  </MinimalAuthShell>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Button, ErrorMessage } from 'frappe-ui'
import MinimalAuthShell from '../../components/MinimalAuthShell.vue'
import ValidatedFormControl from '../../components/ValidatedFormControl.vue'
import OtpInput from '../../components/OtpInput.vue'
import { validateEmail, validateRequired } from '../../utils/validate'
import { useCloudStore } from '../../stores/cloud'

const router = useRouter()
const store = useCloudStore()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const otp = ref('')
const challenge = ref(false)
const submitted = ref(false)
const loading = ref(false)
const error = ref('')

// A stale error describes the last attempt; drop it once the user edits anything.
watch([email, password, otp], () => {
  error.value = ''
})

function submitPassword() {
  submitted.value = true
  error.value = ''
  if (validateEmail(email.value, { required: true }) || validateRequired(password.value, 'Password')) return

  // Mock: any credentials pass. Always show the 2FA step once so the challenge
  // UI is demonstrable in the prototype.
  otp.value = ''
  submitted.value = false
  challenge.value = true
}

function submitOtp() {
  if (loading.value || otp.value.length !== 6) return
  // Mock: hold a brief spinner beat, then let the router guard route by persona.
  // Record the signed-in email so a persona without a server still counts as
  // authed (the guard sends it to Central); one with servers lands in the Desk
  // or dashboard. Mirrors Central, which shows a loader while verifying.
  loading.value = true
  if (!store.user.email) store.signUp(store.user.name || '', email.value.trim())
  setTimeout(() => router.push('/'), 700)
}

function cancelChallenge() {
  challenge.value = false
  otp.value = ''
  error.value = ''
}

// Disable Sign in until both credentials are entered (or while a request runs).
const isFormDisabled = computed(() => loading.value || !email.value.trim() || !password.value)

// One message below the button: the first validation error after a submit
// attempt. Inline field errors would push "Forgot password?" off the password.
const formError = computed(() => {
  if (error.value) return error.value
  if (!submitted.value) return ''
  return validateEmail(email.value, { required: true }) || validateRequired(password.value, 'Password')
})
</script>

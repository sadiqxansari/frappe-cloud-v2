<template>
  <OnboardingShell :step="1">
    <!-- Details — name + email, kept to the essentials -->
    <template v-if="phase === 'details'">
      <h1 class="text-xl font-semibold text-ink-gray-9">Create your account</h1>
      <p class="mt-1.5 text-p-base text-ink-gray-6">
        A couple of minutes from here to running ERPNext.
      </p>

      <div class="mt-6 space-y-4">
        <FormControl v-model="name" type="text" label="Full name" placeholder="Rahul Mehta" @keydown.enter="sendCode" />
        <FormControl v-model="email" type="email" label="Work email" placeholder="rahul@mycompany.in" @keydown.enter="sendCode" />
        <Button variant="solid" size="md" label="Continue" class="w-full" :disabled="!canContinue" @click="sendCode" />
      </div>

      <div class="my-5 flex items-center gap-3">
        <div class="h-px flex-1 bg-surface-gray-3" />
        <span class="text-xs text-ink-gray-4">or</span>
        <div class="h-px flex-1 bg-surface-gray-3" />
      </div>

      <Button variant="outline" size="md" class="w-full" @click="continueWithGoogle">
        <template #prefix>
          <span class="grid size-4 place-items-center rounded-full bg-surface-blue-2 text-[10px] font-bold text-ink-blue-8">G</span>
        </template>
        Continue with Google
      </Button>

      <p class="mt-5 text-center text-p-xs text-ink-gray-5">
        No credit card. You start with $25 in free credit.
      </p>
    </template>

    <!-- Verify — OTP in place, no page jump -->
    <template v-else>
      <h1 class="text-xl font-semibold text-ink-gray-9">Verify your email</h1>
      <p class="mt-1.5 text-p-base text-ink-gray-6">
        Enter the 6-digit code we sent to <span class="font-medium text-ink-gray-8">{{ email }}</span>.
      </p>

      <div class="mt-6">
        <OtpInput v-model="code" />
        <p class="mt-2 text-p-xs text-ink-gray-4">Demo — any 6 digits work.</p>
      </div>

      <Button variant="solid" size="md" label="Verify and continue" class="mt-6 w-full" :disabled="code.length < 6" @click="verify" />

      <div class="mt-4 flex items-center justify-between text-sm">
        <button class="text-ink-gray-5 transition-colors hover:text-ink-gray-8" @click="phase = 'details'">
          Use a different email
        </button>
        <button class="text-ink-gray-5 transition-colors hover:text-ink-gray-8" @click="resend">
          Resend code
        </button>
      </div>
    </template>
  </OnboardingShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button, FormControl, toast } from 'frappe-ui'
import OnboardingShell from '../../components/OnboardingShell.vue'
import OtpInput from '../../components/OtpInput.vue'
import { useCloudStore } from '../../stores/cloud'

const store = useCloudStore()
const router = useRouter()

const phase = ref('details') // 'details' | 'otp'
const name = ref('')
const email = ref('')
const code = ref('')

const canContinue = computed(() => /.+@.+\..+/.test(email.value.trim()))

// Fall back to a friendly name derived from the email if it's left blank.
function resolvedName() {
  if (name.value.trim()) return name.value.trim()
  const local = email.value.trim().split('@')[0] || 'rahul'
  return local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Rahul Mehta'
}

function sendCode() {
  if (!canContinue.value) return
  code.value = ''
  phase.value = 'otp'
  toast.success(`Code sent to ${email.value.trim()}`)
}
function resend() {
  code.value = ''
  toast.success(`New code sent to ${email.value.trim()}`)
}
function verify() {
  if (code.value.length < 6) return
  store.signUp(resolvedName(), email.value.trim())
  router.push('/setup/app')
}

// Google sign-in is already verified — no OTP needed.
function continueWithGoogle() {
  const mail = email.value.trim() || 'rahul@mycompany.in'
  store.signUp(resolvedName(), mail)
  router.push('/setup/app')
}
</script>

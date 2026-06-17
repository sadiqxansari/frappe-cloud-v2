<template>
  <OnboardingShell :step="1">
    <h1 class="text-xl font-semibold text-ink-gray-9">Create your account</h1>
    <p class="mt-1.5 text-p-base text-ink-gray-6">
      You're a couple of minutes away from running ERPNext.
    </p>

    <div class="mt-6 space-y-4">
      <FormControl v-model="email" type="email" label="Email" placeholder="rahul@mycompany.in" />
      <Button variant="solid" size="md" label="Continue" class="w-full" @click="go" />
    </div>

    <div class="my-5 flex items-center gap-3">
      <div class="h-px flex-1 bg-surface-gray-3" />
      <span class="text-xs text-ink-gray-4">or</span>
      <div class="h-px flex-1 bg-surface-gray-3" />
    </div>

    <Button variant="outline" size="md" class="w-full" @click="go">
      <template #prefix>
        <span class="grid size-4 place-items-center rounded-full bg-surface-blue-2 text-[10px] font-bold text-ink-blue-3">G</span>
      </template>
      Continue with Google
    </Button>

  
  </OnboardingShell>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button, FormControl } from 'frappe-ui'
import OnboardingShell from '../../components/OnboardingShell.vue'
import { useCloudStore } from '../../stores/cloud'

const store = useCloudStore()
const router = useRouter()

const email = ref('')

// No name field on the first screen — derive a friendly name from the email
// (the team name / avatar use it; it's editable later in Settings).
function go() {
  const mail = email.value.trim() || 'rahul@mycompany.in'
  const local = mail.split('@')[0]
  const name = local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Rahul Mehta'
  store.signUp(name, mail)
  router.push('/setup/app')
}
</script>

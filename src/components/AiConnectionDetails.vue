<template>
  <div class="space-y-5">
    <!-- The whole pitch of running it here: Central issues the key and adds up the
         tokens, but the request never passes through us. -->
    <p class="text-p-sm text-ink-gray-6">
      Use it from any app, script or tool. Central never sees your prompts — your app calls the
      gateway directly; usage still bills to your team.
    </p>

    <!-- Gateway URL -->
    <div>
      <label class="mb-1 block text-p-sm font-medium text-ink-gray-7">Gateway URL</label>
      <div class="flex items-center gap-2">
        <code class="min-w-0 flex-1 truncate rounded-md border border-outline-gray-2 bg-surface-gray-1 px-3 py-2 font-mono text-sm text-ink-gray-8">{{ gatewayUrl }}</code>
        <Button icon="lucide-copy" aria-label="Copy gateway URL" @click="copy(gatewayUrl, 'Gateway URL copied')" />
      </div>
    </div>

    <!-- API key — masked until revealed, but copy always uses the real value. -->
    <div>
      <label class="mb-1 block text-p-sm font-medium text-ink-gray-7">API key</label>
      <div class="flex items-center gap-2">
        <code class="min-w-0 flex-1 truncate rounded-md border border-outline-gray-2 bg-surface-gray-1 px-3 py-2 font-mono text-sm text-ink-gray-8">{{ maskedKey }}</code>
        <Button
          :icon="revealed ? 'lucide-eye-off' : 'lucide-eye'"
          :aria-label="revealed ? 'Hide key' : 'Reveal key'"
          @click="revealed = !revealed"
        />
        <Button icon="lucide-copy" aria-label="Copy API key" @click="copy(apiKey, 'API key copied')" />
      </div>
      <p class="mt-1 text-p-xs text-ink-gray-5">Treat it like a password. Revocable on its own.</p>
    </div>

    <!-- Example request — the model select rewrites the command; embedding models
         swap the endpoint, so the copied curl is always a working call. -->
    <div>
      <div class="mb-1 flex items-center justify-between gap-2">
        <label class="text-p-sm font-medium text-ink-gray-7">Example request</label>
        <FormControl
          v-if="models.length"
          v-model="selectedId"
          type="select"
          size="sm"
          :options="modelOptions"
        />
      </div>
      <div class="relative">
        <pre class="overflow-x-auto rounded-lg border border-outline-gray-2 bg-surface-gray-2 p-3 pr-10 font-mono text-p-xs leading-relaxed text-ink-gray-8">{{ shownCurl }}</pre>
        <button
          class="absolute right-2 top-2 rounded bg-surface-gray-2 p-1.5 text-ink-gray-5 transition-colors hover:bg-surface-gray-3 hover:text-ink-gray-8"
          aria-label="Copy command"
          @click="copyCurl"
        >
          <span class="lucide-copy size-3.5" />
        </button>
      </div>
      <p class="mt-1 text-p-xs text-ink-gray-5">
        Copy runs with your key filled in; the shown command keeps it as
        <code class="font-mono">$LLM_API_KEY</code>.
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Button, FormControl, toast } from 'frappe-ui'

// Presentational: given a gateway URL, a resolved key, and the plan's models,
// render the endpoint, a masked/reveal-able key, and a ready-to-run curl. Shared
// by the API-keys dialog and the per-site Connect dialog so there's one copy.
const props = defineProps({
  gatewayUrl: { type: String, required: true },
  apiKey: { type: String, required: true },
  models: { type: Array, default: () => [] },
})

const revealed = ref(false)
const selectedId = ref(props.models[0]?.id ?? '')
const selected = computed(() => props.models.find((m) => m.id === selectedId.value) || props.models[0] || null)

const modelOptions = computed(() =>
  props.models.map((m) => ({ label: `${m.name} · ${m.tier}`, value: m.id })),
)

const maskedKey = computed(() =>
  revealed.value ? props.apiKey : `${props.apiKey.slice(0, 6)}${'•'.repeat(24)}${props.apiKey.slice(-4)}`,
)

// Placeholder token in the shown command so a screenshot can't leak the key; the
// copy button swaps in the real value.
function curlFor(model, token) {
  const embedding = model?.kind === 'Embedding'
  const endpoint = embedding ? 'embeddings' : 'chat/completions'
  const name = model?.name || 'MODEL_ID'
  const body = embedding
    ? `    "model": "${name}",\n    "input": "embed me"`
    : `    "model": "${name}",\n    "messages": [{"role": "user", "content": "say something"}]`
  return `curl ${props.gatewayUrl}/v1/${endpoint} \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer ${token}" \\\n  -d '{\n${body}\n  }'`
}

const shownCurl = computed(() => curlFor(selected.value, '$LLM_API_KEY'))

function copy(text, message) {
  navigator.clipboard?.writeText(text)
  toast.success(message)
}
function copyCurl() {
  copy(curlFor(selected.value, props.apiKey), 'Command copied')
}
</script>

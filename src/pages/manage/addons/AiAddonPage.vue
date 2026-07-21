<template>
  <AddonShell addon-key="ai">
    <div class="mt-8">
      <TabButtons v-model="tab" :options="tabs" />

      <!-- ── Models ─────────────────────────────────────────────────────
           Everything you need to make the first call is on this tab: which
           models exist, what they cost, and the exact command to try one. -->
      <template v-if="tab === 'models'">
        <div class="mt-5 rounded-lg border border-outline-gray-2 bg-surface-base p-5 pt-4">
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-base font-semibold text-ink-gray-8">Base URL</h2>
            <button class="flex items-center gap-1.5 text-p-sm text-ink-gray-6 transition-colors hover:text-ink-gray-9" @click="copy(BASE_URL, 'Base URL copied')">
              <span class="lucide-copy size-3.5" />
              Copy
            </button>
          </div>
          <p class="mt-1 font-mono text-p-sm text-ink-gray-7">{{ BASE_URL }}</p>
          <p class="mt-2 text-p-sm text-ink-gray-5">
            Point any OpenAI client at this URL with one of your tokens.
          </p>
        </div>

        <div class="mt-4 space-y-4">
          <section v-for="model in AI_MODELS" :key="model.id" class="rounded-lg border border-outline-gray-2 bg-surface-base p-5">
            <!-- Stacks rather than wraps. With `flex-wrap` the price block kept
                 its right-alignment after dropping to its own line, so it landed
                 mid-card aligned to nothing — a column layout below `sm` puts it
                 cleanly under the description, left-aligned like everything else. -->
            <div class="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <h3 class="break-all font-mono text-sm font-medium text-ink-gray-9">{{ model.name }}</h3>
                  <Badge theme="gray" variant="subtle" :label="model.kind" />
                </div>
                <p class="mt-1 text-p-sm text-ink-gray-5">{{ model.blurb }}</p>
              </div>
              <div class="shrink-0 text-left sm:text-right">
                <div class="text-p-sm tabular-nums text-ink-gray-8">
                  {{ rate(model.in) }}<span class="text-ink-gray-5">{{ model.out ? ' in' : '' }}</span>
                  <template v-if="model.out">
                    · {{ rate(model.out) }}<span class="text-ink-gray-5"> out</span>
                  </template>
                </div>
                <div class="text-p-xs text-ink-gray-5">per million tokens · {{ model.context }} context</div>
              </div>
            </div>

            <!-- Folded by default: four cards each showing eight lines of curl
                 buries the models, which is what the page is actually for.
                 Rendered on a light surface like every other mono block in the
                 app — a dark terminal panel would be the only one in the product. -->
            <button
              class="mt-3 flex items-center gap-1.5 text-p-sm text-ink-gray-6 transition-colors hover:text-ink-gray-9"
              :aria-expanded="isOpen(model.id)"
              @click="toggleExample(model.id)"
            >
              <span class="lucide-chevron-right size-3.5 transition-transform" :class="isOpen(model.id) && 'rotate-90'" />
              Example request
            </button>
            <div v-if="isOpen(model.id)" class="relative mt-2">
              <pre class="overflow-x-auto rounded-lg bg-surface-gray-2 p-3 pr-10 font-mono text-p-xs leading-relaxed text-ink-gray-8">{{ curlFor(model) }}</pre>
              <button
                class="absolute right-2 top-2 rounded bg-surface-gray-2 p-1.5 text-ink-gray-5 transition-colors hover:bg-surface-gray-3 hover:text-ink-gray-8"
                :aria-label="`Copy example for ${model.name}`"
                @click="copy(curlFor(model), 'Example copied')"
              >
                <span class="lucide-copy size-3.5" />
              </button>
            </div>
          </section>
        </div>
      </template>

      <!-- ── Tokens ───────────────────────────────────────────────────── -->
      <template v-else-if="tab === 'tokens'">
        <section class="mt-5 rounded-lg border border-outline-gray-2 bg-surface-base p-5 pt-4">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-1.5">
              <h2 class="text-base font-semibold text-ink-gray-8">Tokens</h2>
              <Tooltip text="Shown once when created. Revoke and make a new one if you lose it.">
                <span class="lucide-info size-3.5 text-ink-gray-4" />
              </Tooltip>
            </div>
            <Button variant="ghost" size="sm" icon="lucide-plus" aria-label="New token" @click="newOpen = true" />
          </div>

          <div v-if="tokens.length" class="mt-2 divide-y divide-outline-alpha-gray-1">
            <div v-for="t in tokens" :key="t.id" class="flex items-center gap-3 py-2.5">
              <span class="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-gray-2 text-ink-gray-6">
                <span class="lucide-key-round size-4" />
              </span>
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-medium text-ink-gray-9">{{ t.label }}</div>
                <div class="truncate font-mono text-p-sm text-ink-gray-5">sk-fc-••••{{ t.tail }}</div>
              </div>
              <span class="shrink-0 text-p-sm text-ink-gray-5">{{ t.lastUsed ? `Used ${t.lastUsed}` : 'Never used' }}</span>
              <Dropdown :options="tokenMenu(t)" placement="bottom-end">
                <button class="rounded p-1 text-ink-gray-5 hover:bg-surface-gray-2" :aria-label="`Actions for ${t.label}`"><span class="lucide-ellipsis size-4" /></button>
              </Dropdown>
            </div>
          </div>
          <EmptyState
            v-else
            class="mt-3"
            icon="lucide-key-round"
            title="No tokens"
            description="You need a token to call the API."
          >
            <Button variant="subtle" size="sm" label="New token" icon-left="lucide-plus" @click="newOpen = true" />
          </EmptyState>
        </section>
      </template>

      <!-- ── Playground ─────────────────────────────────────────────────
           A real call's worth of feedback without leaving the page: pick a
           model, send a prompt, and watch the meter move by what it cost. -->
      <template v-else>
        <section class="mt-5 rounded-lg border border-outline-gray-2 bg-surface-base p-5 pt-4">
          <div class="flex flex-wrap items-end justify-between gap-3">
            <FormControl
              v-model="playModel"
              class="w-64"
              type="select"
              label="Model"
              :options="modelOptions"
            />
            <Button variant="solid" label="Run" :loading="running" :disabled="!prompt.trim()" @click="run" />
          </div>

          <FormControl
            v-model="prompt"
            class="mt-4"
            type="textarea"
            label="Prompt"
            :rows="3"
            placeholder="Summarise this week's sales orders in three bullets."
          />

          <div v-if="reply" class="mt-4">
            <div class="text-p-sm font-medium text-ink-gray-7">Reply</div>
            <p class="mt-1.5 whitespace-pre-wrap rounded-lg bg-surface-gray-1 p-3 text-p-sm text-ink-gray-8">{{ reply }}</p>
            <p class="mt-2 text-p-xs text-ink-gray-5">
              {{ lastTokens.toLocaleString('en-IN') }} tokens · added to this cycle's usage
            </p>
          </div>
        </section>
      </template>
    </div>

    <!-- New token — the value is shown once, so the dialog says so up front. -->
    <Dialog v-model:open="newOpen" title="New token" size="sm">
      <FormControl v-model="newLabel" type="text" label="Name" placeholder="e.g. Production" />
      <p class="mt-2 text-p-sm text-ink-gray-5">The token is shown once, right after you create it.</p>
      <template #actions>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" @click="newOpen = false" />
          <Button variant="solid" label="Create" :disabled="!newLabel.trim()" @click="createToken" />
        </div>
      </template>
    </Dialog>

    <SecretDialog v-model:open="secretOpen" title="Your new token" :fields="secretFields" />

    <ConfirmDialog
      v-model:open="revokeOpen"
      title="Revoke this token?"
      message="Anything still using it stops working immediately. Other tokens are unaffected."
      confirm-label="Revoke"
      theme="red"
      @confirm="revoke"
    />
  </AddonShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Badge, Button, Dialog, Dropdown, FormControl, TabButtons, Tooltip, toast } from 'frappe-ui'
import AddonShell from '../../../components/AddonShell.vue'
import ConfirmDialog from '../../../components/ConfirmDialog.vue'
import EmptyState from '../../../components/EmptyState.vue'
import SecretDialog from '../../../components/SecretDialog.vue'
import { AI_MODELS } from '../../../data/addons'
import { useCloudStore } from '../../../stores/cloud'
import { rate } from '../../../utils/format'

const store = useCloudStore()

const BASE_URL = 'https://ai.frappe.cloud/v1'

const tab = ref('models')
const tabs = [
  { label: 'Models', value: 'models' },
  { label: 'Tokens', value: 'tokens' },
  { label: 'Playground', value: 'playground' },
]

const tokens = computed(() => store.addonState('ai').tokens || [])

// Pre-filled with the model it sits under, so copy-paste is a working call.
function curlFor(model) {
  const endpoint = model.kind === 'Embedding' ? 'embeddings' : 'chat/completions'
  const body =
    model.kind === 'Embedding'
      ? `    "model": "${model.name}",\n    "input": "embed me"`
      : `    "model": "${model.name}",\n    "messages": [{"role": "user", "content": "say something"}]`
  return `curl ${BASE_URL}/${endpoint} \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer $FRAPPE_AI_TOKEN" \\\n  -d '{\n${body}\n  }'`
}

// Folded per model rather than one shared toggle — you're comparing models, so
// opening one shouldn't close the one you were reading.
const openExamples = ref([])
function isOpen(id) {
  return openExamples.value.includes(id)
}
function toggleExample(id) {
  openExamples.value = isOpen(id) ? openExamples.value.filter((x) => x !== id) : [...openExamples.value, id]
}

function copy(text, message) {
  navigator.clipboard?.writeText(text)
  toast.success(message)
}

// — Tokens
const newOpen = ref(false)
const newLabel = ref('')
const revokeOpen = ref(false)
const revoking = ref(null)

function tokenMenu(t) {
  return [{ label: 'Revoke', icon: 'lucide-trash-2', onClick: () => { revoking.value = t; revokeOpen.value = true } }]
}

const secretOpen = ref(false)
const secretFields = ref([])

function createToken() {
  const label = newLabel.value.trim()
  newOpen.value = false
  newLabel.value = ''
  const state = store.addonState('ai')
  const body = Array.from({ length: 32 }, () => Math.random().toString(36)[2]).join('')
  const tail = body.slice(-4)
  store.addons.ai = {
    ...state,
    tokens: [...(state.tokens || []), { id: `tok-${tail}`, label, tail, created: 'Just now', lastUsed: null }],
  }
  // The full value exists only here — the list only ever knows the last four.
  secretFields.value = [{ label: 'Token', value: `sk-fc-${body}` }]
  secretOpen.value = true
}

function revoke() {
  const t = revoking.value
  if (!t) return
  const state = store.addonState('ai')
  store.addons.ai = { ...state, tokens: (state.tokens || []).filter((x) => x.id !== t.id) }
  toast.success(`Revoked ${t.label}`)
  revoking.value = null
}

// — Playground
const playModel = ref(AI_MODELS[0].name)
const modelOptions = AI_MODELS.map((m) => ({ label: m.name, value: m.name }))
const prompt = ref('')
const reply = ref('')
const lastTokens = ref(0)
const running = ref(false)

const REPLIES = [
  'Three things stand out this week:\n\n• Order volume is up 12% on last week, driven almost entirely by the Mumbai region.\n• Two orders are still awaiting payment confirmation past their due date.\n• Average order value slipped slightly, from ₹8,400 to ₹7,950.',
  'Summary:\n\n• 148 orders totalling ₹11.8L, against 132 orders last week.\n• The top customer by value is Acme Retail at ₹2.1L across 9 orders.\n• Nothing is blocked — every order has stock allocated.',
]

function run() {
  running.value = true
  // Roughly what a short prompt and a few-sentence reply actually costs.
  const inTokens = Math.max(40, Math.round(prompt.value.length / 4))
  const outTokens = 180 + Math.round(Math.random() * 120)
  store
    ._work(() => {
      reply.value = REPLIES[Math.floor(Math.random() * REPLIES.length)]
      lastTokens.value = inTokens + outTokens
      // Meters are in millions of tokens — a single call is a sliver, which is
      // itself the honest picture of what one prompt costs.
      store.addAddonUsage('ai', 'tokensIn', inTokens / 1_000_000)
      store.addAddonUsage('ai', 'tokensOut', outTokens / 1_000_000)
    }, 1200)
    .catch((e) => toast.error(e.message))
    .finally(() => { running.value = false })
}
</script>

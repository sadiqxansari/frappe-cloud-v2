<template>
  <AddonShell addon-key="pdf">
    <div class="mt-8">
      <TabButtons v-model="tab" :options="tabs" />

      <!-- ── Print formats ──────────────────────────────────────────────
           Your existing Frappe print formats are the objects here — this
           service renders them, it doesn't ask you to author anything new. -->
      <template v-if="tab === 'formats'">
        <section class="mt-6">
          <!-- No "Print formats" heading — the tab names this; the one thing worth
               saying (where these come from) stays as a quiet helper line. -->
          <p class="text-p-sm text-ink-gray-5">Picked up from your sites — anything that renders a PDF today renders through this instead.</p>

          <div class="mt-3 divide-y divide-outline-alpha-gray-1 border-t border-outline-alpha-gray-1">
            <div v-for="f in formats" :key="f.name" class="flex items-center gap-3 py-2.5">
              <span class="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-gray-2 text-ink-gray-6">
                <span class="lucide-file-text size-4" />
              </span>
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-medium text-ink-gray-9">{{ f.name }}</div>
                <!-- A just-enabled service has rendered nothing; "0 this cycle"
                     on every row is noise, so the count only appears once there
                     is one. -->
                <div class="truncate text-p-sm text-ink-gray-5">
                  {{ f.site }}<template v-if="f.rendered"> · {{ f.rendered.toLocaleString('en-IN') }} this cycle</template>
                </div>
              </div>
              <Button variant="ghost" size="sm" label="Preview" :loading="previewing === f.name" @click="preview(f)" />
            </div>
          </div>
        </section>
      </template>

      <!-- ── Defaults ───────────────────────────────────────────────────
           Page geometry and the header/footer template. Anything a format
           doesn't specify falls back to these. -->
      <template v-else-if="tab === 'defaults'">
        <section class="mt-6">
          <h2 class="text-base font-semibold text-ink-gray-8">Page</h2>
          <div class="mt-3 grid gap-4 sm:grid-cols-2">
            <FormControl v-model="draft.size" type="select" label="Size" :options="SIZES" />
            <FormControl v-model="draft.orientation" type="select" label="Orientation" :options="ORIENTATIONS" />
            <FormControl v-model="draft.margin" type="select" label="Margin" :options="MARGINS" />
            <FormControl v-model="draft.footer" type="text" label="Footer" placeholder="Page {{page}} of {{total}}" />
          </div>
          <p class="mt-2 flex flex-wrap items-center gap-1 text-p-sm text-ink-gray-5">
            <span>Footer accepts</span>
            <code v-for="(v, i) in FOOTER_VARS" :key="v" class="font-mono text-p-xs text-ink-gray-7">{{ v }}<span v-if="i < FOOTER_VARS.length - 1" class="text-ink-gray-5">,</span></code>
          </p>
          <div class="mt-4 flex justify-end">
            <Button variant="subtle" label="Save" :disabled="!changed" @click="saveDefaults" />
          </div>
        </section>

        <!-- Test mode is the honest way to let someone try this without a bill,
             and it's the one setting people forget is on — so the state is
             stated plainly rather than left to a toggle's position. -->
        <section class="mt-8 border-t border-outline-gray-2 pt-8">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="min-w-0">
              <h2 class="text-base font-semibold text-ink-gray-8">Test mode</h2>
              <p class="mt-0.5 text-p-sm text-ink-gray-5">{{ testCopy }}</p>
            </div>
            <Button
              :variant="state.testMode ? 'subtle' : 'ghost'"
              :label="state.testMode ? 'Turn off' : 'Turn on'"
              @click="toggleTest"
            />
          </div>
        </section>
      </template>

      <!-- ── Keys ───────────────────────────────────────────────────── -->
      <template v-else>
        <section class="mt-6">
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-base font-semibold text-ink-gray-8">Endpoint</h2>
            <button class="flex items-center gap-1.5 text-p-sm text-ink-gray-6 transition-colors hover:text-ink-gray-9" @click="copy(ENDPOINT)">
              <span class="lucide-copy size-3.5" />
              Copy
            </button>
          </div>
          <p class="mt-1 font-mono text-p-sm text-ink-gray-7">{{ ENDPOINT }}</p>
          <p class="mt-2 text-p-sm text-ink-gray-5">
            POST HTML or a print format name. Sites on your servers use it automatically — a key is only for calling it from elsewhere.
          </p>
        </section>

        <section class="mt-8 border-t border-outline-gray-2 pt-8">
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-base font-semibold text-ink-gray-8">API keys</h2>
            <Button variant="ghost" size="sm" icon="lucide-plus" aria-label="New key" @click="newOpen = true" />
          </div>

          <div v-if="keys.length" class="mt-2 divide-y divide-outline-alpha-gray-1">
            <div v-for="k in keys" :key="k.id" class="flex items-center gap-3 py-2.5">
              <span class="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-gray-2 text-ink-gray-6">
                <span class="lucide-key-round size-4" />
              </span>
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-medium text-ink-gray-9">{{ k.label }}</div>
                <div class="truncate font-mono text-p-sm text-ink-gray-5">pdf_••••{{ k.tail }}</div>
              </div>
              <span class="shrink-0 text-p-sm text-ink-gray-5">Added {{ k.created }}</span>
              <Dropdown :options="keyMenu(k)" placement="bottom-end">
                <button class="rounded p-1 text-ink-gray-5 hover:bg-surface-gray-2" :aria-label="`Actions for ${k.label}`"><span class="lucide-ellipsis size-4" /></button>
              </Dropdown>
            </div>
          </div>
          <EmptyState
            v-else
            class="mt-3"
            icon="lucide-key-round"
            title="No keys"
            description="Your own sites don't need one. Add a key to render from somewhere else."
          >
            <Button variant="subtle" size="sm" label="New key" icon-left="lucide-plus" @click="newOpen = true" />
          </EmptyState>
        </section>
      </template>
    </div>

    <Dialog v-model:open="newOpen" title="New key" size="sm">
      <FormControl v-model="newLabel" type="text" label="Name" placeholder="e.g. Reporting service" />
      <p class="mt-2 text-p-sm text-ink-gray-5">The key is shown once, right after you create it.</p>
      <template #actions>
        <div class="flex justify-end gap-2">
          <Button label="Cancel" @click="newOpen = false" />
          <Button variant="solid" label="Create" :disabled="!newLabel.trim()" @click="createKey" />
        </div>
      </template>
    </Dialog>

    <SecretDialog v-model:open="secretOpen" title="Your new key" :fields="secretFields" />

    <ConfirmDialog
      v-model:open="revokeOpen"
      title="Revoke this key?"
      message="Anything still using it stops rendering immediately. Other keys are unaffected."
      confirm-label="Revoke"
      theme="red"
      @confirm="revoke"
    />
  </AddonShell>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { Button, Dialog, Dropdown, FormControl, TabButtons, toast } from 'frappe-ui'
import AddonShell from '../../../components/AddonShell.vue'
import ConfirmDialog from '../../../components/ConfirmDialog.vue'
import EmptyState from '../../../components/EmptyState.vue'
import SecretDialog from '../../../components/SecretDialog.vue'
import { useCloudStore } from '../../../stores/cloud'

const store = useCloudStore()

const ENDPOINT = 'https://pdf.frappe.cloud/v1/render'

const tab = ref('formats')
const tabs = [
  { label: 'Print formats', value: 'formats' },
  { label: 'Defaults', value: 'defaults' },
  { label: 'Keys', value: 'keys' },
]

const state = computed(() => store.addonState('pdf'))
const keys = computed(() => state.value.keys || [])

function patch(changes) {
  store.addons.pdf = { ...state.value, ...changes }
}

function copy(text) {
  navigator.clipboard?.writeText(text)
  toast.success('Endpoint copied')
}

// — Print formats. Stand-ins for what the platform would read off the sites.
// `share` is this format's slice of rendering, not a count: the counts are
// derived from the meter below so the page can never claim thousands of renders
// while the usage card above it reads zero.
const FORMATS = [
  { name: 'Sales Invoice', site: 'mycompany.frappe.cloud', share: 0.69 },
  { name: 'Delivery Note', site: 'mycompany.frappe.cloud', share: 0.19 },
  { name: 'Purchase Order', site: 'mycompany.frappe.cloud', share: 0.09 },
  { name: 'Payment Receipt', site: 'myshop.frappe.cloud', share: 0.03 },
]

const documentsUsed = computed(() => state.value.usage?.documents || 0)
const formats = computed(() =>
  FORMATS.map((f) => ({ ...f, rendered: Math.round(f.share * documentsUsed.value) })),
)

const previewing = ref(null)

function preview(f) {
  previewing.value = f.name
  store
    ._work(() => {}, 1100)
    .then(() => toast.success(`Rendered a sample ${f.name}`))
    .catch((e) => toast.error(e.message))
    .finally(() => { previewing.value = null })
}

// — Defaults
const SIZES = [
  { label: 'A4', value: 'A4' },
  { label: 'Letter', value: 'Letter' },
  { label: 'Legal', value: 'Legal' },
  { label: 'A5', value: 'A5' },
]
const ORIENTATIONS = [
  { label: 'Portrait', value: 'portrait' },
  { label: 'Landscape', value: 'landscape' },
]
const MARGINS = [
  { label: 'Normal (15mm)', value: 'normal' },
  { label: 'Narrow (8mm)', value: 'narrow' },
  { label: 'Wide (25mm)', value: 'wide' },
  { label: 'None', value: 'none' },
]

// Built here rather than written in the template: Vue's parser closes an
// interpolation at the first `}}`, so a literal `{{page}}` in markup can't be
// escaped — it has to arrive as data.
const FOOTER_VARS = ['{{page}}', '{{total}}', '{{date}}']

const DEFAULTS = { size: 'A4', orientation: 'portrait', margin: 'normal', footer: '' }
const draft = reactive({ ...DEFAULTS, ...(store.addonState('pdf').page || {}) })
const changed = computed(() => {
  const saved = { ...DEFAULTS, ...(state.value.page || {}) }
  return Object.keys(DEFAULTS).some((k) => draft[k] !== saved[k])
})

function saveDefaults() {
  patch({ page: { ...draft } })
  toast.success('Defaults saved')
}

// On, the copy leads with the risk (watermarks going to a customer); off, it
// leads with the benefit (free trial renders). Same setting, different worry.
const testCopy = computed(() =>
  state.value.testMode
    ? 'Every PDF is watermarked and free. Turn off before you send anything to a customer.'
    : 'Renders watermarked PDFs that don’t count towards your usage.',
)

function toggleTest() {
  const on = !state.value.testMode
  patch({ testMode: on })
  toast.success(on ? 'Test mode on' : 'Test mode off')
}

// — Keys
const newOpen = ref(false)
const newLabel = ref('')
const secretOpen = ref(false)
const secretFields = ref([])

function createKey() {
  const label = newLabel.value.trim()
  newOpen.value = false
  newLabel.value = ''
  const body = Array.from({ length: 32 }, () => Math.random().toString(36)[2]).join('')
  const tail = body.slice(-4)
  patch({ keys: [...keys.value, { id: `pk-${tail}`, label, tail, created: 'just now' }] })
  secretFields.value = [{ label: 'Key', value: `pdf_${body}` }]
  secretOpen.value = true
}

const revokeOpen = ref(false)
const revoking = ref(null)

function keyMenu(k) {
  return [{ label: 'Revoke', icon: 'lucide-trash-2', onClick: () => { revoking.value = k; revokeOpen.value = true } }]
}

function revoke() {
  const k = revoking.value
  if (!k) return
  patch({ keys: keys.value.filter((x) => x.id !== k.id) })
  toast.success(`Revoked ${k.label}`)
  revoking.value = null
}
</script>

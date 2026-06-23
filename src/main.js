import 'frappe-ui/style.css'
import './index.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useCloudStore } from './stores/cloud'

// Persist the store to localStorage so a refresh keeps you where you were
// (no forced trip back to onboarding). This is per-tab only: each tab saves and
// restores its own state on load. We deliberately do NOT sync live across tabs —
// a shared `storage` listener caused feedback loops (two tabs $patch-ing each
// other) that made counts/toggles flicker and demanded reloads.
const pinia = createPinia()
pinia.use(({ store }) => {
  const KEY = `fc.store.${store.$id}`
  const saved = localStorage.getItem(KEY)
  if (saved) {
    try {
      store.$patch(JSON.parse(saved))
    } catch {
      localStorage.removeItem(KEY)
    }
  }
  store.$subscribe((_mutation, state) => {
    // `busy` is transient (drives the progress bar) — never restore it as in-flight.
    const json = JSON.stringify({ ...state, busy: 0 })
    if (localStorage.getItem(KEY) === json) return // skip identical writes
    localStorage.setItem(KEY, json)
  })
})

const app = createApp(App)
app.use(pinia)
app.use(router)
app.mount('#app')

// Live timers don't survive a refresh, but the migration state does (localStorage).
// Re-arm any in-flight or scheduled migration so progress keeps advancing.
useCloudStore(pinia).resumeMigrations()

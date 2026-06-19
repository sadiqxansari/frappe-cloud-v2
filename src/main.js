import 'frappe-ui/style.css'
import './index.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useCloudStore } from './stores/cloud'

// Persist the store to localStorage so a refresh keeps you where you were
// (no forced trip back to onboarding) and every browser tab — Central or a
// server — restores its own state. localStorage is shared across tabs of the
// same origin, so they all read the same account; each tab's URL keeps its view.
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
    // Skip when nothing changed. This also breaks the cross-tab loop below: a
    // storage-driven $patch produces state identical to what's already stored, so
    // we don't re-write it and re-fire `storage` events in the other tabs forever.
    if (localStorage.getItem(KEY) === json) return
    localStorage.setItem(KEY, json)
  })

  // Live cross-tab sync: when another tab writes new state (e.g. the user adds a
  // payment method in a Billing tab opened from the change-plan modal), patch it in
  // so this tab reacts immediately. `storage` fires only in *other* tabs, never the
  // writer, so this never recurses on our own writes.
  window.addEventListener('storage', (event) => {
    if (event.key !== KEY || !event.newValue) return
    try {
      store.$patch(JSON.parse(event.newValue))
    } catch {
      // Ignore malformed payloads — the next valid write will sync.
    }
  })
})

const app = createApp(App)
app.use(pinia)
app.use(router)
app.mount('#app')

// Live timers don't survive a refresh, but the migration state does (localStorage).
// Re-arm any in-flight or scheduled migration so progress keeps advancing.
useCloudStore(pinia).resumeMigrations()

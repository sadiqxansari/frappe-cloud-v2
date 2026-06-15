import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import frappeui from 'frappe-ui/vite'

export default defineConfig({
  plugins: [
    // Frappe UI ships raw .vue/.ts source; its plugin provides the
    // ~icons/lucide/* virtual modules its components import. Backend
    // integrations are disabled — this prototype has no Frappe server.
    frappeui({
      frappeProxy: false,
      jinjaBootData: false,
      buildConfig: false,
      lucideIcons: true,
    }),
    vue(),
  ],
  optimizeDeps: {
    exclude: ['frappe-ui'],
    include: [
      'feather-icons',
      'dayjs',
      '@vueuse/core',
      '@headlessui/vue',
      'reka-ui',
      'vue-sonner',
      'tippy.js',
      '@floating-ui/dom',
      'fuzzysort',
      'socket.io-client',
      'idb-keyval',
    ],
  },
})

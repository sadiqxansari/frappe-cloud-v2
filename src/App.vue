<template>
  <RouterView />
  <DemoSwitch />
  <ToastProvider />
</template>

<script setup>
import { ToastProvider } from 'frappe-ui'
import DemoSwitch from './components/DemoSwitch.vue'
</script>

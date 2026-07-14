<template>
  <main class="flex min-h-screen flex-col bg-surface-white px-4">
    <section class="enter-rise mx-auto w-full max-w-[391px] pt-[16vh]">
      <slot />
    </section>

    <footer class="enter-rise mt-auto flex items-center justify-center gap-2 pb-10" style="--enter-delay: 120ms">
      <img :src="cloudLogo" alt="" class="size-6 rounded-md" />
      <span class="text-sm font-semibold text-ink-gray-7">Frappe Cloud</span>
    </footer>
  </main>
</template>

<script setup>
// The app mounts a single ToastProvider in App.vue, so this shell doesn't add
// its own. Logo asset matches OnboardingShell's brand mark.
import cloudLogo from '../assets/apps/cloud.png'
</script>

<style scoped>
/* One-time screens: a subtle rise-in is worth it. Opacity-only under reduced motion. */
.enter-rise {
  animation: rise-in 300ms cubic-bezier(0.23, 1, 0.32, 1) both;
  animation-delay: var(--enter-delay, 0ms);
}

@keyframes rise-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}

@media (prefers-reduced-motion: reduce) {
  @keyframes rise-in {
    from {
      opacity: 0;
    }
  }
}
</style>

import frappeUIPreset from 'frappe-ui/tailwind'
import plugin from 'tailwindcss/plugin'

/** @type {import('tailwindcss').Config} */
export default {
  presets: [frappeUIPreset],
  content: [
    './index.html',
    './src/**/*.{vue,js,ts}',
    './node_modules/frappe-ui/src/**/*.{vue,js,ts}',
  ],
  plugins: [
    // Plain `hover:` fires on tap on touch devices (no true hover state), so a
    // color swap can look "stuck" until the next tap elsewhere. `hover-hover:`
    // gates the same utilities behind a real-hover, fine-pointer check.
    plugin(({ addVariant }) => {
      addVariant('hover-hover', '@media (hover: hover) and (pointer: fine) { &:hover }')
      // The group-hover equivalent — Tailwind doesn't auto-derive group-*
      // variants for custom variants, so it needs its own registration.
      addVariant('group-hover-hover', '@media (hover: hover) and (pointer: fine) { :merge(.group):hover & }')
    }),
  ],
}

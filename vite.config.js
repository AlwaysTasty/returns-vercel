// vite.config.js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // This line is CRUCIAL. It tells Vite to build all asset paths
  // relative to the root of the domain, like "/assets/index.js".
  base: '/',
})
import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Used only when VITE_API_BASE_URL is empty. Proxying keeps the browser on a single origin,
      // so CORS never enters into it; setting VITE_API_BASE_URL instead calls the API directly and
      // relies on its CORS policy, which admits any loopback port in Development. Either works.
      //
      // secure: false because the backend's development certificate is self-signed - this affects
      // only the dev server's own hop to localhost, never the browser and never production.
      '/api': {
        target: process.env.VITE_DEV_API_TARGET ?? 'https://localhost:7209',
        changeOrigin: true,
        secure: false,
      },
      '/brand': {
        target: process.env.VITE_DEV_API_TARGET ?? 'https://localhost:7209',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})

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
  build: {
    rollupOptions: {
      output: {
        /*
          Chunks are named by hash alone, not by what they contain.

          Vite's default names a chunk after its source - an icon module becomes `plus-<hash>.js`,
          `share-2-<hash>.js`, and so on. Those names match the filter lists ad blockers ship, so
          the extension cancels the request; the browser then hands the page an empty text/html
          response, the dynamic import rejects, and a route that needs that chunk simply never
          loads. It presented as signing in successfully and never leaving the login screen.

          The file is not an advert, but nothing about the request says so - only the name is
          visible to a filter. Hashes carry no words to match, so the block cannot trigger.
        */
        chunkFileNames: 'assets/[hash].js',
        entryFileNames: 'assets/[hash].js',
        assetFileNames: 'assets/[hash][extname]',
      },
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

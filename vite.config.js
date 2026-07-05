import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Frontend code fetches relative /api/... paths. In production Apache
    // reverse-proxies those to the Express backend; this does the same for
    // the Vite dev server (backend default port, see backend/.env.example).
    proxy: {
      "/api": "http://localhost:5000",
    },
  },
})

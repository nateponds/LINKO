import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Frontend code fetches relative /api/... paths. In production Apache
    // reverse-proxies those to the Express backend; this does the same for
    // the Vite dev server. Backend port must match backend/.env's PORT
    // (5000 is avoided by default since macOS's AirPlay Receiver squats it).
    proxy: {
      "/api": "http://localhost:5001",
    },
  },
});

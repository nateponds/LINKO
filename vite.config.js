import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Single source of truth for the backend port: VITE_BACKEND_PORT (set it in
  // the frontend .env), else 5001. macOS's AirPlay Receiver squats 5000, so
  // devs on a Mac keep 5001 here and PORT=5001 in backend/.env — one value,
  // no drift between the proxy target and the server it points at.
  const env = loadEnv(mode, process.cwd(), "");
  const backendPort = env.VITE_BACKEND_PORT || "5001";
  return {
    plugins: [react()],
    server: {
      // Frontend fetches relative /api/... paths; in production cloudflared
      // splits /api to the backend, and this proxy does the same in dev.
      proxy: {
        "/api": `http://localhost:${backendPort}`,
      },
    },
  };
});

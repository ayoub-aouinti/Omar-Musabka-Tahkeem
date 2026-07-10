import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The dashboard runs on the default Vite port (5173) and talks to the API on
// 3001. In dev we proxy `/api` so cookies/CORS stay simple, but the axios client
// still reads `VITE_API_URL` so production builds hit the real host.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});

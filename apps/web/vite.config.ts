import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// `@tahkeem/shared` ships a real ESM build (`exports.import`), so Vite reads its
// named exports directly — no CJS→ESM interop, and no pre-bundled copy that can
// go stale against a rebuilt `dist/`. Excluding the linked workspace package
// from the dep cache means `pnpm shared:build` is picked up on the next request
// instead of after a manual `vite --force`.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  optimizeDeps: {
    exclude: ["@tahkeem/shared"],
  },
});

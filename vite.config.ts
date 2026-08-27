import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { levelPositionsWriter } from "./scripts/vite-plugin-level-positions";

export default defineConfig({
  /* levelPositionsWriter sólo corre en `vite dev` (apply: "serve"): le da al
     editor visual de niveles un endpoint para escribir levelPositions.ts
     directo, sin copiar y pegar. No existe en el build de producción. */
  plugins: [react(), tailwindcss(), levelPositionsWriter()],
  server: {
    // Dev-only: proxy /api to the production API (which runs against
    // Supabase). Keeps the browser same-origin so there are no CORS or
    // cross-site cookie issues — local frontend uses the real backend/DB.
    proxy: {
      "/api": {
        target: "https://typely.bauhub.online",
        changeOrigin: true,
        secure: true,
      },
    },
  },
  build: {
    // Source maps publicados para debugging en producción (Lighthouse
    // "Buenas prácticas"). No exponen secretos: el frontend es público.
    sourcemap: true,
  },
});

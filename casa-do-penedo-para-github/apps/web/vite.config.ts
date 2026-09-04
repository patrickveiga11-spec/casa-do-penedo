import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiTarget = "http://127.0.0.1:3001";
const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(rootDir, "index.html"),
        gestao: path.resolve(rootDir, "gestao.html"),
      },
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/health": apiTarget,
      "/properties": apiTarget,
      "/reservations": apiTarget,
      "/calendar": apiTarget,
      "/pricing-rules": apiTarget,
      "/pricing": apiTarget,
      "/blocks": apiTarget,
      "/dashboard": apiTarget,
      "/auth": apiTarget,
    },
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiTarget = "http://127.0.0.1:3001";

export default defineConfig({
  plugins: [react()],
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

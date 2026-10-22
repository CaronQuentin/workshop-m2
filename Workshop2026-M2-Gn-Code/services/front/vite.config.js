import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Servi à la racine derrière le WAF. En dev, proxy des appels API vers le WAF local.
export default defineConfig({
  plugins: [react()],
  base: "/",
  server: {
    proxy: {
      "/api": { target: "http://localhost:8088", changeOrigin: true },
      "/auth": { target: "http://localhost:8088", changeOrigin: true },
      "/remediation": { target: "http://localhost:8088", changeOrigin: true },
    },
  },
});

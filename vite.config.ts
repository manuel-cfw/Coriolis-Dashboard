import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const page = (file: string) => fileURLToPath(new URL(file, import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.CORIOLIS_API_URL || "http://localhost:3001";

  return {
    plugins: [react()],
    server: {
      port: 5174,
      // Owlbear Rodeo lädt Manifest und Seiten cross-origin
      cors: true,
      proxy: {
        "/api": { target: apiTarget, changeOrigin: true },
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: page("./index.html"),
          background: page("./background.html"),
          hudTop: page("./hud-top.html"),
          hudCrew: page("./hud-crew.html"),
        },
      },
    },
  };
});

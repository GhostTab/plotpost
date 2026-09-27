import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  // Allow Vercel to set API_BASE_URL (no VITE_ prefix) and map it for the client.
  const env = loadEnv(mode, root, "");
  const apiBase = (
    env.VITE_API_BASE_URL ||
    env.API_BASE_URL ||
    process.env.VITE_API_BASE_URL ||
    process.env.API_BASE_URL ||
    ""
  ).replace(/\/$/, "");

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(root, "./src"),
      },
    },
    // Only inject when explicitly configured — otherwise production uses same-origin `/api/v1`.
    define: apiBase
      ? {
          "import.meta.env.VITE_API_BASE_URL": JSON.stringify(apiBase),
        }
      : {},
    server: {
      port: 5173,
    },
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      globals: true,
    },
  };
});

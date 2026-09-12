import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";

export default defineConfig(({ mode }) => {
  // Carrega .env (DATABASE_URL etc.) — vitest não faz isso sozinho
  // como o Next.js faz; os testes de integração cross-tenant
  // precisam de DATABASE_URL para falar com o Postgres local.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));

  return {
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    test: {
      environment: "node",
    },
  };
});

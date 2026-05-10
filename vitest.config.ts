import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    globals: false,
    include: ["tests/unit/**/*.test.ts", "tests/rules/**/*.test.ts"],
    exclude: ["node_modules", ".next", "e2e", "functions"],
    testTimeout: 15_000,
    hookTimeout: 30_000,
    reporters: ["default"],
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});

import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

/**
 * Backend/unit config. Kept separate from any future component-test config so
 * the two suites always run as separate processes.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": resolve(import.meta.dirname, ".") },
  },
});

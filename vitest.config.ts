import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/engine/**/*.test.ts"],
    environment: "node",
  },
});

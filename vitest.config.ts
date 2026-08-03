import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      // Only the pure layers are meaningfully unit-testable without a live
      // Discord gateway and a database; hold those to a real bar.
      include: [
        "src/domain/**",
        "src/core/**",
        "src/bot/custom-id.ts",
        "src/infra/db/user-row.ts",
      ],
      // Thin wrappers over pino and node:timers — nothing to assert that is
      // not just restating the library's own behaviour.
      exclude: ["src/core/logger.ts", "src/core/sleep.ts"],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});

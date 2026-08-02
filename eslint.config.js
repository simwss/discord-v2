// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist/**", "coverage/**", "node_modules/**"]),

  {
    files: ["**/*.ts", "**/*.js"],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      // Last, so it can switch off rules that would fight Prettier.
      prettier,
    ],
    languageOptions: {
      parserOptions: {
        // `allowDefaultProject` lets the config file itself be linted; it is
        // not covered by tsconfig.json (which only includes src/).
        projectService: {
          allowDefaultProject: ["eslint.config.js"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Logging goes through pino so it is structured and redacted.
      "no-console": "error",
      eqeqeq: ["error", "always"],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // discord.js builders are chainable and intentionally return `this`.
      "@typescript-eslint/no-confusing-void-expression": "off",
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true },
      ],
    },
  },

  {
    files: ["**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
    },
  },

  {
    // These are operator-facing scripts; their output is the user interface.
    files: ["src/scripts/**/*.ts"],
    rules: {
      "no-console": "off",
    },
  },
]);

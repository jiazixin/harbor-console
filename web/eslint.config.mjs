import eslint from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "test-results/**",
      "playwright-report/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: ["**/*.{ts,tsx,mts}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      // An empty string falls back like a missing one.
      "@typescript-eslint/prefer-nullish-coalescing": [
        "error",
        { ignorePrimitives: { string: true } },
      ],
      "no-nested-ternary": "error",
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      "react-hooks/exhaustive-deps": "error",
    },
  },
  {
    files: ["**/*.{mjs,cjs,js}"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/**/*.test.{ts,tsx}"],
    rules: {
      "id-length": [
        "error",
        { min: 2, properties: "never", exceptions: ["t", "_", "T", "K", "V"] },
      ],
      "max-depth": ["error", 3],
    },
  },
);

import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["source/**"],
    plugins: { js },
    extends: ["js/recommended"],
  },
  {
    files: ["source/**"],
    languageOptions: { globals: globals.browser },
  },
  tseslint.configs.recommended,

  {
    rules: {
      "no-unused-vars": "error",
      "no-console": "warn",
      semi: ["error", "always"],
      quotes: ["error", "double"],
    },
  },
]);

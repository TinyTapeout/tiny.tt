import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  { ignores: [".wrangler/**", "node_modules/**", "dist/**", "src/*.generated.ts"] },
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.worker },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
);

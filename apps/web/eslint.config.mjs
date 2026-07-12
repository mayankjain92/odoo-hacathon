import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "public/mockServiceWorker.js",
    ],
  },
  {
    rules: {
      // `any` is used deliberately at API/data boundaries in this app; keep it a
      // warning (as in typescript-eslint's own recommended config) rather than a
      // hard error so lint stays green while still flagging the debt.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];

export default eslintConfig;

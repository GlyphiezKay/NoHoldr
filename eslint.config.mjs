import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Bundled verbatim from pdfjs-dist by scripts/sync-pdf-worker.mjs.
    "public/pdf.worker.min.mjs",
    "public/pdf-engine/**",
    "public/image-codec/**",
  ]),
]);

export default eslintConfig;

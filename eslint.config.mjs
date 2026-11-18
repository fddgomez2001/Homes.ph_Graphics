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
    // The Android project (Capacitor) and its copied web assets.
    "android/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "dist/**",
    "desktop-build/**",
    // The Chrome extension: plain browser scripts with the chrome.* API (no build step).
    "chrome-extension/**",
    // Electron main/preload are CommonJS by design.
    "electron/**",
    "scripts/*.cjs",
    // ONNX Runtime Web, copied from node_modules for the photo enhancer (scripts/copy-ort.mjs).
    "public/ort/**",
  ]),
]);

export default eslintConfig;

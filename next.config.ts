import { readFileSync } from "node:fs";
import type { NextConfig } from "next";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

/**
 * MOBILE_BUILD=1 (npm run build:mobile): the Android app. A static export of the
 * *.mobile.tsx routes only — one page — with no server: no proxy, API routes,
 * redirects or headers. Capacitor packs the `out` folder into the APK.
 */
const MOBILE = process.env.MOBILE_BUILD === "1";

const nextConfig: NextConfig = {
  // The Windows desktop app bundles a self-contained server (see scripts/build-desktop.mjs).
  ...(process.env.DESKTOP_BUILD === "1" ? { output: "standalone" as const } : {}),
  ...(MOBILE
    ? {
        output: "export" as const,
        // The export goes into distDir: its own folder, so the desktop/web build in .next is left alone.
        distDir: "out",
        pageExtensions: ["mobile.tsx"],
        images: { unoptimized: true },
        // Route types are generated for the full app; `npm run lint` / tsc check every file.
        typescript: { ignoreBuildErrors: true },
      }
    : {}),
  // Public app version: shown in Settings and used to refresh device caches after an update.
  env: { APP_VERSION: version, ...(MOBILE ? { NEXT_PUBLIC_MOBILE_APP: "1" } : {}) },
  // Both need a server at request time.
  cacheComponents: !MOBILE,
  partialPrefetching: !MOBILE,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  ...(MOBILE
    ? {}
    : {
        async redirects() {
          // SITE_MODE=website: the deployment is only the posting website (see README).
          return [{ source: "/", destination: process.env.SITE_MODE === "website" ? "/site" : "/home", permanent: false }];
        },
        async headers() {
          return [
            {
              source: "/:path*",
              headers: [
                { key: "X-Content-Type-Options", value: "nosniff" },
                { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                { key: "X-Frame-Options", value: "DENY" },
              ],
            },
          ];
        },
      }),
};

export default nextConfig;

import type { CapacitorConfig } from "@capacitor/cli"

// The Android app: the static export in out/ (npm run mobile:build), see scripts/build-mobile.mjs.
const config: CapacitorConfig = {
  appId: "ph.homes.carousels",
  appName: "Homes.ph Carousels",
  webDir: "out",
  android: {
    // Dark until the page paints, like the app's default theme.
    backgroundColor: "#0a0f1c",
  },
  plugins: {
    SystemBars: {
      insetsHandling: "css",
      initialViewportFitValueHint: "cover",
      style: "DARK",
    },
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      backgroundColor: "#0a0f1c",
      showSpinner: false,
    },
  },
}

export default config

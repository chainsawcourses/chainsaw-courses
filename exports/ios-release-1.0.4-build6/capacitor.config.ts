import { CapacitorConfig } from "@capacitor/cli";

const hostedAppUrl = process.env.CAPACITOR_SERVER_URL ?? "https://app.chainsawcourses.com";
const nativeAppId = process.env.CAPACITOR_APP_ID ?? "com.chainsawcourses.app";

const config: CapacitorConfig = {
  appId: nativeAppId,
  appName: "Chainsaw Courses",
  webDir: "dist/public",
  server: {
    // Both native apps use the same-origin hosted app inside Capacitor's
    // full-screen WebView. This keeps the existing /api routes working on
    // iOS and Android without opening a browser tab.
    url: hostedAppUrl,
    cleartext: false,
    allowNavigation: ["app.chainsawcourses.com"],
  },
  ios: {
    contentInset: "always",
  },
};

export default config;

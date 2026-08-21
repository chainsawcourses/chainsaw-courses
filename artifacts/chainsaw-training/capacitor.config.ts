import { CapacitorConfig } from "@capacitor/cli";

const androidServerUrl = process.env.CAPACITOR_ANDROID_SERVER_URL;

const config: CapacitorConfig = {
  appId: "com.chainsawcourses.app",
  appName: "Chainsaw Courses",
  webDir: "dist/public",
  server: {
    // Android uses the same-origin hosted app inside Capacitor's native WebView.
    // This preserves the existing /api routes without launching a browser tab.
    ...(androidServerUrl ? { url: androidServerUrl, cleartext: false } : {}),
    allowNavigation: ["app.chainsawcourses.com"],
  },
  ios: {
    contentInset: "always",
  },
};

export default config;

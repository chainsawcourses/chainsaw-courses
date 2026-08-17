import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.chainsawcourses.app",
  appName: "Chainsaw Courses",
  webDir: "dist/public",
  server: {
    // Allow the app to make requests to the live API over HTTPS
    allowNavigation: ["app.chainsawcourses.com"],
  },
  ios: {
    contentInset: "always",
  },
};

export default config;

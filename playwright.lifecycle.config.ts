import { defineConfig, devices } from "@playwright/test";
import { configureNixWebKitRuntime } from "./scripts/nix-webkit-runtime.mjs";

const webPort = 22102;

configureNixWebKitRuntime();

export default defineConfig({
  testDir: "./artifacts/chainsaw-training/tests/browser",
  fullyParallel: false,
  // Separate viewport projects have isolated browser contexts. Two workers let
  // those projects overlap on the two-core publishing runner; test cases within
  // each spec remain sequential and separate suites still run serially.
  workers: 2,
  timeout: 30_000,
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    serviceWorkers: "block",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium-phone-portrait",
      testMatch: ["retailer-directory.spec.ts", "admin-retailer-review.spec.ts"],
      use: { ...devices["iPhone 14"], browserName: "chromium" },
    },
    {
      name: "chromium-phone-landscape",
      testMatch: ["retailer-directory.spec.ts", "admin-retailer-review.spec.ts"],
      use: {
        ...devices["iPhone 14 landscape"],
        browserName: "chromium",
      },
    },
    {
      name: "chromium-tablet-portrait",
      testMatch: "retailer-directory.spec.ts",
      use: { ...devices["iPad (gen 7)"], browserName: "chromium" },
    },
    {
      name: "chromium-tablet-landscape",
      testMatch: "retailer-directory.spec.ts",
      use: {
        ...devices["iPad (gen 7)"],
        browserName: "chromium",
        viewport: { width: 1080, height: 810 },
      },
    },
    {
      name: "webkit-iphone-standalone",
      testMatch: "access-lifecycle.spec.ts",
      use: { ...devices["iPhone 14"], browserName: "webkit" },
    },
    {
      name: "webkit-ipad-standalone",
      testMatch: "access-lifecycle.spec.ts",
      use: { ...devices["iPad (gen 7)"], browserName: "webkit" },
    },
    {
      name: "webkit-retailer-history",
      testMatch: "admin-retailer-review.spec.ts",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  webServer: {
    // The test-only learner-switch hooks require Vite's DEV mode, even when
    // publishing invokes the surrounding build with NODE_ENV=production.
    // This applies to the local test server, not to production compilation.
    command: `NODE_ENV=development PORT=${webPort} BASE_PATH=/ VITE_BROWSER_LIFECYCLE_TEST=true pnpm --filter @workspace/chainsaw-training run dev`,
    url: `http://127.0.0.1:${webPort}`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
import { defineConfig } from "@playwright/test";

const apiPort = 22100;
const webPort = 22101;

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: `pnpm --filter @workspace/api-server run build && PORT=${apiPort} ADMIN_PASSWORD=gateway-browser-test-password DEMO_MODE=true NODE_ENV=test node artifacts/api-server/dist/index.mjs`,
      url: `http://127.0.0.1:${apiPort}/api/healthz`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `PORT=${webPort} BASE_PATH=/ API_ORIGIN=http://127.0.0.1:${apiPort} VITE_DEMO_MODE=true pnpm --filter @workspace/chainsaw-training run dev`,
      url: `http://127.0.0.1:${webPort}`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
// Browser simulation of the native bridge/UI. Not an Apple sandbox or Xcode test.
import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const baseURL = process.argv[2];
if (!baseURL?.startsWith("https://")) throw new Error("Provide the development preview HTTPS URL");
await mkdir("generated-artifacts/apple-storekit", { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [
    { width: 390, height: 844 }, { width: 844, height: 390 },
    { width: 820, height: 1180 }, { width: 1180, height: 820 },
    { width: 1440, height: 900 },
  ]) {
    const context = await browser.newContext({ viewport, serviceWorkers: "block" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(() => {
      let intent = null;
      window.CapacitorCustomPlatform = { name: "ios" };
      const appleMethods = ["products", "purchase", "restore", "history", "unfinished", "finish", "saveIntent", "readIntent", "clearIntent", "addListener", "removeListener"];
      window.Capacitor = {
        PluginHeaders: [
          { name: "AppleStore", methods: appleMethods.map(name => ({ name, rtype: "promise" })) },
          { name: "LearnerSecureSession", methods: ["get", "set", "remove", "removeLegacy", "getLegacy"].map(name => ({ name, rtype: "promise" })) },
        ],
        nativePromise: async (plugin, method, options) => {
          if (plugin === "LearnerSecureSession") return { value: null };
          if (method === "products") return { products: [{ id: "com.overleafpublishers.chainsawcourses.sixmonths", displayName: "Chainsaw Courses: Six Months", description: "Six months of chainsaw theory course access.", displayPrice: "£250.00" }] };
          if (method === "readIntent") return { value: intent };
          if (method === "saveIntent") { intent = options.value; return {}; }
          if (method === "clearIntent") { intent = null; return {}; }
          if (method === "purchase") return { state: "cancelled" };
          if (["history", "unfinished", "restore"].includes(method)) return { transactions: [] };
          return {};
        },
        nativeCallback: () => "test-listener",
      };
      localStorage.setItem("deviceId", "native-ui-test-device");
    });
    await page.route("**/api/apple/config**", route => route.fulfill({ json: { enabled: true, productId: "com.overleafpublishers.chainsawcourses.sixmonths", environment: "Sandbox" } }));
    await page.route("**/api/apple/intent**", route => route.fulfill({ json: {
      id: "00000000-0000-4000-8000-000000000001", appAccountToken: "00000000-0000-4000-8000-000000000002",
      secret: "browser-simulation-only", productId: "com.overleafpublishers.chainsawcourses.sixmonths",
    } }));
    await page.route("**/api/apple/identity/request**", route => route.fulfill({ json: { challengeId: "00000000-0000-4000-8000-000000000003", message: "Check your email." } }));
    await page.goto(baseURL);
    const buy = page.getByTestId("button-buy");
    await expect(buy).toContainText("£250.00", { timeout: 30000 });
    await expect(page.locator('input[name="code"]')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await buy.click();
    await expect(page.getByText("Purchase cancelled", { exact: true })).toBeVisible();
    await page.getByTestId("button-restore").click();
    await expect(page.getByText("No Apple purchase found", { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
    if (viewport.width === 390 || viewport.width === 1180) {
      await page.screenshot({ path: `generated-artifacts/apple-storekit/browser-${viewport.width}.jpg`, fullPage: true, type: "jpeg", quality: 55 });
    }
    await page.getByRole("button", { name: "Sign in with email", exact: true }).click();
    await page.getByTestId("input-fullname").fill("Browser Test Learner");
    await page.locator('input[type="email"]').fill("browser@example.test");
    await page.getByTestId("button-send-code").click();
    await expect(page.locator('input[autocomplete="one-time-code"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    console.log(`Browser simulation passed: ${viewport.width}×${viewport.height}, dynamic price, cancellation, restore and no horizontal overflow.`);
    await context.close();
  }
} finally { await browser.close(); }

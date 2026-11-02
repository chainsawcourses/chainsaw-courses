import { expect, test, type Page } from "@playwright/test";

type Retailer = {
  id: number;
  name: string;
  address: string;
  town: string;
  county: string;
  postcode: string;
  lat: number;
  lng: number;
  email: string;
  phone: string;
  website: string | null;
  featured: boolean;
  logoUrl?: string | null;
};

const learner = {
  code: "RETAILER-TEST",
  deviceId: "retailer-browser-device",
  userId: 471,
  fullName: "Retailer Test Learner",
  expiresAt: "2099-09-01T00:00:00.000Z",
};

const retailers: Retailer[] = [
  {
    id: 11,
    name: "Northern Saw Supplies",
    address: "11 Forest Road",
    town: "Leeds",
    county: "West Yorkshire",
    postcode: "LS1 1AA",
    lat: 53.801,
    lng: -1.549,
    email: "north@example.test",
    phone: "0113 000 0011",
    website: "https://north.example.test",
    featured: false,
    logoUrl: "/api/retailers/public/logos/11/00000000-0000-4000-8000-000000000011",
  },
  {
    id: 22,
    name: "Southern Forestry Tools",
    address: "22 Timber Lane",
    town: "Southampton",
    county: "Hampshire",
    postcode: "SO14 1AA",
    lat: 50.91,
    lng: -1.404,
    email: "south@example.test",
    phone: "023 8000 0022",
    website: "south.example.test",
    featured: true,
    logoUrl: "/api/retailers/public/logos/22/00000000-0000-4000-8000-000000000022",
  },
  {
    id: 33,
    name: "Alpha Arborist Supplies",
    address: "33 Woodland Way",
    town: "York",
    county: "North Yorkshire",
    postcode: "YO1 1AA",
    lat: 53.96,
    lng: -1.087,
    email: "alpha@example.test",
    phone: "01904 000 033",
    website: "https://alpha.example.test",
    featured: false,
    logoUrl: "/api/retailers/public/logos/33/00000000-0000-4000-8000-000000000033",
  },
];

const testLogoPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAIAQMAAAD+wSzIAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAADUExUReJyJsIYp50AAAAHdElNRQfqCggNNi/eGp11AAAAJXRFWHRkYXRlOmNyZWF0ZQAyMDI2LTEwLTA4VDEzOjU0OjQ3KzAwOjAwcY0pjwAAACV0RVh0ZGF0ZTptb2RpZnkAMjAyNi0xMC0wOFQxMzo1NDo0NyswMDowMADQkTMAAAAodEVYdGRhdGU6dGltZXN0YW1wADIwMjYtMTAtMDhUMTM6NTQ6NDcrMDA6MDBXxbDsAAAAC0lEQVQI12NgQAUAABAAAaHFIcEAAAAASUVORK5CYII=",
  "base64",
);

async function authenticate(page: Page) {
  await page.addInitScript(({ learner }) => {
    localStorage.setItem("activationCode", learner.code);
    localStorage.setItem("deviceId", learner.deviceId);
    localStorage.setItem("userId", String(learner.userId));
    localStorage.setItem("fullName", learner.fullName);
    localStorage.setItem("email", "retailer@example.test");
    localStorage.setItem("learnerSessionStatus", "active");
    localStorage.setItem(`welcome_seen_${learner.userId}`, "1");
    localStorage.setItem(
      `verifiedCourseAccess:${learner.code}:${learner.userId}`,
      JSON.stringify({ accessStatus: "active", accessExpiresAt: learner.expiresAt }),
    );
  }, { learner });
}

async function mockAuthenticatedApp(page: Page, directory: Retailer[] = retailers) {
  await authenticate(page);
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/auth/me") {
      await route.fulfill({
        json: {
          userId: learner.userId,
          fullName: learner.fullName,
          accessStatus: "active",
          accessExpiresAt: learner.expiresAt,
          courseCompletedAt: null,
          allModulesUnlocked: false,
          waiverSigned: true,
          activeAdjustments: [],
        },
      });
      return;
    }
    if (url.pathname === "/api/retailers") {
      await route.fulfill({ json: directory });
      return;
    }
    if (url.pathname.startsWith("/api/retailers/public/logos/")) {
      if (url.pathname.includes("/33/")) {
        await route.fulfill({ status: 404, body: "Logo unavailable" });
        return;
      }
      await route.fulfill({ contentType: "image/png", body: testLogoPng });
      return;
    }
    if (url.pathname === "/api/retailers/postcode") {
      await route.fulfill({ json: { lat: 50.91, lng: -1.404 } });
      return;
    }
    if (url.pathname === "/api/modules") {
      await route.fulfill({ json: [] });
      return;
    }
    if (url.pathname === "/api/progress/summary") {
      await route.fulfill({
        json: {
          completedModules: 0,
          totalModules: 0,
          quizzesPassed: 0,
          percentComplete: 0,
          certificateEarned: false,
        },
      });
      return;
    }
    if (url.pathname === "/api/exam/status") {
      await route.fulfill({ json: { unlocked: false, passed: false } });
      return;
    }
    if (url.pathname === "/api/auth/history") {
      await route.fulfill({ json: [] });
      return;
    }
    await route.fulfill({ json: {} });
  });
}

async function expectViewportUsable(page: Page) {
  await expect(page.getByRole("heading", { name: "Retailer Directory" })).toBeVisible();
  await expect(page.getByLabel("Postcode")).toBeVisible();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}

test("dashboard link opens the directory without exam or passport gates", async ({ page }) => {
  await mockAuthenticatedApp(page);
  await page.goto("/training");

  await expect(page.getByText("Final Exam", { exact: true }).first()).toBeVisible();
  const header = page.locator("header");
  await expect(header.getByTitle("Inspection Checklist")).toHaveCount(0);
  await expect(header.getByRole("button", { name: "Chainsaw Courses menu" }).locator("span").first()).toHaveCSS("font-size", "17px");
  await expect(header.getByTestId("chainsaw-courses-menu-chevron")).toHaveCSS("width", "20px");
  await expect(header.getByTitle("Dynamic Risk Assessment").locator("svg")).toHaveCSS("width", "20px");
  await expect(page.getByTestId("icon-header-retailer-chainsaw")).toBeVisible();
  const headerActions = header.getByTestId("training-header-actions");
  await expect(headerActions).toHaveCSS("opacity", "1");
  await expect(headerActions).toHaveCSS("animation-name", "none");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  const retailerLink = page.getByRole("main").getByRole("link", { name: "Chainsaw Retailers" });
  await expect(retailerLink.getByTestId("icon-retailer-chainsaw")).toBeVisible();
  await retailerLink.click();

  await expect(page).toHaveURL(/\/retailers$/);
  await expect(page.getByTestId("retailer-page-header-chainsaw-icon")).toHaveCSS(
    "background-color",
    "rgb(0, 0, 0)",
  );
  await expectViewportUsable(page);
  await expect(page.getByText(/passport/i)).toHaveCount(0);
});

test("full list is alphabetical before postcode search, then reorders by distance", async ({ page }) => {
  await mockAuthenticatedApp(page);
  await page.goto("/retailers");
  await expectViewportUsable(page);
  await expect(page.getByLabel("Search retailers")).toHaveCount(0);
  await expect(page.getByLabel("Postcode")).toBeVisible();

  const cards = page.locator("button").filter({ has: page.locator("div.font-bold") });
  await expect(cards.first()).toContainText("Alpha Arborist Supplies");
  await expect(cards.nth(1)).toContainText("Northern Saw Supplies");
  await expect(cards.nth(2)).toContainText("Southern Forestry Tools");
  const featuredMarker = page.locator(".retailer-marker-featured");
  const standardMarker = page.locator(".retailer-marker-11");
  const standardTapTarget = page.locator(".retailer-marker-tap-target-11");
  await expect(featuredMarker).toHaveAttribute("fill", "#ffffff");
  await expect(standardMarker).toHaveAttribute("fill", "#e27226");
  expect(
    await standardMarker.evaluate((standard, featured) =>
      Boolean(standard.compareDocumentPosition(featured as Node) & Node.DOCUMENT_POSITION_FOLLOWING),
      await featuredMarker.elementHandle(),
    ),
  ).toBe(true);
  const featuredBox = await featuredMarker.boundingBox();
  const standardBox = await standardMarker.boundingBox();
  expect(featuredBox).not.toBeNull();
  expect(standardBox).not.toBeNull();
  expect(featuredBox!.width).toBeGreaterThan(standardBox!.width);
  const standardTapTargetBox = await standardTapTarget.boundingBox();
  expect(standardTapTargetBox).not.toBeNull();
  expect(standardTapTargetBox!.width).toBeGreaterThanOrEqual(40);
  expect(standardTapTargetBox!.width).toBeGreaterThan(standardBox!.width);
  await page.getByLabel("Postcode").fill("so14 1aa");
  await page.getByRole("button", { name: "Search" }).click();

  await expect(page.locator("p[role='status']")).toHaveText(
    "Postcode search complete for SO14 1AA. Retailers are sorted by distance.",
  );
  await expect(page.getByText("Nearest Retailers")).toBeVisible();
  await expect(cards.first()).toContainText("Southern Forestry Tools");
  await expect(cards.first()).toContainText("0.0 miles");
  await expect(page.locator(".retailer-search-location-marker")).toBeVisible();
  await expect(page.locator(".retailer-marker-22")).toBeVisible();
  const mapFrame = page.locator("[data-map-center]");
  await expect(mapFrame).toHaveAttribute("data-map-center", "50.91,-1.404");
  await expect(mapFrame).toHaveAttribute("data-map-zoom", "11");
});

test("selected standard markers turn darker and list selections use a gentler map zoom", async ({ page }) => {
  await mockAuthenticatedApp(page);
  await page.goto("/retailers");
  await expectViewportUsable(page);

  const map = page.locator(".leaflet-container");
  await expect(page.locator("[data-map-center]")).toHaveAttribute("data-map-center", "53,-1.5");
  const standardMarker = page.locator(".retailer-marker-11");
  const otherStandardMarker = page.locator(".retailer-marker-33");
  const featuredMarker = page.locator(".retailer-marker-22");

  await standardMarker.dispatchEvent("click");
  await expect(page.getByTestId("selected-retailer-panel")).toContainText("Northern Saw Supplies");
  await expect(standardMarker).toHaveAttribute("fill", "#b54f13");

  await otherStandardMarker.dispatchEvent("click");
  await expect(page.getByTestId("selected-retailer-panel")).toContainText("Alpha Arborist Supplies");
  await expect(otherStandardMarker).toHaveAttribute("fill", "#b54f13");
  await expect(standardMarker).toHaveAttribute("fill", "#e27226");

  await featuredMarker.dispatchEvent("click");
  await expect(page.getByTestId("selected-retailer-panel")).toContainText("Southern Forestry Tools");
  await expect(featuredMarker).toHaveAttribute("fill", "#ffffff");

  await page.getByRole("button", { name: /Alpha Arborist Supplies/ }).click();
  await expect(map).toHaveAttribute("data-retailer-focus-zoom", "11");

  await page.getByRole("button", { name: /View featured retailer Southern Forestry Tools/ }).click();
  await expect(map).toHaveAttribute("data-retailer-focus-zoom", "11");
});

test("featured retailers appear before the map and mobile map gestures preserve page scrolling", async ({ page }) => {
  await mockAuthenticatedApp(page);
  await page.goto("/retailers");
  await expectViewportUsable(page);

  const disclaimer = page.locator("details").filter({ has: page.getByText("Disclaimer", { exact: true }) });
  const disclaimerText = disclaimer.getByText(/The retailers listed below are independent businesses/);
  await expect(disclaimer).not.toHaveAttribute("open", "");
  await expect(disclaimerText).not.toBeVisible();
  await disclaimer.getByText("Disclaimer", { exact: true }).click();
  await expect(disclaimer).toHaveAttribute("open", "");
  await expect(disclaimerText).toBeVisible();

  const featured = page.getByRole("region", { name: "Featured Retailers" });
  const map = page.locator(".leaflet-container");
  await expect(featured).toBeVisible();
  await expect(featured.getByTestId("featured-retailers-heading-dot")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  const featuredButton = featured.getByRole("button", { name: /Southern Forestry Tools/ });
  await expect(featuredButton).toBeVisible();
  await expect(featuredButton.locator(".featured-retailer-name")).toHaveCSS("color", "rgb(226, 114, 38)");
  await expect(featuredButton.locator(".featured-retailer-dot")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await featuredButton.click();
  await expect(featuredButton).toHaveAttribute("aria-expanded", "true");
  const featuredDetails = featured.getByTestId("featured-retailer-details-22");
  await expect(featuredDetails).toContainText("22 Timber Lane");
  await expect(featuredDetails).not.toContainText("SO14 1AA");
  await expect(featuredDetails).toContainText("023 8000 0022");
  await expect(featuredDetails.getByRole("link", { name: "south.example.test" })).toBeVisible();
  await expect(page.getByTestId("selected-retailer-panel")).toHaveCount(0);
  expect(
    await featured.evaluate((section, mapElement) =>
      Boolean(section.compareDocumentPosition(mapElement as Node) & Node.DOCUMENT_POSITION_FOLLOWING),
    await map.elementHandle()),
  ).toBe(true);

  if (await page.evaluate(() => window.matchMedia("(pointer: coarse)").matches)) {
    await expect(page.getByText("Use two fingers to move the map")).toBeVisible();
    await expect.poll(() => map.evaluate((element) => !element.classList.contains("leaflet-grab"))).toBe(true);
  }
});

test("retailer logos render in cards and details, while failed logos stay hidden", async ({ page }) => {
  await mockAuthenticatedApp(page);
  await page.goto("/retailers");
  await expectViewportUsable(page);

  const featuredButton = page.getByRole("button", { name: /View featured retailer Southern Forestry Tools/ });
  const featuredLogo = featuredButton.getByTestId("img-retailer-logo-22");
  await expect(featuredLogo).toBeVisible();
  await expect(featuredLogo).toHaveAttribute("alt", "");
  await expect.poll(() => featuredLogo.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);

  const standardLogo = page.getByTestId("img-retailer-logo-11").first();
  await expect(standardLogo).toBeVisible();
  await expect.poll(() => standardLogo.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);

  await expect(page.getByTestId("img-retailer-logo-33")).toHaveCount(0);

  await page.getByRole("button", { name: /Northern Saw Supplies/ }).click();
  const selectedLogo = page.getByTestId("selected-retailer-panel").getByTestId("img-retailer-logo-11");
  await expect(selectedLogo).toBeVisible();
  await expect.poll(() => selectedLogo.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("a delayed older postcode response cannot replace the latest search state", async ({ page }) => {
  await mockAuthenticatedApp(page);
  let releaseOlderSearch: (() => void) | undefined;
  const olderSearchCanFinish = new Promise<void>((resolve) => {
    releaseOlderSearch = resolve;
  });

  await page.route("**/api/retailers/postcode", async (route) => {
    const { postcode } = route.request().postDataJSON() as { postcode: string };
    if (postcode === "LS1 1AA") {
      await olderSearchCanFinish;
      await route.fulfill({
        status: 400,
        json: { error: "This stale error must not be shown." },
      });
      return;
    }
    await route.fulfill({ json: { lat: 50.91, lng: -1.404 } });
  });

  await page.goto("/retailers");
  await expectViewportUsable(page);

  const postcode = page.getByLabel("Postcode");
  const searchButton = page.getByRole("button", { name: "Search" });
  const cards = page.locator("button").filter({ has: page.locator("div.font-bold") });

  await postcode.fill("LS1 1AA");
  await searchButton.click();
  await expect(searchButton.locator(".chainsaw-loader-root")).toBeVisible();
  await expect(page.locator("p[role='status']")).toHaveText("Searching for retailers near LS1 1AA.");

  await postcode.fill("SO14 1AA");
  await searchButton.click();
  await expect(page.locator("p[role='status']")).toHaveText(
    "Postcode search complete for SO14 1AA. Retailers are sorted by distance.",
  );
  await expect(cards.first()).toContainText("Southern Forestry Tools");
  await expect(cards.first()).toContainText("0.0 miles");
  await expect(searchButton.locator(".chainsaw-loader-root")).toHaveCount(0);

  releaseOlderSearch?.();

  await expect(page.getByText("This stale error must not be shown.")).toHaveCount(0);
  await expect(page.locator("p[role='status']")).toHaveText(
    "Postcode search complete for SO14 1AA. Retailers are sorted by distance.",
  );
  await expect(cards.first()).toContainText("Southern Forestry Tools");
  await expect(cards.first()).toContainText("0.0 miles");
  await expect(page.locator(".retailer-search-location-marker")).toBeVisible();
  await expect(searchButton.locator(".chainsaw-loader-root")).toHaveCount(0);
});

test("tile outages leave retailer search, details and website links usable", async ({ page }) => {
  const pageErrors: Error[] = [];
  let blockedTileRequests = 0;
  page.on("pageerror", (error) => pageErrors.push(error));
  await page.route(/^https:\/\/[^/]*\.?tile\.openstreetmap\.org\/.*/, async (route) => {
    blockedTileRequests += 1;
    await route.abort("failed");
  });
  await mockAuthenticatedApp(page);
  await page.goto("/retailers");
  await expectViewportUsable(page);

  await expect.poll(() => blockedTileRequests).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: /Northern Saw Supplies/i })).toBeVisible();

  await page.getByLabel("Postcode").fill("so14 1aa");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByText("Nearest Retailers")).toBeVisible();

  const southernRetailer = page.getByRole("button", { name: /^Southern Forestry Tools Southampton 0\.0 miles$/i });
  await expect(southernRetailer).toContainText("0.0 miles");
  await southernRetailer.click();

  await expect(page.getByRole("heading", { name: "Southern Forestry Tools" })).toBeVisible();
  const selectedPanel = page.getByTestId("selected-retailer-panel");
  await expect(selectedPanel.getByText("22 Timber Lane")).toBeVisible();
  await expect(selectedPanel.getByText("SO14 1AA", { exact: true })).toHaveCount(0);
  await expect(selectedPanel).not.toContainText("SO14 1AA");
  await expect(page.getByText("023 8000 0022")).toBeVisible();
  await expect(page.getByText("south@example.test")).toBeVisible();
  await expect(selectedPanel.getByRole("link", { name: "south.example.test" })).toHaveAttribute(
    "href",
    "https://south.example.test",
  );
  await expect(page.locator("body")).not.toBeEmpty();
  expect(pageErrors).toEqual([]);
});

test("keyboard users can open details and reach the external website", async ({ page }) => {
  await mockAuthenticatedApp(page);
  await page.goto("/retailers");
  await expectViewportUsable(page);

  const retailerButton = page.getByRole("button", { name: /Northern Saw Supplies/i });
  await retailerButton.focus();
  await expect(retailerButton).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: "Northern Saw Supplies" })).toBeVisible();
  const website = page.getByTestId("selected-retailer-panel").getByRole("link", { name: "north.example.test" });
  await website.focus();
  await expect(website).toBeFocused();
  await expect(website).toHaveAttribute("href", "https://north.example.test");
  await expect(website).toHaveAttribute("target", "_blank");

  await page.locator(".retailer-marker-11").dispatchEvent("click");
  const mapPopup = page.locator(".leaflet-popup");
  await expect(mapPopup).not.toContainText("LS1 1AA");
  await expect(mapPopup.getByRole("link", { name: "north.example.test" })).toHaveAttribute(
    "href",
    "https://north.example.test",
  );
});

test("invalid postcode leaves the directory usable", async ({ page }) => {
  await mockAuthenticatedApp(page);
  await page.route("**/api/retailers/postcode", (route) => route.fulfill({
    status: 400,
    json: { error: "Enter a valid UK postcode." },
  }));
  await page.goto("/retailers");
  await page.getByLabel("Postcode").fill("NOT A POSTCODE");
  await page.getByRole("button", { name: "Search" }).click();

  await expect(page.getByText("Enter a valid UK postcode.", { exact: true })).toBeVisible();
  await expect(page.locator("p[role='status']")).toHaveText(
    "Postcode search failed. Enter a valid UK postcode.",
  );
  await expect(page.getByRole("button", { name: /Northern Saw Supplies/i })).toBeVisible();
  await expect(page.locator(".leaflet-container")).toBeVisible();
});

test("empty directory keeps search, map and recovery navigation available", async ({ page }) => {
  await mockAuthenticatedApp(page, []);
  await page.goto("/retailers");

  await expectViewportUsable(page);
  await expect(page.getByText("No verified retailers are currently available.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/training");
  await expect(page.getByLabel("Postcode")).toBeEditable();
});
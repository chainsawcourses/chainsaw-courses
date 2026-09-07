import { expect, test } from "@playwright/test";

test("an admin-saved venue appears as a marker on the public gateway map", async ({ page, request }) => {
  const venueName = `Gateway browser test ${Date.now()}`;
  let venueId: number | undefined;
  let adminToken: string | undefined;

  try {
    await page.goto("/admin");
    await page.getByPlaceholder("PASSWORD").fill("gateway-browser-test-password");

    const loginResponsePromise = page.waitForResponse(
      response => response.url().includes("/api/admin/login") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "ENTER" }).click();
    const loginResponse = await loginResponsePromise;
    expect(loginResponse.ok()).toBe(true);
    adminToken = (await loginResponse.json() as { token: string }).token;

    await page.goto("/admin/gateway");
    await page.getByRole("button", { name: "Add Venue" }).click();
    await page.getByLabel("Venue Name *").fill(venueName);
    await page.getByLabel("Town").fill("Greenwich");
    await page.getByLabel("County").fill("London");
    await page.getByLabel("Latitude (optional — found from postcode)").fill("51.48");
    await page.getByLabel("Longitude (optional — found from postcode)").fill("-0.001");

    const createResponsePromise = page.waitForResponse(
      response => response.url().includes("/api/admin/gateway/venues") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Save Venue" }).click();
    const createResponse = await createResponsePromise;
    expect(createResponse.ok()).toBe(true);
    await expect(page.getByText(venueName)).toBeVisible();

    const venuesResponse = await request.get("/api/admin/gateway/venues", {
      headers: { admintoken: adminToken },
    });
    expect(venuesResponse.ok()).toBe(true);
    const venues = await venuesResponse.json() as Array<{
      id: number;
      name: string;
      active: boolean;
      lat: number;
      lng: number;
    }>;
    const created = venues.find(venue => venue.name === venueName);
    expect(created).toBeDefined();
    if (!created) throw new Error(`Saved venue "${venueName}" was not returned by the admin venue list`);
    venueId = created.id;
    expect(created.active).toBe(true);
    expect(created.lat).not.toBe(0);
    expect(created.lng).not.toBe(0);

    await page.goto("/gateway");
    const marker = page.locator(`.gateway-venue-marker-${venueId}`);
    await expect(marker).toBeVisible();
    await marker.click();
    await expect(page.locator(".leaflet-popup").getByText(venueName)).toBeVisible();
  } finally {
    if (adminToken) {
      if (venueId === undefined) {
        const venuesResponse = await request.get("/api/admin/gateway/venues", {
          headers: { admintoken: adminToken },
        });
        if (venuesResponse.ok()) {
          const venues = await venuesResponse.json() as Array<{ id: number; name: string }>;
          venueId = venues.find(venue => venue.name === venueName)?.id;
        }
      }
      if (venueId !== undefined) {
        const cleanupResponse = await request.delete(`/api/admin/gateway/venues/${venueId}`, {
          headers: { admintoken: adminToken },
        });
        expect(cleanupResponse.ok()).toBe(true);
      }
    }
  }
});
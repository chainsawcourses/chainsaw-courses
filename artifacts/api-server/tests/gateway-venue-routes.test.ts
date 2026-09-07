import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import test from "node:test";

test("a saved venue is active and returned by the public gateway route", async () => {
  const port = 21000 + (process.pid % 1000);
  const postcodePort = 22000 + (process.pid % 1000);
  const postcodeServer = createServer((req, res) => {
    if (req.url?.endsWith("/OUTAGE")) {
      res.writeHead(503, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Service unavailable" }));
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "no_match" }));
  });
  await new Promise<void>((resolve) => postcodeServer.listen(postcodePort, "127.0.0.1", resolve));

  const server = spawn(process.execPath, ["dist/index.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      ADMIN_PASSWORD: "gateway-route-test-password",
      DEMO_MODE: "true",
      NODE_ENV: "test",
      PORT: String(port),
      POSTCODE_PRIMARY_API_URL: `http://127.0.0.1:${postcodePort}/primary`,
      POSTCODE_SECONDARY_API_URL: `http://127.0.0.1:${postcodePort}/secondary`,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("API test server did not start")), 15_000);
    const onData = (chunk: Buffer) => {
      if (chunk.toString().includes("Server listening")) {
        clearTimeout(timeout);
        resolve();
      }
    };
    server.stdout.on("data", onData);
    server.stderr.on("data", onData);
    server.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`API test server exited with code ${code}`));
    });
  });
  const baseUrl = `http://127.0.0.1:${port}/api`;

  let venueId: number | undefined;
  try {
    const loginResponse = await fetch(`${baseUrl}/admin/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "gateway-route-test-password" }),
    });
    assert.equal(loginResponse.status, 200);
    const { token } = await loginResponse.json() as { token: string };

    const createResponse = await fetch(`${baseUrl}/admin/gateway/venues`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        admintoken: token,
      },
      body: JSON.stringify({
        name: `Gateway route test ${Date.now()}`,
        address: "",
        town: "Greenwich",
        county: "London",
        postcode: "",
        lat: 51.48,
        lng: 0,
        email: "",
        phone: "",
        tier: "silver",
        active: false,
      }),
    });
    assert.equal(createResponse.status, 200);
    const created = await createResponse.json() as {
      id: number;
      active: boolean;
      lat: number;
      lng: number;
    };
    venueId = created.id;
    assert.equal(created.active, true);
    assert.equal(created.lat, 51.48);
    assert.equal(created.lng, 0);

    const publicResponse = await fetch(`${baseUrl}/gateway/venues`, {
      headers: {
        activationcode: "DEMO-PREVIEW",
        deviceid: "gateway-route-test-device",
      },
    });
    assert.equal(publicResponse.status, 200);
    const publicVenues = await publicResponse.json() as Array<{ id: number; active: boolean }>;
    assert.ok(publicVenues.some((venue) => venue.id === venueId && venue.active));

    const adminHeaders = {
      "content-type": "application/json",
      admintoken: token,
    };
    const venueInput = {
      name: "Gateway route failure test",
      address: "",
      town: "Greenwich",
      county: "London",
      postcode: "INVALID",
      lat: 0,
      lng: 0,
      email: "",
      phone: "",
      tier: "silver",
      active: true,
    };
    const listVenues = async () => {
      const response = await fetch(`${baseUrl}/admin/gateway/venues`, {
        headers: { admintoken: token },
      });
      assert.equal(response.status, 200);
      return response.json() as Promise<Array<{
        id: number;
        name: string;
        postcode: string;
        lat: number;
        lng: number;
      }>>;
    };
    const assertVenueUnchanged = async (expected: Awaited<ReturnType<typeof listVenues>>[number]) => {
      const venues = await listVenues();
      assert.deepEqual(venues.find((venue) => venue.id === expected.id), expected);
    };
    const initialVenues = await listVenues();
    const savedVenue = initialVenues.find((venue) => venue.id === venueId);
    assert.ok(savedVenue);

    const invalidCreateResponse = await fetch(`${baseUrl}/admin/gateway/venues`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify(venueInput),
    });
    assert.equal(invalidCreateResponse.status, 422);
    assert.deepEqual(await invalidCreateResponse.json(), {
      error: "Enter a valid UK postcode or latitude and longitude so this venue can be added to the map.",
    });
    assert.deepEqual(await listVenues(), initialVenues);

    const outageCreateResponse = await fetch(`${baseUrl}/admin/gateway/venues`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ ...venueInput, name: "Outage create", postcode: "OUTAGE" }),
    });
    assert.equal(outageCreateResponse.status, 503);
    assert.deepEqual(await outageCreateResponse.json(), {
      error: "The postcode mapping service is temporarily unavailable. Please try again shortly or enter latitude and longitude.",
    });
    assert.deepEqual(await listVenues(), initialVenues);

    const invalidUpdateResponse = await fetch(`${baseUrl}/admin/gateway/venues/${venueId}`, {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({ ...venueInput, name: "Invalid update" }),
    });
    assert.equal(invalidUpdateResponse.status, 422);
    assert.deepEqual(await invalidUpdateResponse.json(), {
      error: "Enter a valid UK postcode or latitude and longitude so this venue can be shown on the map.",
    });
    await assertVenueUnchanged(savedVenue);

    const outageUpdateResponse = await fetch(`${baseUrl}/admin/gateway/venues/${venueId}`, {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({ ...venueInput, name: "Outage update", postcode: "OUTAGE" }),
    });
    assert.equal(outageUpdateResponse.status, 503);
    assert.deepEqual(await outageUpdateResponse.json(), {
      error: "The postcode mapping service is temporarily unavailable. Please try again shortly or enter latitude and longitude.",
    });
    await assertVenueUnchanged(savedVenue);
  } finally {
    if (venueId !== undefined) {
      const loginResponse = await fetch(`${baseUrl}/admin/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "gateway-route-test-password" }),
      });
      const { token } = await loginResponse.json() as { token: string };
      await fetch(`${baseUrl}/admin/gateway/venues/${venueId}`, {
        method: "DELETE",
        headers: { admintoken: token },
      });
    }
    server.kill("SIGTERM");
    await new Promise<void>((resolve) => server.once("exit", () => resolve()));
    await new Promise<void>((resolve, reject) => postcodeServer.close((error) => {
      if (error) reject(error);
      else resolve();
    }));
  }
});

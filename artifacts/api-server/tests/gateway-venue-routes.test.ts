import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";

test("a saved venue is active and returned by the public gateway route", async () => {
  const port = 21000 + (process.pid % 1000);
  const server = spawn(process.execPath, ["dist/index.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      ADMIN_PASSWORD: "gateway-route-test-password",
      DEMO_MODE: "true",
      NODE_ENV: "test",
      PORT: String(port),
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

    const invalidResponse = await fetch(`${baseUrl}/admin/gateway/venues`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        admintoken: token,
      },
      body: JSON.stringify({
        name: "Invalid coordinate route test",
        postcode: "",
        lat: 91,
        lng: 999,
      }),
    });
    assert.equal(invalidResponse.status, 422);
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
  }
});
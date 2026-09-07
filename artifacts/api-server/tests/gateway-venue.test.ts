import assert from "node:assert/strict";
import test from "node:test";
import {
  prepareNewGatewayVenue,
  resolveVenueCoordinates,
  VenueMappingServiceError,
} from "../src/lib/gatewayVenue.ts";

const mappedFetch = async () => new Response(JSON.stringify({
  result: { latitude: 51.501009, longitude: -0.141588 },
}), { status: 200 });

test("a valid UK postcode is converted to non-zero coordinates", async () => {
  const coordinates = await resolveVenueCoordinates(
    { postcode: "SW1A 1AA", lat: 0, lng: 0 },
    mappedFetch,
  );

  assert.deepEqual(coordinates, { lat: 51.501009, lng: -0.141588 });
});

test("a newly prepared venue is active immediately", async () => {
  const venue = await prepareNewGatewayVenue(
    { name: "Mapped venue", postcode: "SW1A 1AA", lat: 0, lng: 0, active: false },
    mappedFetch,
  );

  assert.ok(venue);
  assert.equal(venue.active, true);
  assert.notEqual(venue.lat, 0);
  assert.notEqual(venue.lng, 0);
});

test("a valid zero-longitude coordinate can be mapped", async () => {
  const coordinates = await resolveVenueCoordinates({
    postcode: "",
    lat: 51.48,
    lng: 0,
  });

  assert.deepEqual(coordinates, { lat: 51.48, lng: 0 });
});

test("out-of-range manual coordinates are rejected", async () => {
  const unmappedFetch = async () => new Response(null, { status: 404 });

  assert.equal(
    await resolveVenueCoordinates(
      { postcode: "", lat: 91, lng: 999 },
      unmappedFetch,
    ),
    null,
  );
});

test("an unmappable venue is rejected before it can be inserted", async () => {
  const insertions: unknown[] = [];
  const unmappedFetch = async () => new Response(
    JSON.stringify({ status: 404, error: "Postcode not found" }),
    { status: 404 },
  );

  const venue = await prepareNewGatewayVenue(
    { name: "Unmapped venue", postcode: "NOT A POSTCODE", lat: 0, lng: 0 },
    unmappedFetch,
  );
  if (venue) insertions.push(venue);

  assert.equal(venue, null);
  assert.equal(insertions.length, 0);
});

test("a temporary postcode service failure is retried", async () => {
  let attempts = 0;
  const recoveringFetch = async () => {
    attempts += 1;
    if (attempts === 1) {
      return new Response(JSON.stringify({ error: "Service unavailable" }), { status: 503 });
    }
    return mappedFetch();
  };

  const coordinates = await resolveVenueCoordinates(
    { postcode: "SW1A 1AA", lat: 0, lng: 0 },
    recoveringFetch,
  );

  assert.equal(attempts, 2);
  assert.deepEqual(coordinates, { lat: 51.501009, lng: -0.141588 });
});

test("the secondary provider is used only after primary retries are exhausted", async () => {
  const urls: string[] = [];
  const fallbackFetch: typeof fetch = async (input) => {
    const url = String(input);
    urls.push(url);
    if (url.includes("postcodes.io")) {
      return new Response(JSON.stringify({ error: "Service unavailable" }), { status: 503 });
    }
    return new Response(JSON.stringify({
      status: "match",
      data: { latitude: "51.501009", longitude: "-0.141588" },
    }), { status: 200 });
  };

  const coordinates = await resolveVenueCoordinates(
    { postcode: "SW1A 1AA", lat: 0, lng: 0 },
    fallbackFetch,
  );

  assert.deepEqual(coordinates, { lat: 51.501009, lng: -0.141588 });
  assert.equal(urls.length, 3);
  assert.ok(urls[0].includes("postcodes.io"));
  assert.ok(urls[1].includes("postcodes.io"));
  assert.ok(urls[2].includes("getthedata.com"));
});

test("an invalid postcode from the secondary provider remains an input error", async () => {
  let attempts = 0;
  const invalidFallbackFetch: typeof fetch = async (input) => {
    attempts += 1;
    if (String(input).includes("postcodes.io")) {
      return new Response(null, { status: 503 });
    }
    return new Response(JSON.stringify({ status: "no_match", data: {} }), { status: 200 });
  };

  assert.equal(
    await resolveVenueCoordinates(
      { postcode: "NOT A POSTCODE", lat: 0, lng: 0 },
      invalidFallbackFetch,
    ),
    null,
  );
  assert.equal(attempts, 3);
});

test("failures from both postcode providers are reported as a service error", async () => {
  let attempts = 0;
  const unavailableFetch = async () => {
    attempts += 1;
    return new Response(JSON.stringify({ error: "Service unavailable" }), { status: 503 });
  };

  await assert.rejects(
    resolveVenueCoordinates(
      { postcode: "SW1A 1AA", lat: 0, lng: 0 },
      unavailableFetch,
    ),
    VenueMappingServiceError,
  );
  assert.equal(attempts, 3);
});

test("zero coordinates returned by the postcode service are rejected", async () => {
  const zeroFetch = async () => new Response(JSON.stringify({
    result: { latitude: 0, longitude: 0 },
  }), { status: 200 });

  assert.equal(
    await resolveVenueCoordinates(
      { postcode: "SW1A 1AA", lat: 0, lng: 0 },
      zeroFetch,
    ),
    null,
  );
});

test("invalid coordinates returned by the secondary provider are rejected", async () => {
  const fallbackFetch: typeof fetch = async (input) => {
    if (String(input).includes("postcodes.io")) {
      return new Response(null, { status: 503 });
    }
    return new Response(JSON.stringify({
      status: "match",
      data: { latitude: "0", longitude: "0" },
    }), { status: 200 });
  };

  assert.equal(
    await resolveVenueCoordinates(
      { postcode: "SW1A 1AA", lat: 0, lng: 0 },
      fallbackFetch,
    ),
    null,
  );
});
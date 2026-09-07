import assert from "node:assert/strict";
import test from "node:test";
import { getAdminApiError } from "../src/lib/adminApiError.ts";

test("the admin form can display a mapping error returned by the API", async () => {
  const message = "Enter a valid UK postcode so this venue can be added to the map.";
  const response = new Response(JSON.stringify({ error: message }), {
    status: 422,
    headers: { "content-type": "application/json" },
  });

  assert.equal(await getAdminApiError(response), message);
});
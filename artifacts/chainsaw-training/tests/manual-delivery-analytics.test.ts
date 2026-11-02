import assert from "node:assert/strict";
import test from "node:test";

import { trackManualDeliveryEvent } from "../src/lib/analytics.ts";

test("manual delivery analytics only forwards privacy-safe properties", () => {
  const calls: Array<{ name: string; data?: Record<string, unknown> }> = [];
  Object.assign(globalThis, {
    window: {
      umami: {
        track(name: string, data?: Record<string, unknown>) {
          calls.push({ name, data });
        },
      },
    },
  });

  trackManualDeliveryEvent("manual_page_load_failed", {
    surface: "reader",
    layout: "single_page",
    attempt: "initial",
    failure_type: "request",
    userId: 701,
    email: "reader@example.test",
    activationCode: "PRIVATE-CODE",
    deviceId: "private-device",
    page: 12,
    pageNumber: 12,
    searchText: "chain brake",
    manualContent: "private manual passage",
  } as never);

  assert.deepEqual(calls, [{
    name: "manual_page_load_failed",
    data: {
      surface: "reader",
      layout: "single_page",
      attempt: "initial",
      failure_type: "request",
    },
  }]);
});

test("analytics exceptions never escape manual delivery tracking", () => {
  Object.assign(globalThis, {
    window: {
      umami: {
        track() {
          throw new Error("analytics unavailable");
        },
      },
    },
  });

  assert.doesNotThrow(() => {
    trackManualDeliveryEvent("manual_page_retry_attempted", {
      surface: "zoom",
      layout: "spread",
    });
  });
});
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  APPROVED_POSTAL_ADDRESS,
  PLACEHOLDER_PHRASES,
  validatePrivacyPolicySources,
} from "../scripts/check-privacy-policy-consistency.mjs";

const validSources = {
  web: [
    APPROVED_POSTAL_ADDRESS,
    "Last updated: 15 September 2026",
    "Version 1.2",
    "Learner identity, manual page numbers, search text and manual content are not sent to analytics.",
    "Analytics is not used for advertising or cross-site profiling.",
    "essential <strong>cookies</strong>",
    "We do not use advertising cookies.",
    "Replit retains analytics with the published project&rsquo;s history",
    "reporting periods of up to 30 days",
  ].join("\n"),
  pdf: [
    APPROVED_POSTAL_ADDRESS,
    "Last updated: 15 September 2026",
    "Version 1.2",
    "Learner identity, manual page numbers, search text and manual content are not sent to analytics.",
    "Analytics is not used for advertising or cross-site profiling.",
    "essential cookies",
    "We do not use advertising cookies.",
    "Replit retains analytics with the published project's history",
    "reporting periods of up to 30 days",
  ].join("\n"),
  staticHtml: APPROVED_POSTAL_ADDRESS,
};

describe("privacy policy consistency validation", () => {
  it("accepts the approved postal address across all three public surfaces", () => {
    assert.deepEqual(validatePrivacyPolicySources(validSources), []);
  });

  it("fails when one public surface has a different address", () => {
    const failures = validatePrivacyPolicySources({
      ...validSources,
      staticHtml: "Different address",
    });

    assert.ok(
      failures.some(
        (failure) =>
          failure.format === "staticHtml" &&
          failure.requirement === "approved postal address",
      ),
    );
  });

  for (const placeholder of PLACEHOLDER_PHRASES) {
    it(`fails on the known placeholder phrase: ${placeholder}`, () => {
      const failures = validatePrivacyPolicySources({
        ...validSources,
        web: `${validSources.web}\n${placeholder.toUpperCase()}`,
      });

      assert.ok(
        failures.some(
          (failure) =>
            failure.format === "web" &&
            failure.requirement ===
              "absence of placeholder postal-address wording",
        ),
      );
    });
  }
});
import assert from "node:assert/strict";
import test from "node:test";
import {
  findManualPageBudgetViolations,
  formatViolation,
  MAX_MANUAL_PAGE_BYTES,
  MAX_MANUAL_PAGE_HEIGHT,
  MAX_MANUAL_PAGE_WIDTH,
  readJpegDimensions,
} from "../scripts/check-manual-page-budget.mjs";

function jpegWithDimensions(width: number, height: number) {
  return Buffer.from([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x02,
    0xff, 0xc0, 0x00, 0x07, 0x08,
    height >> 8, height & 0xff,
    width >> 8, width & 0xff,
    0xff, 0xd9,
  ]);
}

test("reads dimensions directly from a manual JPEG", () => {
  assert.deepEqual(readJpegDimensions(jpegWithDimensions(875, 1241)), {
    width: 875,
    height: 1241,
  });
});

test("reports every offending page with its exact measured values", () => {
  const pages = [
    { name: "page-001.jpg", width: 875, height: 1241, bytes: 200_000 },
    {
      name: "page-002.jpg",
      width: MAX_MANUAL_PAGE_WIDTH + 1,
      height: MAX_MANUAL_PAGE_HEIGHT + 2,
      bytes: MAX_MANUAL_PAGE_BYTES + 3,
    },
    { name: "page-003.jpg", width: 875, height: 1241, bytes: MAX_MANUAL_PAGE_BYTES + 9 },
  ];

  const violations = findManualPageBudgetViolations(pages);
  assert.deepEqual(violations.map((page) => page.name), ["page-002.jpg", "page-003.jpg"]);
  assert.equal(
    formatViolation(violations[0]),
    `page-002.jpg: ${MAX_MANUAL_PAGE_WIDTH + 1}x${MAX_MANUAL_PAGE_HEIGHT + 2}, `
      + `${MAX_MANUAL_PAGE_BYTES + 3} bytes`,
  );
  assert.equal(
    formatViolation(violations[1]),
    `page-003.jpg: 875x1241, ${MAX_MANUAL_PAGE_BYTES + 9} bytes`,
  );
});
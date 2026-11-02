import assert from "node:assert/strict";
import test from "node:test";
import { formatCourseAccessStatus } from "../src/lib/accessStatus.ts";

test("formats active and ended access as factual full en-GB dates", () => {
  assert.deepEqual(formatCourseAccessStatus("2025-08-14T12:00:00.000Z", "active"), {
    label: "Course access expires",
    date: "14 August 2025",
  });
  assert.deepEqual(formatCourseAccessStatus("2025-08-14T12:00:00.000Z", "expired"), {
    label: "Course access ended",
    date: "14 August 2025",
  });
});

test("omits a menu access block when its status or expiry is unavailable", () => {
  assert.equal(formatCourseAccessStatus(null, "active"), null);
  assert.equal(formatCourseAccessStatus("2025-08-14T12:00:00.000Z", "unknown"), null);
});

test("menu status copy is factual and contains no promotional language", () => {
  const copy = [
    formatCourseAccessStatus("2025-08-14T12:00:00.000Z", "active"),
    formatCourseAccessStatus("2025-08-14T12:00:00.000Z", "expired"),
  ].map((status) => status ? `${status.label} ${status.date}` : "").join(" ").toLowerCase();
  for (const forbidden of ["subscribe", "subscription", "trial", "countdown", "remaining"]) {
    assert.equal(copy.includes(forbidden), false);
  }
});
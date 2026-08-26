import assert from "node:assert/strict";
import test from "node:test";
import { CERTIFICATE_LAYOUT } from "../src/lib/certificateLayout.ts";

const top = (region: { bottom: number; height: number }) => region.bottom + region.height;

test("Chainsaw Courses logo does not overlap adjacent certificate text", () => {
  const { chainsawLogo, completionSentence, courseTitle, minimumVerticalGap } = CERTIFICATE_LAYOUT;

  assert.ok(
    top(chainsawLogo) + minimumVerticalGap <= completionSentence.bottom,
    "logo must remain below the completion sentence",
  );
  assert.ok(
    top(courseTitle) + minimumVerticalGap <= chainsawLogo.bottom,
    "logo must remain above the course title",
  );
});
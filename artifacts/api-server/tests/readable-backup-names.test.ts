import { test } from "node:test";
import assert from "node:assert/strict";
import { learnerBackupName, progressCsv } from "../src/lib/readableBackupNames.ts";

test("filenames lead with the full learner name and distinguish namesakes", () => {
  assert.equal(learnerBackupName("Example Learner", 12), "Example Learner - User 12");
  assert.notEqual(learnerBackupName("Example Learner", 12), learnerBackupName("Example Learner", 13));
  assert.equal(learnerBackupName(" A/B: C ", 1), "A B C - User 1");
  assert.equal(learnerBackupName(null, 2), "Unnamed learner - User 2");
});
test("progress CSV includes all selected learner records without another learner's records", () => {
  const output = progressCsv("Example Learner", [{ name: "user_progress", rows: [
    { id: 1, user_id: 12, module_id: 2, completed: true },
    { id: 2, user_id: 13, module_id: 3, completed: false },
  ] }], 12).toString();
  assert.match(output, /Example Learner/);
  assert.match(output, /"completed","true"/);
  assert.doesNotMatch(output, /"completed","false"/);
});
test("CSV escapes quotes, protects formulas, and handles users without progress", () => {
  assert.match(progressCsv("Learner", [], 1).toString(), /No progress recorded/);
  const output = progressCsv("=formula", [{ name: "exam_attempts", rows: [{ id: 1, user_id: 1, answer: 'A,"B"' }] }], 1).toString();
  assert.match(output, /'=formula/);
  assert.match(output, /A,""B""/);
});

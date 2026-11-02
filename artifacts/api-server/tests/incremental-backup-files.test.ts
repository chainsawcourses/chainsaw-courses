import { test } from "node:test";
import assert from "node:assert/strict";
import { backupFileIdentity, findIncrementalFile } from "../src/lib/incrementalBackupFiles.ts";

test("adopts timestamped historical files using stable record identity, not display names", () => {
  const pairs = [
    ["Example - Certificate User 12 Enrolment 3 2026-10-26T21-33-28-123Z.pdf", "Example - User 12 - Certificate - Enrolment 3.pdf"],
    ["Signed_Waiver_User_12_Enrolment_3_2026-10-26T21-33-28-123Z.pdf", "Example - User 12 - Signed Waiver - Enrolment 3.pdf"],
    ["Inspection_42_2026-10-26T21-33-28-123Z.pdf", "Example - User 12 - Inspection 42.pdf"],
    ["Risk_Assessment_42_2026-10-26T21-33-28-123Z.pdf", "Example - User 12 - Risk Assessment 42.pdf"],
    ["Chainsaw Courses Full Data — 2026-10-26T21-33-28-123Z", "Chainsaw Courses Full Data"],
    ["image-uuid-2026-10-26T21-33-28-123Z.png", "image-uuid.png"],
    ["Retailer_65_Logo_2026-10-26T21-33-28-123Z.png", "Retailer_65_Logo.png"],
  ];
  for (const [oldName, newName] of pairs) assert.equal(backupFileIdentity(oldName), backupFileIdentity(newName), oldName);
  assert.notEqual(backupFileIdentity("User 12 - Progress.csv"), backupFileIdentity("User 13 - Progress.csv"));
});

test("paginates once per folder and selects newest historical match without deleting anything", async () => {
  const owner = {};
  let calls = 0;
  const request = async <T>(_url: string): Promise<T> => {
    calls++;
    return (calls === 1 ? { files: [{ id: "unrelated", name: "Other.pdf" }], nextPageToken: "next" }
      : { files: [{ id: "newest", name: "Inspection_42_2026-10-26T21-33-28-123Z.pdf" }, { id: "old", name: "Inspection_42_2026-10-25T21-33-28-123Z.pdf" }] }) as T;
  };
  assert.equal((await findIncrementalFile(owner, "folder", "User 12 - Inspection 42.pdf", request))?.id, "newest");
  assert.equal((await findIncrementalFile(owner, "folder", "User 12 - Inspection 42.pdf", request))?.id, "newest");
  assert.equal(calls, 2);
});

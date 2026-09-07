import assert from "node:assert/strict";
import test from "node:test";
import { isTrustedPdfHost, normalizePublicPdfUrl } from "../src/lib/remotePdf.ts";

test("accepts only configured PDF providers", () => {
  assert.equal(isTrustedPdfHost("drive.google.com"), true);
  assert.equal(isTrustedPdfHost("firebasestorage.googleapis.com"), true);
  assert.equal(isTrustedPdfHost("content.dropboxusercontent.com"), true);
  assert.equal(isTrustedPdfHost("dropbox.com"), true);
  assert.equal(isTrustedPdfHost("chainsawcourses.com"), true);
  assert.equal(isTrustedPdfHost("attacker.example"), false);
  assert.equal(isTrustedPdfHost("dropbox.com.attacker.example"), false);
});

test("normalises supported Google Drive and Dropbox share links", () => {
  assert.equal(
    normalizePublicPdfUrl("https://drive.google.com/file/d/example-id/view?usp=sharing").hostname,
    "drive.usercontent.google.com",
  );
  assert.equal(
    normalizePublicPdfUrl("https://www.dropbox.com/s/example/file.pdf?dl=0").searchParams.get("dl"),
    "1",
  );
});

test("blocks private, untrusted, credentialed, and non-HTTPS destinations", () => {
  assert.throws(() => normalizePublicPdfUrl("http://127.0.0.1/private.pdf"), /not allowed|HTTPS/);
  assert.throws(() => normalizePublicPdfUrl("https://10.0.0.1/private.pdf"), /not allowed/);
  assert.throws(() => normalizePublicPdfUrl("https://attacker.example/file.pdf"), /not allowed/);
  assert.throws(() => normalizePublicPdfUrl("https://user:pass@storage.googleapis.com/file.pdf"), /not allowed/);
});

test("redirect validation cannot escape to private or attacker-controlled hosts", () => {
  const trustedBase = new URL("https://storage.googleapis.com/bucket/file.pdf");
  const privateRedirect = new URL("http://169.254.169.254/latest/meta-data", trustedBase);
  const untrustedRedirect = new URL("https://rebind.attacker.example/file.pdf", trustedBase);
  assert.throws(() => normalizePublicPdfUrl(privateRedirect.toString()));
  assert.throws(() => normalizePublicPdfUrl(untrustedRedirect.toString()));
});
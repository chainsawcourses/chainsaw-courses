import assert from "node:assert/strict";
import test from "node:test";
import {
  CERTIFICATE_TEST_CODE,
  CERTIFICATE_TEST_CODE_2,
  isCertificateTestCode,
} from "../src/lib/certificateTestAccess.ts";

test("certificate test access is available outside production for the exact code", () => {
  assert.equal(isCertificateTestCode(CERTIFICATE_TEST_CODE, "development"), true);
  assert.equal(isCertificateTestCode(CERTIFICATE_TEST_CODE_2, "development"), true);
  assert.equal(isCertificateTestCode(" certificate-test ", "test"), true);
  assert.equal(isCertificateTestCode("CERTIFICATE-TEST-WRONG", "development"), false);
});

test("certificate test access can never be enabled in production", () => {
  assert.equal(isCertificateTestCode(CERTIFICATE_TEST_CODE, "production"), false);
  assert.equal(isCertificateTestCode(CERTIFICATE_TEST_CODE_2, "production"), false);
});
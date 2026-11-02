export const CERTIFICATE_TEST_CODE = "CERTIFICATE-TEST";
export const CERTIFICATE_TEST_CODE_2 = "CERTIFICATE-TEST-2";

const CERTIFICATE_TEST_CODES = new Set([
  CERTIFICATE_TEST_CODE,
  CERTIFICATE_TEST_CODE_2,
]);

export function isCertificateTestCode(
  activationCode: string,
  nodeEnv = process.env.NODE_ENV,
): boolean {
  return nodeEnv !== "production"
    && CERTIFICATE_TEST_CODES.has(activationCode.trim().toUpperCase());
}
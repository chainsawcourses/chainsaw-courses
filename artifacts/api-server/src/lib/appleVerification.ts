import { AppStoreServerAPIClient, Environment, SignedDataVerifier, Type } from "@apple/app-store-server-library";
import type { JWSTransactionDecodedPayload } from "@apple/app-store-server-library";
import { addCalendarMonthsUtc } from "./courseAccess";
import { normaliseApplePrivateKey } from "./applePrivateKey";

// Public trust anchor downloaded from Apple's certificate authority, not from a
// client-supplied x5c chain. https://www.apple.com/certificateauthority/
const appleRootG3 = "MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwSQXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtfTjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySrMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gAMGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM6BgD56KyKA==";
export const APPLE_BUNDLE_ID = "com.overleafpublishers.chainsawcourses";
export const DEFAULT_APPLE_PRODUCT = "com.overleafpublishers.chainsawcourses.sixmonths";

export class AppleAccessError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export function appleConfig() {
  const environment = process.env.APPLE_IAP_ENVIRONMENT === "Production" ? Environment.PRODUCTION : Environment.SANDBOX;
  const productId = process.env.APPLE_IAP_PRODUCT_ID?.trim() || DEFAULT_APPLE_PRODUCT;
  const enabled = process.env.APPLE_IAP_ENABLED === "true"
    && !!process.env.APPLE_IAP_PRIVATE_KEY
    && !!process.env.APPLE_IAP_KEY_ID && !!process.env.APPLE_IAP_ISSUER_ID
    && (environment !== Environment.PRODUCTION || process.env.APPLE_IAP_PRODUCTION_APPROVED === "true");
  return { enabled, environment, productId };
}

function services(environment?: Environment) {
  const base = appleConfig();
  const config = { ...base, environment: environment ?? base.environment };
  if (!config.enabled) throw new AppleAccessError(503, "apple_unavailable", "Apple purchases are not available yet. Existing course access is unchanged.");
  const appId = Number(process.env.APPLE_IAP_APP_ID || "6802349883");
  const verifier = new SignedDataVerifier([Buffer.from(appleRootG3, "base64")], true, config.environment, APPLE_BUNDLE_ID, appId);
  const client = new AppStoreServerAPIClient(
    normaliseApplePrivateKey(process.env.APPLE_IAP_PRIVATE_KEY!),
    process.env.APPLE_IAP_KEY_ID!, process.env.APPLE_IAP_ISSUER_ID!, APPLE_BUNDLE_ID, config.environment,
  );
  return { verifier, client, config };
}

function verificationServices() {
  const primary = services();
  // App Review and TestFlight use genuine Apple-signed sandbox transactions,
  // even when the submitted binary loads the production-hosted website.
  // Sandbox grants are isolated into non-awarding reviewer learner accounts.
  return primary.config.environment === Environment.PRODUCTION
    && process.env.APPLE_IAP_ALLOW_SANDBOX_REVIEW === "true"
    ? [primary, services(Environment.SANDBOX)] : [primary];
}

export function validateAppleTransaction(payload: JWSTransactionDecodedPayload, productId: string, environment: string, now = Date.now()) {
  if (payload.bundleId !== APPLE_BUNDLE_ID || payload.productId !== productId || payload.environment !== environment
    || payload.type !== Type.NON_RENEWING_SUBSCRIPTION || !payload.transactionId || !/^\d{1,32}$/.test(payload.transactionId)
    || !payload.originalTransactionId || !payload.appAccountToken
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.appAccountToken)
    || typeof payload.purchaseDate !== "number" || payload.purchaseDate < 1 || payload.purchaseDate > now + 60_000
    || payload.inAppOwnershipType === "FAMILY_SHARED") {
    throw new AppleAccessError(400, "invalid_purchase", "The Apple purchase could not be verified for this course.");
  }
  const purchasedAt = new Date(payload.purchaseDate);
  return {
    transactionId: payload.transactionId,
    originalTransactionId: payload.originalTransactionId,
    productId,
    environment,
    appAccountToken: payload.appAccountToken.toLowerCase(),
    purchasedAt,
    expiresAt: addCalendarMonthsUtc(purchasedAt, 6),
    revokedAt: payload.revocationDate ? new Date(payload.revocationDate) : null,
  };
}
export type VerifiedApplePurchase = ReturnType<typeof validateAppleTransaction>;

export async function verifyApplePurchase(signedTransaction: string): Promise<VerifiedApplePurchase> {
  let selected: ReturnType<typeof services> | undefined;
  let clientTransaction: JWSTransactionDecodedPayload | undefined;
  for (const candidate of verificationServices()) {
    try {
      const decoded = await candidate.verifier.verifyAndDecodeTransaction(signedTransaction);
      validateAppleTransaction(decoded, candidate.config.productId, candidate.config.environment);
      selected = candidate; clientTransaction = decoded; break;
    } catch { /* Try only explicitly permitted, independently verified environments. */ }
  }
  if (!selected || !clientTransaction) throw new AppleAccessError(400, "invalid_purchase", "The Apple purchase signature or environment is invalid.");
  const { verifier, client, config } = selected;
  // Never grant from an old, valid pre-refund JWS alone. Ask Apple for the
  // current authoritative record on every claim/restore/reconciliation.
  let current;
  try { current = await client.getTransactionInfo(clientTransaction.transactionId!); }
  catch { throw new AppleAccessError(503, "apple_verification_unavailable", "Apple could not confirm this purchase. Nothing has been charged again; please retry."); }
  if (!current.signedTransactionInfo) throw new AppleAccessError(503, "apple_verification_unavailable", "Apple returned no purchase record.");
  const verified = validateAppleTransaction(
    await verifier.verifyAndDecodeTransaction(current.signedTransactionInfo),
    config.productId, config.environment,
  );
  if (verified.transactionId !== clientTransaction.transactionId) throw new AppleAccessError(400, "invalid_purchase", "Apple returned a different transaction.");
  return verified;
}

export async function verifyAppleNotification(signedPayload: string) {
  for (const { verifier } of verificationServices()) {
    try { return await verifier.verifyAndDecodeNotification(signedPayload); }
    catch { /* Sandbox fallback requires the explicit review setting. */ }
  }
  throw new AppleAccessError(400, "invalid_notification", "Invalid Apple notification.");
}

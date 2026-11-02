import { createHmac, timingSafeEqual } from "node:crypto";

type CertificateTokenPayload = {
  userId: number;
  enrollmentId: number;
  expiresAt: number;
};

function secret(): string | null {
  return process.env.SESSION_SECRET || null;
}

function encode(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function decode(value: string): string | null {
  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

export function issueCertificateToken(
  userId: number,
  enrollmentId: number,
  ttlSeconds = 600,
  now = Math.floor(Date.now() / 1000),
): string {
  const configuredSecret = secret();
  if (!configuredSecret) throw new Error("SESSION_SECRET is required for certificate links");
  const payload = encode(JSON.stringify({ userId, enrollmentId, expiresAt: now + ttlSeconds }));
  const signature = createHmac("sha256", configuredSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyCertificateToken(
  token: string,
  now = Math.floor(Date.now() / 1000),
): CertificateTokenPayload | null {
  const configuredSecret = secret();
  if (!configuredSecret) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const expected = createHmac("sha256", configuredSecret).update(parts[0]).digest("base64url");
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(parts[1]);
  if (expectedBytes.length !== suppliedBytes.length || !timingSafeEqual(expectedBytes, suppliedBytes)) return null;
  const decoded = decode(parts[0]);
  if (!decoded) return null;
  try {
    const payload = JSON.parse(decoded) as Partial<CertificateTokenPayload>;
    const userId = payload.userId;
    const enrollmentId = payload.enrollmentId;
    const expiresAt = payload.expiresAt;
    if (!Number.isInteger(userId) || !Number.isInteger(enrollmentId) ||
      !Number.isInteger(expiresAt) || (expiresAt as number) < now) return null;
    return {
      userId: userId as number,
      enrollmentId: enrollmentId as number,
      expiresAt: expiresAt as number,
    };
  } catch {
    return null;
  }
}
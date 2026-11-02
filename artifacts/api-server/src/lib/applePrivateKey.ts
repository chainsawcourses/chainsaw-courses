import { createPrivateKey } from "node:crypto";

/** Accept PEM copy/paste whitespace without exposing or changing the secret. */
export function normaliseApplePrivateKey(value: string): string {
  try {
    let pem = value.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").trim();
    if ((pem.startsWith('"') && pem.endsWith('"')) || (pem.startsWith("'") && pem.endsWith("'"))) {
      pem = pem.slice(1, -1).trim();
    }
    const match = /^-----BEGIN PRIVATE KEY-----([\s\S]+?)-----END PRIVATE KEY-----$/.exec(pem);
    if (!match) throw new Error();
    const body = match[1].replace(/\s/g, "");
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(body)) throw new Error();
    const der = Buffer.from(body, "base64");
    if (der.toString("base64") !== body) throw new Error();
    const key = createPrivateKey({ key: der, format: "der", type: "pkcs8" });
    if (key.asymmetricKeyType !== "ec" || key.asymmetricKeyDetails?.namedCurve !== "prime256v1") {
      throw new Error();
    }
    return key.export({ type: "pkcs8", format: "pem" }).toString();
  } catch {
    throw new Error("Apple signing key must contain a valid PKCS#8 P-256 private key.");
  }
}

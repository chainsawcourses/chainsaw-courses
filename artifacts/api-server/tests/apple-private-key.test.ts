import assert from "node:assert/strict";
import { generateKeyPairSync, createPrivateKey } from "node:crypto";
import { createRequire } from "node:module";
import test from "node:test";

const { build } = createRequire(import.meta.url)("esbuild");
const output = await build({
  entryPoints: [new URL("../src/lib/applePrivateKey.ts", import.meta.url).pathname],
  bundle: true, write: false, format: "esm", platform: "node",
});
const { normaliseApplePrivateKey } = await import(
  `data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString("base64")}`
);
const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const der = privateKey.export({ type: "pkcs8", format: "der" });
const matchesOriginal = (value: string) => {
  const result = createPrivateKey(normaliseApplePrivateKey(value));
  assert.deepEqual(result.export({ type: "pkcs8", format: "der" }), der);
};

test("Apple key accepts the original PEM without changing its identity", () => {
  matchesOriginal(pem);
});
test("Apple key accepts flattened or whitespace-wrapped PEM copied from an editor", () => {
  matchesOriginal(pem.replace(/\n/g, " "));
  matchesOriginal(`\uFEFF \r\n${pem.replace(/\n/g, "\r\n")}\t`);
  matchesOriginal(pem.replace(/\n/g, ""));
});
test("Apple key accepts literal newline escapes and matching outer quotation marks", () => {
  matchesOriginal(pem.replace(/\n/g, "\\n"));
  matchesOriginal(pem.replace(/\n/g, "\\r\\n"));
  matchesOriginal(`"${pem}"`);
  matchesOriginal(`'${pem}'`);
});
test("Apple key rejects missing, truncated or corrupted private-key data", () => {
  for (const value of ["", "SubscriptionKey.p8", pem.slice(0, -40), pem.replace(/[A-Za-z0-9+\/]{15}/, "!")]) {
    assert.throws(() => normaliseApplePrivateKey(value), /valid PKCS#8 P-256/);
  }
});
test("Apple key rejects unrelated surrounding text or markdown", () => {
  for (const value of [`Here is the key:\n${pem}`, `${pem}extra`, `\`\`\`\n${pem}\`\`\``]) {
    assert.throws(() => normaliseApplePrivateKey(value), /valid PKCS#8 P-256/);
  }
});
test("Apple key rejects RSA and other elliptic curves", () => {
  const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
  const otherCurve = generateKeyPairSync("ec", { namedCurve: "secp384r1" }).privateKey;
  for (const key of [rsa, otherCurve]) {
    assert.throws(() => normaliseApplePrivateKey(key.export({ type: "pkcs8", format: "pem" }).toString()), /valid PKCS#8 P-256/);
  }
});
test("Apple key failure messages do not contain supplied private material", () => {
  assert.throws(() => normaliseApplePrivateKey("private-material-not-to-log"), error => {
    assert.equal(error instanceof Error && error.message.includes("private-material"), false);
    return true;
  });
});

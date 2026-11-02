import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID, generateKeyPairSync } from "node:crypto";
import { createRequire } from "node:module";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { build } = require("esbuild");
const { Pool } = createRequire(new URL("../../../lib/db/package.json", import.meta.url))("pg");

test("StoreKit account, entitlement and API integration in an isolated schema", async t => {
  const schema = `apple_test_${process.pid}_${Date.now()}`;
  const admin = new Pool({ connectionString: process.env.DATABASE_URL });
  const temp = await mkdtemp(path.join(tmpdir(), "apple-tests-"));
  let module: any, server: any;
  const old = { schema: process.env.APPLE_TEST_SCHEMA, enabled: process.env.APPLE_IAP_ENABLED, smtp: process.env.SMTP_HOST };
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`);
    const tables = ["users", "activation_codes", "course_enrolments", "user_progress", "waivers", "quiz_attempts", "exam_attempts", "video_engagement", "module_feedback", "learner_subscriptions", "reasonable_adjustments", "chat_messages", "inspection_records", "risk_assessments", "subscription_billing_events", "subscription_delivery_attempts"];
    for (const table of tables) {
      await admin.query(`CREATE TABLE "${schema}"."${table}" (LIKE public."${table}" INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES)`);
      const { rows } = await admin.query("SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND column_default LIKE 'nextval%'", [schema, table]);
      for (const { column_name: column } of rows) {
        assert.match(column, /^[a-z_]+$/);
        const sequence = `${table}_${column}_test_seq`;
        await admin.query(`CREATE SEQUENCE "${schema}"."${sequence}"`);
        await admin.query(`ALTER TABLE "${schema}"."${table}" ALTER COLUMN "${column}" SET DEFAULT nextval('"${schema}"."${sequence}"')`);
      }
    }
    const client = await admin.connect();
    try {
      await client.query(`SET search_path TO "${schema}"`);
      await client.query(await readFile(new URL("../../../scripts/sql/apple-storekit-additive.sql", import.meta.url), "utf8"));
    } finally { client.release(); }
    process.env.APPLE_TEST_SCHEMA = schema;
    process.env.APPLE_IAP_ENABLED = "false";
    process.env.SMTP_HOST = "";
    const outfile = path.join(temp, "harness.mjs");
    await build({
      entryPoints: [new URL("./helpers/apple-harness.ts", import.meta.url).pathname],
      outfile, bundle: true, format: "esm", platform: "node",
      alias: { "@workspace/db": new URL("./helpers/apple-db.ts", import.meta.url).pathname },
      banner: { js: `import {createRequire} from 'node:module';const require=createRequire(${JSON.stringify(new URL("../package.json", import.meta.url).pathname)});` },
      nodePaths: [new URL("../node_modules", import.meta.url).pathname, new URL("../../../node_modules", import.meta.url).pathname],
      plugins: [{
        name: "isolated-package-resolution",
        setup(builder: any) {
          builder.onResolve({ filter: /^[^./]/ }, (args: any) => {
            if (args.path.startsWith("@workspace/")) return undefined;
            if (args.path.startsWith("node:")) return { path: args.path, external: true };
            return {
              path: args.path === "pg"
                ? createRequire(new URL("../../../lib/db/package.json", import.meta.url)).resolve("pg")
                : createRequire(path.join(args.resolveDir, "resolve.cjs")).resolve(args.path),
              external: true,
            };
          });
        },
      }],
    });
    // ESM external dependencies resolve next to the test bundle.
    const { symlink } = await import("node:fs/promises");
    await symlink(new URL("../node_modules", import.meta.url).pathname, path.join(temp, "node_modules"), "dir");
    module = await import(pathToFileURL(outfile).href);
    const pool = module.pool;
    const q = (sql: string, params: unknown[] = []) => pool.query(sql, params);
    const newChallenge = async (email: string, fullName = "Test Learner", deviceId = "test-device-one") => {
      const id = randomUUID();
      await q("INSERT INTO apple_identity_challenges(id,email,full_name,device_id,request_hash,code_hash,expires_at) VALUES($1,$2,$3,$4,'test',$5,now()+interval '10 minutes')",
        [id, email, fullName, deviceId, module.hashAppleSecret(`${id}:123456`)]);
      return module.checkAppleIdentity(id, "123456", deviceId);
    };
    const purchase = (token = randomUUID(), transactionId = String(Date.now())) => module.validateAppleTransaction({
      transactionId, originalTransactionId: transactionId, appAccountToken: token, productId: module.DEFAULT_APPLE_PRODUCT,
      bundleId: module.APPLE_BUNDLE_ID, type: "Non-Renewing Subscription", environment: "Sandbox",
      purchaseDate: Date.now() - 10000,
    }, module.DEFAULT_APPLE_PRODUCT, "Sandbox");
    const intent = async (p: any, deviceId = "test-device-one") => {
      const id = randomUUID(), secret = "test-claim-secret";
      await q("INSERT INTO apple_purchase_intents(id,secret_hash,app_account_token,device_id,expires_at) VALUES($1,$2,$3,$4,now()+interval '7 days')",
        [id, module.hashAppleSecret(secret), p.appAccountToken, deviceId]);
      return { id, secret };
    };
    let session: any, initialPurchase: any;
    await t.test("new paid learner uses opaque credentials and six months from purchase", async () => {
      const p = purchase();
      initialPurchase = p;
      const proof = await intent(p);
      session = await module.completeAppleAccount(await newChallenge("learner@example.test"), p, proof);
      assert.match(session.activationCode, /^APPLE-SANDBOX-[A-F0-9]{64}$/);
      const { rows: [enrolment] } = await q("SELECT * FROM course_enrolments WHERE id=$1", [session.enrollmentId]);
      assert.equal(enrolment.activated_at.getTime(), p.purchasedAt.getTime());
      assert.equal(enrolment.access_expires_at.getTime(), p.expiresAt.getTime());
      assert.equal(session.waiverRequired, true);
      assert.equal((await q("SELECT * FROM apple_purchase_intents")).rowCount, 0);
    });
    await t.test("restore links same learner, preserves expiry, transfers device, consumes OTP", async () => {
      await q("UPDATE course_enrolments SET course_completed_at='2026-01-02', certificate_issued_at='2026-01-03' WHERE id=$1", [session.enrollmentId]);
      await q("INSERT INTO user_progress(user_id,module_id,enrollment_id,video_completed,quiz_passed) VALUES($1,900001,$2,true,true)", [session.userId, session.enrollmentId]);
      const challenge = await newChallenge("learner@example.test", "Test Learner", "test-device-two");
      const restored = await module.completeAppleAccount(challenge, initialPurchase);
      assert.equal(restored.userId, session.userId);
      assert.equal(restored.enrollmentId, session.enrollmentId);
      assert.equal((await q("SELECT * FROM users")).rowCount, 1);
      assert.equal((await q("SELECT * FROM course_enrolments")).rowCount, 1);
      assert.equal((await q("SELECT quiz_passed FROM user_progress WHERE user_id=$1", [session.userId])).rows[0].quiz_passed, true);
      assert.equal((await q("SELECT certificate_issued_at FROM course_enrolments WHERE id=$1", [session.enrollmentId])).rows[0].certificate_issued_at.toISOString(), "2026-01-03T00:00:00.000Z");
      assert.equal(await module.resolveUser(session.activationCode, "test-device-one", session.userId), null);
      assert.ok(await module.resolveUser(session.activationCode, "test-device-two", session.userId));
      await assert.rejects(() => module.completeAppleAccount(challenge, initialPurchase), /another verification code/);
    });
    await t.test("concurrent restores remain one purchase, one learner and one course cycle", async () => {
      const a = await newChallenge("learner@example.test", "Test Learner", "test-device-two");
      const b = await newChallenge("learner@example.test", "Test Learner", "test-device-two");
      await Promise.all([module.completeAppleAccount(a, initialPurchase), module.completeAppleAccount(b, initialPurchase)]);
      assert.equal((await q("SELECT * FROM apple_purchases")).rowCount, 1);
      assert.equal((await q("SELECT * FROM users")).rowCount, 1);
      assert.equal((await q("SELECT * FROM course_enrolments")).rowCount, 1);
    });
    await t.test("expired new purchase cannot create a learner", async () => {
      const p = { ...purchase(randomUUID(), "100000000000003"), expiresAt: new Date("2020-01-01") };
      const proof = await intent(p);
      await assert.rejects(async () => module.completeAppleAccount(await newChallenge("expired@example.test"), p, proof), /No active course purchase/);
      assert.equal((await q("SELECT * FROM users")).rowCount, 1);
    });
    await t.test("purchase cannot be claimed by another verified email", async () => {
      await assert.rejects(async () => module.completeAppleAccount(await newChallenge("attacker@example.test"), initialPurchase), /another learner/);
      assert.equal((await q("SELECT * FROM users")).rowCount, 1);
    });
    await t.test("unclaimed purchase requires original secure intent proof", async () => {
      const p = purchase(randomUUID(), "100000000000002");
      const proof = await intent(p);
      await assert.rejects(async () => module.completeAppleAccount(await newChallenge("second@example.test"), p, { ...proof, secret: "wrong" }), /cannot be linked/);
      assert.equal((await q("SELECT * FROM users")).rowCount, 1);
    });
    await t.test("wrong codes remain limited even though failed account operations roll back", async () => {
      const c = await newChallenge("brute@example.test");
      for (let i = 0; i < 5; i++) await assert.rejects(() => module.checkAppleIdentity(c.id, "999999", c.deviceId));
      await assert.rejects(() => module.checkAppleIdentity(c.id, "123456", c.deviceId));
    });
    await t.test("verified email recovers a paid, not-yet-activated Shopify purchase", async () => {
      await q("INSERT INTO activation_codes(code,is_used,assigned_to,notes) VALUES('SHOPIFY-PAID',false,'shopify@example.test','Shopify order id 123')");
      const recovered = await module.completeAppleAccount(await newChallenge("shopify@example.test", "Shopify Learner"));
      assert.equal(recovered.activationCode, "SHOPIFY-PAID");
      const { rows: [row] } = await q("SELECT * FROM course_enrolments WHERE id=$1", [recovered.enrollmentId]);
      assert.equal(row.access_type, "paid");
      assert.ok(row.activated_at.getTime() > Date.now() - 10000);
      assert.equal((await q("SELECT is_used FROM activation_codes WHERE code='SHOPIFY-PAID'")).rows[0].is_used, true);
    });
    await t.test("ordinary manually assigned code is not treated as proof of a Shopify purchase", async () => {
      await q("INSERT INTO activation_codes(code,is_used,assigned_to,notes) VALUES('MANUAL',false,'manual@example.test','Unpaid')");
      await assert.rejects(async () => module.completeAppleAccount(await newChallenge("manual@example.test")), /No active course purchase/);
    });
    await t.test("sandbox payments cannot attach to or replace a paid Shopify learner", async () => {
      const p = purchase(randomUUID(), "100000000000005");
      const proof = await intent(p);
      await assert.rejects(async () => module.completeAppleAccount(await newChallenge("shopify@example.test", "Shopify Learner"), p, proof), /separate test learner/);
    });
    await t.test("sandbox accounts are reviewer-only and cannot receive production purchases", async () => {
      assert.equal((await q("SELECT all_modules_unlocked FROM activation_codes WHERE code=$1", [session.activationCode])).rows[0].all_modules_unlocked, true);
      const p = { ...purchase(randomUUID(), "100000000000006"), environment: "Production" };
      const proof = await intent(p);
      await assert.rejects(async () => module.completeAppleAccount(await newChallenge("learner@example.test"), p, proof), /separate test learner/);
    });
    await t.test("refund revokes only the Apple course and falls back to valid Shopify access", async () => {
      const { rows: [other] } = await q("INSERT INTO course_enrolments(user_id,purchase_code,activation_code,access_type,access_expires_at) VALUES($1,'OTHER-PAID',$2,'paid',now()+interval '2 months') RETURNING id", [session.userId, session.activationCode]);
      const { rows: [ledger] } = await q("SELECT * FROM apple_purchases WHERE transaction_id=$1", [initialPurchase.transactionId]);
      // Use Drizzle row shape by reading via resolveUser's schema adapter.
      await module.completeAppleAccount(await newChallenge("learner@example.test", "Test Learner", "test-device-two"), { ...initialPurchase, revokedAt: new Date() });
      const { rows: [current] } = await q("SELECT * FROM users WHERE id=$1", [session.userId]);
      assert.equal(current.current_enrollment_id, other.id);
      assert.equal((await q("SELECT status FROM course_enrolments WHERE id=$1", [session.enrollmentId])).rows[0].status, "revoked");
      assert.equal((await q("SELECT status FROM course_enrolments WHERE id=$1", [other.id])).rows[0].status, "active");
      assert.ok(ledger);
    });
    await t.test("unrelated valid Apple account cannot attach by name/email similarity", async () => {
      await assert.rejects(async () => module.completeAppleAccount(await newChallenge("learner@example.test", "Different Person")), /name on your existing learner/);
    });
    await t.test("new Apple payment after expiry reuses learner and preserves earlier evidence", async () => {
      await q("UPDATE course_enrolments SET access_expires_at='2020-01-01' WHERE user_id=$1 AND access_type='paid'", [session.userId]);
      const p = purchase(randomUUID(), "100000000000004");
      const proof = await intent(p, "test-device-two");
      const result = await module.completeAppleAccount(await newChallenge("learner@example.test", "Test Learner", "test-device-two"), p, proof);
      assert.equal(result.userId, session.userId);
      assert.notEqual(result.enrollmentId, session.enrollmentId);
      const { rows: [fresh] } = await q("SELECT * FROM course_enrolments WHERE id=$1", [result.enrollmentId]);
      assert.equal(fresh.course_completed_at, null);
      assert.equal(fresh.certificate_issued_at, null);
      assert.equal(fresh.access_expires_at.getTime(), p.expiresAt.getTime());
      const old = (await q("SELECT * FROM course_enrolments WHERE id=$1", [session.enrollmentId])).rows[0];
      assert.ok(old.certificate_issued_at);
      assert.equal((await q("SELECT * FROM user_progress WHERE enrollment_id=$1", [session.enrollmentId])).rowCount, 1);
      assert.equal((await q("SELECT * FROM users WHERE id=$1", [session.userId])).rowCount, 1);
    });
    await t.test("a real-production entitlement does not enable reviewer/sample-award mode", async () => {
      const p = { ...purchase(randomUUID(), "100000000000007"), environment: "Production" };
      const proof = await intent(p);
      const paid = await module.completeAppleAccount(await newChallenge("production@example.test", "Paid Learner"), p, proof);
      assert.match(paid.activationCode, /^APPLE-[A-F0-9]{64}$/);
      assert.equal((await q("SELECT all_modules_unlocked FROM activation_codes WHERE code=$1", [paid.activationCode])).rows[0].all_modules_unlocked, false);
    });
    await t.test("transaction validation rejects wrong app, type, product, environment and future purchase", () => {
      const base = { transactionId: "1000000999", originalTransactionId: "1000000999", appAccountToken: randomUUID(),
        bundleId: module.APPLE_BUNDLE_ID, productId: module.DEFAULT_APPLE_PRODUCT, environment: "Sandbox", type: "Non-Renewing Subscription", purchaseDate: Date.now() };
      for (const override of [{ bundleId: "wrong" }, { type: "Non-Consumable" }, { productId: "wrong" }, { environment: "Production" }, { purchaseDate: Date.now() + 86400000 }, { appAccountToken: undefined }, { inAppOwnershipType: "FAMILY_SHARED" }]) {
        assert.throws(() => module.validateAppleTransaction({ ...base, ...override }, module.DEFAULT_APPLE_PRODUCT, "Sandbox"));
      }
    });
    await new Promise<void>(resolve => { server = module.app.listen(0, "127.0.0.1", resolve); });
    const base = `http://127.0.0.1:${server.address().port}/api`;
    await t.test("unconfigured store fails closed and rejects malformed/forged proofs", async () => {
      const config = await (await fetch(`${base}/apple/config`)).json();
      assert.equal(config.enabled, false);
      const intentResponse = await fetch(`${base}/apple/intent`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId: "test-device-one" }) });
      assert.equal(intentResponse.status, 503);
      const notification = await fetch(`${base}/apple/notifications`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signedPayload: "not-an-apple-signature".repeat(8) }) });
      assert.equal(notification.status, 503);
      const activate = await fetch(`${base}/auth/activate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: session.activationCode, deviceId: "test-device-two", fullName: "Test Learner", email: "learner@example.test" }) });
      assert.equal(activate.status, 400);
    });
    await t.test("admin reset marker still permits bonded /auth/me recovery", async () => {
      await q("UPDATE users SET device_id='RESET_test' WHERE id=$1", [session.userId]);
      const response = await fetch(`${base}/auth/me`, { headers: { activationcode: session.activationCode, deviceid: "test-device-three", userid: String(session.userId) } });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).id, session.userId);
    });
    await t.test("enabled verifier rejects forged Apple signatures before making an Apple API call", async () => {
      const keys = ["APPLE_IAP_ENABLED", "APPLE_IAP_ENVIRONMENT", "APPLE_IAP_PRIVATE_KEY", "APPLE_IAP_KEY_ID", "APPLE_IAP_ISSUER_ID"];
      const previous = new Map(keys.map(key => [key, process.env[key]]));
      const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
      try {
        Object.assign(process.env, {
          APPLE_IAP_ENABLED: "true", APPLE_IAP_ENVIRONMENT: "Sandbox",
          APPLE_IAP_PRIVATE_KEY: privateKey.export({ type: "pkcs8", format: "pem" }),
          APPLE_IAP_KEY_ID: "TESTONLY01", APPLE_IAP_ISSUER_ID: randomUUID(),
        });
        await assert.rejects(() => module.verifyApplePurchase("invalid.apple.signature"), (err: any) => err.status === 400);
        const result = await fetch(`${base}/apple/notifications`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signedPayload: "invalid.apple.signature".repeat(8) }) });
        assert.equal(result.status, 400);
      } finally {
        for (const [key, value] of previous) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
      }
    });
    await t.test("account erasure removes training data and leaves purchase non-claimable", async () => {
      const response = await fetch(`${base}/auth/delete-account`, { method: "DELETE", headers: { activationcode: session.activationCode, deviceid: "test-device-three", userid: String(session.userId) } });
      assert.equal(response.status, 200);
      const { rows: [ledger] } = await q("SELECT * FROM apple_purchases WHERE transaction_id=$1", [initialPurchase.transactionId]);
      assert.equal(ledger.user_id, null);
      assert.ok(ledger.erased_at);
      await assert.rejects(async () => module.completeAppleAccount(await newChallenge("learner@example.test"), initialPurchase), /deleted account/);
    });
  } finally {
    if (server) await new Promise<void>(resolve => server.close(resolve));
    if (module) await module.pool.end();
    for (const [key, value] of Object.entries({ APPLE_TEST_SCHEMA: old.schema, APPLE_IAP_ENABLED: old.enabled, SMTP_HOST: old.smtp })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
    await rm(temp, { recursive: true, force: true });
  }
});

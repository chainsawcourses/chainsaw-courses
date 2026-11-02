import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import vm from "node:vm";
import express from "express";
import { build } from "esbuild";

const apiDir = fileURLToPath(new URL("../", import.meta.url));
const scriptSource = await readFile(new URL("../../chainsaw-training/public/docs/google-backup-trigger.gs", import.meta.url), "utf8");
const fakeKey = "test-only-not-a-real-key-".repeat(3);

test("external backup route authenticates separately, waits for work, and returns no private data", async (t) => {
  const dir = await mkdtemp(path.join(apiDir, ".backup-automation-test-"));
  const outfile = path.join(dir, "route.mjs");
  let server;
  try {
    await build({
      entryPoints: [path.join(apiDir, "src/routes/backupAutomation.ts")],
      outfile, bundle: true, platform: "node", format: "esm",
      external: ["express", "pino", "pino-pretty"],
    });
    const { createBackupAutomationRouter } = await import(pathToFileURL(outfile).href);
    let secret = fakeKey;
    let production = true;
    let now = new Date("2026-10-15T05:15:00Z");
    let runs = 0;
    let state = "succeeded";
    let throwOnRun = false;
    let finished = false;
    const app = express();
    app.use("/api", createBackupAutomationRouter({
      secret: () => secret,
      isProduction: () => production,
      now: () => now,
      run: async () => {
        runs++;
        if (throwOnRun) throw new Error("private database detail must not escape");
        await new Promise((resolve) => setTimeout(resolve, 15));
        finished = true;
      },
      findRun: async () => state ? { state, privateData: "must-not-be-returned" } : null,
    }));
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const url = `http://127.0.0.1:${server.address().port}/api/automation/backups/daily`;
    const call = (method = "POST", token = fakeKey) => fetch(url, {
      method, headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    await t.test("missing/wrong credentials cannot run backups", async () => {
      for (const token of [null, "wrong-key-that-is-at-least-thirty-two-characters"]) {
        assert.equal((await call("POST", token)).status, 401);
      }
      assert.equal(runs, 0);
      secret = undefined;
      assert.equal((await call()).status, 503);
      secret = "too-short";
      assert.equal((await call()).status, 503);
      secret = fakeKey;
    });
    await t.test("development does not run backups", async () => {
      production = false;
      assert.equal((await call()).status, 503);
      production = true;
      assert.equal(runs, 0);
    });
    await t.test("GET verifies readiness without creating a backup", async () => {
      const response = await call("GET");
      assert.equal(response.status, 200);
      assert.match(response.headers.get("cache-control"), /no-store/);
      assert.deepEqual(await response.json(), { state: "ready", dateKey: "2026-10-15" });
      assert.equal(runs, 0);
    });
    await t.test("before 06:00 UK does not execute", async () => {
      now = new Date("2026-10-15T04:59:00Z");
      assert.deepEqual(await (await call()).json(), { state: "not_due", dateKey: "2026-10-15" });
      assert.equal(runs, 0);
      now = new Date("2026-10-15T05:15:00Z");
    });
    await t.test("response waits for completion and contains only state/date", async () => {
      const response = await call();
      assert.equal(response.status, 200);
      assert.equal(finished, true);
      assert.deepEqual(await response.json(), { state: "succeeded", dateKey: "2026-10-15" });
    });
    await t.test("concurrent work and failed runs are reported truthfully", async () => {
      for (const value of ["running", null, "failed"]) {
        state = value;
        const response = await call();
        assert.equal(response.status, value === "failed" ? 200 : 202);
        assert.deepEqual(await response.json(), { state: value ?? "busy", dateKey: "2026-10-15" });
      }
    });
    await t.test("unexpected errors never expose private details", async () => {
      throwOnRun = true;
      const response = await call();
      assert.equal(response.status, 503);
      assert.doesNotMatch(await response.text(), /private database|must-not/);
    });
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
});

function googleHarness({ at = "2026-10-15T05:15:00Z", state = "succeeded", code = 200, networkError = false } = {}) {
  const props = new Map([["BACKUP_TRIGGER_SECRET", fakeKey]]);
  const calls = [];
  const messages = [];
  let date = at;
  let held = false;
  let failNetwork = networkError;
  const old = { getHandlerFunction: () => "runDailyBackup" };
  const other = { getHandlerFunction: () => "unrelatedJob" };
  let triggers = [old, other];
  const intervals = [];
  const NativeDate = Date;
  const context = vm.createContext({
    Date: class extends NativeDate { constructor(...args) { super(...(args.length ? args : [date])); } },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (key) => props.get(key) ?? null,
      setProperty: (key, value) => props.set(key, value),
    }) },
    LockService: { getScriptLock: () => ({
      tryLock: () => { if (held) return false; held = true; return true; },
      hasLock: () => held,
      releaseLock: () => { held = false; },
    }) },
    Utilities: { formatDate: (value, zone, format) => {
      if (format === "HH") return new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", hourCycle: "h23" }).format(value);
      return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
    } },
    UrlFetchApp: { fetch: (url, options) => {
      calls.push({ url, options });
      if (failNetwork) throw new Error(fakeKey);
      return {
        getResponseCode: () => code,
        getContentText: () => JSON.stringify({
          state: options.method === "get" ? "ready" : state,
          dateKey: new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new NativeDate(date)),
        }),
      };
    } },
    ScriptApp: {
      getProjectTriggers: () => triggers,
      deleteTrigger: (item) => { triggers = triggers.filter((trigger) => trigger !== item); },
      newTrigger: (handler) => ({
        timeBased() { return this; },
        everyMinutes(minutes) { intervals.push(minutes); return this; },
        create() { triggers.push({ getHandlerFunction: () => handler }); },
      }),
    },
    console: { log: (message) => messages.push(message), warn: (message) => messages.push(message) },
  });
  vm.runInContext(scriptSource, context);
  return { context, props, calls, messages, intervals,
    setDate: (value) => { date = value; },
    setNetworkError: (value) => { failNetwork = value; },
    triggers: () => triggers,
  };
}

test("Google install is a safe check and replaces only its own trigger", () => {
  const h = googleHarness();
  h.context.installBackupTrigger();
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].options.method, "get");
  assert.equal(h.calls[0].options.followRedirects, false);
  assert.equal(h.calls[0].options.headers.Authorization, `Bearer ${fakeKey}`);
  assert.deepEqual(h.intervals, [15]);
  assert.equal(h.triggers().filter((t) => t.getHandlerFunction() === "runDailyBackup").length, 1);
  assert.equal(h.triggers().filter((t) => t.getHandlerFunction() === "unrelatedJob").length, 1);
  h.context.removeBackupTrigger();
  assert.equal(h.triggers().length, 1);
});

test("Google refuses to install when the published connection is not ready", () => {
  const h = googleHarness({ code: 401 });
  assert.throws(() => h.context.installBackupTrigger(), /HTTP 401/);
  assert.deepEqual(h.intervals, []);
  assert.equal(h.triggers().length, 2);
});

test("Google schedules by UK local time and records only terminal results", () => {
  const h = googleHarness({ at: "2026-10-15T04:59:00Z" });
  h.context.runDailyBackup();
  assert.equal(h.calls.length, 0);
  h.setDate("2026-10-15T05:15:00Z");
  h.context.runDailyBackup();
  h.context.runDailyBackup();
  assert.equal(h.calls.length, 1);
  assert.equal(h.props.get("BACKUP_TERMINAL_DATE"), "2026-10-15");
  h.setDate("2026-10-16T05:15:00Z");
  h.context.runDailyBackup();
  assert.equal(h.calls.length, 2);
  const winter = googleHarness({ at: "2026-01-15T05:59:00Z" });
  winter.context.runDailyBackup();
  assert.equal(winter.calls.length, 0);
  winter.setDate("2026-01-15T06:00:00Z");
  winter.context.runDailyBackup();
  assert.equal(winter.calls.length, 1);
});

test("Google retries uncertain work without leaking credentials or sending mail", () => {
  for (const state of ["busy", "running", "not_due"]) {
    const h = googleHarness({ state, code: 202 });
    h.context.runDailyBackup();
    h.context.runDailyBackup();
    assert.equal(h.calls.length, 2);
    assert.equal(h.props.has("BACKUP_TERMINAL_DATE"), false);
  }
  const h = googleHarness({ networkError: true });
  h.context.runDailyBackup();
  assert.equal(h.props.has("BACKUP_TERMINAL_DATE"), false);
  h.setNetworkError(false);
  h.context.runDailyBackup();
  assert.equal(h.props.get("BACKUP_LAST_STATE"), "succeeded");
  assert.ok(h.messages.every((message) => !message.includes(fakeKey)));
  assert.doesNotMatch(scriptSource, /GmailApp|MailApp|sendEmail/);
  const failed = googleHarness({ state: "failed" });
  failed.context.runDailyBackup();
  failed.context.runDailyBackup();
  assert.equal(failed.calls.length, 1);
  assert.equal(failed.props.get("BACKUP_LAST_STATE"), "failed");
});

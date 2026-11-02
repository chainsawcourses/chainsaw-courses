import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { observeBackupConnection, reconcileUnownedBackupRuns, recoverBackupOwnership } from "../src/lib/backupLockLease.ts";

test("lost session is replaced only when the lock is acquired and the run is still active", async () => {
  const released: string[] = [];
  assert.equal(await recoverBackupOwnership("old", {
    acquire: async () => "new", isStillRunning: async () => true,
    release: async (client) => { released.push(client); },
  }), "new");
  assert.deepEqual(released, ["old"]);
});

test("recovery never steals another worker's lock or revives a terminal run", async () => {
  const released: string[] = [];
  await assert.rejects(recoverBackupOwnership("old", {
    acquire: async () => null, isStillRunning: async () => { throw new Error("must not check"); },
    release: async (client) => { released.push(client); },
  }), /Another backup owns/);
  assert.deepEqual(released, []);
  await assert.rejects(recoverBackupOwnership("old", {
    acquire: async () => "new", isStillRunning: async () => false,
    release: async (client) => { released.push(client); },
  }), /no longer active/);
  assert.deepEqual(released, ["new"]);
});

class FakeConnection extends EventEmitter {
  queries = 0;
  async query(_config: { text: string; query_timeout: number }) { this.queries++; }
  released: boolean[] = [];
  release(destroy = false) { this.released.push(destroy); }
}

test("heartbeat keeps the checked-out lock connection active and stops on release", async () => {
  const client = new FakeConnection();
  const lease = observeBackupConnection(client, () => {}, 5);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.ok(client.queries > 0);
  await lease.stopHeartbeat();
  const count = client.queries;
  lease.release();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(client.queries, count);
});

test("heartbeat query rejection invalidates ownership without an unhandled rejection", async () => {
  const client = new FakeConnection();
  client.query = async () => { throw new Error("connection terminated"); };
  let notices = 0;
  const lease = observeBackupConnection(client, () => { notices++; }, 5);
  await new Promise((resolve) => setTimeout(resolve, 30));
  await lease.stopHeartbeat();
  assert.equal(notices, 1);
  assert.throws(() => lease.assertHeld(), /connection was interrupted/);
  lease.release();
  assert.deepEqual(client.released, [true]);
});

test("heartbeat queries never overlap and shutdown waits for the active query", async () => {
  const client = new FakeConnection();
  let finish!: () => void;
  client.query = async (config) => {
    assert.equal(config.text, "SELECT 1");
    assert.equal(config.query_timeout, 10_000);
    client.queries++;
    await new Promise<void>((resolve) => { finish = resolve; });
  };
  const lease = observeBackupConnection(client, () => {}, 5);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(client.queries, 1);
  let stopped = false;
  const stop = lease.stopHeartbeat().then(() => { stopped = true; });
  await Promise.resolve();
  assert.equal(stopped, false);
  finish();
  await stop;
  lease.release();
  assert.equal(stopped, true);
});

test("a lost checked-out backup connection is handled and cannot be reported healthy", () => {
  const client = new FakeConnection();
  let notices = 0;
  const lease = observeBackupConnection(client, () => { notices++; });
  lease.assertHeld();
  assert.doesNotThrow(() => client.emit("error", new Error("connection terminated")));
  assert.equal(notices, 1);
  assert.equal(lease.lost, true);
  assert.throws(() => lease.assertHeld(), /connection was interrupted/);
  lease.release();
  assert.deepEqual(client.released, [true]);
  assert.equal(client.listenerCount("error"), 0);
});

test("healthy backup clients are returned without leaking error listeners", () => {
  const client = new FakeConnection();
  for (let i = 0; i < 3; i++) {
    const lease = observeBackupConnection(client, () => {});
    lease.assertHeld();
    lease.release();
  }
  assert.deepEqual(client.released, [false, false, false]);
  assert.equal(client.listenerCount("error"), 0);
});

test("an unlock failure can explicitly discard an otherwise healthy client", () => {
  const client = new FakeConnection();
  observeBackupConnection(client, () => {}).release(true);
  assert.deepEqual(client.released, [true]);
});

test("status recovery never marks an actively locked backup as interrupted", async () => {
  let recovered = false;
  let released = false;
  const changed = await reconcileUnownedBackupRuns({
    acquire: async () => null,
    recover: async () => { recovered = true; },
    release: async () => { released = true; },
  });
  assert.equal(changed, false);
  assert.equal(recovered, false);
  assert.equal(released, false);
});

test("orphan recovery retains the lock until the status update is complete", async () => {
  const client = {};
  const calls: string[] = [];
  const changed = await reconcileUnownedBackupRuns({
    acquire: async () => { calls.push("acquire"); return client; },
    recover: async (value) => { assert.equal(value, client); calls.push("recover"); },
    release: async (value) => { assert.equal(value, client); calls.push("release"); },
  });
  assert.equal(changed, true);
  assert.deepEqual(calls, ["acquire", "recover", "release"]);
});

test("recovery failure still releases the lock and is not mistaken for success", async () => {
  let released = false;
  await assert.rejects(reconcileUnownedBackupRuns({
    acquire: async () => ({}),
    recover: async () => { throw new Error("database unavailable"); },
    release: async () => { released = true; },
  }), /database unavailable/);
  assert.equal(released, true);
});

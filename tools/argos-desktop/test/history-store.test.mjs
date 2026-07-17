import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { HistoryStore } from "../src/history-store.mjs";
import { makeConfig, makePayload } from "./fixtures.mjs";

test("stores immutable snapshots, diffs, and a deduplicated latest config", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "argos-history-test-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const times = [new Date("2026-07-17T10:00:00.000Z"), new Date("2026-07-17T10:01:00.000Z")];
  const store = new HistoryStore(root, () => times.shift());
  await store.init();

  const first = await store.appendSnapshot(makePayload());
  assert.equal(first.stored, true);
  assert.equal(first.summary, "Initial snapshot");

  const duplicate = await store.appendSnapshot(makePayload());
  assert.equal(duplicate.stored, false);
  assert.equal(store.list().length, 1);

  const changedConfig = makeConfig({ keycodes: [[4, 5, 6, 8]] });
  const second = await store.appendSnapshot(makePayload(changedConfig));
  assert.equal(second.stored, true);
  assert.equal(second.summary, "1 keymap");

  const records = store.list();
  assert.equal(records.length, 2);
  const snapshot = await store.get(records[0].id);
  assert.deepEqual(snapshot.config, changedConfig);
  assert.deepEqual(snapshot.record.changes, [
    { op: "replace", path: "/keycodes/0/3", oldValue: 7, value: 8 }
  ]);
  assert.deepEqual(JSON.parse(await readFile(path.join(root, "latest.json"), "utf8")), changedConfig);
  assert.equal((await readFile(path.join(root, "audit.jsonl"), "utf8")).trim().split("\n").length, 2);
});

test("rejects snapshot path traversal", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "argos-history-test-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const store = new HistoryStore(root);
  await store.init();
  await assert.rejects(() => store.get("../../config"), /Invalid snapshot identifier/);
});

test("exports an empty audit log before the first snapshot", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "argos-history-test-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const store = new HistoryStore(root);
  await store.init();

  const destination = path.join(root, "export.jsonl");
  await store.exportAuditLog(destination);
  assert.equal(await readFile(destination, "utf8"), "");
});

test("keeps deduplication and diffs separate for each keyboard product", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "argos-history-test-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const times = [new Date("2026-07-17T10:00:00.000Z"), new Date("2026-07-17T10:01:00.000Z")];
  const store = new HistoryStore(root, () => times.shift());
  await store.init();

  await store.appendSnapshot(makePayload());
  const nanoPayload = makePayload();
  nanoPayload.device.productId = 0x1832;
  nanoPayload.device.productName = "Charybdis Nano";
  const nano = await store.appendSnapshot(nanoPayload);

  assert.equal(nano.stored, true);
  assert.equal(nano.summary, "Initial snapshot");
  assert.equal(store.list().length, 2);
  const snapshot = await store.get(nano.id);
  assert.equal(snapshot.record.previousHash, null);
});

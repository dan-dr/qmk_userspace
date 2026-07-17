import test from "node:test";
import assert from "node:assert/strict";
import { validateArgosConfig, validateSnapshotPayload } from "../src/validation.mjs";
import { makeConfig, makePayload } from "./fixtures.mjs";

test("accepts and clones an Argos-compatible configuration", () => {
  const input = makeConfig();
  const result = validateArgosConfig(input);
  assert.deepEqual(result, input);
  assert.notEqual(result, input);
});

test("rejects a keymap whose matrix shape is inconsistent", () => {
  assert.throws(
    () => validateArgosConfig(makeConfig({ keycodes: [[4, 5, 6]] })),
    /Invalid Argos config field: keycodes/
  );
});

test("validates exact per-key RGB state shapes", () => {
  const rgbState = { r: 12, g: 34, b: 56, transparent: false, on: true, custom: true };
  assert.deepEqual(
    validateArgosConfig(makeConfig({ rgbMatrix: { "0:1:1": rgbState } })).rgbMatrix,
    { "0:1:1": rgbState }
  );
  assert.throws(
    () => validateArgosConfig(makeConfig({ rgbMatrix: { "0:9:9": rgbState } })),
    /Invalid Argos config field: rgbMatrix/
  );
  assert.throws(
    () => validateArgosConfig(makeConfig({ rgbMatrix: { "0:1:1": { ...rgbState, r: 999 } } })),
    /Invalid Argos config field: rgbMatrix/
  );
});

test("normalizes untrusted audit metadata", () => {
  const payload = makePayload();
  payload.reason = "keymap\nchange";
  payload.device.productName = "Charybdis\tRight";
  const result = validateSnapshotPayload(payload);
  assert.equal(result.reason, "keymap change");
  assert.equal(result.device.productName, "Charybdis Right");
});

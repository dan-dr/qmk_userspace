import test from "node:test";
import assert from "node:assert/strict";
import { canonicalJson, diffJson, summarizeDiff } from "../src/diff.mjs";

test("reports exact JSON pointer changes", () => {
  const changes = diffJson(
    { keycodes: [[4, 5]], comboTerm: 40 },
    { keycodes: [[4, 6]], comboTerm: 42 }
  );
  assert.deepEqual(changes, [
    { op: "replace", path: "/comboTerm", oldValue: 40, value: 42 },
    { op: "replace", path: "/keycodes/0/1", oldValue: 5, value: 6 }
  ]);
  assert.equal(summarizeDiff(changes), "1 timing, 1 keymap");
});

test("canonical JSON ignores object insertion order", () => {
  assert.equal(canonicalJson({ b: 2, a: { d: 4, c: 3 } }), canonicalJson({ a: { c: 3, d: 4 }, b: 2 }));
});

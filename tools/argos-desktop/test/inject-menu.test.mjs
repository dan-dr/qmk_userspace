import test from "node:test";
import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { injectMenuScripts } from "../src/injected/menu/manifest.mjs";
import { loadInjectMenuScripts } from "../src/inject-menu.mjs";

const MENU_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/injected/menu");

test("inject menu manifest points at real script files", async () => {
  assert.ok(injectMenuScripts.length > 0);
  for (const entry of injectMenuScripts) {
    assert.ok(entry.id);
    assert.ok(entry.label);
    assert.ok(entry.file.endsWith(".js"));
    await access(path.join(MENU_DIR, entry.file));
  }
});

test("inject menu scripts load as executable page sources", async () => {
  const scripts = await loadInjectMenuScripts();
  assert.equal(scripts.length, injectMenuScripts.length);
  for (const script of scripts) {
    assert.ok(script.source.includes("(()"));
    assert.ok(script.source.length > 100);
  }
  const chord = scripts.find((script) => script.id === "combo-chord-capture");
  assert.ok(chord);
  assert.match(chord.source, /__argosChordCapture/);
  assert.match(chord.source, /CAPTURE_COMBO/);
});

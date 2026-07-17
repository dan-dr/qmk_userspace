import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { installArgosAudit } = require("../src/injected/argos-audit.cjs");
const protocol = installArgosAudit({});

test("parses Argos keyboard info including protocol 4 pointer flags", () => {
  const response = new Uint8Array([
    0x90, 0x01, 0x00, 0x04, 50, 16, 4, 13, 0, 0, 8, 1, 0, 175, 0, 42, 1, 1, 0
  ]);
  assert.deepEqual(protocol.parseKeyboardInfo(response), {
    protocol: 4,
    tapDanceAmount: 50,
    comboAmount: 16,
    keysPerCombo: 4,
    themeId: 13,
    qmkKeycodesVersion: [0, 0, 8],
    hasDisplayedWelcomeMessage: true,
    tappingTerm: 175,
    comboTerm: 42,
    isLeftHanded: true,
    autoMouseLayerEnabled: true,
    autoPrecisionOnMouseLayerEnabled: false
  });
});

test("parses combo and tap-dance entries with firmware byte order", () => {
  const combo = new Uint8Array([
    0x90, 0x02, 3, 1, 0x34, 0x12, 0x2a, 0, 4, 0, 5, 0, 0, 0, 7, 0
  ]);
  assert.deepEqual(protocol.parseCombo(combo, 4), {
    enabled: true,
    output: 0x1234,
    input: [4, 5, 0, 0],
    customTerm: 42
  });

  const tapDance = new Uint8Array([0x90, 0x07, 2, 4, 0, 5, 0, 6, 0, 7, 0, 175, 0]);
  assert.deepEqual(protocol.parseTapDance(tapDance), {
    on_tap: 4,
    on_hold: 5,
    on_double_tap: 6,
    on_tap_hold: 7,
    custom_tapping_term: 175
  });
});

test("recognizes every current Argos write command", () => {
  assert.equal(protocol.isMutation(new Uint8Array([0x90, 0x0e])), true);
  assert.equal(protocol.isMutation(new Uint8Array([0x90, 0x02])), false);
  assert.equal(protocol.isMutation(new Uint8Array([0x90, 0x14])), false);
  assert.equal(protocol.isMutation(new Uint8Array([0x90, 0x15])), true);
  assert.equal(protocol.describeCommand(new Uint8Array([0x90, 0x15])), "per-key RGB change");
  assert.equal(protocol.isMutation(new Uint8Array([0x05])), true);
  assert.equal(protocol.describeCommand(new Uint8Array([0x05])), "keymap change");
});

test("parses per-key RGB state and maps split matrix offsets", () => {
  assert.deepEqual(
    protocol.parseRgbMatrixLed(new Uint8Array([0x90, 0x14, 12, 34, 56, 1, 0, 1])),
    { r: 12, g: 34, b: 56, transparent: true, on: false, custom: true }
  );

  assert.deepEqual(protocol.rgbMatrixPositions([null, [0, 0], [2, 0]], 4, 1), [
    { row: 0, column: 0, index: 1, offset: 0, layer: 0, key: "0:0:0" },
    { row: 2, column: 0, index: 1, offset: 1, layer: 0, key: "0:2:0" },
    { arrayIndex: 0, index: 0, offset: 0, layer: 0, key: "0:underglow:0" }
  ]);
});

test("selects an authorized supported keyboard matching the live Argos filters", () => {
  const unsupported = {
    vendorId: 0x1234,
    productId: 0x1833,
    collections: [{ usagePage: 65377, usage: 98 }]
  };
  const wrongCollection = {
    vendorId: 0xa8f8,
    productId: 0x1833,
    collections: [{ usagePage: 1, usage: 2 }]
  };
  const charybdis = {
    vendorId: 0xa8f8,
    productId: 0x1833,
    collections: [{ usagePage: 65377, usage: 98 }]
  };

  assert.equal(
    protocol.selectAuthorizedDevice([unsupported, wrongCollection, charybdis], [
      { usagePage: 65377, usage: 98 },
      { usagePage: 65376, usage: 97 }
    ]),
    charybdis
  );
  assert.equal(protocol.selectAuthorizedDevice([wrongCollection], [{ usagePage: 65377, usage: 98 }]), null);
});

test("reuses an authorized keyboard before opening the native chooser", async () => {
  const charybdis = {
    vendorId: 0xa8f8,
    productId: 0x1833,
    collections: [{ usagePage: 65377, usage: 98 }]
  };
  let chooserCalls = 0;
  const hid = { getDevices: async () => [charybdis] };
  const result = await protocol.requestAuthorizedDevice(
    hid,
    async () => {
      chooserCalls += 1;
      return [];
    },
    { filters: [{ usagePage: 65377, usage: 98 }] }
  );

  assert.deepEqual(result, [charybdis]);
  assert.equal(chooserCalls, 0);
});

test("falls back to the native chooser when no supported keyboard is authorized", async () => {
  const hid = { getDevices: async () => [] };
  const selected = { vendorId: 0xa8f8, productId: 0x1833 };
  const options = { filters: [{ usagePage: 65377, usage: 98 }] };
  const result = await protocol.requestAuthorizedDevice(hid, async (received) => {
    assert.equal(received, options);
    return [selected];
  }, options);

  assert.deepEqual(result, [selected]);
});

test("finds only the live page's enabled Connect button", () => {
  const disabled = { disabled: true, textContent: "Connect" };
  const history = { disabled: false, textContent: "History" };
  const connect = { disabled: false, textContent: " Connect " };
  const document = { querySelectorAll: () => [disabled, history, connect] };

  assert.equal(protocol.findConnectButton(document), connect);
});

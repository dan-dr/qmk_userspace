import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { installArgosAudit } = require("../src/injected/argos-audit.cjs");
const { installArgosStateHook } = require("../src/injected/argos-state-hook.cjs");
const protocol = installArgosAudit({});

function configFixture(overrides = {}) {
  return {
    viaProtocolVersion: 11,
    argosProtocolVersion: 4,
    qmkKeycodesVersion: [0, 0, 8],
    pointingDeviceType: 2,
    keycodes: [[4, 5]],
    combos: [],
    tapDances: [],
    rgbMatrix: {},
    themeId: 13,
    ...overrides
  };
}

test("captures and serializes the same reactive config object used by Argos Export", () => {
  const root = { Proxy };
  installArgosStateHook(root);

  const config = new root.Proxy(configFixture(), {});
  config.themeId = 16;

  assert.equal(root.__argosDesktopConfig, config);
  assert.equal(protocol.serializeCachedConfig(root), JSON.stringify(config));
});

test("ignores unrelated Vue proxies and follows replacement Argos configs", () => {
  const root = { Proxy };
  installArgosStateHook(root);

  new root.Proxy({ keycodes: [] }, {});
  assert.equal(root.__argosDesktopConfig, undefined);

  const first = new root.Proxy(configFixture({ themeId: 1 }), {});
  const second = new root.Proxy(configFixture({ themeId: 2 }), {});
  assert.equal(root.__argosDesktopConfig, second);
  assert.notEqual(root.__argosDesktopConfig, first);
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

test("stores cached history without sending an additional HID request", async () => {
  const snapshots = [];
  let sends = 0;
  class FakeHidDevice {
    constructor() {
      this.vendorId = 0xa8f8;
      this.productId = 0x1833;
      this.productName = "Charybdis";
      this.opened = true;
      this.listeners = new Set();
    }

    addEventListener(_name, listener) {
      this.listeners.add(listener);
    }

    removeEventListener(_name, listener) {
      this.listeners.delete(listener);
    }

    async sendReport(_reportId, data) {
      sends += 1;
      const response = new Uint8Array([data[0], data[1] ?? 0]);
      queueMicrotask(() => {
        for (const listener of this.listeners) listener({ data: new DataView(response.buffer) });
      });
    }
  }
  const hid = {
    requestDevice: async () => [],
    getDevices: async () => [],
    addEventListener() {}
  };
  const root = {
    __argosDesktopConfig: configFixture(),
    __argosDesktopSnapshotDebounceMs: 0,
    navigator: { hid },
    argosAudit: {
      openHistory() {},
      async storeSnapshot(snapshot) {
        snapshots.push(snapshot);
        return { stored: true, count: snapshots.length, summary: "keymap change" };
      }
    },
    HIDDevice: FakeHidDevice,
    setTimeout,
    clearTimeout,
    console
  };
  installArgosAudit(root);
  const device = new FakeHidDevice();

  await device.sendReport(0, new Uint8Array([0x05]));
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(sends, 1);
  assert.equal(snapshots.length, 1);
  assert.deepEqual(snapshots[0].config, root.__argosDesktopConfig);
});

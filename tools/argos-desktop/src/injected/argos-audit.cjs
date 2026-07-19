(function exposeArgosAudit(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = { installArgosAudit: factory };
  } else {
    factory(root);
  }
})(globalThis, function installArgosAudit(root) {
  "use strict";

  const ARGOS_PREFIX = 0x90;
  const REPORT_ID = 0;
  const SNAPSHOT_DEBOUNCE_MS = root.__argosDesktopSnapshotDebounceMs ?? 1500;
  const CONFIG_CACHE_KEY = "__argosDesktopConfig";
  const SUPPORTED_DEVICES = new Map([
    [0x1832, "Charybdis Nano"],
    [0x1833, "Charybdis"],
    [0x1836, "Dilemma v3 3x5"]
  ]);
  const ARGOS_MUTATIONS = new Set([
    0x03,
    0x04,
    0x06,
    0x08,
    0x09,
    0x0a,
    0x0b,
    0x0d,
    0x0e,
    0x10,
    0x11,
    0x12,
    0x13,
    0x15,
    0x16,
    0x17,
    0x18,
    0x19
  ]);
  const VIA_MUTATIONS = new Set([0x05, 0x07, 0x09, 0x13]);

  function bytesFrom(value) {
    if (value instanceof Uint8Array) return new Uint8Array(value);
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) {
      return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    }
    return new Uint8Array(value);
  }

  function responseBytes(event) {
    const data = event.data;
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }

  function expectedPrefix(request) {
    return request[0] === ARGOS_PREFIX ? [ARGOS_PREFIX, request[1]] : [request[0]];
  }

  function startsWith(bytes, prefix) {
    return prefix.every((byte, index) => bytes[index] === byte);
  }

  function isMutation(request) {
    if (request[0] === ARGOS_PREFIX) return ARGOS_MUTATIONS.has(request[1]);
    return VIA_MUTATIONS.has(request[0]);
  }

  function describeCommand(request) {
    if (request[0] === ARGOS_PREFIX) {
      const names = {
        0x03: "combo deletion",
        0x04: "combo capture",
        0x06: "theme change",
        0x08: "tap dance change",
        0x09: "tap dance capture",
        0x0a: "tap dance deletion",
        0x0b: "pointer DPI change",
        0x0d: "precision DPI change",
        0x0e: "combo change",
        0x10: "welcome-state change",
        0x11: "tapping-term change",
        0x12: "combo-term change",
        0x13: "tap dance assignment",
        0x15: "per-key RGB change",
        0x16: "auto-mouse change",
        0x17: "auto-precision change",
        0x18: "pointer-axis inversion change",
        0x19: "drag-scroll DPI change"
      };
      return names[request[1]] ?? `Argos command 0x${request[1].toString(16).padStart(2, "0")}`;
    }
    const names = {
      0x05: "keymap change",
      0x07: "RGB setting change",
      0x09: "RGB settings save",
      0x13: "keymap restore"
    };
    return names[request[0]] ?? `VIA command 0x${request[0].toString(16).padStart(2, "0")}`;
  }

  function matchesHidFilter(device, filter) {
    if (filter.vendorId !== undefined && device.vendorId !== filter.vendorId) return false;
    if (filter.productId !== undefined && device.productId !== filter.productId) return false;
    if (filter.usagePage === undefined && filter.usage === undefined) return true;
    return (device.collections ?? []).some((collection) => {
      if (filter.usagePage !== undefined && collection.usagePage !== filter.usagePage) return false;
      if (filter.usage !== undefined && collection.usage !== filter.usage) return false;
      return true;
    });
  }

  function selectAuthorizedDevice(devices, filters = []) {
    return (
      devices.find((device) => {
        if (!isSupportedDevice(device)) return false;
        return filters.length === 0 || filters.some((filter) => matchesHidFilter(device, filter));
      }) ?? null
    );
  }

  async function requestAuthorizedDevice(hid, originalRequestDevice, options = {}) {
    const authorized = await hid.getDevices();
    const device = selectAuthorizedDevice(authorized, options.filters ?? []);
    if (device) return [device];
    return originalRequestDevice(options);
  }

  function findConnectButton(document) {
    return (
      [...(document?.querySelectorAll?.("button") ?? [])].find(
        (button) => !button.disabled && button.textContent?.trim() === "Connect"
      ) ?? null
    );
  }

  function serializeCachedConfig(targetRoot) {
    const config = targetRoot[CONFIG_CACHE_KEY];
    return config ? JSON.stringify(config) : null;
  }

  function installStatusButton(auditApi) {
    if (!root.document?.body) return { update() {} };
    let button = root.document.getElementById("argos-desktop-history");
    if (!button) {
      const style = root.document.createElement("style");
      style.textContent = `
        #argos-desktop-history {
          position: fixed; right: 18px; bottom: 18px; z-index: 2147483647;
          border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
          border-radius: 999px; padding: 9px 14px; cursor: pointer;
          color: var(--color-base-content, #f5f5f5);
          background: color-mix(in srgb, var(--color-base-300, #20242b) 92%, transparent);
          box-shadow: 0 8px 30px rgba(0,0,0,.28); backdrop-filter: blur(14px);
          font: 600 12px/1.2 ui-sans-serif, system-ui, sans-serif;
        }
        #argos-desktop-history[data-state="saved"]::before { content: ""; display: inline-block;
          width: 7px; height: 7px; margin-right: 7px; border-radius: 50%; background: #4ade80; }
        #argos-desktop-history[data-state="error"]::before { content: ""; display: inline-block;
          width: 7px; height: 7px; margin-right: 7px; border-radius: 50%; background: #fb7185; }
      `;
      root.document.head.appendChild(style);
      button = root.document.createElement("button");
      button.id = "argos-desktop-history";
      button.type = "button";
      button.textContent = "History";
      button.title = "Open local Argos configuration history";
      button.addEventListener("click", () => auditApi.openHistory());
      root.document.body.appendChild(button);
    }
    return {
      update(state, label, title = "Open local Argos configuration history") {
        button.dataset.state = state;
        button.textContent = label;
        button.title = title;
      }
    };
  }

  const testApi = {
    bytesFrom,
    serializeCachedConfig,
    isMutation,
    describeCommand,
    matchesHidFilter,
    selectAuthorizedDevice,
    requestAuthorizedDevice,
    findConnectButton
  };
  if (!root.navigator?.hid || !root.argosAudit || root.__argosAuditInstalled) return testApi;
  root.__argosAuditInstalled = true;

  const auditApi = root.argosAudit;
  const status = installStatusButton(auditApi);
  const states = new WeakMap();
  const originalSendReport = root.HIDDevice?.prototype?.sendReport;
  if (typeof originalSendReport !== "function") {
    status.update("error", "History unavailable", "Electron did not expose WebHID");
    return testApi;
  }

  function stateFor(device) {
    let state = states.get(device);
    if (!state) {
      state = {
        auditPromise: null,
        timer: null,
        hasSnapshot: false,
        dirty: false,
        pendingReason: "keyboard connected"
      };
      states.set(device, state);
    }
    return state;
  }

  function isSupportedDevice(device) {
    return device?.vendorId === 0xa8f8 && SUPPORTED_DEVICES.has(device.productId);
  }

  function installAutoConnect() {
    const hid = root.navigator.hid;
    const originalRequestDevice = hid.requestDevice.bind(hid);
    const attemptedDevices = new WeakSet();
    let scheduled = false;

    Object.defineProperty(hid, "requestDevice", {
      configurable: true,
      writable: true,
      value: (options) => requestAuthorizedDevice(hid, originalRequestDevice, options)
    });

    const maybeConnect = async () => {
      scheduled = false;
      const device = selectAuthorizedDevice(await hid.getDevices());
      if (!device) return;
      if (attemptedDevices.has(device)) return;
      const connectButton = findConnectButton(root.document);
      if (!connectButton) return;
      attemptedDevices.add(device);
      connectButton.click();
    };
    const scheduleConnect = () => {
      if (scheduled) return;
      scheduled = true;
      root.setTimeout(() => {
        void maybeConnect().catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          status.update("error", "Auto-connect error", message);
          root.console.error("Argos Desktop auto-connect failed:", error);
        });
      }, 0);
    };

    hid.addEventListener("connect", (event) => {
      attemptedDevices.delete(event.device);
      scheduleConnect();
    });
    hid.addEventListener("disconnect", (event) => {
      attemptedDevices.delete(event.device);
    });
    if (typeof root.MutationObserver === "function" && root.document?.body) {
      const observer = new root.MutationObserver(scheduleConnect);
      observer.observe(root.document.body, { childList: true, subtree: true });
    }
    scheduleConnect();
  }

  installAutoConnect();

  function capture(device, state) {
    if (!device.opened || state.auditPromise || !state.dirty) return state.auditPromise;
    const serializedConfig = serializeCachedConfig(root);
    if (serializedConfig === null) return null;
    const reason = state.pendingReason;
    state.dirty = false;
    const promise = (async () => {
      try {
        const result = await auditApi.storeSnapshot({
          config: JSON.parse(serializedConfig),
          warnings: [],
          reason,
          device: {
            vendorId: device.vendorId,
            productId: device.productId,
            productName: device.productName || SUPPORTED_DEVICES.get(device.productId)
          }
        });
        state.hasSnapshot = true;
        status.update("saved", `History · ${result.count}`, result.stored ? `Saved: ${result.summary}` : "Configuration unchanged");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        status.update("error", "History error", message);
        root.console.error("Argos Desktop history capture failed:", error);
      } finally {
        state.auditPromise = null;
        if (state.dirty && state.timer === null) scheduleCapture(device, state, state.pendingReason);
      }
    })();
    state.auditPromise = promise;
    return promise;
  }

  function scheduleCapture(device, state, reason) {
    state.pendingReason = reason;
    state.dirty = true;
    if (state.timer !== null) root.clearTimeout(state.timer);
    state.timer = root.setTimeout(() => {
      state.timer = null;
      void capture(device, state);
    }, SNAPSHOT_DEBOUNCE_MS);
  }

  function observeResponse(device, state, request) {
    const prefix = expectedPrefix(request);
    let settled = false;
    const cleanup = () => {
      if (settled) return;
      settled = true;
      root.clearTimeout(timeout);
      device.removeEventListener("inputreport", onInputReport);
    };
    const onInputReport = (event) => {
      const bytes = responseBytes(event);
      if (!startsWith(bytes, prefix)) return;
      cleanup();
      if (!state.hasSnapshot || isMutation(request)) {
        scheduleCapture(device, state, state.hasSnapshot ? describeCommand(request) : "keyboard connected");
      }
    };
    const timeout = root.setTimeout(cleanup, 15000);
    device.addEventListener("inputreport", onInputReport);
    return cleanup;
  }

  root.HIDDevice.prototype.sendReport = async function auditedSendReport(reportId, data) {
    const device = this;
    if (!isSupportedDevice(device) || reportId !== REPORT_ID) {
      return originalSendReport.call(device, reportId, data);
    }
    const state = stateFor(device);
    const request = bytesFrom(data);
    const stopObserving = observeResponse(device, state, request);
    try {
      return await originalSendReport.call(device, reportId, data);
    } catch (error) {
      stopObserving();
      throw error;
    }
  };

  status.update("saved", "History · ready");
  return testApi;
});

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
  const REPORT_SIZE = 32;
  const RESPONSE_TIMEOUT_MS = 5000;
  const SNAPSHOT_DEBOUNCE_MS = 900;
  const DEVICE_LAYOUTS = new Map([
    [
      0x1832,
      {
        name: "Charybdis Nano",
        rows: 8,
        cols: 5,
        layers: ["base", "function", "navigation", "media", "pointer", "numeral", "symbols"],
        rgbMatrix: [
          null, null, null, null, null, null, null, null, null, null, null, null, null, null,
          null, null, null, null, [0, 4], [0, 3], [0, 2], [0, 1], [0, 0], [1, 0], [1, 1],
          [1, 2], [1, 3], [1, 4], [2, 4], [2, 3], [2, 2], [2, 1], [2, 0], [3, 2], [3, 0],
          [3, 1], null, null, null, null, null, null, null, null, null, null, null, null, null,
          null, null, null, null, null, [4, 4], [4, 3], [4, 2], [4, 1], [4, 0], [5, 0],
          [5, 1], [5, 2], [5, 3], [5, 4], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0], [7, 2],
          [7, 0], [7, 1]
        ]
      }
    ],
    [
      0x1833,
      {
        name: "Charybdis",
        rows: 10,
        cols: 6,
        layers: ["base", "lower", "raise", "pointer"],
        rgbMatrix: [
          [0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [2, 1], [1, 1], [0, 1], [0, 2], [1, 2],
          [2, 2], [3, 2], [3, 3], [2, 3], [1, 3], [0, 3], [0, 4], [1, 4], [2, 4], [3, 4],
          [0, 5], [1, 5], [2, 5], [3, 5], [4, 2], [4, 5], [4, 3], [4, 4], [4, 1], [5, 0],
          [6, 0], [7, 0], [8, 0], [8, 1], [7, 1], [6, 1], [5, 1], [5, 2], [6, 2], [7, 2],
          [8, 2], [8, 3], [7, 3], [6, 3], [5, 3], [5, 4], [6, 4], [7, 4], [8, 4], [5, 5],
          [6, 5], [7, 5], [8, 5], [9, 1], [9, 3], [9, 5]
        ]
      }
    ],
    [
      0x1836,
      {
        name: "Dilemma v3 3x5",
        rows: 8,
        cols: 5,
        layers: ["base", "function", "navigation", "media", "pointer", "numeral", "symbols"],
        rgbMatrix: [
          null, null, null, null, null, null, null, null, null, null, null, null, null, null,
          null, null, null, null, [0, 4], [0, 3], [0, 2], [0, 1], [0, 0], [1, 0], [1, 1],
          [1, 2], [1, 3], [1, 4], [2, 4], [2, 3], [2, 2], [2, 1], [2, 0], [3, 2], [3, 0],
          [3, 1], null, null, null, null, null, null, null, null, null, null, null, null, null,
          null, null, null, null, null, [4, 4], [4, 3], [4, 2], [4, 1], [4, 0], [5, 0],
          [5, 1], [5, 2], [5, 3], [5, 4], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0], [7, 2],
          [7, 0], [7, 1]
        ]
      }
    ]
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
    0x17
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

  function bigEndian(bytes, offset) {
    return (bytes[offset] << 8) | bytes[offset + 1];
  }

  function littleEndian(bytes, offset) {
    return bytes[offset] | (bytes[offset + 1] << 8);
  }

  function parseKeyboardInfo(response) {
    const data = response.slice(2);
    if (data.length < 15) throw new Error("Incomplete Argos keyboard-info response");
    const protocol = bigEndian(data, 0);
    return {
      protocol,
      tapDanceAmount: data[2],
      comboAmount: data[3],
      keysPerCombo: data[4],
      themeId: data[5],
      qmkKeycodesVersion: [data[6], data[7], data[8]],
      hasDisplayedWelcomeMessage: data[9] === 1,
      tappingTerm: bigEndian(data, 10),
      comboTerm: bigEndian(data, 12),
      isLeftHanded: data[14] === 1,
      autoMouseLayerEnabled: protocol >= 4 && data[15] === 1,
      autoPrecisionOnMouseLayerEnabled: protocol >= 4 && data[16] === 1
    };
  }

  function parseCombo(response, keysPerCombo) {
    const data = response.slice(2);
    if (data.length < 6 + keysPerCombo * 2) throw new Error("Incomplete Argos combo response");
    const input = [];
    let foundEmpty = false;
    for (let index = 0; index < keysPerCombo; index += 1) {
      const keycode = littleEndian(data, 6 + index * 2);
      if (keycode === 0) foundEmpty = true;
      input.push(foundEmpty ? 0 : keycode);
    }
    return {
      enabled: data[1] !== 0,
      output: littleEndian(data, 2),
      input,
      customTerm: littleEndian(data, 4)
    };
  }

  function parseTapDance(response) {
    const data = response.slice(2);
    if (data.length < 11) throw new Error("Incomplete Argos tap-dance response");
    return {
      on_tap: littleEndian(data, 1),
      on_hold: littleEndian(data, 3),
      on_double_tap: littleEndian(data, 5),
      on_tap_hold: littleEndian(data, 7),
      custom_tapping_term: littleEndian(data, 9)
    };
  }

  function parsePointingDevice(response) {
    const data = response.slice(2);
    if (data.length < 15) throw new Error("Incomplete Argos pointing-device response");
    return {
      pointingDeviceType: data[0],
      defaultDPI: littleEndian(data, 1),
      minimumDefaultDpi: littleEndian(data, 3),
      defaultDPIConfigStep: littleEndian(data, 5),
      snipingDPI: littleEndian(data, 7),
      minimumSnipingDPI: littleEndian(data, 9),
      snipingDPIConfigStep: littleEndian(data, 11),
      defaultDPIMaxSteps: data[13],
      snipingDPIMaxSteps: data[14]
    };
  }

  function makeReport(request) {
    if (request.length > REPORT_SIZE) throw new Error("Raw HID request exceeds 32 bytes");
    const report = new Uint8Array(REPORT_SIZE);
    report.set(request);
    return report;
  }

  function transact(device, rawSend, request, timeoutMs = RESPONSE_TIMEOUT_MS) {
    const prefix = expectedPrefix(request);
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        root.clearTimeout(timeout);
        device.removeEventListener("inputreport", onInputReport);
        callback(value);
      };
      const onInputReport = (event) => {
        const bytes = responseBytes(event);
        if (startsWith(bytes, prefix)) finish(resolve, bytes);
      };
      const timeout = root.setTimeout(
        () => finish(reject, new Error(`Timed out waiting for ${prefix.map((byte) => byte.toString(16)).join(" ")}`)),
        timeoutMs
      );
      device.addEventListener("inputreport", onInputReport);
      Promise.resolve(rawSend.call(device, REPORT_ID, makeReport(request))).catch((error) => finish(reject, error));
    });
  }

  async function readKeymap(device, rawSend, layerCount, rows, cols) {
    const byteCount = layerCount * rows * cols * 2;
    const keymapBytes = [];
    for (let offset = 0; offset < byteCount; offset += 22) {
      const size = Math.min(22, byteCount - offset);
      const response = await transact(device, rawSend, [0x12, offset >> 8, offset & 0xff, size]);
      keymapBytes.push(...response.slice(4, 4 + size));
    }

    const flatKeycodes = [];
    for (let offset = 0; offset < keymapBytes.length; offset += 2) {
      flatKeycodes.push(bigEndian(keymapBytes, offset));
    }
    const layerSize = rows * cols;
    return Array.from({ length: layerCount }, (_, layer) =>
      flatKeycodes.slice(layer * layerSize, (layer + 1) * layerSize)
    );
  }

  async function readRgb(device, rawSend, warnings) {
    const readValue = async (valueId) => transact(device, rawSend, [0x08, 0x03, valueId]);
    try {
      const brightness = await readValue(0x01);
      const effectType = await readValue(0x02);
      const effectSpeed = await readValue(0x03);
      const color = await readValue(0x04);
      return {
        rgbBrightness: brightness[3],
        rgbEffectSpeed: effectSpeed[3],
        rgbEffectType: effectType[3],
        rgbHue: color[3],
        rgbSat: color[4]
      };
    } catch (error) {
      warnings.push(`RGB settings could not be read: ${error instanceof Error ? error.message : String(error)}`);
      return {
        rgbBrightness: 50,
        rgbEffectSpeed: 50,
        rgbEffectType: 0,
        rgbHue: 0,
        rgbSat: 0
      };
    }
  }

  function parseRgbMatrixLed(response) {
    const data = response.slice(2);
    if (data.length < 6) throw new Error("Incomplete Argos RGB matrix LED response");
    return {
      r: data[0],
      g: data[1],
      b: data[2],
      transparent: data[3] !== 0,
      on: data[4] !== 0,
      custom: data[5] !== 0
    };
  }

  function rgbMatrixPositions(definition, matrixRows, layerCount) {
    const matrixEntries = [];
    const underglowEntries = [];
    for (let arrayIndex = 0; arrayIndex < definition.length; arrayIndex += 1) {
      const coordinate = definition[arrayIndex];
      if (!coordinate) {
        underglowEntries.push({ arrayIndex, index: arrayIndex, offset: 0 });
        continue;
      }

      const isLeftHalf = coordinate[0] < matrixRows / 2;
      const firstHalfIndex = definition.findIndex(
        (candidate) => candidate && (candidate[0] < matrixRows / 2) === isLeftHalf
      );
      const offset = Math.max(firstHalfIndex - 1, 0);
      matrixEntries.push({
        row: coordinate[0],
        column: coordinate[1],
        index: arrayIndex - offset,
        offset
      });
    }

    const positions = [];
    for (let layer = 0; layer < layerCount; layer += 1) {
      for (const entry of matrixEntries) {
        positions.push({ ...entry, layer, key: `${layer}:${entry.row}:${entry.column}` });
      }
      for (const entry of underglowEntries) {
        positions.push({ ...entry, layer, key: `${layer}:underglow:${entry.arrayIndex}` });
      }
    }
    return positions;
  }

  async function readRgbMatrix(device, rawSend, layout, layerCount) {
    const result = {};
    for (const position of rgbMatrixPositions(layout.rgbMatrix, layout.rows, layerCount)) {
      const response = await transact(device, rawSend, [
        ARGOS_PREFIX,
        0x14,
        position.layer,
        position.index,
        position.offset
      ]);
      result[position.key] = parseRgbMatrixLed(response);
    }
    return result;
  }

  async function readFullConfig(device, rawSend) {
    const layout = DEVICE_LAYOUTS.get(device.productId);
    if (!layout) {
      throw new Error(`Unsupported Argos keyboard product 0x${device.productId.toString(16).padStart(4, "0")}`);
    }
    const warnings = [];
    const viaResponse = await transact(device, rawSend, [0x01]);
    const viaProtocolVersion = bigEndian(viaResponse, 1);
    const info = parseKeyboardInfo(await transact(device, rawSend, [ARGOS_PREFIX, 0x01]));
    if (info.protocol === 0) throw new Error("Connected keyboard does not report Argos support");
    const layerResponse = await transact(device, rawSend, [0x11]);
    const layerCount = layerResponse[1];
    if (layerCount < 1 || layerCount > 32) throw new Error(`Invalid layer count: ${layerCount}`);

    const keycodes = await readKeymap(device, rawSend, layerCount, layout.rows, layout.cols);
    const combos = [];
    for (let index = 0; index < info.comboAmount; index += 1) {
      combos.push(parseCombo(await transact(device, rawSend, [ARGOS_PREFIX, 0x02, index]), info.keysPerCombo));
    }
    const tapDances = [];
    for (let index = 0; index < info.tapDanceAmount; index += 1) {
      tapDances.push(parseTapDance(await transact(device, rawSend, [ARGOS_PREFIX, 0x07, index])));
    }
    const pointing = parsePointingDevice(await transact(device, rawSend, [ARGOS_PREFIX, 0x0c]));
    const rgb = await readRgb(device, rawSend, warnings);
    const layerNames = Array.from({ length: layerCount }, (_, index) => layout.layers[index] ?? `layer ${index}`);
    const rgbMatrix = info.protocol >= 3 ? await readRgbMatrix(device, rawSend, layout, layerCount) : {};

    return {
      config: {
        viaProtocolVersion,
        argosProtocolVersion: info.protocol,
        qmkKeycodesVersion: info.qmkKeycodesVersion,
        tapDanceAmount: info.tapDanceAmount,
        comboAmount: info.comboAmount,
        keysPerCombo: info.keysPerCombo,
        themeId: info.themeId,
        ...rgb,
        ...pointing,
        keycodes,
        layerNames,
        combos,
        tapDances,
        rows: layout.rows,
        cols: layout.cols,
        hasDisplayedWelcomeMessage: info.hasDisplayedWelcomeMessage,
        tappingTerm: info.tappingTerm,
        comboTerm: info.comboTerm,
        isVIAOnly: false,
        isLeftHanded: info.isLeftHanded,
        autoMouseLayerEnabled: info.autoMouseLayerEnabled,
        autoPrecisionOnMouseLayerEnabled: info.autoPrecisionOnMouseLayerEnabled,
        rgbMatrix
      },
      warnings
    };
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
        0x17: "auto-precision change"
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
        #argos-desktop-history[data-state="saving"]::before { content: ""; display: inline-block;
          width: 7px; height: 7px; margin-right: 7px; border-radius: 50%; background: #f0b429; }
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
    parseKeyboardInfo,
    parseCombo,
    parseTapDance,
    parsePointingDevice,
    parseRgbMatrixLed,
    rgbMatrixPositions,
    readFullConfig,
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
        pendingReason: "keyboard connected"
      };
      states.set(device, state);
    }
    return state;
  }

  function isSupportedDevice(device) {
    return device?.vendorId === 0xa8f8 && DEVICE_LAYOUTS.has(device.productId);
  }

  function installAutoConnect() {
    const hid = root.navigator.hid;
    const originalRequestDevice = hid.requestDevice.bind(hid);
    const attemptedDevices = new Set();
    let scheduled = false;

    Object.defineProperty(hid, "requestDevice", {
      configurable: true,
      writable: true,
      value: (options) => requestAuthorizedDevice(hid, originalRequestDevice, options)
    });

    const deviceKey = (device) => `${device.vendorId}:${device.productId}`;
    const maybeConnect = async () => {
      scheduled = false;
      const device = selectAuthorizedDevice(await hid.getDevices());
      if (!device || attemptedDevices.has(deviceKey(device))) return;
      const connectButton = findConnectButton(root.document);
      if (!connectButton) return;
      attemptedDevices.add(deviceKey(device));
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
      attemptedDevices.delete(deviceKey(event.device));
      scheduleConnect();
    });
    hid.addEventListener("disconnect", (event) => {
      attemptedDevices.delete(deviceKey(event.device));
    });
    if (typeof root.MutationObserver === "function" && root.document?.body) {
      const observer = new root.MutationObserver(scheduleConnect);
      observer.observe(root.document.body, { childList: true, subtree: true });
    }
    scheduleConnect();
  }

  installAutoConnect();

  async function capture(device, state) {
    if (!device.opened || state.auditPromise) return;
    status.update("saving", "Saving history…");
    const reason = state.pendingReason;
    state.auditPromise = (async () => {
      const { config, warnings } = await readFullConfig(device, originalSendReport);
      const result = await auditApi.storeSnapshot({
        config,
        warnings,
        reason,
        device: {
          vendorId: device.vendorId,
          productId: device.productId,
          productName: device.productName || DEVICE_LAYOUTS.get(device.productId).name
        }
      });
      state.hasSnapshot = true;
      const label = result.stored ? `History · ${result.count}` : `History · ${result.count}`;
      status.update("saved", label, result.stored ? `Saved: ${result.summary}` : "Configuration unchanged");
    })();
    try {
      await state.auditPromise;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      status.update("error", "History error", message);
      root.console.error("Argos Desktop history capture failed:", error);
    } finally {
      state.auditPromise = null;
    }
  }

  function scheduleCapture(device, state, reason) {
    state.pendingReason = reason;
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
    if (state.auditPromise) await state.auditPromise;
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

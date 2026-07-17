const MAX_CONFIG_BYTES = 4 * 1024 * 1024;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireInteger(record, key, minimum = 0, maximum = 0xffff) {
  const value = record[key];
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`Invalid Argos config field: ${key}`);
  }
  return value;
}

function requireBoolean(record, key) {
  if (typeof record[key] !== "boolean") {
    throw new Error(`Invalid Argos config field: ${key}`);
  }
}

function requireStringArray(record, key, expectedLength) {
  const value = record[key];
  if (
    !Array.isArray(value) ||
    value.length !== expectedLength ||
    value.some((entry) => typeof entry !== "string" || entry.length > 80)
  ) {
    throw new Error(`Invalid Argos config field: ${key}`);
  }
}

function cloneJson(value) {
  let json;
  try {
    json = JSON.stringify(value);
  } catch {
    throw new Error("Argos snapshot is not JSON serializable");
  }
  if (json.length > MAX_CONFIG_BYTES) {
    throw new Error("Argos snapshot exceeds the 4 MiB safety limit");
  }
  const clone = JSON.parse(json);
  if (!isRecord(clone)) throw new Error("Argos snapshot must be an object");
  return clone;
}

function requireRgbMatrix(config, rows, cols) {
  if (!isRecord(config.rgbMatrix)) throw new Error("Invalid Argos config field: rgbMatrix");
  const entries = Object.entries(config.rgbMatrix);
  if (entries.length > 4096) throw new Error("Invalid Argos config field: rgbMatrix");

  for (const [key, state] of entries) {
    const match = /^(\d+):(?:(\d+):(\d+)|underglow:(\d+))$/.exec(key);
    if (!match || !isRecord(state)) throw new Error("Invalid Argos config field: rgbMatrix");
    const layer = Number(match[1]);
    const row = match[2] === undefined ? null : Number(match[2]);
    const column = match[3] === undefined ? null : Number(match[3]);
    const underglowIndex = match[4] === undefined ? null : Number(match[4]);
    if (
      layer >= config.keycodes.length ||
      (row !== null && (row >= rows || column >= cols)) ||
      (underglowIndex !== null && underglowIndex > 2048) ||
      ["r", "g", "b"].some(
        (channel) => !Number.isInteger(state[channel]) || state[channel] < 0 || state[channel] > 255
      ) ||
      ["transparent", "on", "custom"].some((flag) => typeof state[flag] !== "boolean")
    ) {
      throw new Error("Invalid Argos config field: rgbMatrix");
    }
  }
}

export function validateArgosConfig(value) {
  const config = cloneJson(value);
  const rows = requireInteger(config, "rows", 1, 64);
  const cols = requireInteger(config, "cols", 1, 64);

  for (const key of [
    "viaProtocolVersion",
    "argosProtocolVersion",
    "tapDanceAmount",
    "comboAmount",
    "keysPerCombo",
    "themeId",
    "rgbBrightness",
    "rgbEffectSpeed",
    "rgbEffectType",
    "rgbHue",
    "rgbSat",
    "pointingDeviceType",
    "defaultDPI",
    "minimumDefaultDpi",
    "defaultDPIConfigStep",
    "snipingDPI",
    "minimumSnipingDPI",
    "snipingDPIConfigStep",
    "defaultDPIMaxSteps",
    "snipingDPIMaxSteps",
    "tappingTerm",
    "comboTerm"
  ]) {
    requireInteger(config, key);
  }

  if (
    !Array.isArray(config.qmkKeycodesVersion) ||
    config.qmkKeycodesVersion.length !== 3 ||
    config.qmkKeycodesVersion.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    throw new Error("Invalid Argos config field: qmkKeycodesVersion");
  }

  if (
    !Array.isArray(config.keycodes) ||
    config.keycodes.length < 1 ||
    config.keycodes.length > 32 ||
    config.keycodes.some(
      (layer) =>
        !Array.isArray(layer) ||
        layer.length !== rows * cols ||
        layer.some((keycode) => !Number.isInteger(keycode) || keycode < 0 || keycode > 0xffff)
    )
  ) {
    throw new Error("Invalid Argos config field: keycodes");
  }
  requireStringArray(config, "layerNames", config.keycodes.length);

  if (
    !Array.isArray(config.combos) ||
    config.combos.length !== config.comboAmount ||
    config.combos.some(
      (combo) =>
        !isRecord(combo) ||
        typeof combo.enabled !== "boolean" ||
        !Number.isInteger(combo.output) ||
        combo.output < 0 ||
        combo.output > 0xffff ||
        !Number.isInteger(combo.customTerm) ||
        combo.customTerm < 0 ||
        combo.customTerm > 0xffff ||
        !Array.isArray(combo.input) ||
        combo.input.length !== config.keysPerCombo ||
        combo.input.some((keycode) => !Number.isInteger(keycode) || keycode < 0 || keycode > 0xffff)
    )
  ) {
    throw new Error("Invalid Argos config field: combos");
  }

  if (
    !Array.isArray(config.tapDances) ||
    config.tapDances.length !== config.tapDanceAmount ||
    config.tapDances.some(
      (dance) =>
        !isRecord(dance) ||
        ["on_tap", "on_hold", "on_double_tap", "on_tap_hold", "custom_tapping_term"].some(
          (key) => !Number.isInteger(dance[key]) || dance[key] < 0 || dance[key] > 0xffff
        )
    )
  ) {
    throw new Error("Invalid Argos config field: tapDances");
  }

  for (const key of [
    "hasDisplayedWelcomeMessage",
    "isVIAOnly",
    "isLeftHanded",
    "autoMouseLayerEnabled",
    "autoPrecisionOnMouseLayerEnabled"
  ]) {
    requireBoolean(config, key);
  }
  requireRgbMatrix(config, rows, cols);

  return config;
}

function cleanText(value, fallback, maximumLength) {
  if (typeof value !== "string") return fallback;
  const cleaned = value.replaceAll(/[\r\n\t]/g, " ").trim();
  return cleaned.slice(0, maximumLength) || fallback;
}

export function validateSnapshotPayload(value) {
  if (!isRecord(value)) throw new Error("Invalid Argos snapshot payload");
  const device = isRecord(value.device) ? value.device : {};
  const vendorId = Number.isInteger(device.vendorId) ? device.vendorId : 0;
  const productId = Number.isInteger(device.productId) ? device.productId : 0;
  if (vendorId < 0 || vendorId > 0xffff || productId < 0 || productId > 0xffff) {
    throw new Error("Invalid Argos snapshot device identifiers");
  }

  return {
    config: validateArgosConfig(value.config),
    device: {
      vendorId,
      productId,
      productName: cleanText(device.productName, "Argos keyboard", 120)
    },
    reason: cleanText(value.reason, "configuration change", 160),
    warnings: Array.isArray(value.warnings)
      ? value.warnings.map((warning) => cleanText(warning, "", 240)).filter(Boolean).slice(0, 12)
      : []
  };
}

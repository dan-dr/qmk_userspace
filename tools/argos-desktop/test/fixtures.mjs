export function makeConfig(overrides = {}) {
  return {
    viaProtocolVersion: 12,
    argosProtocolVersion: 2,
    qmkKeycodesVersion: [0, 0, 8],
    tapDanceAmount: 1,
    comboAmount: 1,
    keysPerCombo: 2,
    themeId: 16,
    rgbBrightness: 50,
    rgbEffectSpeed: 50,
    rgbEffectType: 0,
    rgbHue: 0,
    rgbSat: 0,
    pointingDeviceType: 2,
    defaultDPI: 400,
    minimumDefaultDpi: 400,
    defaultDPIConfigStep: 200,
    snipingDPI: 200,
    minimumSnipingDPI: 200,
    snipingDPIConfigStep: 100,
    defaultDPIMaxSteps: 16,
    snipingDPIMaxSteps: 4,
    keycodes: [[4, 5, 6, 7]],
    layerNames: ["base"],
    combos: [{ enabled: true, output: 40, input: [4, 5], customTerm: 0 }],
    tapDances: [
      { on_tap: 4, on_hold: 5, on_double_tap: 6, on_tap_hold: 7, custom_tapping_term: 175 }
    ],
    rows: 2,
    cols: 2,
    hasDisplayedWelcomeMessage: true,
    tappingTerm: 175,
    comboTerm: 42,
    isVIAOnly: false,
    isLeftHanded: false,
    autoMouseLayerEnabled: false,
    autoPrecisionOnMouseLayerEnabled: false,
    rgbMatrix: {},
    ...overrides
  };
}

export function makePayload(config = makeConfig()) {
  return {
    config,
    reason: "keymap change",
    warnings: [],
    device: {
      vendorId: 0xa8f8,
      productId: 0x1833,
      productName: "Charybdis"
    }
  };
}

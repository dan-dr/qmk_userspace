(() => {
  // Re-inject replaces a previous install (e.g. after updating the script).
  if (typeof globalThis.__argosChordCaptureDispose === "function") {
    globalThis.__argosChordCaptureDispose();
  }

  const ARGOS = 0x90;
  const GET_COMBO = 0x02;
  const CAPTURE_COMBO = 0x04;
  const SET_COMBO = 0x0e;
  const MOD = { ctrl: 0x0100, shift: 0x0200, alt: 0x0400, gui: 0x0800 };
  // Physical modifier codes → QMK keycodes. Do not preventDefault on these
  // keydowns: Chromium can drop shiftKey/ctrlKey for the following key.
  const MOD_CODES = {
    ControlLeft: { bit: MOD.ctrl, bare: 224 },
    ControlRight: { bit: MOD.ctrl, bare: 228 },
    ShiftLeft: { bit: MOD.shift, bare: 225 },
    ShiftRight: { bit: MOD.shift, bare: 229 },
    AltLeft: { bit: MOD.alt, bare: 226 },
    AltRight: { bit: MOD.alt, bare: 230 },
    MetaLeft: { bit: MOD.gui, bare: 227 },
    MetaRight: { bit: MOD.gui, bare: 231 }
  };
  const CODE_TO_KC = Object.fromEntries([
    ...[..."abcdefghijklmnopqrstuvwxyz"].map((c, i) => [`Key${c.toUpperCase()}`, 4 + i]),
    ...[..."1234567890"].map((c, i) => [`Digit${c}`, 30 + i]),
    ["Enter", 40],
    ["Escape", 41],
    ["Backspace", 42],
    ["Tab", 43],
    ["Space", 44],
    ["Minus", 45],
    ["Equal", 46],
    ["BracketLeft", 47],
    ["BracketRight", 48],
    ["Backslash", 49],
    ["Semicolon", 51],
    ["Quote", 52],
    ["Backquote", 53],
    ["Comma", 54],
    ["Period", 55],
    ["Slash", 56],
    ...Array.from({ length: 12 }, (_, i) => [`F${i + 1}`, 58 + i])
  ]);

  const onceWaiters = new WeakMap();
  const proto = HIDDevice.prototype;
  const origAdd = proto.addEventListener;
  const origRemove = proto.removeEventListener;
  const origSend = proto.sendReport;

  function bytesOf(data) {
    if (data instanceof Uint8Array) return data;
    if (ArrayBuffer.isView(data)) {
      return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    }
    return new Uint8Array(data);
  }

  function keysPerCombo() {
    return globalThis.__argosDesktopConfig?.keysPerCombo ?? 4;
  }

  proto.addEventListener = function (type, listener, options) {
    const once = options === true || options?.once === true;
    if (type === "inputreport" && once) {
      const wrap = (ev) => {
        onceWaiters.get(this)?.delete(wrap);
        listener.call(this, ev);
      };
      let set = onceWaiters.get(this);
      if (!set) onceWaiters.set(this, (set = new Set()));
      set.add(wrap);
      return origAdd.call(this, type, wrap, options);
    }
    return origAdd.call(this, type, listener, options);
  };

  proto.removeEventListener = function (type, listener, options) {
    return origRemove.call(this, type, listener, options);
  };

  function detachOnceWaiters(device) {
    const set = onceWaiters.get(device);
    if (!set?.size) return [];
    const saved = [...set];
    for (const handler of saved) {
      origRemove.call(device, "inputreport", handler, { once: true });
      set.delete(handler);
    }
    return saved;
  }

  function releaseWaiters(saved, cmd = CAPTURE_COMBO) {
    const view = new DataView(Uint8Array.of(ARGOS, cmd).buffer);
    for (const handler of saved) handler({ data: view });
  }

  async function hidCmd(device, send, cmd, payload = []) {
    const report = new Uint8Array(32);
    report[0] = ARGOS;
    report[1] = cmd;
    report.set(payload, 2);
    return new Promise(async (resolve, reject) => {
      const t = setTimeout(() => {
        device.removeEventListener("inputreport", onReport);
        reject(new Error("HID timeout"));
      }, 5000);
      function onReport(e) {
        const data = bytesOf(e.data);
        if (data[0] === ARGOS && data[1] === cmd) {
          clearTimeout(t);
          device.removeEventListener("inputreport", onReport);
          resolve(data);
        }
      }
      device.addEventListener("inputreport", onReport);
      await send.call(device, 0, report);
    });
  }

  function parseCombo(response) {
    const body = response.slice(3);
    const count = keysPerCombo();
    const input = [];
    let empty = false;
    for (let i = 0; i < count; i++) {
      const kc = body[6 + i * 2] | (body[7 + i * 2] << 8);
      empty ||= kc === 0;
      input.push(empty ? 0 : kc);
    }
    return {
      enabled: body[0] !== 0,
      output: body[1] | (body[2] << 8),
      customTerm: body[3] | (body[4] << 8),
      input
    };
  }

  async function writeCombo(device, send, index, combo) {
    const payload = [index, (combo.output >> 8) & 0xff, combo.output & 0xff];
    for (const kc of combo.input) payload.push((kc >> 8) & 0xff, kc & 0xff);
    await hidCmd(device, send, SET_COMBO, payload);
    const cached = globalThis.__argosDesktopConfig?.combos?.[index];
    if (cached) Object.assign(cached, combo);
  }

  function listenChord(timeoutMs = 4000) {
    return new Promise((resolve, reject) => {
      const heldMods = new Set();
      let bareTimer = null;
      let pendingBare = null;

      const cleanup = () => {
        clearTimeout(timer);
        clearTimeout(bareTimer);
        window.removeEventListener("keydown", onKeyDown, true);
        window.removeEventListener("keyup", onKeyUp, true);
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("Timed out — press a key within 4s"));
      }, timeoutMs);

      function finish(keycode) {
        cleanup();
        resolve(keycode);
      }

      function modBits() {
        let bits = 0;
        for (const code of heldMods) bits |= MOD_CODES[code].bit;
        return bits;
      }

      function onKeyDown(e) {
        if (e.repeat) return;
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopImmediatePropagation();
          cleanup();
          reject(new Error("Cancelled"));
          return;
        }

        const mod = MOD_CODES[e.code];
        if (mod) {
          // Keep native modifier state intact for the following key.
          clearTimeout(bareTimer);
          pendingBare = null;
          heldMods.add(e.code);
          return;
        }

        const base = CODE_TO_KC[e.code];
        if (base == null) return;

        e.preventDefault();
        e.stopImmediatePropagation();
        clearTimeout(bareTimer);
        pendingBare = null;
        finish(base | modBits());
      }

      function onKeyUp(e) {
        const mod = MOD_CODES[e.code];
        if (!mod) return;
        if (!heldMods.has(e.code)) return;
        heldMods.delete(e.code);

        // Modifier tapped alone: wait briefly so Shift→F still chords if F
        // arrives just after Shift is released.
        if (heldMods.size > 0) return;
        pendingBare = mod.bare;
        clearTimeout(bareTimer);
        bareTimer = setTimeout(() => {
          if (pendingBare != null) finish(pendingBare);
        }, 175);
      }

      window.addEventListener("keydown", onKeyDown, true);
      window.addEventListener("keyup", onKeyUp, true);
      console.log("[Argos Desktop] Chord capture armed — e.g. Shift+F, or Esc to cancel");
    });
  }

  proto.sendReport = async function (reportId, data) {
    const bytes = bytesOf(data);
    if (!(bytes[0] === ARGOS && bytes[1] === CAPTURE_COMBO)) {
      return origSend.call(this, reportId, data);
    }

    const comboIndex = bytes[2];
    const keyIndex = bytes[3];
    const saved = detachOnceWaiters(this);

    try {
      const current = parseCombo(await hidCmd(this, origSend, GET_COMBO, [comboIndex]));
      const keycode = await listenChord();
      if (keyIndex === 0) current.output = keycode;
      else current.input[keyIndex - 1] = keycode;
      await writeCombo(this, origSend, comboIndex, current);
      console.log(
        `[Argos Desktop] Combo ${comboIndex} ${
          keyIndex === 0 ? "output" : `input ${keyIndex}`
        } = 0x${keycode.toString(16).toUpperCase().padStart(4, "0")}`
      );
    } catch (err) {
      console.warn("[Argos Desktop]", String(err.message || err));
    } finally {
      releaseWaiters(saved, CAPTURE_COMBO);
    }
  };

  globalThis.__argosChordCaptureDispose = () => {
    proto.addEventListener = origAdd;
    proto.removeEventListener = origRemove;
    proto.sendReport = origSend;
    delete globalThis.__argosChordCaptureDispose;
    delete globalThis.__argosChordCapture;
  };
  globalThis.__argosChordCapture = true;
  console.log(
    "[Argos Desktop] Combo chord capture enabled — click a combo slot, then press mod+key"
  );
  return { ok: true, alreadyEnabled: false };
})();

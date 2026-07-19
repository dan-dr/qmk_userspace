function installArgosStateHook(root = globalThis) {
  const CACHE_KEY = "__argosDesktopConfig";
  if (root.__argosDesktopStateHookInstalled) return;
  root.__argosDesktopStateHookInstalled = true;

  const NativeProxy = root.Proxy;
  const isArgosConfig = (value) =>
    value !== null &&
    typeof value === "object" &&
    typeof value.viaProtocolVersion === "number" &&
    typeof value.argosProtocolVersion === "number" &&
    Array.isArray(value.qmkKeycodesVersion) &&
    Array.isArray(value.keycodes) &&
    Array.isArray(value.combos) &&
    Array.isArray(value.tapDances) &&
    Object.hasOwn(value, "rgbMatrix") &&
    Object.hasOwn(value, "pointingDeviceType");

  const remember = (target, proxy) => {
    if (!isArgosConfig(target)) return;
    Object.defineProperty(root, CACHE_KEY, {
      configurable: true,
      writable: true,
      value: proxy
    });
  };

  function ArgosDesktopProxy(target, handler) {
    const proxy = new NativeProxy(target, handler);
    remember(target, proxy);
    return proxy;
  }

  ArgosDesktopProxy.revocable = (target, handler) => {
    const result = NativeProxy.revocable(target, handler);
    remember(target, result.proxy);
    return result;
  };
  Object.setPrototypeOf(ArgosDesktopProxy, NativeProxy);
  root.Proxy = ArgosDesktopProxy;
}

if (typeof process === "object" && process.type === "renderer") {
  const { contextBridge, ipcRenderer } = require("electron/renderer");

  contextBridge.executeInMainWorld({ func: installArgosStateHook });

  contextBridge.exposeInMainWorld("argosAudit", {
    storeSnapshot: (payload) => ipcRenderer.invoke("audit:snapshot", payload),
    openHistory: () => ipcRenderer.invoke("history:open")
  });
} else if (typeof module === "object" && module.exports) {
  module.exports = { installArgosStateHook };
}

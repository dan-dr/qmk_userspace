const { contextBridge, ipcRenderer } = require("electron/renderer");
const { installArgosStateHook } = require("../injected/argos-state-hook.cjs");

contextBridge.executeInMainWorld({ func: installArgosStateHook });

contextBridge.exposeInMainWorld("argosAudit", {
  storeSnapshot: (payload) => ipcRenderer.invoke("audit:snapshot", payload),
  openHistory: () => ipcRenderer.invoke("history:open")
});

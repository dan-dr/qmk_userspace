const { contextBridge, ipcRenderer } = require("electron/renderer");

contextBridge.exposeInMainWorld("argosAudit", {
  storeSnapshot: (payload) => ipcRenderer.invoke("audit:snapshot", payload),
  openHistory: () => ipcRenderer.invoke("history:open")
});

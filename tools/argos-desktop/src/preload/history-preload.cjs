const { contextBridge, ipcRenderer } = require("electron/renderer");

contextBridge.exposeInMainWorld("historyApi", {
  list: () => ipcRenderer.invoke("history:list"),
  get: (id) => ipcRenderer.invoke("history:get", id),
  exportSnapshot: (id) => ipcRenderer.invoke("history:export-snapshot", id),
  exportAuditLog: () => ipcRenderer.invoke("history:export-audit-log"),
  reveal: () => ipcRenderer.invoke("history:reveal"),
  storageInfo: () => ipcRenderer.invoke("history:storage-info"),
  onChanged: (callback) => {
    const listener = (_event, record) => callback(record);
    ipcRenderer.on("history:changed", listener);
    return () => ipcRenderer.removeListener("history:changed", listener);
  }
});

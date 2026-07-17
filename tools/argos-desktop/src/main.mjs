import { app, BrowserWindow, dialog, ipcMain, Menu, session, shell } from "electron";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HistoryStore } from "./history-store.mjs";

const ARGOS_URL = "https://argos.bastardkb.com/";
const ARGOS_ORIGIN = new URL(ARGOS_URL).origin;
const APP_DIR = path.dirname(fileURLToPath(import.meta.url));
const ARGOS_PRELOAD = path.join(APP_DIR, "preload", "argos-preload.cjs");
const HISTORY_PRELOAD = path.join(APP_DIR, "preload", "history-preload.cjs");
const HISTORY_HTML = path.join(APP_DIR, "history", "index.html");
const AUDIT_SCRIPT_PATH = path.join(APP_DIR, "injected", "argos-audit.cjs");

app.setName("Argos Desktop");
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

let mainWindow = null;
let historyWindow = null;
let historyStore = null;
let auditScript = "";
const configuredSessions = new WeakSet();

function isArgosUrl(value) {
  try {
    return new URL(value).origin === ARGOS_ORIGIN;
  } catch {
    return false;
  }
}

function isTrustedArgosEvent(event) {
  return event.sender === mainWindow?.webContents && isArgosUrl(event.senderFrame?.url ?? "");
}

function isTrustedHistoryEvent(event) {
  return event.sender === historyWindow?.webContents;
}

function requireArgosEvent(event) {
  if (!isTrustedArgosEvent(event)) throw new Error("Untrusted Argos IPC origin");
}

function requireHistoryEvent(event) {
  if (!isTrustedHistoryEvent(event)) throw new Error("Untrusted history IPC origin");
}

function configureArgosSession(argosSession) {
  if (configuredSessions.has(argosSession)) return;
  configuredSessions.add(argosSession);

  argosSession.webRequest.onBeforeSendHeaders(
    { urls: [`${ARGOS_ORIGIN}/*`] },
    (details, callback) => {
      callback({
        requestHeaders: {
          ...details.requestHeaders,
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache",
          Expires: "0"
        }
      });
    }
  );

  argosSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin, details) => {
    if (permission !== "hid") return false;
    return isArgosUrl(details.securityOrigin ?? requestingOrigin);
  });
  argosSession.setDevicePermissionHandler((details) => {
    return (
      details.deviceType === "hid" &&
      isArgosUrl(details.origin) &&
      details.device?.vendorId === 0xa8f8
    );
  });
  argosSession.on("select-hid-device", async (event, details, callback) => {
    event.preventDefault();
    const devices = details.deviceList ?? [];
    if (devices.length === 0) {
      callback();
      return;
    }
    if (devices.length === 1) {
      callback(devices[0].deviceId);
      return;
    }

    const buttons = devices.map((device) => {
      const vendor = device.vendorId?.toString(16).padStart(4, "0") ?? "????";
      const product = device.productId?.toString(16).padStart(4, "0") ?? "????";
      return `${device.productName || device.deviceName || "HID device"} (${vendor}:${product})`;
    });
    buttons.push("Cancel");
    const result = await dialog.showMessageBox(mainWindow, {
      type: "question",
      title: "Connect Argos keyboard",
      message: "Choose the keyboard to configure",
      buttons,
      cancelId: buttons.length - 1,
      defaultId: 0,
      noLink: true
    });
    callback(result.response < devices.length ? devices[result.response].deviceId : undefined);
  });
}

function guardRemoteNavigation(window) {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (!isArgosUrl(url)) event.preventDefault();
  });
}

async function createMainWindow() {
  const argosSession = session.fromPartition("persist:argos-desktop", { cache: false });
  configureArgosSession(argosSession);
  await argosSession.clearCache();
  await argosSession.clearStorageData({ storages: ["serviceworkers", "cachestorage"] });
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 960,
    minWidth: 1050,
    minHeight: 720,
    show: false,
    backgroundColor: "#171a1f",
    title: "Argos Desktop",
    webPreferences: {
      session: argosSession,
      preload: ARGOS_PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  guardRemoteNavigation(mainWindow);
  mainWindow.webContents.on("page-title-updated", (event) => {
    event.preventDefault();
    mainWindow?.setTitle("Argos Desktop");
  });
  mainWindow.webContents.on("dom-ready", async () => {
    try {
      await mainWindow?.webContents.executeJavaScript(auditScript, true);
    } catch (error) {
      console.error("Could not install the Argos history bridge:", error);
    }
  });
  mainWindow.webContents.on("preload-error", (_event, preloadPath, error) => {
    console.error(`Preload failed: ${preloadPath}`, error);
  });
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  await mainWindow.loadURL(ARGOS_URL);
}

async function openHistoryWindow() {
  if (historyWindow && !historyWindow.isDestroyed()) {
    historyWindow.show();
    historyWindow.focus();
    return;
  }
  historyWindow = new BrowserWindow({
    width: 1040,
    height: 720,
    minWidth: 820,
    minHeight: 560,
    show: false,
    backgroundColor: "#111318",
    title: "Argos Configuration History",
    webPreferences: {
      preload: HISTORY_PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  historyWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  historyWindow.once("ready-to-show", () => historyWindow?.show());
  historyWindow.on("closed", () => {
    historyWindow = null;
  });
  await historyWindow.loadFile(HISTORY_HTML);
}

function defaultSnapshotName(createdAt) {
  return `argos_config_${createdAt.replaceAll(/[:.]/g, "-")}.json`;
}

function registerIpc() {
  ipcMain.handle("audit:snapshot", async (event, payload) => {
    requireArgosEvent(event);
    const result = await historyStore.appendSnapshot(payload);
    if (result.stored && historyWindow && !historyWindow.isDestroyed()) {
      historyWindow.webContents.send("history:changed", result);
    }
    return result;
  });
  ipcMain.handle("history:open", async (event) => {
    if (!isTrustedArgosEvent(event) && !isTrustedHistoryEvent(event)) {
      throw new Error("Untrusted history IPC origin");
    }
    await openHistoryWindow();
  });
  ipcMain.handle("history:list", (event) => {
    requireHistoryEvent(event);
    return historyStore.list();
  });
  ipcMain.handle("history:get", (event, id) => {
    requireHistoryEvent(event);
    return historyStore.get(id);
  });
  ipcMain.handle("history:storage-info", (event) => {
    requireHistoryEvent(event);
    return historyStore.storageInfo();
  });
  ipcMain.handle("history:export-snapshot", async (event, id) => {
    requireHistoryEvent(event);
    const snapshot = await historyStore.get(id);
    const result = await dialog.showSaveDialog(historyWindow, {
      title: "Export Argos configuration",
      defaultPath: defaultSnapshotName(snapshot.record.createdAt),
      filters: [{ name: "Argos configuration", extensions: ["json"] }]
    });
    if (result.canceled || !result.filePath) return { exported: false };
    await historyStore.exportSnapshot(id, result.filePath);
    return { exported: true, filePath: result.filePath };
  });
  ipcMain.handle("history:export-audit-log", async (event) => {
    requireHistoryEvent(event);
    const result = await dialog.showSaveDialog(historyWindow, {
      title: "Export Argos audit log",
      defaultPath: "argos_audit.jsonl",
      filters: [{ name: "JSON Lines", extensions: ["jsonl"] }]
    });
    if (result.canceled || !result.filePath) return { exported: false };
    await historyStore.exportAuditLog(result.filePath);
    return { exported: true, filePath: result.filePath };
  });
  ipcMain.handle("history:reveal", (event) => {
    requireHistoryEvent(event);
    shell.showItemInFolder(historyStore.storageInfo().latestPath);
  });
}

async function exportLatestFromMenu() {
  const latest = await historyStore.latest();
  if (!latest) {
    await dialog.showMessageBox(mainWindow, {
      type: "info",
      message: "No Argos snapshots yet",
      detail: "Connect a keyboard and make a change first."
    });
    return;
  }
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Export latest Argos configuration",
    defaultPath: defaultSnapshotName(latest.record.createdAt),
    filters: [{ name: "Argos configuration", extensions: ["json"] }]
  });
  if (!result.canceled && result.filePath) {
    await writeFile(result.filePath, `${JSON.stringify(latest.config, null, 2)}\n`, "utf8");
  }
}

function installMenu() {
  const template = [
    ...(process.platform === "darwin"
      ? [{ label: app.name, submenu: [{ role: "about" }, { type: "separator" }, { role: "quit" }] }]
      : []),
    {
      label: "File",
      submenu: [
        { label: "Configuration History", accelerator: "CmdOrCtrl+Shift+H", click: () => void openHistoryWindow() },
        { label: "Export Latest Configuration…", click: () => void exportLatestFromMenu() },
        { type: "separator" },
        { role: process.platform === "darwin" ? "close" : "quit" }
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "zoom" }, ...(process.platform === "darwin" ? [{ role: "front" }] : [])]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

if (hasSingleInstanceLock) {
  app.on("second-instance", () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      if (app.isReady()) void createMainWindow();
      return;
    }
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    auditScript = await readFile(AUDIT_SCRIPT_PATH, "utf8");
    historyStore = new HistoryStore(path.join(app.getPath("userData"), "audit"));
    await historyStore.init();
    registerIpc();
    installMenu();
    await createMainWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) void createMainWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}

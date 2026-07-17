const snapshotList = document.querySelector("#snapshot-list");
const emptyState = document.querySelector("#empty-state");
const detail = document.querySelector("#detail");
const detailPlaceholder = document.querySelector("#detail-placeholder");
const snapshotCount = document.querySelector("#snapshot-count");
const exportButton = document.querySelector("#export-button");
const auditButton = document.querySelector("#audit-button");
const revealButton = document.querySelector("#reveal-button");
const actionStatus = document.querySelector("#action-status");
const storagePath = document.querySelector("#storage-path");
const diffList = document.querySelector("#diff-list");
const configJson = document.querySelector("#config-json");
const warningList = document.querySelector("#warning-list");

let records = [];
let selectedId = null;

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "medium"
});
const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

function setStatus(message) {
  actionStatus.textContent = message;
  if (message) window.setTimeout(() => {
    if (actionStatus.textContent === message) actionStatus.textContent = "";
  }, 5000);
}

function formatValue(value) {
  if (value === undefined) return "undefined";
  const formatted = JSON.stringify(value);
  return formatted.length > 240 ? `${formatted.slice(0, 237)}…` : formatted;
}

function makeSnapshotButton(record) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `snapshot${record.id === selectedId ? " active" : ""}`;
  button.dataset.id = record.id;

  const dot = document.createElement("span");
  dot.className = "snapshot-dot";
  const content = document.createElement("span");
  const title = document.createElement("span");
  title.className = "snapshot-title";
  title.textContent = record.summary;
  const meta = document.createElement("span");
  meta.className = "snapshot-meta";
  const time = document.createElement("span");
  time.textContent = shortDateFormatter.format(new Date(record.createdAt));
  const count = document.createElement("span");
  count.textContent = record.changeCount === 0 ? "baseline" : `${record.changeCount} edits`;
  meta.append(time, count);
  content.append(title, meta);
  button.append(dot, content);
  button.addEventListener("click", () => void selectSnapshot(record.id));
  return button;
}

function renderTimeline() {
  snapshotList.replaceChildren(...records.map(makeSnapshotButton));
  snapshotCount.textContent = String(records.length);
  emptyState.hidden = records.length !== 0;
  snapshotList.hidden = records.length === 0;
}

function renderDiff(changes) {
  if (changes.length === 0) {
    const empty = document.createElement("p");
    empty.className = "diff-empty";
    empty.textContent = "Baseline snapshot. This is the first complete configuration in local history.";
    diffList.replaceChildren(empty);
    return;
  }

  const rows = changes.map((change) => {
    const row = document.createElement("div");
    row.className = "diff-row";
    row.dataset.op = change.op;
    const operation = document.createElement("span");
    operation.className = "diff-operation";
    operation.textContent = change.op;
    const path = document.createElement("code");
    path.className = "diff-path";
    path.textContent = change.path;
    const values = document.createElement("span");
    values.className = "diff-values";
    if ("oldValue" in change) {
      const oldValue = document.createElement("span");
      oldValue.className = "diff-value old";
      oldValue.textContent = formatValue(change.oldValue);
      oldValue.title = JSON.stringify(change.oldValue);
      values.appendChild(oldValue);
    }
    if ("value" in change) {
      const value = document.createElement("span");
      value.className = "diff-value";
      value.textContent = formatValue(change.value);
      value.title = JSON.stringify(change.value);
      values.appendChild(value);
    }
    row.append(operation, path, values);
    return row;
  });
  diffList.replaceChildren(...rows);
}

function renderWarnings(warnings) {
  warningList.hidden = warnings.length === 0;
  warningList.replaceChildren(...warnings.map((warning) => {
    const row = document.createElement("div");
    row.textContent = warning;
    return row;
  }));
}

async function selectSnapshot(id) {
  selectedId = id;
  renderTimeline();
  try {
    const snapshot = await window.historyApi.get(id);
    document.querySelector("#detail-time").textContent = dateFormatter.format(new Date(snapshot.record.createdAt));
    document.querySelector("#detail-summary").textContent = snapshot.record.summary;
    document.querySelector("#detail-reason").textContent = `${snapshot.record.device.productName} · ${snapshot.record.reason}`;
    document.querySelector("#detail-hash").textContent = snapshot.record.hash;
    renderWarnings(snapshot.record.warnings ?? []);
    renderDiff(snapshot.record.changes);
    configJson.textContent = JSON.stringify(snapshot.config, null, 2);
    detail.hidden = false;
    detailPlaceholder.hidden = true;
    exportButton.disabled = false;
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error));
  }
}

async function refresh() {
  records = await window.historyApi.list();
  renderTimeline();
  if (records.length > 0) {
    const target = records.some((record) => record.id === selectedId) ? selectedId : records[0].id;
    await selectSnapshot(target);
  } else {
    detail.hidden = true;
    detailPlaceholder.hidden = false;
    exportButton.disabled = true;
  }
}

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab === button));
    document.querySelector("#diff-view").hidden = button.dataset.tab !== "diff";
    document.querySelector("#config-view").hidden = button.dataset.tab !== "config";
  });
});

exportButton.addEventListener("click", async () => {
  if (!selectedId) return;
  const result = await window.historyApi.exportSnapshot(selectedId);
  setStatus(result.exported ? `Exported to ${result.filePath}` : "Export canceled");
});

auditButton.addEventListener("click", async () => {
  const result = await window.historyApi.exportAuditLog();
  setStatus(result.exported ? `Audit log exported to ${result.filePath}` : "Export canceled");
});

revealButton.addEventListener("click", () => window.historyApi.reveal());
window.historyApi.onChanged(() => void refresh());

Promise.all([window.historyApi.storageInfo(), refresh()])
  .then(([info]) => {
    storagePath.textContent = info.rootPath;
    storagePath.title = info.rootPath;
  })
  .catch((error) => setStatus(error instanceof Error ? error.message : String(error)));

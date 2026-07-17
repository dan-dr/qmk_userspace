import { appendFile, copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { canonicalJson, diffJson, summarizeDiff } from "./diff.mjs";
import { validateSnapshotPayload } from "./validation.mjs";

const AUDIT_LOG = "audit.jsonl";

function deviceKey(device) {
  return `${device.vendorId.toString(16).padStart(4, "0")}-${device.productId
    .toString(16)
    .padStart(4, "0")}`;
}

function hashConfig(config) {
  return createHash("sha256").update(canonicalJson(config)).digest("hex");
}

function snapshotId(createdAt, hash) {
  return `${createdAt.replaceAll(/[:.]/g, "-")}_${hash.slice(0, 12)}`;
}

async function atomicWrite(filePath, contents) {
  const temporaryPath = `${filePath}.tmp-${process.pid}-${randomUUID()}`;
  await writeFile(temporaryPath, contents, { encoding: "utf8", mode: 0o600 });
  await rename(temporaryPath, filePath);
}

function isSnapshotId(value) {
  return typeof value === "string" && /^[0-9TZ-]+_[a-f0-9]{12}$/.test(value);
}

export class HistoryStore {
  constructor(rootPath, now = () => new Date()) {
    this.rootPath = rootPath;
    this.now = now;
    this.records = [];
    this.queue = Promise.resolve();
  }

  get auditLogPath() {
    return path.join(this.rootPath, AUDIT_LOG);
  }

  get snapshotsPath() {
    return path.join(this.rootPath, "snapshots");
  }

  async init() {
    await mkdir(this.snapshotsPath, { recursive: true, mode: 0o700 });
    try {
      const contents = await readFile(this.auditLogPath, "utf8");
      this.records = contents
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      this.records = [];
    }
  }

  appendSnapshot(payload) {
    const operation = this.queue.then(() => this.#appendSnapshot(payload));
    this.queue = operation.catch(() => {});
    return operation;
  }

  async #appendSnapshot(payload) {
    const normalized = validateSnapshotPayload(payload);
    const hash = hashConfig(normalized.config);
    const normalizedDeviceKey = deviceKey(normalized.device);
    const previous = this.records.findLast((record) => deviceKey(record.device) === normalizedDeviceKey);
    if (previous?.hash === hash) {
      return { stored: false, id: previous.id, count: this.records.length, summary: "No change" };
    }

    const createdAt = this.now().toISOString();
    const id = snapshotId(createdAt, hash);
    const fileName = `${id}.json`;
    const filePath = path.join(this.snapshotsPath, fileName);
    let previousConfig = null;
    if (previous) {
      previousConfig = JSON.parse(await readFile(path.join(this.snapshotsPath, previous.fileName), "utf8"));
    }
    const changes = previousConfig ? diffJson(previousConfig, normalized.config) : [];
    const record = {
      id,
      createdAt,
      hash,
      previousHash: previous?.hash ?? null,
      fileName,
      device: normalized.device,
      reason: normalized.reason,
      warnings: normalized.warnings,
      summary: summarizeDiff(changes),
      changes
    };
    const configJson = `${JSON.stringify(normalized.config, null, 2)}\n`;

    await atomicWrite(filePath, configJson);
    await appendFile(this.auditLogPath, `${JSON.stringify(record)}\n`, { encoding: "utf8", mode: 0o600 });
    this.records.push(record);
    await atomicWrite(path.join(this.rootPath, "latest.json"), configJson);

    return { stored: true, id, count: this.records.length, summary: record.summary };
  }

  list() {
    return [...this.records].reverse().map(({ changes, fileName, ...record }) => ({
      ...record,
      changeCount: changes.length
    }));
  }

  async get(id) {
    if (!isSnapshotId(id)) throw new Error("Invalid snapshot identifier");
    const record = this.records.find((candidate) => candidate.id === id);
    if (!record) throw new Error("Snapshot not found");
    const config = JSON.parse(await readFile(path.join(this.snapshotsPath, record.fileName), "utf8"));
    return { record, config };
  }

  async latest() {
    const record = this.records.at(-1);
    return record ? this.get(record.id) : null;
  }

  async exportSnapshot(id, destination) {
    const { config } = await this.get(id);
    await writeFile(destination, `${JSON.stringify(config, null, 2)}\n`, { encoding: "utf8" });
  }

  async exportAuditLog(destination) {
    if (this.records.length === 0) {
      await writeFile(destination, "", { encoding: "utf8" });
      return;
    }
    await copyFile(this.auditLogPath, destination);
  }

  storageInfo() {
    return {
      rootPath: this.rootPath,
      auditLogPath: this.auditLogPath,
      latestPath: path.join(this.rootPath, "latest.json"),
      count: this.records.length
    };
  }
}

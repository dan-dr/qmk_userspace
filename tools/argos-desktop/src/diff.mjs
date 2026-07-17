function escapeJsonPointer(segment) {
  return String(segment).replaceAll("~", "~0").replaceAll("/", "~1");
}

function pathFor(parent, key) {
  return `${parent}/${escapeJsonPointer(key)}`;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function diffJson(before, after, path = "") {
  if (Object.is(before, after)) {
    return [];
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    const changes = [];
    const commonLength = Math.min(before.length, after.length);
    for (let index = 0; index < commonLength; index += 1) {
      changes.push(...diffJson(before[index], after[index], pathFor(path, index)));
    }
    for (let index = before.length - 1; index >= after.length; index -= 1) {
      changes.push({ op: "remove", path: pathFor(path, index), oldValue: before[index] });
    }
    for (let index = commonLength; index < after.length; index += 1) {
      changes.push({ op: "add", path: pathFor(path, index), value: after[index] });
    }
    return changes;
  }

  if (isPlainObject(before) && isPlainObject(after)) {
    const changes = [];
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of [...keys].sort()) {
      const childPath = pathFor(path, key);
      if (!(key in after)) {
        changes.push({ op: "remove", path: childPath, oldValue: before[key] });
      } else if (!(key in before)) {
        changes.push({ op: "add", path: childPath, value: after[key] });
      } else {
        changes.push(...diffJson(before[key], after[key], childPath));
      }
    }
    return changes;
  }

  return [{ op: "replace", path: path || "/", oldValue: before, value: after }];
}

function categoryFor(path) {
  if (path.startsWith("/keycodes")) return "keymap";
  if (path.startsWith("/combos")) return "combo";
  if (path.startsWith("/tapDances")) return "tap dance";
  if (path.startsWith("/rgb")) return "RGB";
  if (path.toLowerCase().includes("dpi") || path.startsWith("/pointingDevice")) return "pointer";
  if (path.endsWith("Term")) return "timing";
  if (path.startsWith("/auto")) return "pointer";
  return "setting";
}

export function summarizeDiff(changes) {
  if (changes.length === 0) return "Initial snapshot";

  const counts = new Map();
  for (const change of changes) {
    const category = categoryFor(change.path);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([category, count]) => `${count} ${category}${count === 1 ? "" : " changes"}`)
    .join(", ");
}

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isPlainObject(value)) return value;

  const result = {};
  for (const key of Object.keys(value).sort()) {
    result[key] = canonicalize(value[key]);
  }
  return result;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

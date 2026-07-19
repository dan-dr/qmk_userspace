import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { injectMenuScripts } from "./injected/menu/manifest.mjs";

const MENU_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "injected", "menu");

/**
 * Load inject-menu script sources once at app startup.
 * @returns {Promise<Array<{ id: string, label: string, detail: string, source: string }>>}
 */
export async function loadInjectMenuScripts() {
  return Promise.all(
    injectMenuScripts.map(async (entry) => {
      const source = await readFile(path.join(MENU_DIR, entry.file), "utf8");
      return {
        id: entry.id,
        label: entry.label,
        detail: entry.detail ?? "",
        source
      };
    })
  );
}

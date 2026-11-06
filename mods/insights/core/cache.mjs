import { readFile, stat } from "node:fs/promises";
import { atomicWriteJson, hashKey } from "./util.mjs";

// Disposable sidecars, not another source of truth. Include the implementation
// and timezone in the revision so upgrades/accounting changes invalidate them.
export const CACHE_VERSION = 1;
const implementation = [
  "../collector.mjs", "../presenter.mjs", "../analytics.js",
  "./cache.mjs", "./config.mjs", "./store.mjs", "./scan.mjs", "./adapters.mjs", "./util.mjs",
].map((file) => new URL(file, import.meta.url));

export async function cacheRevision(storePath) {
  try {
    const files = await Promise.all([storePath, ...implementation].map((file) => stat(file)));
    return hashKey(CACHE_VERSION, Intl.DateTimeFormat().resolvedOptions().timeZone,
      files.map((file) => [file.dev, file.ino, file.size, file.mtimeMs, file.ctimeMs]));
  } catch {
    return null;
  }
}

export function cachePath(storePath, kind) {
  return `${storePath}.${kind}.json`;
}

export async function readCache(storePath, kind, revision) {
  if (!revision) return null;
  try {
    const cached = JSON.parse(await readFile(cachePath(storePath, kind), "utf8"));
    return cached.version === CACHE_VERSION && cached.revision === revision ? cached.value : null;
  } catch {
    return null;
  }
}

export async function writeCache(storePath, kind, revision, value) {
  if (!revision) return;
  try {
    await atomicWriteJson(cachePath(storePath, kind), { version: CACHE_VERSION, revision, value });
  } catch {
    // A missing, corrupt or unwritable cache must never break collection.
  }
}

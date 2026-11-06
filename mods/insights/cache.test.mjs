import assert from "node:assert/strict";
import { appendFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { collectSnapshot } from "./collector.mjs";
import { run } from "./presenter.mjs";

async function fixture(t, adapter = "pi") {
  const home = await mkdtemp(path.join(os.tmpdir(), "insights-"));
  t.after(() => rm(home, { recursive: true, force: true }));
  return { home, store: path.join(home, "insights.json"), config: {
    sources: [{ id: adapter, label: adapter, adapter, enabled: true, roots: [home] }],
  } };
}

async function dashboard(f, command = "prepare", options = {}) {
  const result = await run([command, "--store", f.store, "--home", f.home, "--options", JSON.stringify(options)]);
  assert.equal(result.exitCode, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.error, null);
  return payload.dashboard;
}

test("incremental refresh keeps cached dashboards fresh and recovers corrupt caches", async (t) => {
  const f = await fixture(t);
  const file = path.join(f.home, "session.jsonl");
  const usage = (id, input) => JSON.stringify({ type: "usage", id, timestamp: "2026-01-15T12:00:00Z", usage: { input } }) + "\n";
  await writeFile(file, usage("first", 10));
  await collectSnapshot("configure", f);
  const first = await dashboard(f, "snapshot");
  assert.deepEqual(await dashboard(f), first);
  assert.equal((await collectSnapshot("snapshot", f)).stats.bytesRead, 0);

  const extra = usage("second", 20);
  await appendFile(file, extra);
  const refreshed = await collectSnapshot("snapshot", f);
  assert.equal(refreshed.stats.bytesRead, Buffer.byteLength(extra));
  assert.equal((await dashboard(f)).lifetime.input, 30);
  for (const kind of ["snapshot", "dashboard"]) await writeFile(`${f.store}.${kind}.json`, "broken");
  assert.equal((await dashboard(f)).lifetime.input, 30);
});

test("OpenCode's current schema reports reasoning once and supports the Agent filter", async (t) => {
  let DatabaseSync;
  try { ({ DatabaseSync } = await import("node:sqlite")); }
  catch { t.skip("node:sqlite unavailable"); return; }
  const f = await fixture(t, "opencode");
  const db = new DatabaseSync(path.join(f.home, "opencode.db"));
  t.after(() => db.close());
  db.exec(`
    CREATE TABLE session_v2 (id TEXT PRIMARY KEY, directory TEXT);
    CREATE TABLE session_message (id TEXT PRIMARY KEY, session_id TEXT, type TEXT, time_created INTEGER, data TEXT);
    INSERT INTO session_v2 VALUES ('session', '/project');
  `);
  const data = { model: { providerID: "test", id: "model" }, tokens: { input: 10, output: 5, reasoning: 2 } };
  db.prepare("INSERT INTO session_message VALUES ('message', 'session', 'assistant', ?, ?)")
    .run(Date.parse("2026-01-15T12:00:00Z"), JSON.stringify(data));
  const snapshot = await collectSnapshot("configure", f);
  assert.equal(snapshot.stats.errors, 0);
  assert.equal(snapshot.rows[0].tokens.total, 17);
  assert.equal(snapshot.rows[0].project, "/project");
  assert.equal((await dashboard(f, "prepare", { filters: { source: "opencode" } })).totals.input, 10);
  const excluded = await dashboard(f, "prepare", { filters: { source: "pi" } });
  assert.equal(excluded.totals.input, 0);
  assert.equal(excluded.lifetime.input, 10);
});

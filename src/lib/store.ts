import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { DashboardData, Match, Mode } from "./model";
import type { ProviderSnapshot } from "./providers/contract";
let db: DatabaseSync | undefined;
export function database() {
  if (db) return db;
  // This is runtime state, never a build input or a file to bundle.
  const path = resolve(
    /* turbopackIgnore: true */ process.env.DATABASE_PATH ??
      "data/frag-court.sqlite",
  );
  mkdirSync(dirname(path), { recursive: true });
  db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS matches (mode TEXT NOT NULL, id TEXT NOT NULL, act TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(mode,id));
    CREATE TABLE IF NOT EXISTS snapshots (mode TEXT PRIMARY KEY, payload TEXT NOT NULL, last_sync TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS identities (riot_id TEXT PRIMARY KEY, puuid TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS locks (mode TEXT PRIMARY KEY, expires INTEGER NOT NULL);`);
  return db;
}
export function readSnapshot(mode: Mode): DashboardData | null {
  const d = database();
  const row = d
    .prepare("SELECT payload,last_sync FROM snapshots WHERE mode=?")
    .get(mode) as { payload: string; last_sync: string } | undefined;
  if (!row) return null;
  const snapshot: ProviderSnapshot = JSON.parse(row.payload);
  const matches = (
    d
      .prepare("SELECT payload FROM matches WHERE mode=? AND act=?")
      .all(mode, snapshot.act.id) as { payload: string }[]
  ).map((r) => JSON.parse(r.payload) as Match);
  return {
    ...snapshot,
    mode,
    matches: matches.sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    lastSync: row.last_sync,
  };
}
export function saveSnapshot(mode: Mode, snapshot: ProviderSnapshot): number {
  const d = database();
  let added = 0;
  d.exec("BEGIN IMMEDIATE");
  try {
    const insert = d.prepare(
      "INSERT OR IGNORE INTO matches(mode,id,act,payload) VALUES(?,?,?,?)",
    );
    const update = d.prepare(
      "UPDATE matches SET act=?,payload=? WHERE mode=? AND id=? AND payload<>?",
    );
    for (const m of snapshot.matches) {
      const payload = JSON.stringify(m);
      added += Number(insert.run(mode, m.id, m.actId, payload).changes);
      update.run(m.actId, payload, mode, m.id, payload);
    }
    d.prepare(
      "INSERT OR REPLACE INTO snapshots(mode,payload,last_sync) VALUES(?,?,?)",
    ).run(
      mode,
      JSON.stringify({ ...snapshot, matches: [] }),
      new Date().toISOString(),
    );
    d.exec("COMMIT");
    return added;
  } catch (error) {
    d.exec("ROLLBACK");
    throw error;
  }
}
export async function resolveIdentity(
  name: string,
  tag: string,
  fetcher: () => Promise<string>,
) {
  const key = `${name}#${tag}`.toLowerCase(),
    d = database();
  const found = d
    .prepare("SELECT puuid FROM identities WHERE riot_id=?")
    .get(key) as { puuid: string } | undefined;
  if (found) return found.puuid;
  const id = await fetcher();
  d.prepare("INSERT OR REPLACE INTO identities VALUES(?,?)").run(key, id);
  return id;
}
export function acquireLock(mode: Mode): boolean {
  const now = Date.now();
  return (
    Number(
      database()
        .prepare(
          "INSERT INTO locks VALUES(?,?) ON CONFLICT(mode) DO UPDATE SET expires=excluded.expires WHERE locks.expires < ?",
        )
        .run(mode, now + 30 * 60 * 1000, now).changes,
    ) > 0
  );
}
export function releaseLock(mode: Mode) {
  database().prepare("DELETE FROM locks WHERE mode=?").run(mode);
}

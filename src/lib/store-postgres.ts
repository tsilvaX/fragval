import "server-only";
import { randomUUID } from "node:crypto";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { CourtStore } from "./persistence";
import type { Match, Mode } from "./model";
import type { ProviderSnapshot } from "./providers/contract";

const connections = new Map<
  string,
  { sql: NeonQueryFunction<false, false>; ready: Promise<unknown> }
>();
function connection(url: string) {
  const existing = connections.get(url);
  if (existing) return existing;
  const sql = neon(url);
  const ready = sql
    .transaction([
      sql`CREATE TABLE IF NOT EXISTS court_matches (mode TEXT NOT NULL, id TEXT NOT NULL, act TEXT NOT NULL, payload JSONB NOT NULL, PRIMARY KEY(mode, id))`,
      sql`CREATE INDEX IF NOT EXISTS court_matches_act ON court_matches(mode, act)`,
      sql`CREATE TABLE IF NOT EXISTS court_snapshots (mode TEXT PRIMARY KEY, payload JSONB NOT NULL, last_sync TIMESTAMPTZ NOT NULL DEFAULT now())`,
      sql`CREATE TABLE IF NOT EXISTS court_identities (riot_id TEXT PRIMARY KEY, puuid TEXT NOT NULL)`,
      sql`CREATE TABLE IF NOT EXISTS court_locks (mode TEXT PRIMARY KEY, owner TEXT NOT NULL, expires TIMESTAMPTZ NOT NULL)`,
    ])
    .catch((error) => {
      connections.delete(url);
      throw error;
    });
  const result = { sql, ready };
  connections.set(url, result);
  return result;
}

export function createPostgresStore(url: string): CourtStore {
  const owners = new Map<Mode, string>();
  async function database() {
    const { sql, ready } = connection(url);
    await ready;
    return sql;
  }
  return {
    async readSnapshot(mode) {
      const sql = await database();
      // One statement reads metadata and matches from the same MVCC snapshot.
      const rows = await sql`
        SELECT s.payload, s.last_sync,
          COALESCE((SELECT jsonb_agg(m.payload ORDER BY m.payload->>'startedAt' DESC)
            FROM court_matches m WHERE m.mode = s.mode AND m.act = s.payload->'act'->>'id'), '[]'::jsonb) AS matches
        FROM court_snapshots s WHERE s.mode = ${mode}`;
      if (!rows.length) return null;
      const row = rows[0] as {
        payload: ProviderSnapshot;
        last_sync: string;
        matches: Match[];
      };
      return {
        ...row.payload,
        mode,
        matches: row.matches,
        lastSync: new Date(row.last_sync).toISOString(),
      };
    },
    async saveSnapshot(mode, snapshot) {
      const sql = await database();
      const results = await sql.transaction([
        sql`INSERT INTO court_matches (mode, id, act, payload)
          SELECT ${mode}, entry->>'id', entry->>'actId', entry
          FROM jsonb_array_elements(${JSON.stringify(snapshot.matches)}::jsonb) AS entry
          ON CONFLICT (mode, id) DO NOTHING RETURNING id`,
        sql`UPDATE court_matches m SET act = entry->>'actId', payload = entry
          FROM jsonb_array_elements(${JSON.stringify(snapshot.matches)}::jsonb) AS entry
          WHERE m.mode = ${mode} AND m.id = entry->>'id' AND m.payload IS DISTINCT FROM entry`,
        sql`INSERT INTO court_snapshots (mode, payload, last_sync)
          VALUES (${mode}, ${JSON.stringify({ ...snapshot, matches: [] })}::jsonb, now())
          ON CONFLICT (mode) DO UPDATE SET payload = EXCLUDED.payload, last_sync = EXCLUDED.last_sync`,
      ]);
      return results[0].length;
    },
    async resolveIdentity(name, tag, fetcher) {
      const sql = await database();
      const key = `${name}#${tag}`.toLowerCase();
      const found =
        await sql`SELECT puuid FROM court_identities WHERE riot_id = ${key}`;
      if (found.length) return found[0].puuid as string;
      const id = await fetcher();
      const rows =
        await sql`INSERT INTO court_identities (riot_id, puuid) VALUES (${key}, ${id})
        ON CONFLICT (riot_id) DO UPDATE SET puuid = court_identities.puuid RETURNING puuid`;
      return rows[0].puuid as string;
    },
    async acquireLock(mode) {
      const sql = await database();
      const owner = randomUUID();
      const rows =
        await sql`INSERT INTO court_locks (mode, owner, expires) VALUES (${mode}, ${owner}, now() + interval '30 minutes')
        ON CONFLICT (mode) DO UPDATE SET owner = EXCLUDED.owner, expires = EXCLUDED.expires
        WHERE court_locks.expires < now() RETURNING owner`;
      if (!rows.length) return false;
      owners.set(mode, owner);
      return true;
    },
    async releaseLock(mode) {
      const owner = owners.get(mode);
      if (!owner) return;
      const sql = await database();
      await sql`DELETE FROM court_locks WHERE mode = ${mode} AND owner = ${owner}`;
      owners.delete(mode);
    },
  };
}

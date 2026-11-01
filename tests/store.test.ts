import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fixtureAct, fixtureMatches } from "../src/lib/fixtures";
import { fixtureFriends } from "../src/config/players";
import {
  database,
  saveSnapshot,
  readSnapshot,
  acquireLock,
  releaseLock,
  resolveIdentity,
} from "../src/lib/store";
const directory = mkdtempSync(join(tmpdir(), "frag-court-tests-"));
process.env.DATABASE_PATH = join(directory, "test.sqlite");
test("SQLite deduplicates match IDs, keeps provider namespaces separate, and filters act", async (t) => {
  t.after(() => {
    database().close();
    rmSync(directory, { recursive: true, force: true });
  });
  const snapshot = {
    act: fixtureAct,
    friends: fixtureFriends,
    matches: fixtureMatches(),
    coverage: "test",
    warnings: [],
  };
  assert.equal(saveSnapshot("fixture", snapshot), 36);
  assert.equal(saveSnapshot("fixture", snapshot), 0);
  assert.equal(readSnapshot("fixture")?.matches.length, 36);
  assert.equal(readSnapshot("henrik"), null);
  assert.equal(saveSnapshot("henrik", snapshot), 36);
  assert.equal(readSnapshot("henrik")?.matches.length, 36);
  const next = {
    ...snapshot,
    act: { ...fixtureAct, id: "next-act" },
    matches: [],
  };
  saveSnapshot("henrik", next);
  assert.equal(readSnapshot("henrik")?.matches.length, 0);
  assert.equal(readSnapshot("fixture")?.matches.length, 36);
  assert.equal(acquireLock("fixture"), true);
  assert.equal(acquireLock("fixture"), false);
  releaseLock("fixture");
  assert.equal(acquireLock("fixture"), true);
  releaseLock("fixture");
  let calls = 0;
  const fetcher = async () => {
    calls++;
    return "immutable-puuid";
  };
  assert.equal(
    await resolveIdentity("Name", "TAG", fetcher),
    "immutable-puuid",
  );
  assert.equal(
    await resolveIdentity("name", "tag", fetcher),
    "immutable-puuid",
  );
  assert.equal(calls, 1);
});

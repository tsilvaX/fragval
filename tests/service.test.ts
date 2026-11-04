import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDashboard, synchronize, dataMode } from "../src/lib/service";
import { database, saveSnapshot } from "../src/lib/store";
import { fixtureAct, fixtureMatches } from "../src/lib/fixtures";
import { fixtureFriends } from "../src/config/players";
import { sharedMatches } from "../src/lib/stats";
import { HenrikProvider, henrikRosterKey } from "../src/lib/providers/henrik";
test("service never substitutes demo for failed live data and never serves an expired live act", async () => {
  const directory = mkdtempSync(join(tmpdir(), "frag-court-service-"));
  const keys = ["DATABASE_PATH", "DATA_PROVIDER", "HENRIK_API_KEY"] as const;
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  process.env.DATABASE_PATH = join(directory, "service.sqlite");
  delete process.env.HENRIK_API_KEY;
  try {
    process.env.DATA_PROVIDER = "fixture";
    const firstSync = await synchronize();
    const demo = firstSync.data;
    const shared = sharedMatches(
      fixtureMatches(),
      fixtureFriends.map((f) => f.id),
      fixtureAct,
    );
    assert.equal(demo.matches.length, shared.length);
    assert.equal(firstSync.added, shared.length);
    assert.ok(shared.length < fixtureMatches().length);
    assert.equal(demo.mode, "fixture");
    assert.equal((await synchronize()).added, 0);
    process.env.DATA_PROVIDER = "henrik";
    await assert.rejects(getDashboard(), /HENRIK_API_KEY/);
    const liveAct = {
      ...fixtureAct,
      endsAt: new Date(Date.now() + 86400000).toISOString(),
    };
    const migrated = fixtureMatches();
    migrated[0].rosterKey = henrikRosterKey();
    const legacy = structuredClone(migrated[1]);
    legacy.players[0].id = "anonymous-legacy";
    saveSnapshot("henrik", {
      act: liveAct,
      friends: fixtureFriends,
      matches: [migrated[0], legacy],
      coverage: "legacy mappings",
      warnings: [],
    });
    const expireCooldown = () =>
      database()
        .prepare("UPDATE snapshots SET last_sync=? WHERE mode='henrik'")
        .run(new Date(Date.now() - 16000).toISOString());
    expireCooldown();
    const originalSync = HenrikProvider.prototype.sync;
    try {
      let calls = 0;
      HenrikProvider.prototype.sync = async (knownIds) => {
        calls++;
        assert.ok(knownIds.has(migrated[0].id));
        assert.equal(knownIds.has(legacy.id), calls > 1);
        migrated[1].rosterKey = henrikRosterKey();
        return {
          act: liveAct,
          friends: fixtureFriends,
          matches: calls === 1 ? [migrated[1]] : [],
          coverage: "linked accounts",
          warnings: [],
        };
      };
      const repaired = await synchronize();
      assert.equal(repaired.added, 0);
      assert.equal(
        repaired.data.matches[0].players[0].id,
        migrated[1].players[0].id,
      );
      expireCooldown();
      await synchronize();
      assert.equal(calls, 2);
    } finally {
      HenrikProvider.prototype.sync = originalSync;
    }
    saveSnapshot("henrik", {
      act: { ...fixtureAct, endsAt: "2000-01-01T00:00:00Z" },
      friends: fixtureFriends,
      matches: fixtureMatches(),
      coverage: "expired",
      warnings: [],
    });
    await assert.rejects(getDashboard(), /HENRIK_API_KEY/);
    process.env.DATA_PROVIDER = "riot";
    await assert.rejects(getDashboard(), /RSO/);
    process.env.DATA_PROVIDER = "invalid";
    assert.throws(() => dataMode(), /DATA_PROVIDER/);
    process.env.DATA_PROVIDER = "fixture";
    assert.equal((await getDashboard()).matches.length, shared.length);
    // Old snapshots containing solo games are filtered on read and during
    // the refresh cooldown without requiring a provider request or migration.
    saveSnapshot("fixture", {
      act: fixtureAct,
      friends: fixtureFriends,
      matches: fixtureMatches(),
      coverage: "legacy cache with solo games",
      warnings: [],
    });
    assert.deepEqual(
      (await getDashboard()).matches.map((m) => m.id),
      shared.map((m) => m.id),
    );
    assert.deepEqual(
      (await synchronize()).data.matches.map((m) => m.id),
      shared.map((m) => m.id),
    );
  } finally {
    database().close();
    rmSync(directory, { recursive: true, force: true });
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});

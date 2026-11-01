import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDashboard, synchronize, dataMode } from "../src/lib/service";
import { database, saveSnapshot } from "../src/lib/store";
import { fixtureAct, fixtureMatches } from "../src/lib/fixtures";
import { fixtureFriends } from "../src/config/players";
test("service never substitutes demo for failed live data and never serves an expired live act", async () => {
  const directory = mkdtempSync(join(tmpdir(), "frag-court-service-"));
  const keys = ["DATABASE_PATH", "DATA_PROVIDER", "HENRIK_API_KEY"] as const;
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  process.env.DATABASE_PATH = join(directory, "service.sqlite");
  delete process.env.HENRIK_API_KEY;
  try {
    process.env.DATA_PROVIDER = "fixture";
    const demo = await getDashboard();
    assert.equal(demo.matches.length, 36);
    assert.equal(demo.mode, "fixture");
    assert.equal((await synchronize()).added, 0);
    process.env.DATA_PROVIDER = "henrik";
    await assert.rejects(getDashboard(), /HENRIK_API_KEY/);
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
    assert.equal((await getDashboard()).matches.length, 36);
  } finally {
    database().close();
    rmSync(directory, { recursive: true, force: true });
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});

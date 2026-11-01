import { test } from "node:test";
import assert from "node:assert/strict";
import { trackedAccounts } from "../src/config/players";
import { configuredMode, setupStatus } from "../src/lib/readiness";

test("the exact four consented Riot IDs are configured without guessed ranks or agents", () => {
  assert.deepEqual(
    trackedAccounts.map((p) => `${p.name}#${p.tag}`),
    [
      "Mini Wo0t#ESP1",
      "HomelessSlayer94#142",
      "kotoris kitten#6874",
      "kotooriiii#4236",
    ],
  );
  assert.ok(trackedAccounts.every((p) => p.consent && p.agent === "Unknown"));
});
test("default live mode never silently substitutes fixtures and the explicit demo remains available", () => {
  const saved = process.env.DATA_PROVIDER;
  try {
    delete process.env.DATA_PROVIDER;
    assert.equal(configuredMode(), "henrik");
    assert.equal(configuredMode(true), "fixture");
    process.env.DATA_PROVIDER = "fixture";
    assert.equal(configuredMode(), "fixture");
    process.env.DATA_PROVIDER = "invalid";
    assert.throws(() => configuredMode(), /DATA_PROVIDER/);
  } finally {
    if (saved === undefined) delete process.env.DATA_PROVIDER;
    else process.env.DATA_PROVIDER = saved;
  }
});
test("readiness reports missing requirements and never exposes the key", () => {
  const keys = [
    "HENRIK_API_KEY",
    "HENRIK_AUTHORIZED",
    "VALORANT_REGION",
  ] as const;
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  try {
    delete process.env.HENRIK_API_KEY;
    delete process.env.HENRIK_AUTHORIZED;
    delete process.env.VALORANT_REGION;
    let s = setupStatus();
    assert.equal(s.rosterReady, true);
    assert.equal(s.ready, false);
    assert.equal(s.hasKey, false);
    assert.equal(s.region, "auto");
    process.env.HENRIK_API_KEY = "not-a-real-test-key";
    process.env.HENRIK_AUTHORIZED = "true";
    s = setupStatus();
    assert.equal(s.ready, true);
    assert.equal(s.hasKey, true);
    assert.ok(!JSON.stringify(s).includes("not-a-real-test-key"));
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});

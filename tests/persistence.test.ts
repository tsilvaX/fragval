import { test } from "node:test";
import assert from "node:assert/strict";
import { getStore } from "../src/lib/persistence";

test("Vercel requires durable storage rather than silently writing an ephemeral SQLite cache", () => {
  const keys = ["DATABASE_URL", "POSTGRES_URL", "VERCEL"] as const;
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    process.env.VERCEL = "1";
    assert.throws(getStore, /Connect a Neon database/);
    // Store construction must not open a connection or run SQL at build time.
    process.env.DATABASE_URL = "postgresql://test:test@invalid.example/test";
    assert.doesNotThrow(getStore);
    delete process.env.DATABASE_URL;
    process.env.POSTGRES_URL = "postgresql://test:test@invalid.example/test";
    assert.doesNotThrow(getStore);
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});

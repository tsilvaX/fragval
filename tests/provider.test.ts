import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeHenrik } from "../src/lib/providers/henrik";
import {
  requestJson,
  ProviderError,
  retryDelaySeconds,
} from "../src/lib/providers/http";
test("provider's reset header is a seconds duration when Retry-After is absent", () => {
  assert.equal(
    retryDelaySeconds(new Headers({ "x-ratelimit-reset": "60" })),
    60,
  );
  assert.equal(
    retryDelaySeconds(
      new Headers({ "retry-after": "20", "x-ratelimit-reset": "60" }),
    ),
    20,
  );
  assert.equal(
    retryDelaySeconds(new Headers({ "x-ratelimit-reset": "invalid" }), 4),
    4,
  );
});
function raw() {
  return {
    metadata: {
      match_id: "match-1",
      started_at: "2026-10-20T00:00:00Z",
      is_completed: true,
      map: { name: "Ascent" },
      season: { id: "act-1" },
      queue: { id: "competitive" },
    },
    teams: [
      { team_id: "opaque-team-A", rounds: { won: 13 } },
      { team_id: "opaque-team-B", rounds: { won: 8 } },
    ],
    players: [
      {
        puuid: "p1",
        name: "sensitive-name",
        tag: "SECRET",
        team_id: "opaque-team-B",
        agent: { name: "Jett" },
        stats: {
          kills: 21,
          deaths: 15,
          assists: 7,
          score: 5250,
          headshots: 20,
          bodyshots: 60,
          legshots: 5,
          damage: { dealt: 3150, received: 2800 },
        },
      },
    ],
  };
}
test("normalization joins teams by ID and preserves total score and hit counts", () => {
  const m = normalizeHenrik(raw(), [
    {
      id: "p1",
      name: "friend",
      tag: "GG",
      color: "#fff",
      rank: null,
      agent: "Jett",
    },
  ]);
  assert.equal(m.players[0].team, "Blue");
  assert.equal(m.players[0].rounds, 21);
  assert.equal(m.players[0].score, 5250);
  assert.equal(m.players[0].head, 20);
  assert.equal(m.players[0].damage, 3150);
  assert.equal(m.players[0].name, "friend#GG");
});
test("nonconsenting player IDs and names are discarded before storage", () => {
  const m = normalizeHenrik(raw(), []);
  const payload = JSON.stringify(m);
  assert.ok(!payload.includes("sensitive-name"));
  assert.ok(!payload.includes("SECRET"));
  assert.ok(!payload.includes('"p1"'));
  assert.equal(m.players[0].name, "Player 1");
});
test("unknown team IDs and malformed score fields fail validation", () => {
  const a = raw();
  a.players[0].team_id = "unknown";
  assert.throws(() => normalizeHenrik(a, []));
  const b = raw();
  b.players[0].stats.kills = -1;
  assert.throws(() => normalizeHenrik(b, []));
});
test("rate limits retry within a bound and preserve Retry-After", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response("", { status: 429, headers: { "Retry-After": "120" } });
  };
  try {
    await assert.rejects(
      requestJson("https://example.com"),
      (e: unknown) =>
        e instanceof ProviderError && e.status === 503 && e.retryAfter === 120,
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = original;
  }
});
test("provider auth failures do not retry or leak provider payloads", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response("secret-provider-details", { status: 403 });
  };
  try {
    await assert.rejects(
      requestJson("https://example.com", "private-key"),
      (e: unknown) =>
        e instanceof ProviderError &&
        !e.message.includes("secret-provider-details") &&
        !e.message.includes("private-key"),
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = original;
  }
});

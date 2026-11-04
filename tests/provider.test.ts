import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeHenrik } from "../src/lib/providers/henrik";
import type { Friend } from "../src/lib/model";
import { aggregate, calculateAwards, sharedMatches } from "../src/lib/stats";
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
test("reported match 55605f20 credits kotooriiii despite another player's higher ACS", () => {
  const source = raw();
  const scores = [2930, 5694, 5790, 5413, 3663, 5979, 3987, 2722, 5204, 4165];
  const performance = [
    208.0437, 301.8715, 307.2148, 324.4554, 151.0897, 299.187, 178.8261,
    135.736, 264.3935, 217.0065,
  ];
  const friends: Friend[] = ["Mini Wo0t", "kotoris kitten", "kotooriiii"].map(
    (name, i) => ({
      id: `p${i + 1}`,
      name,
      tag: ["ESP1", "6874", "4236"][i],
      color: "#fff",
      rank: null,
      agent: "Unknown",
    }),
  );
  const input = {
    ...source,
    metadata: {
      ...source.metadata,
      match_id: "55605f20-4212-4a83-b4e3-4d2725bc3a07",
      mvp: { puuid: "p3" } as { puuid: string } | null,
    },
    teams: [
      { team_id: "opaque-team-A", rounds: { won: 10 } },
      { team_id: "opaque-team-B", rounds: { won: 13 } },
    ],
    players: scores.map((score, i) => ({
      ...source.players[0],
      puuid: `p${i}`,
      team_id: [0, 1, 2, 3, 8].includes(i) ? "opaque-team-B" : "opaque-team-A",
      stats: { ...source.players[0].stats, score },
      performance: { score: performance[i] as number | null },
    })),
  };
  const act = {
    id: "act-1",
    name: "test",
    startsAt: "2026-10-01T00:00:00Z",
    endsAt: "2026-11-01T00:00:00Z",
    source: "test",
  };
  const match = normalizeHenrik(input, friends);
  assert.deepEqual(match.mvpIds, ["p3"]);
  assert.equal(match.players[3].performanceScore, 324.4554);
  const mvp = calculateAwards(
    [match],
    friends.map((f) => f.id),
    act,
  ).find((a) => a.key === "mvp")!;
  assert.deepEqual(mvp.entries.find((e) => e.playerId === "p3")!.matchIds, [
    input.metadata.match_id,
  ]);
  assert.equal(
    mvp.entries.find((e) => e.playerId === "p2")!.matchIds.length,
    0,
  );
  // Official metadata is authoritative even if a performance field is absent.
  input.players[3].performance.score = null;
  assert.deepEqual(normalizeHenrik(input, friends).mvpIds, ["p3"]);
  // No metadata and incomplete performance data must not fall back to ACS.
  input.metadata.mvp = null;
  assert.deepEqual(normalizeHenrik(input, friends).mvpIds, []);
  input.players[3].performance.score = performance[3];
  assert.deepEqual(normalizeHenrik(input, friends).mvpIds, ["p3"]);
  // An untracked MVP keeps an anonymous ID, never the raw provider PUUID.
  input.metadata.mvp = { puuid: "p5" };
  const anonymousWinner = normalizeHenrik(input, friends);
  assert.deepEqual(anonymousWinner.mvpIds, [anonymousWinner.players[5].id]);
  assert.ok(!JSON.stringify(anonymousWinner).includes('"p5"'));
});
test("linked accounts combine weighted totals, awards and history under one profile", () => {
  const friends: Friend[] = [
    {
      id: "primary",
      name: "HomelessSlayer94",
      tag: "142",
      color: "#fff",
      rank: null,
      agent: "Unknown",
      accounts: [
        { id: "primary", name: "HomelessSlayer94", tag: "142" },
        { id: "alternate", name: "breedableboy24", tag: "1234" },
      ],
    },
    {
      id: "teammate",
      name: "Friend",
      tag: "GG",
      color: "#fff",
      rank: null,
      agent: "Unknown",
    },
  ];
  const act = {
    id: "act-1",
    name: "Act",
    startsAt: "2026-10-01T00:00:00Z",
    endsAt: "2026-11-01T00:00:00Z",
    source: "test",
  };
  const lobby = (accountId: string, id: string) => {
    const source = raw();
    source.metadata.match_id = id;
    source.players = Array.from({ length: 10 }, (_, i) => ({
      ...structuredClone(source.players[0]),
      puuid: i === 0 ? accountId : i === 1 ? "teammate" : `guest-${i}`,
      team_id: i < 5 ? "opaque-team-A" : "opaque-team-B",
      stats: {
        ...source.players[0].stats,
        score: (i === 0 ? 50 : 200 + i) * 21,
        kills: i === 0 ? 10 : 20,
        deaths: 10,
      },
    }));
    return source;
  };
  const primary = normalizeHenrik(lobby("primary", "primary-match"), friends);
  const alternate = normalizeHenrik(
    lobby("alternate", "alternate-match"),
    friends,
  );
  alternate.players[0].kills = 30;
  for (const m of [primary, alternate])
    m.players.forEach((p, i) => {
      p.performanceScore = i === 0 ? 50 : 200 + i;
    });
  const matches = [primary, alternate, alternate];
  assert.equal(alternate.players[0].id, "primary");
  assert.equal(alternate.players[0].name, "breedableboy24#1234");
  assert.equal(
    sharedMatches(
      matches,
      friends.map((f) => f.id),
      act,
    ).length,
    2,
  );
  const stats = aggregate(matches, "primary");
  assert.equal(stats.matches, 2);
  assert.equal(stats.kills, 40);
  assert.equal(stats.deaths, 20);
  assert.equal(stats.kd, 2);
  assert.equal(stats.acs, 50);
  assert.deepEqual(
    calculateAwards(
      matches,
      friends.map((f) => f.id),
      act,
    )[0].entries[0].matchIds,
    [primary.id, alternate.id],
  );
  // Two accounts belonging to one person cannot satisfy the two-friend rule.
  const solo = lobby("alternate", "solo");
  solo.players[1].puuid = "untracked";
  assert.equal(
    sharedMatches(
      [normalizeHenrik(solo, friends)],
      friends.map((f) => f.id),
      act,
    ).length,
    0,
  );
  solo.players[1].puuid = "primary";
  assert.equal(
    sharedMatches(
      [normalizeHenrik(solo, friends)],
      friends.map((f) => f.id),
      act,
    ).length,
    0,
  );
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

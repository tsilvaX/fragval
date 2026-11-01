import { test } from "node:test";
import assert from "node:assert/strict";
import { trackedAccounts } from "../src/config/players";
import { HenrikProvider } from "../src/lib/providers/henrik";
import { fixtureMatches } from "../src/lib/fixtures";
import { eligibleMatch } from "../src/lib/stats";

test("live provider contract resolves the act and PUUIDs, deduplicates shared details, and skips known IDs", async () => {
  const originalFetch = globalThis.fetch;
  const envKeys = [
    "HENRIK_API_KEY",
    "HENRIK_AUTHORIZED",
    "VALORANT_REGION",
    "VALORANT_PLATFORM",
  ] as const;
  const saved = Object.fromEntries(envKeys.map((k) => [k, process.env[k]]));
  process.env.HENRIK_API_KEY = "test-key-never-a-real-credential";
  process.env.HENRIK_AUTHORIZED = "true";
  process.env.VALORANT_REGION = "na";
  process.env.VALORANT_PLATFORM = "pc";
  const start = new Date(Date.now() - 86400000).toISOString(),
    end = new Date(Date.now() + 86400000).toISOString(),
    now = new Date().toISOString();
  const source = fixtureMatches()[0];
  let detailCalls = 0,
    accountCalls = 0;
  const friends = [0, 1, 2].map((i) => ({
    name: `Friend${i}`,
    tag: "GG",
    color: "#c45734",
    agent: "Jett",
    consent: true,
  }));
  trackedAccounts.push(...friends);
  globalThis.fetch = async (input, options) => {
    const url = String(input);
    if (url.startsWith("https://api.henrikdev.xyz"))
      assert.equal(
        new Headers(options?.headers).get("authorization"),
        "test-key-never-a-real-credential",
      );
    if (url.endsWith("/content"))
      return Response.json({
        data: { acts: [{ id: "live-act", name: "Current Act" }] },
      });
    if (url.endsWith("/seasons"))
      return Response.json({
        data: [
          {
            uuid: "live-act",
            displayName: "ACT",
            title: "Current Act",
            type: "EAresSeasonType::Act",
            startTime: start,
            endTime: end,
          },
        ],
      });
    if (url.includes("/v2/account/")) {
      accountCalls++;
      const i = url.match(/Friend(\d)/)?.[1];
      return Response.json({ data: { puuid: `live-friend-${i}` } });
    }
    if (url.includes("/mmr/"))
      return Response.json({
        data: { current: { tier: { name: "Diamond 1" } } },
      });
    if (url.includes("/stored-matches/"))
      return Response.json({
        data: [
          {
            meta: {
              id: "shared-match",
              started_at: now,
              season: { id: "live-act" },
            },
          },
          {
            meta: {
              id: "prior-act-match",
              started_at: start,
              season: { id: "prior-act" },
            },
          },
        ],
        results: { after: 0 },
      });
    if (url.includes("/v4/match/")) {
      detailCalls++;
      return Response.json({
        data: {
          metadata: {
            match_id: "shared-match",
            started_at: now,
            is_completed: true,
            map: { name: "Ascent" },
            season: { id: "live-act" },
            queue: { id: "competitive" },
          },
          teams: [
            { team_id: "opaque-red", rounds: { won: source.red } },
            { team_id: "opaque-blue", rounds: { won: source.blue } },
          ],
          players: source.players.map((p, i) => ({
            puuid: i < 3 ? `live-friend-${i}` : `untracked-secret-${i}`,
            name: "private-name",
            tag: "PRIVATE",
            team_id: p.team === "Red" ? "opaque-red" : "opaque-blue",
            agent: { name: p.agent },
            stats: {
              score: p.score,
              kills: p.kills,
              deaths: p.deaths,
              assists: p.assists,
              headshots: p.head,
              bodyshots: p.body,
              legshots: p.leg,
              damage: { dealt: p.damage, received: p.received },
            },
          })),
        },
      });
    }
    throw Error(`Unexpected test URL: ${url}`);
  };
  try {
    const identities = new Map<string, string>();
    const provider = new HenrikProvider(async (name, _tag, fetcher) => {
      if (!identities.has(name)) identities.set(name, await fetcher());
      return identities.get(name)!;
    });
    const first = await provider.sync(new Set());
    assert.equal(first.act.id, "live-act");
    assert.equal(first.matches.length, 1);
    assert.equal(detailCalls, 1);
    assert.equal(accountCalls, 3);
    assert.equal(first.friends[0].rank, "Diamond 1");
    assert.ok(eligibleMatch(first.matches[0], first.act));
    assert.ok(!JSON.stringify(first).includes("private-name"));
    assert.ok(!JSON.stringify(first).includes("untracked-secret"));
    const second = await provider.sync(new Set(["shared-match"]));
    assert.equal(second.matches.length, 0);
    assert.equal(detailCalls, 1);
    assert.equal(accountCalls, 3);
  } finally {
    globalThis.fetch = originalFetch;
    trackedAccounts.splice(0, trackedAccounts.length);
    for (const key of envKeys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});

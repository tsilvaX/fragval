import { test } from "node:test";
import assert from "node:assert/strict";
import { HenrikProvider, henrikRosterKey } from "../src/lib/providers/henrik";
import type { TrackedAccount } from "../src/config/players";
import { fixtureMatches } from "../src/lib/fixtures";
import { eligibleMatch, aggregate } from "../src/lib/stats";

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
  process.env.VALORANT_REGION = "auto";
  process.env.VALORANT_PLATFORM = "pc";
  const start = new Date(Date.now() - 86400000).toISOString(),
    end = new Date(Date.now() + 86400000).toISOString(),
    now = new Date().toISOString();
  const source = fixtureMatches()[0];
  let detailCalls = 0,
    accountCalls = 0;
  let pauseStored = false,
    storedCalls = 0;
  const friends: TrackedAccount[] = [0, 1, 2].map((i) => ({
    name: `Friend${i}`,
    tag: "GG",
    color: "#c45734",
    agent: "Jett",
    consent: true,
  }));
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
      if (url.includes("FriendAlt1"))
        return Response.json({ data: { puuid: "live-alt-1", region: "eu" } });
      const i = url.match(/Friend(\d)/)?.[1];
      return Response.json({
        data: { puuid: `live-friend-${i}`, region: "eu" },
      });
    }
    if (url.includes("/v2/by-puuid/account/"))
      return Response.json({
        data: { puuid: url.split("/").at(-1), region: "eu" },
      });
    if (url.includes("/mmr/")) {
      assert.ok(url.includes("/mmr/eu/pc/"));
      return Response.json({
        data: { current: { tier: { name: "Diamond 1" } } },
      });
    }
    if (url.includes("/stored-matches/")) {
      assert.ok(url.includes("/stored-matches/eu/"));
      storedCalls++;
      if (pauseStored && storedCalls > 1)
        return new Response("", {
          status: 429,
          headers: { "Retry-After": "120" },
        });
      return Response.json({
        data: [
          ...(url.includes("live-alt-1")
            ? [
                {
                  meta: {
                    id: "alt-match",
                    started_at: now,
                    season: { id: "live-act" },
                  },
                },
              ]
            : []),
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
    }
    if (url.includes("/v4/match/")) {
      detailCalls++;
      const alternate = url.endsWith("/alt-match");
      return Response.json({
        data: {
          metadata: {
            match_id: alternate ? "alt-match" : "shared-match",
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
            puuid:
              alternate && i === 1
                ? "live-alt-1"
                : i < 3
                  ? `live-friend-${i}`
                  : `untracked-secret-${i}`,
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
    }, friends);
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
    const originalRosterKey = henrikRosterKey(friends);
    friends[1].aliases = [{ name: "FriendAlt1", tag: "ALT" }];
    assert.notEqual(henrikRosterKey(friends), originalRosterKey);
    const linked = await provider.sync(new Set(["shared-match"]));
    assert.equal(linked.friends.length, 3);
    assert.deepEqual(
      linked.friends[1].accounts?.map((a) => a.id),
      ["live-friend-1", "live-alt-1"],
    );
    assert.equal(linked.matches.length, 1);
    assert.equal(linked.matches[0].players[1].id, "live-friend-1");
    assert.equal(linked.matches[0].players[1].name, "FriendAlt1#ALT");
    assert.equal(linked.matches[0].rosterKey, henrikRosterKey(friends));
    assert.equal(
      aggregate([...first.matches, ...linked.matches], "live-friend-1").matches,
      2,
    );
    assert.equal(linked.friends[1].rank, "Diamond 1");
    assert.equal(accountCalls, 4);
    pauseStored = true;
    storedCalls = 0;
    const partial = await provider.sync(new Set());
    assert.equal(partial.matches.length, 1);
    assert.ok(
      partial.warnings.some((w) => w.includes("already retrieved were saved")),
    );
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of envKeys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});

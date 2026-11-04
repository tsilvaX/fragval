import { test } from "node:test";
import assert from "node:assert/strict";
import { fixtureAct, fixtureMatches } from "../src/lib/fixtures";
import { squadInsights } from "../src/lib/squad";
import { playerPortrait } from "../src/config/portraits";
import type { Friend } from "../src/lib/model";

const friends: Friend[] = [0, 1, 2, 3].map((i) => ({
  id: `p${i}`,
  name: `Friend ${i}`,
  tag: "TAG",
  color: "#a5d995",
  agent: "Jett",
  rank: null,
}));
function game(index: number, scores = [400, 250, 200, 100], win = true) {
  const m = structuredClone(fixtureMatches()[1]);
  m.id = `game-${index}`;
  m.startedAt = new Date(
    Date.parse(fixtureAct.startsAt) + index * 60000,
  ).toISOString();
  m.red = win ? 13 : 9;
  m.blue = win ? 9 : 13;
  m.players.forEach((p, i) => {
    p.id = `p${i}`;
    p.team = i < 5 ? "Red" : "Blue";
    p.rounds = 22;
    p.score = (scores[i] ?? 160) * 22;
    p.kills = [20, 15, 10, 5][i] ?? 10;
    p.deaths = 10;
    p.assists = 100 * i;
  });
  m.mvpIds = m.players
    .filter(
      (p) => p.score === Math.max(...m.players.map((other) => other.score)),
    )
    .map((p) => p.id);
  return m;
}
const keys = (result: ReturnType<typeof squadInsights>, id: string) =>
  result.titles[id].map((t) => t.key);

test("home titles use total K/D, lobby awards and relative ACS consistency", () => {
  const matches = [
    game(1, [400, 250, 180, 100]),
    game(2, [450, 250, 260, 80]),
    game(3, [350, 250, 200, 120]),
  ];
  const result = squadInsights(matches, friends, fixtureAct);
  assert.ok(keys(result, "p0").includes("best-kd"));
  assert.ok(keys(result, "p0").includes("mvp"));
  assert.ok(keys(result, "p3").includes("worst-kd"));
  assert.ok(keys(result, "p3").includes("bottom"));
  assert.ok(keys(result, "p1").includes("consistent"));
  assert.ok(!keys(result, "p0").includes("consistent"));
  assert.equal(result.duos.length, 2);
  assert.equal(new Set(result.duos.flatMap((d) => d.playerIds)).size, 4);
});

test("titles and carrier change when new results arrive; input order and duplicates do not affect results", () => {
  const initial = [game(1), game(2), game(3)];
  const before = squadInsights(initial, friends, fixtureAct);
  const later = Array.from({ length: 10 }, (_, i) => {
    const m = game(i + 4, [100, 450, 200, 150]);
    m.players[1].kills = 50;
    return m;
  });
  const after = squadInsights([...initial, ...later], friends, fixtureAct);
  assert.equal(before.carriers[0].playerId, "p0");
  assert.equal(after.carriers[0].playerId, "p1");
  assert.ok(!keys(after, "p0").includes("best-kd"));
  assert.ok(keys(after, "p1").includes("best-kd"));
  assert.ok(keys(after, "p1").includes("mvp"));
  assert.equal(after.recentMatches, 10);
  assert.deepEqual(
    after,
    squadInsights(
      [...later.reverse(), ...initial, initial[0]],
      friends,
      fixtureAct,
    ),
  );
});

test("duos optimize disjoint same-team pairings and exclude opponents and tiny samples", () => {
  let index = 0;
  const matches = (
    [
      [0, 1, true],
      [2, 3, true],
      [0, 2, false],
      [1, 3, false],
    ] as const
  ).flatMap(([a, b, win]) =>
    Array.from({ length: 3 }, () => {
      const m = game(++index, undefined, win);
      m.players.forEach((p, i) => {
        if (i !== a && i !== b) p.id = `other-${i}`;
      });
      return m;
    }),
  );
  const result = squadInsights(matches, friends, fixtureAct);
  assert.deepEqual(
    result.duos.map((d) => d.playerIds),
    [
      ["p0", "p1"],
      ["p2", "p3"],
    ],
  );
  assert.ok(result.duos.every((d) => d.wins === 3 && d.winRate === 100));
  assert.equal(
    squadInsights(matches.slice(0, 2), friends, fixtureAct).duos.length,
    0,
  );
  const opposing = [game(100), game(101), game(102)];
  for (const m of opposing) {
    m.players[1].team = "Blue";
    m.players[5].team = "Red";
  }
  assert.equal(
    squadInsights(opposing, friends.slice(0, 2), fixtureAct).duos.length,
    0,
  );
  assert.equal(
    squadInsights(opposing, friends.slice(0, 2), fixtureAct).recentMatches,
    0,
  );
});

test("no titles, duos or carrier are fabricated for empty or unsupported matches", () => {
  const incomplete = game(1);
  incomplete.completed = false;
  const result = squadInsights([incomplete], friends, fixtureAct);
  assert.ok(Object.values(result.titles).every((t) => !t.length));
  assert.deepEqual(result.carriers, []);
  assert.deepEqual(result.duos, []);
  assert.equal(result.recentMatches, 0);
  assert.equal(
    squadInsights([game(1), game(2)], friends, fixtureAct).carriers.length,
    0,
  );
  assert.ok(
    Object.values(squadInsights([game(1)], friends, fixtureAct).titles).every(
      (tags) => !tags.some((t) => t.key === "consistent"),
    ),
  );
});
test("solo games do not change squad titles, pairings or carrier totals", () => {
  const matches = [game(1), game(2), game(3)];
  const solo = game(4, [50, 250, 200, 100]);
  solo.players.forEach((p, i) => {
    if (i > 0) p.id = `untracked-${i}`;
  });
  assert.deepEqual(
    squadInsights([...matches, solo], friends, fixtureAct),
    squadInsights(matches, friends, fixtureAct),
  );
});

test("ties share titles and carry credit, while zero awards and zero-over-zero K/D earn no title", () => {
  const matches = [
    game(1, [400, 400, 200, 200]),
    game(2, [400, 400, 200, 200]),
    game(3, [400, 400, 200, 200]),
  ];
  for (const m of matches) {
    m.players[1].kills = 20;
    m.players[2].kills = 0;
    m.players[2].deaths = 0;
    m.players[3].kills = 0;
    m.players[3].deaths = 0;
  }
  const result = squadInsights(matches, friends, fixtureAct);
  assert.equal(result.carriers.length, 2);
  assert.ok(keys(result, "p0").includes("mvp"));
  assert.ok(keys(result, "p1").includes("mvp"));
  assert.ok(keys(result, "p0").includes("best-kd"));
  assert.ok(keys(result, "p1").includes("best-kd"));
  assert.ok(!keys(result, "p2").includes("worst-kd"));
  assert.ok(
    Object.values(result.titles).every(
      (tags) => !tags.some((t) => t.key === "bottom"),
    ),
  );
  for (const m of matches) m.players.forEach((p) => (p.score = 200 * p.rounds));
  assert.deepEqual(squadInsights(matches, friends, fixtureAct).carriers, []);
});

test("photos follow the named player including the configured kitten alias, with no real photos assigned to fictional players", () => {
  assert.equal(playerPortrait("Mini Wo0t"), "/players/mini-woot.png");
  assert.equal(
    playerPortrait("HomelessSlayer94"),
    "/players/homeless-slayer.png",
  );
  assert.equal(playerPortrait("kotooriiii"), "/players/kotooriiii.png");
  assert.equal(
    playerPortrait("kotoris kitten"),
    playerPortrait("kotooriiii's kitten"),
  );
  assert.equal(playerPortrait("witness"), undefined);
});

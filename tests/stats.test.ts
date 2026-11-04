import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aggregate,
  calculateAwards,
  eligibleMatch,
  placement,
  uniqueMatches,
  agentStats,
  sharedMatches,
} from "../src/lib/stats";
import { fixtureAct, fixtureMatches } from "../src/lib/fixtures";
import type { Match } from "../src/lib/model";
function match(): Match {
  const m = structuredClone(fixtureMatches()[1]);
  m.mvpIds = ["p0"];
  m.players.forEach((p, i) => {
    p.id = `p${i}`;
    p.score = (300 - i * 20) * p.rounds;
    p.kills = 20 - i;
  });
  return m;
}
const award = (m: Match[], key: string, ids = ["p0", "p5", "p9"]) =>
  calculateAwards(m, ids, fixtureAct).find((a) => a.key === key)!;
test("sole tenth place is measured against all ten, not just the player's team", () => {
  const m = match(),
    a = award([m], "bottom");
  assert.deepEqual(a.entries.find((e) => e.playerId === "p9")?.matchIds, [
    m.id,
  ]);
  assert.equal(a.entries.find((e) => e.playerId === "p5")?.matchIds.length, 0);
});
test("match MVP and top kills are distinct awards", () => {
  const m = match();
  m.players[5].kills = 40;
  assert.equal(award([m], "mvp").entries[0].playerId, "p0");
  assert.equal(award([m], "fragger").entries[0].playerId, "p5");
});
test("official MVP overrides ACS and missing MVP data is never guessed", () => {
  const m = match();
  m.mvpIds = ["p5"];
  assert.deepEqual(
    award([m], "mvp").entries.find((e) => e.playerId === "p5")!.matchIds,
    [m.id],
  );
  assert.equal(
    award([m], "mvp").entries.find((e) => e.playerId === "p0")!.matchIds.length,
    0,
  );
  assert.deepEqual(
    award([m], "bottom").entries.find((e) => e.playerId === "p9")!.matchIds,
    [m.id],
  );
  for (const ids of [undefined, [], ["not-a-participant"]]) {
    m.mvpIds = ids;
    assert.equal(award([m], "mvp").eligible, 0);
    assert.ok(award([m], "mvp").entries.every((e) => e.matchIds.length === 0));
    assert.equal(aggregate([m], "p0").matches, 1);
  }
});

test("K/D awards use ratios across the full lobby and ignore assists and combat score", () => {
  const m = match();
  m.players.forEach((p) => {
    p.kills = 20;
    p.deaths = 20;
  });
  m.players[5].kills = 12;
  m.players[5].deaths = 4;
  m.players[9].kills = 2;
  m.players[9].assists = 100;
  assert.equal(award([m], "best-kd").entries[0].playerId, "p5");
  assert.equal(award([m], "worst-kd").entries[0].playerId, "p9");

  // An untracked participant can beat the entire friend group.
  m.players[1].deaths = 1;
  assert.ok(award([m], "best-kd").entries.every((e) => !e.matchIds.length));
  m.players[1].kills = 0;
  assert.ok(award([m], "worst-kd").entries.every((e) => !e.matchIds.length));
});

test("K/D ties share credit and duplicate matches count once", () => {
  const m = match();
  m.players.forEach((p) => {
    p.kills = 10;
    p.deaths = 10;
  });
  m.players[0].kills = 20;
  m.players[5].deaths = 5;
  m.players[2].kills = 0;
  m.players[9].kills = 0;
  for (const [key, ids] of [
    ["best-kd", ["p0", "p5"]],
    ["worst-kd", ["p2", "p9"]],
  ] as const) {
    const a = award([m, structuredClone(m)], key, [...ids]);
    assert.equal(a.eligible, 1);
    assert.ok(a.entries.every((e) => e.matchIds.length === 1));
  }
});

test("K/D awards handle deathless players and exclude undefined zero-over-zero ratios", () => {
  const m = match();
  m.players.forEach((p) => {
    p.kills = 10;
    p.deaths = 10;
  });
  m.players[0].deaths = 0;
  m.players[5].deaths = 0;
  m.players[9].kills = 0;
  m.players[9].deaths = 0;
  assert.equal(
    award([m], "best-kd").entries.filter((e) => e.matchIds.length).length,
    2,
  );
  assert.ok(award([m], "worst-kd").entries.every((e) => !e.matchIds.length));
  for (const key of ["best-kd", "worst-kd"])
    assert.equal(award([m], key, ["p9"]).eligible, 0);
  m.players.forEach((p) => {
    p.kills = 0;
    p.deaths = 0;
  });
  for (const key of ["best-kd", "worst-kd"])
    assert.equal(award([m], key).eligible, 0);
});
test("friend carry and liability compare friends even without the lobby winner", () => {
  const m = match();
  assert.equal(
    award([m], "carry", ["p2", "p6", "p8"]).entries[0].playerId,
    "p2",
  );
  assert.equal(
    award([m], "liability", ["p2", "p6", "p8"]).entries[0].playerId,
    "p8",
  );
});
test("solo matches cannot earn any court award", () => {
  for (const key of [
    "bottom",
    "mvp",
    "fragger",
    "carry",
    "liability",
    "best-kd",
    "worst-kd",
  ]) {
    const a = award([match()], key, ["p0"]);
    assert.equal(a.eligible, 0);
    assert.equal(a.entries[0].matchIds.length, 0);
  }
});
test("shared matches require two distinct tracked friends, keep opponents, and deduplicate IDs", () => {
  const m = match();
  assert.equal(sharedMatches([m], [], fixtureAct).length, 0);
  assert.equal(
    sharedMatches([m], ["p0", "p0", "absent"], fixtureAct).length,
    0,
  );
  assert.deepEqual(
    sharedMatches([m, structuredClone(m)], ["p0", "p9"], fixtureAct),
    [m],
  );
  m.completed = false;
  assert.equal(sharedMatches([m], ["p0", "p9"], fixtureAct).length, 0);
});
test("bottom counter grows only for new shared matches with a sole tenth finish", () => {
  const first = match();
  const next = structuredClone(first);
  next.id = "new-bottom";
  const solo = structuredClone(first);
  solo.id = "solo-bottom";
  solo.players[0].id = "untracked-0";
  solo.players[5].id = "untracked-5";
  const tied = structuredClone(next);
  tied.id = "tied-bottom";
  tied.players[8].score = tied.players[9].score;
  const count = (matches: Match[]) =>
    award(matches, "bottom").entries.find((e) => e.playerId === "p9")!.matchIds;
  assert.deepEqual(count([first]), [first.id]);
  assert.deepEqual(count([first, next, next, solo, tied]), [first.id, next.id]);
});
test("shared and duplicate matches count once, even in the eligible denominator", () => {
  const m = match(),
    a = award([m, m, structuredClone(m)], "carry");
  assert.equal(a.eligible, 1);
  assert.equal(a.entries[0].matchIds.length, 1);
  assert.equal(uniqueMatches([m, m]).length, 1);
  assert.equal(aggregate([m, m], "p0").matches, 1);
});
test("tied leaders share MVP and highest-kill awards", () => {
  const m = match();
  m.players[5].score = m.players[0].score;
  m.players[5].kills = m.players[0].kills;
  m.mvpIds = ["p0", "p5"];
  assert.equal(placement(m.players[5], m), 1);
  assert.equal(placement(m.players[1], m), 3);
  for (const key of ["mvp", "fragger"]) {
    const a = award([m], key);
    assert.equal(a.entries.filter((e) => e.matchIds.length === 1).length, 2);
  }
});
test("tied last place is not sole tenth, but group liability is shared", () => {
  const m = match();
  m.players[5].score = m.players[9].score;
  assert.equal(placement(m.players[9], m), 9);
  assert.equal(
    award([m], "bottom").entries.every((e) => !e.matchIds.length),
    true,
  );
  assert.equal(
    award([m], "liability").entries.filter((e) => e.matchIds.length).length,
    2,
  );
});
test("incomplete, noncompetitive, short and malformed lobbies do not qualify", () => {
  const variations = [
    (m: Match) => {
      m.completed = false;
    },
    (m: Match) => {
      m.queue = "deathmatch";
    },
    (m: Match) => {
      m.players.pop();
    },
    (m: Match) => {
      m.players[0].id = m.players[1].id;
    },
    (m: Match) => {
      m.players[0].score = NaN;
    },
    (m: Match) => {
      m.players[0].rounds = 0;
    },
    (m: Match) => {
      m.players[0].team = "Blue";
    },
  ];
  for (const change of variations) {
    const m = match();
    change(m);
    assert.equal(eligibleMatch(m, fixtureAct), false);
    assert.equal(award([m], "mvp").eligible, 0);
  }
});
test("act identity and date boundaries both apply, with an exclusive end", () => {
  const m = match();
  m.startedAt = fixtureAct.startsAt;
  assert.equal(eligibleMatch(m, fixtureAct), true);
  m.startedAt = fixtureAct.endsAt;
  assert.equal(eligibleMatch(m, fixtureAct), false);
  m.startedAt = new Date(Date.parse(fixtureAct.startsAt) - 1).toISOString();
  assert.equal(eligibleMatch(m, fixtureAct), false);
  m.startedAt = fixtureAct.startsAt;
  m.actId = "previous-act";
  assert.equal(eligibleMatch(m, fixtureAct), false);
});
test("ACS, ADR and delta weight rounds, headshots weight hits, K/D uses totals", () => {
  const a = match(),
    b = match();
  b.id = "another";
  const p = a.players[0],
    q = b.players[0];
  p.rounds = 10;
  q.rounds = 30;
  p.score = 3000;
  q.score = 3000;
  p.damage = 2000;
  q.damage = 3000;
  p.received = 1000;
  q.received = 4000;
  p.head = 9;
  p.body = 1;
  p.leg = 0;
  q.head = 1;
  q.body = 89;
  q.leg = 0;
  p.kills = 10;
  p.deaths = 2;
  q.kills = 20;
  q.deaths = 18;
  const s = aggregate([a, b], "p0");
  assert.equal(s.acs, 150);
  assert.equal(s.adr, 125);
  assert.equal(s.delta, 0);
  assert.equal(s.hs, 10);
  assert.equal(s.kd, 1.5);
  assert.equal(s.kills, 30);
  assert.equal(s.deaths, 20);
});
test("missing source statistics remain null rather than becoming zero", () => {
  const m = match();
  m.players[0].damage = null;
  m.players[0].head = null;
  const s = aggregate([m], "p0");
  assert.equal(s.adr, null);
  assert.equal(s.delta, null);
  assert.equal(s.hs, null);
});
test("draws count in matches and win rate but do not become losses", () => {
  const a = match(),
    b = match();
  b.id = "draw";
  a.red = 13;
  a.blue = 9;
  b.red = 14;
  b.blue = 14;
  const s = aggregate([a, b], "p0");
  assert.equal(s.wins, 1);
  assert.equal(s.losses, 0);
  assert.equal(s.draws, 1);
  assert.equal(s.winRate, 50);
});
test("zero deaths are explicit, and empty samples have no fabricated round stats", () => {
  const m = match();
  m.players[0].deaths = 0;
  assert.equal(aggregate([m], "p0").kd, null);
  const s = aggregate([], "none");
  assert.equal(s.matches, 0);
  assert.equal(s.kd, null);
  assert.equal(s.acs, null);
  assert.equal(s.hs, null);
});
test("agent aggregates separate agents and share weighted calculation semantics", () => {
  const a = match(),
    b = match();
  b.id = "another";
  a.players[0].agent = "Jett";
  b.players[0].agent = "Sage";
  const s = agentStats([a, b], "p0");
  assert.equal(s.length, 2);
  assert.equal(s[0].matches, 1);
  assert.equal(
    s.find((s) => s.agent === "Jett")?.acs,
    a.players[0].score / a.players[0].rounds,
  );
});
test("fixtures are deterministic and every fixture satisfies the exhibition act", () => {
  const a = fixtureMatches();
  assert.deepEqual(a, fixtureMatches());
  assert.equal(a.length, 36);
  assert.ok(a.every((m) => eligibleMatch(m, fixtureAct)));
});

import type { Act, Friend, Match } from "./model";
import {
  aggregate,
  calculateAwards,
  eligibleMatch,
  uniqueMatches,
  won,
} from "./stats";

export type PlayerTitle = {
  key: string;
  label: string;
  detail: string;
  tone: "fame" | "shame" | "neutral";
};
export type Duo = {
  playerIds: [string, string];
  matches: number;
  wins: number;
  draws: number;
  winRate: number;
};
export type CarryStanding = {
  playerId: string;
  matches: number;
  advantage: number;
  acs: number;
};

export function squadInsights(matches: Match[], friends: Friend[], act: Act) {
  const qualifying = uniqueMatches(matches)
    .filter((m) => eligibleMatch(m, act))
    .sort(
      (a, b) =>
        b.startedAt.localeCompare(a.startedAt) || a.id.localeCompare(b.id),
    );
  const ids = friends.map((f) => f.id);
  const titles: Record<string, PlayerTitle[]> = Object.fromEntries(
    ids.map((id) => [id, []]),
  );
  const totals = friends.map((f) => ({
    playerId: f.id,
    ...aggregate(qualifying, f.id),
  }));
  const leaders = (
    values: { playerId: string; value: number }[],
    lowest = false,
  ) => {
    if (!values.length) return [];
    const target = (lowest ? Math.min : Math.max)(
      ...values.map((v) => v.value),
    );
    return values.filter(
      (v) => v.value === target || Math.abs(v.value - target) < 1e-10,
    );
  };
  const kd = totals
    .filter((s) => s.matches && (s.deaths > 0 || s.kills > 0))
    .map((s) => ({
      playerId: s.playerId,
      value: s.deaths ? s.kills / s.deaths : Infinity,
    }));
  if (kd.length >= 2) {
    for (const lowest of [false, true]) {
      for (const entry of leaders(kd, lowest)) {
        const s = totals.find((s) => s.playerId === entry.playerId)!;
        titles[entry.playerId].push({
          key: lowest ? "worst-kd" : "best-kd",
          label: lowest ? "Exit Interview" : "Trade Surplus",
          detail: `${lowest ? "Lowest" : "Highest"} squad K/D: ${entry.value === Infinity ? "deathless" : entry.value.toFixed(2)} · ${s.kills} kills / ${s.deaths} deaths across ${s.matches} matches. Assists excluded. Ties share the title.`,
          tone: lowest ? "shame" : "fame",
        });
      }
    }
  }
  const awards = calculateAwards(qualifying, ids, act);
  for (const [key, label, tone] of [
    ["mvp", "Main Character Clause", "fame"],
    ["bottom", "Basement Residency", "shame"],
  ] as const) {
    const values = awards
      .find((a) => a.key === key)!
      .entries.filter((e) => e.matchIds.length > 0)
      .map((e) => ({ playerId: e.playerId, value: e.matchIds.length }));
    for (const entry of leaders(values)) {
      titles[entry.playerId].push({
        key,
        label,
        tone,
        detail:
          key === "mvp"
            ? `Most lobby MVPs: ${entry.value}. Highest combat score among all ten players; tied MVPs count. Tied totals share the title.`
            : `Most sole bottom finishes: ${entry.value}. Sole 10th place by combat score across all ten players. Tied last places do not count. Tied totals share the title.`,
      });
    }
  }
  const consistency = ids.flatMap((playerId) => {
    const scores = qualifying.flatMap((m) => {
      const p = m.players.find((p) => p.id === playerId);
      return p ? [p.score / p.rounds] : [];
    });
    if (scores.length < 3) return [];
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const deviation = Math.sqrt(
      scores.reduce((sum, score) => sum + (score - mean) ** 2, 0) /
        scores.length,
    );
    return [
      { playerId, value: mean ? deviation / mean : 0, matches: scores.length },
    ];
  });
  if (consistency.length >= 2) {
    for (const entry of leaders(consistency, true)) {
      const sample = consistency.find((s) => s.playerId === entry.playerId)!;
      titles[entry.playerId].push({
        key: "consistent",
        label: "Metronome",
        tone: "neutral",
        detail: `Most consistent combat score: ${(entry.value * 100).toFixed(1)}% relative variation across ${sample.matches} games. Lowest standard deviation divided by mean ACS; minimum three matches. Consistency measures steadiness, not skill.`,
      });
    }
  }

  const candidates: (Duo & { strength: number; acs: number })[] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const together = qualifying.flatMap((m) => {
        const a = m.players.find((p) => p.id === ids[i]);
        const b = m.players.find((p) => p.id === ids[j]);
        return a && b && a.team === b.team ? [{ m, a, b }] : [];
      });
      if (together.length < 3) continue;
      const wins = together.filter(({ m, a }) => won(a, m)).length;
      const draws = together.filter(({ m }) => m.red === m.blue).length;
      candidates.push({
        playerIds: [ids[i], ids[j]],
        matches: together.length,
        wins,
        draws,
        winRate: (wins / together.length) * 100,
        // A small prior keeps a tiny perfect record from overpowering a proven duo.
        strength: (wins + 1) / (together.length + 2),
        acs:
          together.reduce(
            (sum, { a, b }) => sum + a.score / a.rounds + b.score / b.rounds,
            0,
          ) / together.length,
      });
    }
  }
  type Pairing = {
    pairs: typeof candidates;
    strength: number;
    matches: number;
    acs: number;
  };
  let best: Pairing = { pairs: [], strength: 0, matches: 0, acs: 0 };
  function pair(remaining: string[], pairs: typeof candidates) {
    if (!remaining.length) {
      const score = {
        pairs,
        strength: pairs.reduce((n, p) => n + p.strength, 0),
        matches: pairs.reduce((n, p) => n + p.matches, 0),
        acs: pairs.reduce((n, p) => n + p.acs, 0),
      };
      if (
        score.pairs.length > best.pairs.length ||
        (score.pairs.length === best.pairs.length &&
          (score.strength > best.strength ||
            (score.strength === best.strength &&
              (score.matches > best.matches ||
                (score.matches === best.matches && score.acs > best.acs)))))
      )
        best = score;
      return;
    }
    const [first, ...rest] = remaining;
    for (const candidate of candidates.filter((c) =>
      c.playerIds.includes(first),
    )) {
      const partner = candidate.playerIds.find((id) => id !== first)!;
      if (rest.includes(partner))
        pair(
          rest.filter((id) => id !== partner),
          [...pairs, candidate],
        );
    }
    pair(rest, pairs);
  }
  pair([...ids].sort(), []);
  const duos: Duo[] = best.pairs.map(
    ({ strength: _strength, acs: _acs, ...duo }) => duo,
  );
  for (const duo of duos) {
    for (const playerId of duo.playerIds) {
      const partner = friends.find(
        (f) => duo.playerIds.includes(f.id) && f.id !== playerId,
      )!;
      titles[playerId].push({
        key: "duo",
        label: `Partners in Crime · ${partner.name}`,
        tone: "neutral",
        detail: `${duo.wins} wins in ${duo.matches} same-team games with ${partner.name} (${duo.winRate.toFixed(0)}% win rate). Pairings maximize the number of disjoint duos, then their combined adjusted win rate: (wins + 1) / (games + 2). Ties use shared games, then combined ACS. Minimum three shared games.`,
      });
    }
  }

  const recent = qualifying
    .filter((m) =>
      ["Red", "Blue"].some(
        (team) =>
          m.players.filter((p) => p.team === team && ids.includes(p.id))
            .length >= 2,
      ),
    )
    .slice(0, 10);
  const carryStandings: CarryStanding[] = ids
    .flatMap((playerId) => {
      const performances = recent.flatMap((m) => {
        const p = m.players.find((p) => p.id === playerId);
        if (!p) return [];
        const team = m.players.filter(
          (q) => q.team === p.team && ids.includes(q.id),
        );
        if (team.length < 2) return [];
        const acs = p.score / p.rounds;
        const average =
          team.reduce((n, q) => n + q.score / q.rounds, 0) / team.length;
        return [{ acs, advantage: acs - average }];
      });
      if (performances.length < 3) return [];
      return [
        {
          playerId,
          matches: performances.length,
          advantage:
            performances.reduce((n, p) => n + p.advantage, 0) /
            performances.length,
          acs:
            performances.reduce((n, p) => n + p.acs, 0) / performances.length,
        },
      ];
    })
    .sort(
      (a, b) =>
        b.advantage - a.advantage ||
        b.matches - a.matches ||
        a.playerId.localeCompare(b.playerId),
    );
  const top = carryStandings[0];
  const carriers =
    top && top.advantage > 1e-10
      ? carryStandings.filter(
          (s) => Math.abs(s.advantage - top.advantage) < 1e-10,
        )
      : [];
  return { titles, duos, carriers, recentMatches: recent.length };
}

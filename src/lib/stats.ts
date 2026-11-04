import type {
  Act,
  Aggregate,
  Award,
  AwardKey,
  Match,
  Participant,
} from "./model";

export function eligibleMatch(m: Match, act: Act): boolean {
  const time = Date.parse(m.startedAt);
  return (
    m.completed &&
    m.queue === "competitive" &&
    m.actId === act.id &&
    time >= Date.parse(act.startsAt) &&
    time < Date.parse(act.endsAt) &&
    m.players.length === 10 &&
    new Set(m.players.map((p) => p.id)).size === 10 &&
    m.players.filter((p) => p.team === "Red").length === 5 &&
    m.players.filter((p) => p.team === "Blue").length === 5 &&
    m.red + m.blue > 0 &&
    m.players.every(
      (p) =>
        p.rounds === m.red + m.blue &&
        [p.kills, p.deaths, p.assists, p.score].every(
          (n) => Number.isFinite(n) && n >= 0,
        ),
    )
  );
}
export function uniqueMatches(matches: Match[]): Match[] {
  return [...new Map(matches.map((m) => [m.id, m])).values()];
}
export function sharedMatches(
  matches: Match[],
  friendIds: string[],
  act: Act,
): Match[] {
  const ids = new Set(friendIds);
  return uniqueMatches(matches).filter(
    (m) =>
      eligibleMatch(m, act) &&
      m.players.filter((p) => ids.has(p.id)).length >= 2,
  );
}
export function performanceScore(p: Participant): number | null {
  const score = p.performanceScore;
  return typeof score === "number" &&
    Number.isFinite(score) &&
    score >= 0 &&
    score <= 500
    ? score
    : null;
}
export function hasPerformanceScores(m: Match): boolean {
  return (
    m.players.length === 10 &&
    m.players.every((p) => performanceScore(p) !== null)
  );
}
// Equal reported Performance Scores share a placement. Never substitute ACS.
export function placement(p: Participant, m: Match): number | null {
  if (!hasPerformanceScores(m) || performanceScore(p) === null) return null;
  return (
    1 +
    m.players.filter((other) => performanceScore(other)! > performanceScore(p)!)
      .length
  );
}
export function scoreboard(m: Match): Participant[] {
  return [...m.players].sort(
    (a, b) =>
      (performanceScore(b) ?? -Infinity) - (performanceScore(a) ?? -Infinity) ||
      a.id.localeCompare(b.id),
  );
}
export function won(p: Participant, m: Match): boolean {
  return p.team === "Red" ? m.red > m.blue : m.blue > m.red;
}
export function aggregate(matches: Match[], playerId: string): Aggregate {
  const entries = uniqueMatches(matches).flatMap((m) => {
    const p = m.players.find((p) => p.id === playerId);
    return p ? [{ m, p }] : [];
  });
  const sum = (get: (p: Participant) => number) =>
    entries.reduce((total, { p }) => total + get(p), 0);
  const rounds = sum((p) => p.rounds),
    kills = sum((p) => p.kills),
    deaths = sum((p) => p.deaths);
  const wins = entries.filter(({ m, p }) => won(p, m)).length;
  const draws = entries.filter(({ m }) => m.red === m.blue).length;
  const damageAvailable =
    entries.length > 0 && entries.every(({ p }) => p.damage !== null);
  const receivedAvailable =
    damageAvailable && entries.every(({ p }) => p.received !== null);
  const hitsAvailable =
    entries.length > 0 &&
    entries.every(
      ({ p }) => p.head !== null && p.body !== null && p.leg !== null,
    );
  const hits = sum((p) => (p.head ?? 0) + (p.body ?? 0) + (p.leg ?? 0));
  return {
    matches: entries.length,
    wins,
    losses: entries.length - wins - draws,
    draws,
    winRate: entries.length ? (wins / entries.length) * 100 : 0,
    kills,
    deaths,
    assists: sum((p) => p.assists),
    rounds,
    kd: deaths ? kills / deaths : null,
    acs: rounds ? sum((p) => p.score) / rounds : null,
    performance:
      entries.length && entries.every(({ p }) => performanceScore(p) !== null)
        ? sum((p) => performanceScore(p)!) / entries.length
        : null,
    adr: rounds && damageAvailable ? sum((p) => p.damage!) / rounds : null,
    delta:
      rounds && receivedAvailable
        ? sum((p) => p.damage! - p.received!) / rounds
        : null,
    hs: hitsAvailable && hits ? (sum((p) => p.head!) / hits) * 100 : null,
  };
}
export const awardDefinitions: {
  key: AwardKey;
  title: string;
  description: string;
}[] = [
  {
    key: "bottom",
    title: "Bottom Frag King",
    description:
      "Sole lowest Riot Performance Score among all ten players. Tied last places do not count. The floor is yours.",
  },
  {
    key: "mvp",
    title: "Match MVP",
    description:
      "Official match MVP from the provider, using Riot Performance Score when MVP metadata is absent. ACS does not decide this award.",
  },
  {
    key: "fragger",
    title: "Lobby Top Fragger",
    description:
      "Highest Riot Performance Score among all ten players. Equal leaders share the award.",
  },
  {
    key: "carry",
    title: "Friend Group Carry",
    description:
      "Highest combat score among at least two tracked friends. You're welcome.",
  },
  {
    key: "liability",
    title: "Friend Group Liability",
    description:
      "Lowest combat score among at least two tracked friends. Moral support counts, right?",
  },
  {
    key: "best-kd",
    title: "Best K/D",
    description:
      "Highest kills-to-deaths ratio among all ten players per match. Assists do not count. Tied leaders share the award.",
  },
  {
    key: "worst-kd",
    title: "Worst K/D",
    description:
      "Lowest kills-to-deaths ratio among all ten players per match. Assists do not count. Tied players share the award.",
  },
];
export function calculateAwards(
  matches: Match[],
  friendIds: string[],
  act: Act,
): Award[] {
  const qualifying = sharedMatches(matches, friendIds, act);
  return awardDefinitions.map((def) => {
    const kd = def.key === "best-kd" || def.key === "worst-kd";
    const valueOf = (p: Participant): number | null => {
      if (def.key === "fragger" || def.key === "bottom")
        return performanceScore(p);
      if (kd)
        return p.deaths > 0
          ? p.kills / p.deaths
          : p.kills > 0
            ? Infinity
            : null;
      return p.score / p.rounds;
    };
    const entries = friendIds.map((playerId) => ({
      playerId,
      matchIds: [] as string[],
    }));
    let eligible = 0;
    for (const m of qualifying) {
      if (
        (def.key === "bottom" || def.key === "fragger") &&
        !hasPerformanceScores(m)
      )
        continue;
      const friends = m.players.filter(
        (p) => friendIds.includes(p.id) && valueOf(p) !== null,
      );
      const group = def.key === "carry" || def.key === "liability";
      if (group ? friends.length < 2 : friends.length < 1) continue;
      if (def.key === "mvp") {
        const winners =
          m.mvpIds?.filter((id) => m.players.some((p) => p.id === id)) ?? [];
        if (!winners.length) continue;
        eligible++;
        for (const entry of entries)
          if (winners.includes(entry.playerId)) entry.matchIds.push(m.id);
        continue;
      }
      eligible++;
      const pool = group ? friends : m.players;
      const values = pool.map(valueOf).filter((v) => v !== null);
      const target =
        def.key === "bottom" ||
        def.key === "liability" ||
        def.key === "worst-kd"
          ? Math.min(...values)
          : Math.max(...values);
      for (const p of friends) {
        const value = valueOf(p);
        if (
          value === target &&
          (def.key !== "bottom" || placement(p, m) === 10)
        )
          entries.find((e) => e.playerId === p.id)!.matchIds.push(m.id);
      }
    }
    return {
      ...def,
      eligible,
      entries: entries.sort(
        (a, b) =>
          b.matchIds.length - a.matchIds.length ||
          a.playerId.localeCompare(b.playerId),
      ),
    };
  });
}
export function agentStats(matches: Match[], playerId: string) {
  const agents = [
    ...new Set(
      matches.flatMap((m) =>
        m.players.filter((p) => p.id === playerId).map((p) => p.agent),
      ),
    ),
  ];
  return agents
    .map((agent) => ({
      agent,
      ...aggregate(
        matches.filter((m) =>
          m.players.some((p) => p.id === playerId && p.agent === agent),
        ),
        playerId,
      ),
    }))
    .sort((a, b) => b.matches - a.matches);
}

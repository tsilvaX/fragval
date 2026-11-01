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
// Equal combat scores share a placement. No arbitrary kills/name tie-breaker.
export function placement(p: Participant, m: Match): number {
  return (
    1 +
    m.players.filter((other) => other.score / other.rounds > p.score / p.rounds)
      .length
  );
}
export function scoreboard(m: Match): Participant[] {
  return [...m.players].sort(
    (a, b) =>
      b.score / b.rounds - a.score / a.rounds || a.id.localeCompare(b.id),
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
      "Sole 10th place by combat score in the entire lobby. The floor is yours.",
  },
  {
    key: "mvp",
    title: "Match MVP",
    description:
      "Highest combat score in the entire lobby. Equal leaders share the award.",
  },
  {
    key: "fragger",
    title: "Lobby Top Fragger",
    description:
      "Most kills among all ten players. Equal leaders share the award.",
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
];
export function calculateAwards(
  matches: Match[],
  friendIds: string[],
  act: Act,
): Award[] {
  const qualifying = uniqueMatches(matches).filter((m) =>
    eligibleMatch(m, act),
  );
  return awardDefinitions.map((def) => {
    const entries = friendIds.map((playerId) => ({
      playerId,
      matchIds: [] as string[],
    }));
    let eligible = 0;
    for (const m of qualifying) {
      const friends = m.players.filter((p) => friendIds.includes(p.id));
      const group = def.key === "carry" || def.key === "liability";
      if (group ? friends.length < 2 : friends.length < 1) continue;
      eligible++;
      const pool = group ? friends : m.players;
      const values = pool.map((p) =>
        def.key === "fragger" ? p.kills : p.score / p.rounds,
      );
      const target =
        def.key === "bottom" || def.key === "liability"
          ? Math.min(...values)
          : Math.max(...values);
      for (const p of friends) {
        const value = def.key === "fragger" ? p.kills : p.score / p.rounds;
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

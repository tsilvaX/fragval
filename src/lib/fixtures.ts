import { fixtureFriends } from "../config/players";
import type { Act, Match, Participant } from "./model";
export const fixtureAct: Act = {
  id: "demo-act",
  name: "Exhibition Act",
  startsAt: "2026-10-01T00:00:00Z",
  endsAt: "2026-11-01T00:00:00Z",
  source: "Deterministic fixture season · not the live act",
};
const agents = [
  "Jett",
  "Omen",
  "Killjoy",
  "Sage",
  "Sova",
  "Raze",
  "Cypher",
  "Reyna",
  "Viper",
  "Breach",
];
export function fixtureMatches(): Match[] {
  let seed = 43108;
  const random = (min: number, max: number) => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return min + (seed % (max - min + 1));
  };
  return Array.from({ length: 36 }, (_, i) => {
    const red = i % 4 === 0 ? random(6, 11) : 13,
      blue = red === 13 ? random(5, 11) : 13;
    const rounds = red + blue;
    const friendCount = i % 7 === 0 ? 1 : i % 3 === 0 ? 3 : 4;
    const selected = Array.from(
      { length: friendCount },
      (_, j) => fixtureFriends[(j + (i % 4)) % 4],
    );
    const players: Participant[] = Array.from({ length: 10 }, (_, j) => {
      const f = selected[j],
        skill = f ? [6, 1, 4, -3][fixtureFriends.indexOf(f)] : 0;
      const kills = Math.max(2, random(8, 26) + skill),
        deaths = random(9, 21);
      const head = random(12, 43),
        body = random(40, 100),
        leg = random(4, 16);
      return {
        id: f?.id ?? `guest-${i}-${j}`,
        name: f ? `${f.name}#${f.tag}` : `Player ${j + 1}`,
        team: j < 5 ? "Red" : "Blue",
        agent: f
          ? i % 5 === 0
            ? agents[(fixtureFriends.indexOf(f) + 4) % 10]
            : f.agent
          : agents[j],
        kills,
        deaths,
        assists: random(2, 12),
        score: Math.max(70, 100 + kills * 5 + random(-30, 65)) * rounds,
        performanceScore: Math.min(
          500,
          Math.max(0, Math.round(100 + kills * 6 - deaths * 2 + head / 2)),
        ),
        rounds,
        damage: (60 + kills * 4 + random(0, 35)) * rounds,
        received: (105 + random(0, 45)) * rounds,
        head,
        body,
        leg,
      };
    });
    return {
      id: `exhibit-${String(i + 1).padStart(3, "0")}`,
      actId: fixtureAct.id,
      startedAt: new Date(
        Date.UTC(2026, 9, 30, 21) - i * 17 * 3600000,
      ).toISOString(),
      map: ["Ascent", "Haven", "Bind", "Lotus", "Sunset", "Split", "Pearl"][
        i % 7
      ],
      queue: "competitive",
      completed: true,
      red,
      blue,
      players,
      mvpIds: players
        .filter(
          (p) =>
            p.performanceScore ===
            Math.max(...players.map((other) => other.performanceScore!)),
        )
        .map((p) => p.id),
    };
  });
}

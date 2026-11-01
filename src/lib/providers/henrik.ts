import { z } from "zod";
import { trackedAccounts } from "../../config/players";
import type { Act, Friend, Match } from "../model";
import type { MatchProvider } from "./contract";
import { requestJson, ProviderError } from "./http";
import { eligibleMatch } from "../stats";
const count = z.number().int().nonnegative();
const rawMatch = z.object({
  metadata: z.object({
    match_id: z.string(),
    started_at: z.string().datetime({ offset: true }),
    is_completed: z.boolean(),
    map: z.object({ name: z.string() }),
    season: z.object({ id: z.string() }),
    queue: z.object({ id: z.string() }),
  }),
  teams: z.array(
    z.object({ team_id: z.string(), rounds: z.object({ won: count }) }),
  ),
  players: z.array(
    z.object({
      puuid: z.string(),
      team_id: z.string(),
      agent: z.object({ name: z.string() }),
      stats: z.object({
        kills: count,
        deaths: count,
        assists: count,
        score: count,
        headshots: count.nullish(),
        bodyshots: count.nullish(),
        legshots: count.nullish(),
        damage: z
          .object({ dealt: count.nullish(), received: count.nullish() })
          .nullish(),
      }),
    }),
  ),
});
export function normalizeHenrik(raw: unknown, friends: Friend[]): Match {
  const m = rawMatch.parse(raw);
  if (m.teams.length !== 2) throw new Error("Unsupported team structure");
  if (new Set(m.players.map((p) => p.puuid)).size !== m.players.length)
    throw new Error("Duplicate participant identifiers");
  const [red, blue] = m.teams;
  const rounds = red.rounds.won + blue.rounds.won;
  return {
    id: m.metadata.match_id,
    actId: m.metadata.season.id,
    startedAt: m.metadata.started_at,
    map: m.metadata.map.name,
    completed: m.metadata.is_completed,
    queue: m.metadata.queue.id.toLowerCase(),
    red: red.rounds.won,
    blue: blue.rounds.won,
    players: m.players.map((p, i) => {
      const friend = friends.find((f) => f.id === p.puuid);
      if (p.team_id !== red.team_id && p.team_id !== blue.team_id)
        throw new Error("Unknown team ID");
      return {
        id: friend?.id ?? `anonymous-${m.metadata.match_id}-${i}`,
        name: friend ? `${friend.name}#${friend.tag}` : `Player ${i + 1}`,
        team: p.team_id === red.team_id ? "Red" : "Blue",
        agent: p.agent.name,
        kills: p.stats.kills,
        deaths: p.stats.deaths,
        assists: p.stats.assists,
        score: p.stats.score,
        rounds,
        damage: p.stats.damage?.dealt ?? null,
        received: p.stats.damage?.received ?? null,
        head: p.stats.headshots ?? null,
        body: p.stats.bodyshots ?? null,
        leg: p.stats.legshots ?? null,
      };
    }),
  };
}
export class HenrikProvider implements MatchProvider {
  constructor(
    private resolve: (
      name: string,
      tag: string,
      fetcher: () => Promise<string>,
    ) => Promise<string>,
  ) {}
  async sync(knownIds: Set<string>) {
    const key = process.env.HENRIK_API_KEY;
    if (!key)
      throw new ProviderError(
        "Live mode needs HENRIK_API_KEY in .env.local. Fixture mode works without credentials.",
        503,
      );
    if (process.env.HENRIK_AUTHORIZED !== "true")
      throw new ProviderError(
        "Confirm permitted provider access before setting HENRIK_AUTHORIZED=true. See docs/PROVIDERS.md.",
        503,
      );
    if (
      trackedAccounts.length < 3 ||
      trackedAccounts.length > 4 ||
      trackedAccounts.some((p) => !p.consent)
    )
      throw new ProviderError(
        "Configure 3–4 authorized, opted-in friends in src/config/players.ts.",
        503,
      );
    const region = process.env.VALORANT_REGION ?? "na";
    const platform = process.env.VALORANT_PLATFORM ?? "pc";
    if (
      !["na", "eu", "ap", "kr", "br", "latam"].includes(region) ||
      !["pc", "console"].includes(platform)
    )
      throw new ProviderError(
        "Invalid server region or platform configuration.",
        503,
      );
    const get = (path: string) =>
      requestJson(`https://api.henrikdev.xyz${path}`, key);
    const content = z
      .object({
        data: z.object({
          acts: z.array(
            z.object({ id: z.string().nullable(), name: z.string() }),
          ),
        }),
      })
      .parse(await get("/valorant/v1/content"));
    const seasons = z
      .object({
        data: z.array(
          z.object({
            uuid: z.string(),
            displayName: z.string(),
            title: z.string().nullable(),
            type: z.string().nullable(),
            startTime: z.string(),
            endTime: z.string(),
          }),
        ),
      })
      .parse(await requestJson("https://valorant-api.com/v1/seasons"));
    const candidates = seasons.data.filter(
      (s) =>
        s.type === "EAresSeasonType::Act" &&
        Date.now() >= Date.parse(s.startTime) &&
        Date.now() < Date.parse(s.endTime),
    );
    const dates = candidates.length === 1 ? candidates[0] : null;
    if (
      !dates ||
      !content.data.acts.some(
        (a) => a.id?.toLowerCase() === dates.uuid.toLowerCase(),
      )
    )
      throw new ProviderError(
        "The current act could not be verified against the season catalog and provider content. No new matches were imported.",
      );
    const act: Act = {
      id: dates.uuid,
      name: dates.title ?? dates.displayName,
      startsAt: dates.startTime,
      endsAt: dates.endTime,
      source:
        "VALORANT-API season dates and type; ID verified against Riot content via HenrikDev",
    };
    const friends: Friend[] = [];
    const warnings: string[] = [];
    for (const account of trackedAccounts) {
      const id =
        account.puuid ??
        (await this.resolve(
          account.name,
          account.tag,
          async () =>
            z
              .object({ data: z.object({ puuid: z.string() }) })
              .parse(
                await get(
                  `/valorant/v2/account/${encodeURIComponent(account.name)}/${encodeURIComponent(account.tag)}`,
                ),
              ).data.puuid,
        ));
      let rank: string | null = null;
      try {
        rank = z
          .object({
            data: z.object({
              current: z.object({ tier: z.object({ name: z.string() }) }),
            }),
          })
          .parse(
            await get(
              `/valorant/v3/by-puuid/mmr/${region}/${platform}/${encodeURIComponent(id)}`,
            ),
          ).data.current.tier.name;
      } catch {
        warnings.push(
          `${account.name}: current rank is unavailable. Match statistics are still supported.`,
        );
      }
      friends.push({
        id,
        name: account.name,
        tag: account.tag,
        agent: account.agent,
        color: account.color,
        rank,
      });
    }
    if (new Set(friends.map((f) => f.id)).size !== friends.length)
      throw new ProviderError(
        "Each tracked account must resolve to a unique PUUID.",
      );
    const matches = new Map<string, Match>();
    let skipped = 0;
    const deadline = Date.now() + 120000;
    let details = 0;
    history: for (const f of friends) {
      // Paginate the materialized history, then fetch only unseen full scoreboards.
      for (let page = 1; page <= 20; page++) {
        if (Date.now() >= deadline) {
          warnings.push(
            "Refresh reached its two-minute retrieval budget. Retrieved progress was saved; refresh again to continue.",
          );
          break history;
        }
        const stored = z
          .object({
            data: z.array(
              z.object({
                meta: z.object({
                  id: z.string(),
                  started_at: z.string(),
                  season: z.object({ id: z.string() }),
                }),
              }),
            ),
            results: z.object({ after: count }),
          })
          .parse(
            await get(
              `/valorant/v1/by-puuid/stored-matches/${region}/${encodeURIComponent(f.id)}?mode=competitive&size=20&page=${page}`,
            ),
          );
        let reachedBoundary = false;
        for (const entry of stored.data) {
          if (Date.parse(entry.meta.started_at) < Date.parse(act.startsAt)) {
            reachedBoundary = true;
            continue;
          }
          if (
            entry.meta.season.id !== act.id ||
            knownIds.has(entry.meta.id) ||
            matches.has(entry.meta.id)
          )
            continue;
          if (details >= 40 || Date.now() >= deadline) {
            warnings.push(
              "Refresh reached its 40-new-scoreboard or two-minute retrieval budget. Retrieved progress was saved; refresh again to continue.",
            );
            break history;
          }
          details++;
          const payload = z
            .object({ data: z.unknown() })
            .parse(
              await get(
                `/valorant/v4/match/${region}/${encodeURIComponent(entry.meta.id)}`,
              ),
            );
          try {
            const m = normalizeHenrik(payload.data, friends);
            if (m.id === entry.meta.id && eligibleMatch(m, act))
              matches.set(m.id, m);
            else skipped++;
          } catch {
            skipped++;
          }
        }
        if (!stored.results.after || !stored.data.length || reachedBoundary)
          break;
        if (page === 20)
          warnings.push(
            `${f.name}: stopped at the safety limit of 400 stored matches. Refresh coverage is partial.`,
          );
      }
    }
    if (skipped)
      warnings.push(
        `${skipped} unsupported or malformed scoreboards were skipped; they contribute no statistics or awards.`,
      );
    warnings.push(
      "Per-weapon hit and damage breakdowns are not provided by this integration.",
    );
    return {
      act,
      friends,
      matches: [...matches.values()],
      warnings,
      coverage:
        "Retrieved matches only. HenrikDev stored history is a materialized subset and may contain gaps; these are not complete act totals.",
    };
  }
}

import "server-only";
import { fixtureFriends } from "../config/players";
import { fixtureAct, fixtureMatches } from "./fixtures";
import type { DashboardData, Mode } from "./model";
import { getStore } from "./persistence";
import { HenrikProvider, henrikRosterKey } from "./providers/henrik";
import { RiotProvider } from "./providers/riot";
import { ProviderError } from "./providers/http";
import { eligibleMatch, agentStats, sharedMatches } from "./stats";
import { configuredMode } from "./readiness";
export function dataMode(demo = false): Mode {
  try {
    return configuredMode(demo);
  } catch {
    throw new ProviderError(
      "DATA_PROVIDER must be fixture, henrik, or riot.",
      503,
    );
  }
}
function prepareDashboard(data: DashboardData): DashboardData {
  data = {
    ...data,
    matches: sharedMatches(
      data.matches,
      data.friends.map((f) => f.id),
      data.act,
    ),
  };
  if (data.mode === "fixture") {
    const currentFixtures = new Map(fixtureMatches().map((m) => [m.id, m]));
    return {
      ...data,
      matches: data.matches.map((m) => currentFixtures.get(m.id) ?? m),
      coverage: `${data.matches.length} deterministic shared exhibition matches. Fictional accounts and results; this is not live VALORANT data.`,
    };
  }
  const pendingMvp = data.matches.filter((m) => m.mvpIds === undefined).length;
  return {
    ...data,
    warnings: pendingMvp
      ? [
          ...data.warnings,
          `${pendingMvp} cached shared matches are awaiting official MVP data. Refresh again to continue updating history. These matches are excluded from MVP totals until verified.`,
        ]
      : data.warnings,
    friends: data.friends.map((friend) => ({
      ...friend,
      agent: agentStats(data.matches, friend.id)[0]?.agent ?? "Unknown",
    })),
  };
}
export async function synchronize(demo = false): Promise<{
  data: DashboardData;
  added: number;
}> {
  const mode = dataMode(demo);
  const store = getStore();
  if (!(await store.acquireLock(mode)))
    throw new ProviderError(
      "A refresh is already in progress. Please wait.",
      409,
    );
  try {
    const previous = await store.readSnapshot(mode);
    if (
      previous?.lastSync &&
      (mode === "fixture" || Date.now() < Date.parse(previous.act.endsAt)) &&
      Date.now() - Date.parse(previous.lastSync) < 15000
    )
      return { data: prepareDashboard(previous), added: 0 };
    const rosterKey = mode === "henrik" ? henrikRosterKey() : undefined;
    // A roster change can turn an anonymous participant into a linked account.
    // Revisit old mappings until every available scoreboard is updated, even
    // when the provider's budget spreads this work across multiple refreshes.
    const sharedIds = new Set(
      sharedMatches(
        previous?.matches ?? [],
        previous?.friends.map((f) => f.id) ?? [],
        previous?.act ?? fixtureAct,
      ).map((m) => m.id),
    );
    const normalizedIds = new Set(
      previous?.matches
        .filter(
          (m) =>
            mode !== "henrik" ||
            (m.rosterKey === rosterKey &&
              (!sharedIds.has(m.id) || m.mvpIds !== undefined)),
        )
        .map((m) => m.id),
    );
    const snapshot =
      mode === "fixture"
        ? {
            act: fixtureAct,
            friends: fixtureFriends,
            matches: fixtureMatches(),
            coverage:
              "36 deterministic exhibition matches. Fictional accounts and results; this is not live VALORANT data.",
            warnings: [],
          }
        : await (
            mode === "henrik"
              ? new HenrikProvider(store.resolveIdentity)
              : new RiotProvider()
          ).sync(normalizedIds);
    snapshot.matches = snapshot.matches.filter((m) =>
      eligibleMatch(m, snapshot.act),
    );
    // Retain valid solo records internally so sync does not repeatedly fetch
    // their scoreboards and exhaust its retrieval budget. Only shared games
    // contribute to the dashboard or its new-match count.
    const knownIds = new Set(previous?.matches.map((m) => m.id));
    const added = sharedMatches(
      snapshot.matches,
      snapshot.friends.map((f) => f.id),
      snapshot.act,
    ).filter((m) => !knownIds.has(m.id)).length;
    await store.saveSnapshot(mode, snapshot);
    return {
      data: prepareDashboard((await store.readSnapshot(mode))!),
      added,
    };
  } finally {
    await store.releaseLock(mode);
  }
}
export async function getDashboard(demo = false) {
  const mode = dataMode(demo);
  const existing = await getStore().readSnapshot(mode);
  if (!existing) return (await synchronize(demo)).data;
  if (mode !== "fixture" && Date.now() >= Date.parse(existing.act.endsAt)) {
    // Never return last act's cached totals as the current act.
    return (await synchronize(demo)).data;
  }
  return prepareDashboard(existing);
}

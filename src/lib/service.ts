import "server-only";
import { fixtureFriends } from "../config/players";
import { fixtureAct, fixtureMatches } from "./fixtures";
import type { DashboardData, Mode } from "./model";
import { getStore } from "./persistence";
import { HenrikProvider } from "./providers/henrik";
import { RiotProvider } from "./providers/riot";
import { ProviderError } from "./providers/http";
import { eligibleMatch, agentStats } from "./stats";
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
function withObservedAgents(data: DashboardData): DashboardData {
  if (data.mode === "fixture") return data;
  return {
    ...data,
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
      return { data: withObservedAgents(previous), added: 0 };
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
          ).sync(new Set(previous?.matches.map((m) => m.id)));
    snapshot.matches = snapshot.matches.filter((m) =>
      eligibleMatch(m, snapshot.act),
    );
    const added = await store.saveSnapshot(mode, snapshot);
    return {
      data: withObservedAgents((await store.readSnapshot(mode))!),
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
  return withObservedAgents(existing);
}

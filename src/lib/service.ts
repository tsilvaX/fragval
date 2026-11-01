import "server-only";
import { fixtureFriends } from "../config/players";
import { fixtureAct, fixtureMatches } from "./fixtures";
import type { DashboardData, Mode } from "./model";
import {
  acquireLock,
  readSnapshot,
  releaseLock,
  resolveIdentity,
  saveSnapshot,
} from "./store";
import { HenrikProvider } from "./providers/henrik";
import { RiotProvider } from "./providers/riot";
import { ProviderError } from "./providers/http";
import { eligibleMatch } from "./stats";
export function dataMode(): Mode {
  const mode = process.env.DATA_PROVIDER ?? "fixture";
  if (!["fixture", "henrik", "riot"].includes(mode))
    throw new ProviderError(
      "DATA_PROVIDER must be fixture, henrik, or riot.",
      503,
    );
  return mode as Mode;
}
export async function synchronize(): Promise<{
  data: DashboardData;
  added: number;
}> {
  const mode = dataMode();
  if (!acquireLock(mode))
    throw new ProviderError(
      "A refresh is already in progress. Please wait.",
      409,
    );
  try {
    const previous = readSnapshot(mode);
    if (
      previous?.lastSync &&
      (mode === "fixture" || Date.now() < Date.parse(previous.act.endsAt)) &&
      Date.now() - Date.parse(previous.lastSync) < 15000
    )
      return { data: previous, added: 0 };
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
              ? new HenrikProvider(resolveIdentity)
              : new RiotProvider()
          ).sync(new Set(previous?.matches.map((m) => m.id)));
    snapshot.matches = snapshot.matches.filter((m) =>
      eligibleMatch(m, snapshot.act),
    );
    const added = saveSnapshot(mode, snapshot);
    return { data: readSnapshot(mode)!, added };
  } finally {
    releaseLock(mode);
  }
}
export async function getDashboard() {
  const mode = dataMode();
  const existing = readSnapshot(mode);
  if (!existing) return (await synchronize()).data;
  if (mode !== "fixture" && Date.now() >= Date.parse(existing.act.endsAt)) {
    // Never return last act's cached totals as the current act.
    return (await synchronize()).data;
  }
  return existing;
}

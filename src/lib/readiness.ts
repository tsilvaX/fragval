import "server-only";
import { trackedAccounts } from "../config/players";
import type { Mode, SetupStatus } from "./model";

export function configuredMode(demo = false): Mode {
  if (demo) return "fixture";
  const value =
    process.env.DATA_PROVIDER ||
    (trackedAccounts.length ? "henrik" : "fixture");
  if (value === "fixture" || value === "henrik" || value === "riot")
    return value;
  throw new Error("DATA_PROVIDER must be fixture, henrik, or riot.");
}
export function setupStatus(): SetupStatus {
  const validRoster =
    trackedAccounts.length >= 3 &&
    trackedAccounts.length <= 4 &&
    trackedAccounts.every((p) => p.consent);
  return {
    provider: (() => {
      try {
        return configuredMode();
      } catch {
        return null;
      }
    })(),
    accounts: trackedAccounts.map((p) => ({
      riotId: `${p.name}#${p.tag}`,
      aliases: p.aliases?.map((a) => `${a.name}#${a.tag}`),
      consent: p.consent,
      color: p.color,
    })),
    hasKey: !!process.env.HENRIK_API_KEY?.trim(),
    authorized: process.env.HENRIK_AUTHORIZED === "true",
    rosterReady: validRoster,
    region: process.env.VALORANT_REGION || "auto",
    ready:
      !!process.env.HENRIK_API_KEY?.trim() &&
      process.env.HENRIK_AUTHORIZED === "true" &&
      validRoster,
  };
}

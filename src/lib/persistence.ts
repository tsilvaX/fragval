import "server-only";
import type { DashboardData, Mode } from "./model";
import type { ProviderSnapshot } from "./providers/contract";
import { ProviderError } from "./providers/http";
import * as sqlite from "./store";
import { createPostgresStore } from "./store-postgres";

type Result<T> = T | Promise<T>;
export type CourtStore = {
  readSnapshot(mode: Mode): Result<DashboardData | null>;
  saveSnapshot(mode: Mode, snapshot: ProviderSnapshot): Result<number>;
  acquireLock(mode: Mode): Result<boolean>;
  releaseLock(mode: Mode): Result<void>;
  resolveIdentity(
    name: string,
    tag: string,
    fetcher: () => Promise<string>,
  ): Promise<string>;
};

// Each sync gets its own lock owner. The HTTP database client can be shared,
// but lease ownership must never be shared between concurrent invocations.
export function getStore(): CourtStore {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (url) return createPostgresStore(url);
  if (process.env.VERCEL === "1")
    throw new ProviderError(
      "Connect a Neon database to this Vercel project before loading court records.",
      503,
    );
  return sqlite;
}

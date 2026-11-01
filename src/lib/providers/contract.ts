import type { Act, Friend, Match } from "../model";
export type ProviderSnapshot = {
  act: Act;
  friends: Friend[];
  matches: Match[];
  coverage: string;
  warnings: string[];
};
export interface MatchProvider {
  sync(knownIds: Set<string>): Promise<ProviderSnapshot>;
}

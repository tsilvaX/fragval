import type { MatchProvider, ProviderSnapshot } from "./contract";
import { ProviderError } from "./http";
// Deliberate integration boundary. RSO and a production-approved use case are
// prerequisites, not switches that an API key alone can satisfy.
export class RiotProvider implements MatchProvider {
  async sync(): Promise<ProviderSnapshot> {
    throw new ProviderError(
      "Riot integration requires an approved production application and RSO opt-in. Personal/private applications are currently unsupported by Riot policy. See docs/PROVIDERS.md.",
      503,
    );
  }
}

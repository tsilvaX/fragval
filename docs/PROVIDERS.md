# Provider research and integration contract

Researched against current public primary documentation on **2026-10-31**. The downloaded OpenAPI schema was inspected before implementing fields. No Tracker.gg scraping, session cookies, browser tokens, raw private-data endpoints or game-client credential extraction is used.

## Live roster and explicit deterministic exhibition

Thirty-six generated exhibition matches, four fictional friends, fixed PRNG seed, fixed October 2026 dates and a clearly labeled exhibition act. This fixture act is separate from the current live act and is not a claim about the live game. Demo and live SQLite namespaces never mix. Fixture refresh re-ingests the same IDs and exercises deduplication.

With the configured real roster, default mode is live HenrikDev. The `/api/setup` response exposes readiness booleans and the configured roster, never a key. Missing credentials render an explicit connection screen. `?demo=1` explicitly selects the fictional exhibition for both dashboard and refresh requests; it is never an automatic fallback.

## HenrikDev: conditional experimental integration

Primary sources:

- [Documentation index](https://docs.henrikdev.xyz/llms.txt)
- [Authentication and legitimate key setup](https://docs.henrikdev.xyz/general/auth)
- [Published OpenAPI schema](https://api.henrikdev.xyz/openapi.json)
- [Stored-history completeness and pagination](https://docs.henrikdev.xyz/valorant/guides/stored-matches)
- [Rate limiting](https://docs.henrikdev.xyz/general/rate-limiting)
- [v4 match details](https://docs.henrikdev.xyz/api-reference/valorant/get-match-details-v4)
- [v3 PUUID MMR](https://docs.henrikdev.xyz/api-reference/valorant/get-mmr-by-puuid-v3)

The public auth docs require an API key from the [HenrikDev dashboard](https://api.henrikdev.xyz/dashboard/), which uses Discord sign-in. Public documentation does **not** establish blanket authorization for this private deployment. Review the current dashboard/key terms and applicable Riot policies, and obtain any required authorization and player opt-in before enabling live requests. The operator supplied a key and confirmed the four owners' consent; live access was validated and configured locally. No live key is included in source control.

`HENRIK_AUTHORIZED=true` is an operator acknowledgement, **not proof of provider permission and not an implementation of Riot Sign On**. Every configured friend must also have `consent: true`; only set that after the required actual opt-in is complete. If the applicable terms do not permit this use, leave fixture mode enabled. Do not use an unofficial provider as a workaround for Riot access requirements.

Implemented, documented routes:

| Purpose | Route |
| --- | --- |
| Resolve Riot ID | `GET /valorant/v2/account/{name}/{tag}` |
| Resolve cached account region | `GET /valorant/v2/by-puuid/account/{puuid}` |
| Content catalog | `GET /valorant/v1/content` |
| Current MMR tier | `GET /valorant/v3/by-puuid/mmr/{affinity}/{platform}/{puuid}` |
| Stored history | `GET /valorant/v1/by-puuid/stored-matches/{affinity}/{puuid}?mode=competitive&size=20&page=N` |
| Full scoreboard | `GET /valorant/v4/match/{affinity}/{match_id}` |

The stored-history endpoint is a materialized, potentially incomplete subset, not an archive of all matches. Its `results.after` supports pagination. The application caps retrieval at 400 summaries per account, forty new scoreboards and a two-minute between-request retrieval budget per refresh; it saves partial progress and warns when a limit is reached. Missing individual matches can exist even when `after` is zero. Summaries are only used to discover IDs; a complete supported scoreboard is required for inclusion.

v4 player `stats.score` is normalized as total combat score and divided by rounds from the two team round-win counts. `headshots`, `bodyshots` and `legshots` are hit-region counts; HS% uses hits, not kills. `damage.dealt` and `damage.received` are totals. Player teams are joined using opaque `team_id`, not array index or a presumed team number. Optional unavailable metrics remain null. Zod rejects unsupported payloads instead of inventing values.

Active season resolution uses [VALORANT-API seasons](https://valorant-api.com/v1/seasons): exactly one `EAresSeasonType::Act` must contain the server's current UTC time. The UUID must also exist in HenrikDev's content catalog. No episode/act identifier is hardcoded in live mode; unknown metadata blocks ingestion. VALORANT-API is an unofficial, verified public game-content source, not Riot's official platform API.

Current rank is optional: if MMR fails, match statistics remain available with a warning. The implemented v4 normalization does not attribute hit regions or damage to individual weapons, so weapon-specific HS/body/leg%, damage distribution and weapon performance remain **Not available from data provider.**

Automatic region mode uses the account endpoint's documented `region` field. A cached PUUID is looked up through the documented by-PUUID account route to recover its current region. Explicit region override remains available.

The supplied key's observed shortest window was **30 credits / 60 seconds**. This counts background Riot requests as well as API calls. The HTTP client honors both `Retry-After` and the seconds-duration `X-RateLimit-Reset`, and waits proactively when `X-RateLimit-Remaining` reaches zero. Longer windows return a retry delay. If retrieval is paused after importing new matches, those matches are committed and the coverage warning explains how to resume.

## Riot official: future boundary, currently unavailable

Primary sources:

- [Riot VALORANT game policy and RSO requirements](https://developer.riotgames.com/docs/valorant)
- [Official VALORANT API overview](https://support-developer.riotgames.com/hc/en-us/articles/22698769097107-VALORANT)
- [API reference](https://developer.riotgames.com/apis)

Riot states that personal key applications are not supported, that private/personal-only apps are not an approved use case, and that showing player statistics requires opt-in through approved RSO. RSO access requires an approved production application.

The `RiotProvider` therefore intentionally returns a clear setup/policy error. It does not pretend an arbitrary developer key enables this product. A future approved product would implement RSO verification, consent lifecycle, official account resolution, `VAL-CONTENT-V1`, `VAL-MATCH-V1` matchlist/details and privacy controls behind the existing normalized provider interface. This work is not represented as complete.

## Security and limitations

- Keys stay in server environment variables; no `NEXT_PUBLIC_` secrets.
- Anonymous player labels and synthetic per-match IDs are persisted for untracked participants.
- Maximum three HTTP attempts, bounded exponential delay, honored `Retry-After`, explicit 401/403 errors, and a persistent refresh lock.
- Real account resolution, rank retrieval, act verification, match import and live rendering were verified for all four configured accounts. The key and cached records remain local, not in Git.
- Cache totals are based only on retrieved supported matches; the app never claims complete-act totals.

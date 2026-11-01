# Architecture

## Implementation plan and completed structure

1. Verify public provider contracts and access constraints; choose offline-first fixtures and an authorization-gated HenrikDev adapter.
2. Establish paper/charcoal/orange/lime tokens, local typefaces and agent/map assets.
3. Build all six product views over a shared normalized match model.
4. Cache unique matches in SQLite; separate fixture/Henrik/Riot namespaces; persist Riot-ID-to-PUUID resolution.
5. Calculate statistics and awards with pure, independently tested functions.
6. Verify full desktop/mobile interactions with Playwright, inspect screenshots, and build production output.

## Data flow

`CourtApp → GET /api/dashboard → service → SQLite → normalized records → pure stats → views`

`REFRESH STATS → POST /api/refresh → SQLite lock → provider → validation/privacy normalization → eligibility filter → atomic cache transaction → updated records → UI`

- Provider implementations satisfy `MatchProvider`. Fixture mode requires no network. Riot's future adapter returns an explicit setup error until an approved integration is implemented.
- Real accounts are configured separately from fictional fixtures. Live mode is the default for the configured roster, with an explicit connection/readiness screen until credentials are ready. `?demo=1` is an explicit exhibition choice. The safe setup endpoint never returns credential values. The secure CLI validates and stores a key in ignored local environment configuration.
- Auto region resolution uses each account's documented region, including a by-PUUID lookup for cached identities. Displayed main agents are derived from actual imported match counts; ranks and agent preferences are not invented.
- Henrik history is paginated by PUUID, twenty records per stored page, at most twenty pages per friend. Only unseen IDs have their full details fetched. Each sync retrieves at most forty new scoreboards and checks a two-minute retrieval budget between requests; a bounded in-flight request can finish after that budget. Partial progress is saved with a coverage warning so another refresh can continue. Completed supported matches are stored once. Unsupported results are excluded and counted in warnings. Failed transactions leave the prior snapshot intact.
- An atomic SQLite UPSERT lock prevents overlapping refreshes across workers on the same disk. Its thirty-minute crash lease covers bounded page/detail work; this app is intended for a single instance. A fifteen-second success cooldown avoids button bursts. Cached data remains visible on refresh failures.
- History retention, gaps in materialized provider history and the safety cap prevent any full-act completeness guarantee. The UI always states retrieved-match coverage.
- Provider errors avoid logging response bodies or credentials. Source API keys never enter a client component. Untracked names and PUUIDs are replaced before persistence.
- The page shell loads records through same-origin API routes. Visitors open the page, view records and refresh without authentication. There is no password proxy or login flow. Provider credentials remain server-only; refresh still validates request origin, rate limits provider calls and prevents overlapping synchronization.

## Aggregates

- K/D = sum(kills) / sum(deaths). Undefined ratios show a dash.
- ACS = sum(total combat score) / sum(rounds).
- ADR = sum(damage dealt) / sum(rounds).
- DDΔ = sum(damage dealt − received) / sum(rounds).
- HS% = sum(head hits) / sum(head + body + leg hits) × 100.
- Win% = wins / matches × 100. Draws count in matches but neither wins nor losses.
- A missing required damage/hit field in the sample makes the corresponding aggregate unavailable, rather than changing its denominator silently.
- Agent aggregates use the same formulas on the agent subset. K/D is a ratio of totals, never an unweighted average of per-match ratios. Best-on-agent requires five matches; ties share leadership.

The normalized score is a total score. Live v4 fields are not confused with the stored-history `stats.score` field: stored summaries are used only for match IDs and season/date filtering.

## Eligibility and court rules

Only completed Competitive matches with exactly ten unique participants, two five-player teams, valid nonnegative core statistics and a positive shared round count qualify. Both the act UUID and the half-open `[start, end)` date interval must match.

Scoreboard ordering uses ACS (equivalent to total score when everyone has the same denominator). Equal scores share competition placement: 1, 1, 3. Stable ID sorting affects display order only, not awards.

- **Bottom Frag King:** sole rank 10 among all ten players. A tie for last does not qualify.
- **Match MVP:** every player tied for highest combat score.
- **Lobby Top Fragger:** every player tied for most kills, independently of combat score.
- **Friend Group Carry / Liability:** every friend tied for highest/lowest combat score within the tracked participants. Requires at least two tracked friends.

Each category exposes its exact eligible-match denominator and each recipient's match-ID evidence. No group awards are created for solo-friend matches. Unique match IDs prevent double counting across player histories.

## Design choices

Dark charcoal surfaces, warm off-white text, orange and lime accents, horizontal top navigation, square cards, condensed sports typography, fine rules, locally hosted agent portraits and understated court humor. Dark mode is applied from the initial HTML/CSS paint regardless of system preference; native controls and browser theme metadata use the same dark scheme. Chart bars begin at zero; negative deltas extend left of zero. The ACS trend uses a labeled zero-based scale and explicitly aligns by each player's match index, not calendar date. Motion is confined to state changes, hover, refresh and scoreboard entry; `prefers-reduced-motion` disables it.

## Scope limits

Live provider access, retention and account authorization depend on the operator's authorized key and player opt-in. Weapon-specific information is deliberately unavailable; global hits are shown separately. Visitor access requires no login or password. Use a persistent single-server deployment and HTTPS. Riot OAuth is not implemented.

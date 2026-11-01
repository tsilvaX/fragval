# Verification record

Validated locally on Windows with Node 26.13.0 and Next.js 16.4.3. CI targets Node 24 LTS on Linux.

## Results

| Boundary | Result | Evidence |
| --- | --- | --- |
| TypeScript | Passed | `npm run typecheck` |
| Statistics, provider contracts, cache, setup and service | 33 tests passed | `npm test` |
| Browser flows | 9 passed | `npm run test:e2e`; one duplicate mobile width-matrix test intentionally skipped |
| Production compilation | Passed, no build warnings | `npm run build` |
| Production access without configured password | Blocked as intended | HTTP 503 |
| Configured password, unauthenticated visitor | Challenged as intended | HTTP 401 |
| Authenticated page and API | Passed | HTTP 200; 36 unique fixtures returned |
| Authenticated same-origin refresh | Passed | HTTP 200; cached fixtures preserved |
| Browser console on production page | Passed | No page errors or console errors |
| Real HenrikDev connection | Passed | All four Riot IDs resolved; current ranks loaded |
| Real current-act history | Passed | 61 unique supported Competitive matches ingested into the local cache |
| Live UI | Passed | All six views checked at desktop and mobile widths, including full scoreboards and each friend's agents; no browser errors |
| Secret isolation | Passed | No API key in client build assets, standalone environment files or staged source; `.env.local` is ignored |
| Dark mode | Passed | All six live views, scoreboards and dialogs checked at desktop/mobile sizes under light and dark system preferences; principal text/control pairs exceed 4.5:1 contrast |

The browser story is: navigate from Overview to comparisons, choose a metric, inspect The Court's evidence and rules, filter match history, expand and collapse a full ten-player scoreboard, switch an agent's player filter, inspect explicit Armory availability, refresh through the API into SQLite, and see the updated result. URL hashes restore the selected view. Reduced motion is honored. Unrelated request origins are rejected.

The responsive matrix checks all six views at **320, 390, 768, 1024 and 1440 pixels** with no page-level horizontal overflow. Wide scoreboards use their own horizontal scroll container.

Screenshots captured and visually inspected:

- [`desktop-production.png`](../artifacts/desktop-production.png)
- [`mobile-production.png`](../artifacts/mobile-production.png)
- [`desktop-court.png`](../artifacts/desktop-court.png)
- [`mobile-court.png`](../artifacts/mobile-court.png)
- [`live-desktop.png`](../artifacts/live-desktop.png)
- [`live-mobile.png`](../artifacts/live-mobile.png)

## Bugs found and corrected

- Same-origin refresh was initially rejected because Next normalized its internal request URL to `localhost` while the browser used `127.0.0.1`. Validation now checks the actual Host header and an explicitly configured proxy origin. Regression tests cover both accepted and rejected origins.
- Build tracing initially tried to include the runtime database path's containing project. The runtime-only path now explicitly opts out of tracing; the final build has no warning and does not bundle SQLite runtime state.
- Leaderboards now show shared metric positions for tied values instead of suggesting an arbitrary ordering is an additional rank.
- An expired live-act snapshot bypasses the short refresh cooldown; it cannot be returned as current-act data. The test verifies that an unavailable live integration errors instead of substituting fixture data.
- Real key testing exposed free-tier throttling. Requests now honor `X-RateLimit-Reset` as a seconds duration and the remaining-credit header, in addition to `Retry-After`. Partially retrieved matches are committed on a provider pause and subsequent refreshes resume by unique ID. Regression tests cover header semantics and partial progress.
- Live matches used Chamber, Brimstone, Neon and Corrode, beyond the initial fixture asset set. A full local content catalog now covers the returned 30 playable agents and 26 map splash entries.
- Configured account owners' consent is recorded separately from fictional data. Default mode is live, with an honest setup state until credentials are connected; the offline exhibition is an explicit query-parameter choice. Auto region resolution and main-agent selection use provider/account and match data.

## External limits

A real key was supplied and validated locally, and the operator confirmed the four account owners' consent. The retrieved current-act sample contains 39 matches for Mini Wo0t, 19 for HomelessSlayer94, 20 for kotoris kitten and 49 for kotooriiii; shared matches are stored once, for 61 unique matches total. The provider's available stored history was traversed until no retrieval-budget warning remained. This is still not a completeness guarantee for the entire act: HenrikDev's materialized history can have gaps.

The key, generated court password, PUUID cache and actual match cache remain in ignored local files. They are not pushed to GitHub. Fresh deployments must configure server secrets and a durable disk. Riot's official integration is intentionally unavailable pending approval and RSO implementation. Weapon-specific metrics are unavailable.

Docker configuration is provided but a Docker build was not run on this host. No public hosting deployment was created; the repository contains Node/Docker deployment instructions for a private persistent-disk service.

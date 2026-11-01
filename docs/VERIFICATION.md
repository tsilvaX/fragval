# Verification record

Validated locally on Windows with Node 26.13.0 and Next.js 16.4.3. CI targets Node 24 LTS on Linux.

## Results

| Boundary | Result | Evidence |
| --- | --- | --- |
| TypeScript | Passed | `npm run typecheck` |
| Statistics, provider contracts, cache and service | 28 tests passed | `npm test` |
| Browser flows | 7 passed | `npm run test:e2e`; one duplicate mobile width-matrix test intentionally skipped |
| Production compilation | Passed, no build warnings | `npm run build` |
| Production access without configured password | Blocked as intended | HTTP 503 |
| Configured password, unauthenticated visitor | Challenged as intended | HTTP 401 |
| Authenticated page and API | Passed | HTTP 200; 36 unique fixtures returned |
| Authenticated same-origin refresh | Passed | HTTP 200; cached fixtures preserved |
| Browser console on production page | Passed | No page errors or console errors |

The browser story is: navigate from Overview to comparisons, choose a metric, inspect The Court's evidence and rules, filter match history, expand and collapse a full ten-player scoreboard, switch an agent's player filter, inspect explicit Armory availability, refresh through the API into SQLite, and see the updated result. URL hashes restore the selected view. Reduced motion is honored. Unrelated request origins are rejected.

The responsive matrix checks all six views at **320, 390, 768, 1024 and 1440 pixels** with no page-level horizontal overflow. Wide scoreboards use their own horizontal scroll container.

Screenshots captured and visually inspected:

- [`desktop-production.png`](../artifacts/desktop-production.png)
- [`mobile-production.png`](../artifacts/mobile-production.png)
- [`desktop-court.png`](../artifacts/desktop-court.png)
- [`mobile-court.png`](../artifacts/mobile-court.png)

## Bugs found and corrected

- Same-origin refresh was initially rejected because Next normalized its internal request URL to `localhost` while the browser used `127.0.0.1`. Validation now checks the actual Host header and an explicitly configured proxy origin. Regression tests cover both accepted and rejected origins.
- Build tracing initially tried to include the runtime database path's containing project. The runtime-only path now explicitly opts out of tracing; the final build has no warning and does not bundle SQLite runtime state.
- Leaderboards now show shared metric positions for tied values instead of suggesting an arbitrary ordering is an additional rank.
- An expired live-act snapshot bypasses the short refresh cooldown; it cannot be returned as current-act data. The test verifies that an unavailable live integration errors instead of substituting fixture data.

## External limits

No real provider key or Riot IDs were supplied. The HenrikDev workflow is exercised against documented, mocked response contracts, not a real account. Provider access/terms and each friend's required opt-in still need to be completed before live activation. Riot's official integration is intentionally unavailable pending approval and RSO implementation. Weapon-specific metrics are unavailable.

Docker configuration is provided but a Docker build was not run on this host. No public hosting deployment was created; the repository contains Node/Docker deployment instructions for a private persistent-disk service.

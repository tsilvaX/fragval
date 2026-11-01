# Private deployment

Use a single Node 24 LTS service or Docker container with a persistent volume. This is a stateful SQLite app; the default cache is not appropriate for a static export or an ephemeral serverless filesystem.

## Node server

1. Clone the repository on the host and run `npm ci`.
2. Set server-only environment variables, especially a long random `COURT_PASSWORD` and a durable `DATABASE_PATH`.
3. Run `npm run build`, then `npm start` under your process manager.
4. Put port 3000 behind an HTTPS reverse proxy. Set `APP_ORIGIN=https://your-court.example` if the proxy changes the request's effective internal origin.
5. Share the URL and password privately. The browser's Basic Authentication prompt accepts any username.

You can validate the deployed protection with an unauthenticated request: expect 401 when a password is configured, or 503 when production is missing it. Authenticated requests should return the page and `/api/dashboard`. Never expose Basic Authentication over plain HTTP outside loopback or a trusted TLS-terminating proxy.

## Docker

Copy `.env.example` to `.env.local`; set `COURT_PASSWORD` and your provider settings. Then:

```sh
docker compose up --build -d
```

Compose binds to localhost port 3000 so the service is exposed through your HTTPS reverse proxy. The named `court-data` volume survives restarts and image rebuilds. The image runs as the unprivileged `node` user. No `.env` file, API key, SQLite database or test artifact is copied into the image.

## Persistence and backups

The database uses WAL mode. Use SQLite's online backup API or stop the service before copying the database and sidecar files; copying only the main file during writes can omit committed WAL content. Keep backups private because they contain tracked player statistics. Restarting with the same durable path preserves match IDs, PUUID resolution, snapshots and refresh state. An abandoned lock expires after thirty minutes.

Use one application instance and one volume. For multiple replicas or a stateless host, replace the SQLite store with a shared database and distributed locks first. The normalized provider/statistics layers do not depend on the database implementation.

## Refresh behavior

Users trigger synchronization with REFRESH STATS. There is no hidden scheduled task. A successful refresh is rate-limited to once every fifteen seconds; overlapping work returns 409. Refresh failures preserve the last complete transaction, while an expired live act is never presented as the current act. An act transition resolves and caches the new act dynamically on the next request/refresh.

## Live activation checklist

Obtain permitted provider access and the required player opt-in, configure 3–4 friends, set HenrikDev's server key and region/platform, then restart. Confirm the LIVE PROVIDER indicator and inspect coverage details. Fixture and live caches are separate. The official Riot adapter remains disabled pending production approval and RSO implementation.

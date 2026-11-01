# Private deployment

Use a single Node 24 LTS service or Docker container with a persistent volume. This is a stateful SQLite app; the default cache is not appropriate for a static export or an ephemeral serverless filesystem.

Regular `npm run build` output runs with `npm start`. The Docker build sets `BUILD_STANDALONE=true` and runs the generated standalone server instead, so local startup does not emit a mismatched-output warning.

## Node server

1. Clone the repository on the host and run `npm ci`.
2. Set server-only environment variables, especially a long random `COURT_PASSWORD` and a durable `DATABASE_PATH`.
3. Run `npm run build`, then `npm start` under your process manager.
4. Put port 3000 behind an HTTPS reverse proxy. Set `APP_ORIGIN=https://your-court.example` if the proxy changes the request's effective internal origin.
5. Share the URL and password privately. The browser's Basic Authentication prompt accepts any username.

You can validate the deployed protection with an unauthenticated request: expect 401 when a password is configured, or 503 when production is missing it. Authenticated requests should return the page and `/api/dashboard`. Never expose Basic Authentication over plain HTTP outside loopback or a trusted TLS-terminating proxy.

## Docker

Run `npm run setup:live` to validate your permitted provider key and prepare the ignored `.env.local` file, including a private court password if one is missing. Alternatively copy `.env.example` and configure those values manually. Then:

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

The four Riot IDs and the operator's confirmation of their owners' consent are already configured. A real key was validated locally, but no secret or match cache is in Git: configure your deployment's key, access acknowledgement, region (`auto` by default), platform and court password before starting it. Confirm the LIVE PROVIDER indicator and inspect coverage details. Fixture and live caches are separate; `?demo=1` explicitly opens the fictional exhibition. The official Riot adapter remains disabled pending production approval and RSO implementation.

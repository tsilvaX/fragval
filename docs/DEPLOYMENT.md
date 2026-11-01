# Deployment

Use Vercel with Neon Postgres, or a single Node 24 LTS service / Docker container with a persistent SQLite volume. The app is not a static export.

## Vercel and Neon

1. Connect the GitHub repository to a Next.js Vercel project and select Node 24.
2. Add a free Neon database through Vercel Storage. Use the integration’s default environment-variable prefix so `DATABASE_URL` is supplied. The store also accepts `POSTGRES_URL`.
3. Keep automatic database branching off for Production and on for Preview. Real-time subscriptions are not required.
4. Configure server-only `DATA_PROVIDER=henrik`, `HENRIK_API_KEY`, `HENRIK_AUTHORIZED=true`, `VALORANT_REGION=auto`, and `VALORANT_PLATFORM=pc`. Keep secrets in Vercel, outside Git.
5. Deploy the intended commit to Production. Open `/api/setup`, then `/api/dashboard` and the home tab. The first live sync can take several minutes while retrieving scoreboards; subsequent loads use the shared cache. Dashboard and refresh handlers allow up to 300 seconds.

Neon schema creation is lazy and build-safe. Snapshots and unique match inserts commit together. Reads use one SQL statement for a consistent metadata/match view. Refresh leases are shared across instances, expire after thirty minutes, and can only be released by their owner. Fixture and live namespaces remain separate. Vercel without a database connection returns a clear setup error; it never silently falls back to an ephemeral file. Local SQLite history is not uploaded to Git; a new cloud database imports live history through the provider on its first sync.

Regular `npm run build` output runs with `npm start`. The Docker build sets `BUILD_STANDALONE=true` and runs the generated standalone server instead, so local startup does not emit a mismatched-output warning.

## Node server

1. Clone the repository on the host and run `npm ci`.
2. Set server-only provider environment variables and a durable `DATABASE_PATH`.
3. Run `npm run build`, then `npm start` under your process manager.
4. Put port 3000 behind an HTTPS reverse proxy. Set `APP_ORIGIN=https://your-court.example` if the proxy changes the request's effective internal origin.
5. Open or share the URL. No username, password or sign-in is required.

Validate the deployment with ordinary requests without Authorization headers: the page, `/api/setup`, `/api/dashboard` and same-origin `/api/refresh` should work directly when provider configuration is ready. Old `COURT_PASSWORD` environment settings are no longer used.

## Docker

Run `npm run setup:live` to validate your permitted provider key and prepare the ignored `.env.local` file. Alternatively copy `.env.example` and configure those values manually. No visitor credentials are generated. Then:

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

The four Riot IDs and the operator's confirmation of their owners' consent are already configured. A real key was validated locally, but no secret or match cache is in Git: configure your deployment's key, access acknowledgement, region (`auto` by default) and platform before starting it. Confirm the LIVE PROVIDER indicator and inspect coverage details. Fixture and live caches are separate; `?demo=1` explicitly opens the fictional exhibition. The official Riot adapter remains disabled pending production approval and RSO implementation.

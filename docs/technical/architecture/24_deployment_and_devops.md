# 24. Deployment & DevOps

The first production target is **Google Cloud Run**. The release should stay
narrow: trusted core routes only, with recovery-lab tools treated as secondary
unless they pass the same calculation and UX checks.

## 1. Hosting Environment

- **Platform:** Google Cloud Run.
- **Container:** checked-in `Dockerfile` builds the Next.js standalone output,
  runs as the non-root `node` user, exposes `PORT=8080`, and includes a local
  `/api/health` healthcheck.
- **Build:** GitHub Actions builds and pushes production images for deployment.
  The checked-in `cloudbuild.yaml` is kept aligned with the public Cloud Run policy
  for manual Google Cloud Build usage.
- **Default region:** `europe-west1`, supported by
  Cloud Run and Artifact Registry.
- **Runtime port:** Cloud Run provides `PORT`; the container exposes `8080` and
  runs the standalone `server.js` with `HOSTNAME=0.0.0.0`.

The Docker base image is pinned by digest. Dependabot owns controlled Docker and
GitHub Action updates; review each digest update with the production image
build, Trivy high/critical scan, and release checks. The production Buildx push
also publishes an SBOM and maximum-mode provenance attestation beside the
immutable commit-tagged Artifact Registry image.

## 1.1 Local Development Workflow

WSL 2 with Docker Desktop WSL integration is the recommended local development
path. Use `compose.yaml` for the local app and Postgres stack, and `Taskfile.yml`
as the command layer for setup, local DB lifecycle, browser smoke checks, Docker
builds, and the Cloud Run proxy. Windows-native `pnpm` commands remain supported
as a fallback for simple host-only work.

For production-image verification before touching CI/CD behavior, use:

```bash
task prod:container
task smoke:prod-container
```

The production Compose profile runs the final Docker image against local
Postgres on `http://localhost:8080`; the smoke command checks the same route
set used by the CI container boot gate.

## 2. Required Production Migrations

The production database must include the additive migrations in `drizzle/`:

1. `0000_unified_schema.sql` creates the core calculator, metadata, and portfolio tables.
2. `0001_sync_runs.sql` creates sync history used by freshness reporting.
3. `0002_auth_tables.sql` creates the Auth.js adapter tables for OAuth sessions.
4. `0003_portfolio_lot_indexes.sql` through `0008_web_vital_aggregates.sql` add portfolio indexes/sharing, retention constraints, audit events, shared rate limits, and aggregate vital storage.

Do not deploy portfolio-auth changes until `0002_auth_tables.sql` is applied.
Without those tables, Auth.js cannot persist OAuth users, accounts, sessions, or
verification tokens. The application has defensive read paths for missing sync
history, but auth-backed portfolio management should be treated as unavailable
until the auth migration exists.

## 3. Required Environment Variables

Core runtime:

- `DATABASE_URL`: Neon/Supabase/Postgres connection string reachable from Cloud Run.
- `AUTH_SECRET`: Auth.js secret for session signing. `NEXTAUTH_SECRET` remains
  accepted as a compatibility fallback, but production should use `AUTH_SECRET`.
- `NEXT_PUBLIC_APP_URL`: canonical deployed app URL used by metadata and shared links.

OAuth providers:

- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `AUTH_FACEBOOK_ID`
- `AUTH_FACEBOOK_SECRET`

At least one OAuth provider pair must be configured for users to sign in. The
login surface is intentionally OAuth-only; do not add password credentials
without revisiting storage, reset, throttling, and abuse controls.

Sync/admin:

- `ADMIN_EMAIL_ALLOWLIST`: comma-separated normalized emails authorized for browser-based admin status and sync requests.
- `SYNC_SECRET`: machine-to-machine operational credential only; it is never sent to or persisted by the browser.
- Inngest signing/event keys if production Inngest is enabled.
- Any provider-specific sync credentials required by future data providers.

## 4. First Cloud Run Deploy

Prepare Google Cloud resources:

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
gcloud artifacts repositories create obligacje-calculator \
  --repository-format=docker \
  --location=europe-west1
```

Run release checks before building:

```bash
pnpm check:local-env
pnpm check:release
```

This gate runs typecheck, lint, the trusted release Vitest contracts, and the
Next production build. It includes deterministic checks for `Dockerfile`,
`cloudbuild.yaml`, retained-route release scope, health/readiness routes,
calculation route helpers, and the package release script.
On Windows, Next standalone tracing may print a local copy warning for Node
externals while still exiting successfully; treat Linux Cloud Build and Cloud Run
health/readiness checks as the production signal.

Validate the production environment from the shell or deployment secret source
before applying migrations:

```bash
pnpm check:prod-config
```

This operator check validates `DATABASE_URL`, `AUTH_SECRET` or
`NEXTAUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, `SYNC_SECRET`, and at least one
complete OAuth provider pair. Configure `ADMIN_EMAIL_ALLOWLIST` separately for
browser administration. It is intentionally not part of `check:release`
because CI and local developer machines should not require production secrets.
During private preview only, pass `--allow-missing-oauth` when OAuth credentials
are intentionally absent; this does not waive database, URL, or secret checks.

The protected production deployment applies checked-in Drizzle migrations before
it promotes traffic. Operators must generate and review the migration files in
the pull request; never use an ad-hoc schema push or request-time compatibility
DDL against a release database. The migration identity is separate from the
Cloud Run runtime identity; runtime DDL denial is verified with a redacted
production evidence record.
Seed or sync the target database only when the release changes reference data:

```bash
pnpm run db:seed:production
pnpm run sync:full
```

Submit the Cloud Build deployment:

```bash
gcloud builds submit \
  --config cloudbuild.yaml \
  --substitutions _REGION=europe-west1,_SERVICE=obligacje-calculator,_AR_REPOSITORY=obligacje-calculator
```

Set secrets and environment variables through the protected GitHub Actions
deployment environment. Do not commit `.env` files. GitHub Actions is the production
source of truth for normal deploys; `cloudbuild.yaml` is kept as a manual
fallback and runs the same release gate before building.

## 5. Deployment Guardrails

- Review and merge explicit Drizzle migrations before the protected deployment
  applies them against the target database. Do not run `drizzle-kit push` in a
  release workflow or against production manually.
- Run `pnpm check:release` before promoting a build. This is the trusted-core
  Cloud Run gate; run `pnpm test:ci` separately when reconciling the broader
  legacy UI contract inventory.
- Run `pnpm check:local-env` on WSL or a release workstation before local Docker
  and browser verification. It reports Node, pnpm, git, Playwright, Docker,
  gcloud, and GitHub CLI readiness without requiring production secrets.
- Run `pnpm check:prod-config` against the environment that will back the Cloud
  Run revision before applying migrations or promoting traffic.
- Keep browser API calls behind shared clients (`admin-client`,
  `bond-series-client`, `portfolio-client`, `scenario-share-client`,
  `sync-client`) so UI code does not own request envelopes.
- Keep route responses on `okJson`, `createdJson`, `errorJson`, or the existing
  domain response helpers unless a route intentionally streams or returns a
  non-envelope response.
- Keep calculation route bodies on `readJsonBody` and calculation envelopes on
  `okJson` through `lib/server/http/calculation-route.ts`.
- Verify `/api/health` returns `ok: true`.
- Verify `/api/readiness` returns `ok: true` after production env and database
  setup are complete.
- Verify `/api/health` and `/api/readiness` keep operational payloads delegated
  to `lib/server/health` and `lib/server/readiness`.
- Verify deploys and rollbacks with `pnpm ops:verify-prod -- --expected-revision
<revision>`. Deploys should also pass `--expected-image` for the commit-SHA
  image.
- Verify `/login` shows the configured OAuth providers.
- Verify `/api/portfolio/access` reports `canManageWorkspace: true` after sign-in.
- Verify `/admin/status` shows recent `sync_runs` rows after a manual sync and
  exposes per-series `lastSyncAttemptAt` separately from `lastDataPointDate`.
- Verify calculation meta displays both data coverage and last sync attempt when
  sync history is present.
- Verify single and comparison chart/table monthly, quarterly, and yearly views
  start at the purchase date and preserve the final withdrawal value.
- Verify single, comparison, regular investment, ladder, notebook, and economic
  data routes load on desktop and mobile widths.
- Verify the local Compose workflow with `task smoke:container` before changing
  container, database, or startup behavior.
- Verify the production image with `task smoke:prod-container` before changing
  the Dockerfile, Cloud Run runtime flags, or CI Docker job.

## 6. Monitoring & Operations

- Cloud Run logs are the first operational log source for the initial deploy.
- Add uptime monitoring against `/api/health`.
- Add readiness monitoring against `/api/readiness` only where protected access
  or private uptime checks are available.
- Trigger `pnpm run sync:full` manually after deploy until scheduled production
  sync is configured.
- Treat failed or stale sync metadata as a release blocker when it affects trusted
  core calculator interpretation.

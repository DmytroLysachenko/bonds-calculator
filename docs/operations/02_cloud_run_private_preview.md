# Cloud Run Preview Access

The production preview service is public so anyone can open it directly in a browser. Application-level authentication continues to protect user-specific data and actions.

## Service Details

- GCP project: `bond-calculator-pl`
- Region: `europe-west1`
- Cloud Run service: `obligacje-calculator`
- Public service URL: `https://obligacje-calculator-738965529859.europe-west1.run.app`

Open the service URL directly. No Google Cloud account, proxy, or Cloud Run Invoker role is required for browser access.

## Health Checks

Run directly against the public URL:

```bash
curl https://obligacje-calculator-738965529859.europe-west1.run.app/api/health
curl https://obligacje-calculator-738965529859.europe-west1.run.app/api/readiness
```

Expected deployment contract:

- `/api/health`: `200`
- `/api/readiness`: `200` only when runtime configuration, database
  connectivity, required tables, and every reviewed migration hash are present
- OAuth may be deferred only with the explicit preview exception documented by
  the verifier; it does not establish authenticated-preview readiness

For the same smoke checks against the deployed service, run:

```bash
pnpm ops:verify-prod -- --allow-missing-oauth
```

The verifier checks:

- `/api/health`
- `/`
- `/single-calculator`
- `/api/calculation-defaults`
- `/api/readiness`

`--allow-missing-oauth` is valid only while Google OAuth is intentionally not configured. The database readiness check must still pass.

The readiness endpoint is dependency-aware but cannot prove a deployed state
from this repository. Record a redacted `ops:verify-prod` result, revision, and
authenticated workspace smoke in the private-preview evidence log before
claiming operational readiness.

After a deploy or rollback, pass the expected Cloud Run revision when checking
traffic routing:

```bash
pnpm ops:verify-prod -- --allow-missing-oauth --expected-revision obligacje-calculator-00042-abc
```

The verifier fails if that revision is not receiving 100 percent of service
traffic. Deploys also pass `--expected-image` so the ready service is checked
against the commit-SHA image built by the workflow.

To inspect the active Cloud Run revision without printing secret values, run:

```bash
pnpm ops:cloud-run-status
```

The command prints the service URL, latest ready revision, deployed image, traffic split, and whether each runtime environment variable is set.

## Local Production-Image Check

Before changing Docker, Cloud Run flags, or deployment workflows, run the final
image locally:

```bash
task preflight
task prod:container
task smoke:prod-container
```

The production Compose profile starts `app-prod` on `http://localhost:8080`
against local Postgres. The smoke command checks `/`, `/single-calculator`,
`/api/health`, and `/api/calculation-defaults`, including content type when CI
runs the same gate.

## GitHub Actions Deployment Secrets

The manual `Deploy Cloud Run` workflow requires these repository secrets:

- `DATABASE_URL`
- `AUTH_SECRET`
- `SYNC_SECRET`
- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`

Optional until Google OAuth is configured:

- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`

The workflow fails before deployment if the required secrets are missing, so it cannot silently overwrite Cloud Run with empty runtime values.
The workflow passes these values to Cloud Run as runtime environment variables;
it does not use Google Secret Manager. GitHub environment/repository secret
access and Cloud Run revision access must therefore remain restricted. Do not
set `INNGEST_DEV=1` on Cloud Run.

After deployment, add `https://obligacje-calculator-738965529859.europe-west1.run.app/api/inngest`
as an app URL in the intended Inngest Cloud environment and sync the app from
the Inngest dashboard. Confirm that the `sync-economic-data` and both retention
functions appear there before relying on their schedules. The deployment
workflow checks that the Inngest SDK rejects an unsigned GET with HTTP 401
and its SDK-handled header. This proves the endpoint is reachable and protected,
but not that Inngest has synced it or that signed execution, a successful run,
or retry/replay works. Record those observations separately in the operational
evidence log.

## CI/CD Flow

Use `dev` as the integration branch for ongoing work. Use `main` as the deployable branch.

Recommended flow:

1. branch from `dev` for focused changes
2. merge completed batches back into `dev`
3. open a PR from `dev` to `main` when the batch is ready
4. wait for CI to pass on `main`
5. run `pnpm deploy:prod` to dispatch the manual `Deploy Cloud Run` workflow from `main`

CI runs on pushes to both `dev` and `main`, and on pull requests. Production deploys are guarded so they only run from `main`.

Recommended GitHub branch protection:

- `main`: require pull request reviews, require CI `quality`, `build`, and `browser-smoke`, block force pushes, block direct pushes except emergency admin fixes.
- `dev`: require CI `quality`, `build`, and `browser-smoke`, allow feature-branch PR merges, block force pushes.
- Production environment: require manual approval before `Deploy Cloud Run` and `Rollback Cloud Run`.

## Manual Deploy

From an authenticated GitHub CLI session, dispatch the protected deployment workflow:

```bash
pnpm deploy:prod
gh run watch
```

The command does not deploy from the local machine. It starts the existing GitHub Actions
workflow on `main`, where release checks, OIDC authentication, production environment rules,
and post-deploy verification still apply.

In GitHub:

1. open `Actions`
2. select `Deploy Cloud Run`
3. choose `Run workflow`
4. select branch `main`

The deploy workflow:

- runs `pnpm check:release` before building the image
- builds and pushes immutable commit-SHA and `latest` image tags
- uses GitHub Actions cache for Docker layers
- deploys the public Cloud Run service
- labels the revision with the commit and GitHub run
- captures the latest ready Cloud Run revision
- runs production smoke checks with `pnpm ops:verify-prod`,
  including image and 100 percent revision traffic checks for the just-deployed
  image and revision
- writes the deployed image, revision, and service URL to the workflow summary

## Rollback

List recent revisions:

```bash
gcloud run revisions list \
  --project bond-calculator-pl \
  --region europe-west1 \
  --service obligacje-calculator
```

Then run the GitHub `Rollback Cloud Run` workflow and provide the target revision name. The workflow routes 100 percent of traffic to that revision and runs the same production verification checks with `--expected-revision`.

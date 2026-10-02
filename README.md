# Obligacje Calculator

## Offline behavior

The application deliberately does not register a service worker and is not an
offline calculator. Financial calculations depend on current offer and market
data, so presenting a silently cached result would be misleading. Browser
assets follow normal HTTP caching; a failed network request is shown as an
error rather than an offline financial result.

Production-focused simulation platform for Polish treasury bonds, recurring bond plans, comparison scenarios, and reference macro-data.

The current product direction is conservative and trust-first:

- flagship surfaces: `single-calculator`, `compare`, `regular-investment`, `ladder`, `notebook`, `economic-data`
- secondary/reference tools: `multi-asset`, `recovery-lab`, `optimize`, `retirement`
- calculation truth and display consistency take priority over broad feature sprawl

## What The App Does Today

- **Single bond simulation:** Full-cycle bond runs with issued-offer context, rollover handling, tax treatment, and real-value readouts.
- **Scenario comparison:** Structured bond-vs-bond comparison under one committed shared setup.
- **Regular investment and ladder planning:** Repeated purchase modeling for recurring contribution strategies.
- **Workspace notebook:** A records-style portfolio workspace with explicit active-portfolio selection, guest lock states, and save-to-active-portfolio behavior.
- **Economic reference dashboard:** CPI, NBP, source status, and usage guidance grouped as a reference dashboard to support calculator interpretation.
- **Structured exports:** Normalized CSV/PDF/report outputs built from display models, not screenshots.

## Current Architecture

- **Framework:** Next.js 16 App Router + React 19
- **Language:** TypeScript
- **Database:** PostgreSQL + Drizzle ORM
- **Background jobs:** Inngest
- **Precision math:** `decimal.js`
- **Styling/UI:** Tailwind CSS 4 + Radix UI + Lucide
- **Charts:** Recharts
- **Tests:** Vitest
- **i18n:** `next-intl`

Important code boundaries:

- `app/`: routes, layouts, metadata, thin route/page orchestration
- `features/`: domain-specific UI, calculation handlers, adapters, and product flows
- `shared/components/`: reusable UI grouped by subdomain
- `shared/lib/`: shared display/export/workspace helpers
- `lib/data/`: cached read models and data retrieval helpers
- `lib/server/`: server-only services, repositories, sync/admin orchestration, HTTP helpers
- `db/schema.ts`: canonical Drizzle schema entrypoint
- `drizzle/`: ordered, migration-only schema authority; runtime routes never execute DDL
- `db/seed/`: seed modules split by concern

Current production-readiness notes:

- [Current Product Roadmap](./docs/plans/00_roadmap.md)
- [Cloud Run Release Candidate Plan](./docs/plans/08_cloud_run_release_candidate_plan.md)

## Local Development

### Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Set environment variables in `.env.local` using the deployment documentation and project-specific secrets.
3. Prepare the database if needed:
   ```bash
   pnpm db:migrate
   pnpm run db:seed:production
   ```
4. Start the app:
   ```bash
   pnpm dev
   ```

### Quality Checks

```bash
pnpm test:ci
pnpm test:coverage
pnpm test:release
pnpm test:db # requires an isolated TEST_DATABASE_URL
TEST_DATABASE_URL=postgresql://... pnpm test:browser:integration # isolated disposable database only
task test:db:local # starts an isolated disposable Postgres container on port 5433
task db:local:up # starts the persistent local development database on port 5432
pnpm test:core
pnpm test:browser
pnpm test:web-vitals
pnpm lint
pnpm exec tsc --noEmit
pnpm scan:unused
```

`pnpm test:ci` is the full Vitest suite; `pnpm test:release` is a faster,
curated release signal and does not replace it. `pnpm test:db` applies the
checked-in migration journal only to a disposable database.
The authenticated browser integration suite also migrates its target database,
creates temporary Auth.js fixtures, and runs a production webpack build with
the integration-only PostgreSQL adapter. Never point `TEST_DATABASE_URL` at a
development or production database.

`pnpm scan:unused` is a green gate: it must report no unused files, exports,
types, unlisted binaries, or configuration hints. The checked 70% coverage
threshold applies to high-risk calculation, server, and shared-library source.

### Data Sync

The repo already contains both the full sync path and a bond-offer-focused operator alias:

```bash
pnpm sync:bond-offers
pnpm sync:full
```

The underlying workflow refreshes:

- current bond offers and issued series
- CPI / macro reference data
- market-history series used by supporting dashboards and secondary tools

For local Inngest development:

```bash
pnpm dev
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

Use `INNGEST_DEV=1` locally. Production/cloud signing keys are only needed for deployed Inngest usage.

## Documentation

Start from the central index:

- [Documentation Index](./docs/index.md)

High-value entry docs:

- [Product Vision & Purpose](./docs/product/01_product_vision_and_purpose.md)
- [System Architecture](./docs/technical/architecture/19_system_architecture.md)
- [Database & Data Modeling](./docs/technical/architecture/20_database_and_data_modeling.md)
- [Engineering and Coding Rules](./docs/technical/architecture/26_engineering_and_coding_rules.md)
- [Calculation Stability Rules](./docs/technical/architecture/27_calculation_stability_rules.md)
- [Current Product Roadmap](./docs/plans/00_roadmap.md)
- [Cloud Run Release Candidate Plan](./docs/plans/08_cloud_run_release_candidate_plan.md)

## Deployment Target

The first production-style deployment target is Google Cloud Run. The checked-in
container and build files are:

- `Dockerfile`
- `.dockerignore`
- `cloudbuild.yaml`

Deployment details, required environment variables, migration order, and smoke
checks live in [Deployment & DevOps](./docs/technical/architecture/24_deployment_and_devops.md).

For local production-image verification:

```bash
pnpm build
pnpm smoke:local -- --base-url http://127.0.0.1:3000 --check-content-type
```

GitHub Actions is the production Cloud Run deployment source of truth. The
checked-in `cloudbuild.yaml` remains an aligned manual fallback. Before a
production promotion, use the documented migration identity, run
`pnpm check:prod-config`, and retain the required redacted post-deploy evidence.

## Security reporting

Do not include credentials, tokens, portfolio data, or personal information in
an issue. Report a suspected vulnerability privately to the project maintainer;
the maintainer will acknowledge it, coordinate remediation, and document a
redacted incident record where operational follow-up is required.

## Product Guardrails

- no hardcoded translated UI copy in code
- no browser-native prompts in product flows
- no display settings that change engine truth
- guest users may calculate and preview workspace surfaces, but portfolio/workspace mutations stay gated behind signed-in access
- secondary tools should remain explicitly demoted and not compete with the flagship calculator flows
- administrative UI actions require an authenticated session whose email is in `ADMIN_EMAIL_ALLOWLIST`; `SYNC_SECRET` is reserved for machine-to-machine operational requests

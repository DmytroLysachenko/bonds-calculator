# 09. Comprehensive Codebase Quality, Security, and Refactor Plan

**Status:** In progress — completion ledger below records delivered audit items
**Audit date:** 2026-07-29
**Scope:** Full tracked application source, tests, scripts, database schema and migrations, CI/CD, runtime configuration, public assets, and documentation
**Primary stack:** Next.js 16, React 19, TypeScript, Drizzle ORM, PostgreSQL/Neon, Auth.js, Tailwind CSS, Radix UI, Recharts, Playwright, Vitest, Cloud Run
**Audience:** Maintainers, reviewers, operators, and future contributors

## 1. Executive Summary

The application has a strong calculation-domain core, useful runtime validation, a strict TypeScript and lint baseline, good security-header foundations, and meaningful release-level regression coverage. The production build succeeds, the curated release suite passes, the audited production dependency graph has no currently known advisories, and the sampled public pages pass automated accessibility checks.

The codebase is not yet in a state where the current documentation, CI gates, runtime architecture, and security posture all tell the same story. The most important work is not cosmetic cleanup. It is restoring several system invariants:

1. Administration must fail closed even when configuration is incomplete.
2. Database state must be created exclusively by reviewed migrations, not request-time compatibility DDL.
3. Financial results must never survive a bond-offer or market-data revision through an incomplete cache key.
4. Cancelling a calculation must never commit `null` as a successful result.
5. The default test command must be green and must test behavior rather than exact source spelling.
6. Public pages should not all become uncached dynamic responses solely because the root layout needs a CSP nonce.
7. Portfolio imports must be bounded and atomic.
8. Documentation must describe the current server-backed, authenticated application rather than an earlier client-only prototype.

### Overall risk assessment

| Area                              | Assessment                                 | Main reason                                                                                                               |
| --------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Financial correctness             | **High remediation priority**              | Calculation cache omits authoritative data/offer revision                                                                 |
| Authentication and admin security | **High remediation priority**              | Missing `SYNC_SECRET` can produce a fail-open comparison; secret is persisted in `localStorage`                           |
| Data integrity                    | **High remediation priority**              | Schema/migration drift and non-transactional portfolio import                                                             |
| Reliability                       | **High remediation priority**              | Cancellation can be represented as success; detached background work is unreliable in serverless runtime                  |
| Test confidence                   | **High remediation priority**              | Full Vitest suite fails; many contracts inspect source text rather than behavior                                          |
| Performance                       | **Material improvement required**          | LCP is 2.9–5.8 seconds in local Lighthouse; all routes inherit dynamic/no-store rendering                                 |
| Accessibility                     | **Good baseline, incomplete coverage**     | Sampled routes pass axe, but specific accessible-name and target-size issues remain                                       |
| UI/UX                             | **Sound foundation, inconsistent details** | Financial flows are capable, but copy density, date formatting, touch targets, and route-specific loading need refinement |
| Scalability                       | **Prototype-grade runtime assumptions**    | Per-instance caches/rate limits and one-instance Cloud Run configuration                                                  |
| Documentation                     | **Substantially stale in critical areas**  | Security, privacy, offline, database, and testing documents conflict with current code                                    |

### Immediate release blockers

The following should be treated as P0/P1 work before describing the application as production-ready:

- **SEC-01:** fail-open admin authorization when the production secret is absent;
- **SEC-02:** bearer administration secret persisted in browser storage;
- **DATA-01:** schema/migration drift plus request-time DDL;
- **COR-01:** calculation cache does not vary by authoritative data revision;
- **REL-01:** abort path returns `null as T` and can be committed as success;
- **DATA-02:** unbounded, non-transactional portfolio import;
- **TEST-01:** default full suite is red and Playwright specs are collected by Vitest;
- **DOC-01:** security/privacy documentation materially misrepresents current data processing.

## 2. Audit Method and Limitations

### 2.1 What was scanned

The audit inventoried and pattern-scanned all tracked application and project areas:

- `app/`, including pages, layouts, metadata, and 31 API route modules;
- `features/`, including calculators, comparison, ladder, optimizer, economic data, notebook, and admin UI;
- `shared/`, including components, hooks, workers, contexts, API clients, persistence, charts, exports, and observability;
- `lib/`, including server services, authentication, authorization, HTTP infrastructure, data access, synchronization, and runtime configuration;
- `db/` and `drizzle/`;
- `public/`;
- `scripts/`;
- `.github/workflows/`, `cloudbuild.yaml`, Docker and package configuration;
- all Markdown documentation under `docs/` plus the root README.

The repository contains approximately:

- 566 TypeScript files;
- 217 TSX files;
- 63 Markdown files;
- 69,797 lines of application TypeScript/TSX;
- 171 client TSX modules;
- 237 test/spec files.

Large and high-coupling production modules were reviewed individually after the inventory scan. Runtime checks then exercised build, static quality, unit/release tests, browser accessibility, browser budgets, Lighthouse, and the production dependency audit.

### 2.2 Commands and observed results

| Check                                 | Result        | Notes                                                                           |
| ------------------------------------- | ------------- | ------------------------------------------------------------------------------- |
| `pnpm check:types`                    | Pass          | No TypeScript errors                                                            |
| `pnpm lint`                           | Pass          | No ESLint errors                                                                |
| `pnpm build`                          | Pass          | Every application page is emitted as dynamic                                    |
| `pnpm audit --prod --audit-level=low` | Pass          | No known production dependency vulnerabilities on audit date                    |
| `pnpm scan:unused`                    | Reports debt  | 5 unused files, 9 unused exports, 20 unused exported types, 4 unlisted binaries |
| `pnpm test:release`                   | Pass          | 57 files, 351 tests                                                             |
| `pnpm test:ci`                        | Fail          | 44 failed files, 80 failed tests; 192 files and 1,032 tests passed              |
| `pnpm test:a11y`                      | Pass          | 10 sampled browser tests                                                        |
| `pnpm test:web-vitals`                | Pass with gap | LCP was `null`, so the LCP assertion did not execute                            |
| `pnpm test:lighthouse`                | Fail          | LCP, performance, and preview SEO assertions fail                               |

### 2.3 What this audit does not claim

This is a comprehensive repository audit, not a penetration test or a production field-performance study. It did not include:

- authenticated browser testing with real OAuth accounts and production data;
- destructive testing against a live database;
- a third-party penetration test;
- Cloud Run load testing;
- Chrome UX Report or real-user Core Web Vitals data;
- restore testing from a managed production backup;
- verification of cloud IAM outside repository configuration.

Items requiring those environments are explicitly marked as validation work rather than confirmed defects.

## 3. Priority and Delivery Model

### 3.1 Priority definitions

| Priority | Meaning                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------------ |
| P0       | Plausible unauthorized access, financial correctness failure, or severe data-integrity risk; fix immediately |
| P1       | High reliability/security risk or release confidence gap; fix before wider production use                    |
| P2       | Material performance, usability, maintainability, or scalability improvement                                 |
| P3       | Cleanup, consolidation, or longer-horizon capability                                                         |

### 3.2 Required implementation discipline

Each remediation item should be delivered as:

1. a failing behavioral test or measurable baseline;
2. the smallest coherent implementation;
3. removal of replaced compatibility code or obsolete tests;
4. updated documentation in the same change;
5. an explicit completion check.

Do not add a second mechanism while leaving the first active indefinitely. A refactor is complete only when the old path can be deleted.

## 4. Security and Privacy

### SEC-01 — Production admin authorization can fail open when `SYNC_SECRET` is missing

**Priority:** P0
**Evidence:** `lib/server/admin/auth.ts:13-19`

Production authorization compares the provided header with:

```text
Bearer ${getSyncSecret(env)}
```

If the secret is absent, the expected value becomes `Bearer undefined`. A caller who sends exactly that header can satisfy the equality check. Readiness validation detects missing configuration, but an authorization boundary must independently fail closed.

**Required change**

- Introduce a small, deep `AdminAuthorizer` module whose interface accepts credentials and returns an authorization decision.
- Require a non-empty, minimum-strength secret before any comparison.
- Return a configuration/unavailable result when the server is misconfigured; never construct an expected bearer token from an optional value.
- Compare secret bytes with a constant-time operation after checking equal length.
- Do not permit development bypass implicitly. Make local bypass an explicit opt-in environment setting that cannot be enabled in production.
- Apply the same authorizer to admin status and sync routes.

**Tests**

- production + missing secret + `Bearer undefined` is rejected;
- production + blank/whitespace secret is rejected;
- production + wrong and prefix/suffix variants are rejected;
- production + correct secret succeeds;
- development without explicit bypass is rejected;
- explicit local-only bypass is rejected when deployment tier is production;
- missing configuration produces a sanitized 503/500 response without revealing the secret name or value.

**Done when**

- no route performs raw string bearer comparison;
- the authorizer has one fail-closed contract;
- production readiness and route integration tests cover missing-secret behavior.

### SEC-02 — Administration bearer secret is stored in `localStorage`

**Priority:** P0/P1
**Evidence:** `features/admin/status/hooks/useAdminStatusDashboard.ts:64-80`

Any script executing in the origin can read `localStorage`. Persisting the administration bearer credential increases the impact of an XSS, malicious extension, shared device, browser profile synchronization, or accidental console disclosure.

**Required change**

- Replace secret-entry administration with Auth.js session authorization and an explicit server-side administrator role or allowlist.
- Keep authorization decisions on the server. The UI should receive only capability/status data.
- Prefer short-lived sessions and re-authentication for destructive synchronization actions.
- If a temporary bridge is unavoidable, keep the credential in memory only, clear it on navigation/idle, never log it, and remove the bridge on a dated migration ticket.

**Tests**

- unauthenticated, authenticated non-admin, and authenticated admin route matrix;
- session expiration and revoked-admin behavior;
- no credential appears in local/session storage, rendered HTML, logs, or analytics;
- CSRF/origin defense for the destructive sync action.

**Done when**

- `SYNC_SECRET` is machine-to-machine only or removed from browser-facing administration;
- no browser persistence code references it.

### SEC-03 — Admin routes bypass the shared HTTP protection layer and leak raw errors

**Priority:** P1
**Evidence:** `app/api/admin/sync/route.ts:17-38`

The admin sync route is not wrapped by the shared rate limiter and returns `String(error)` in a public problem body. Internal provider, database, or parsing messages may reach the caller. The unauthenticated GET also publishes endpoint information.

**Required change**

- Put admin routes behind the authenticated admin adapter and endpoint-specific rate limit.
- Return a stable public error code and correlation ID; log the full error only server-side with redaction.
- Remove or minimize the informational GET unless operationally required.
- Add audit events for admin login failure, sync request, sync result, actor, and correlation ID without secrets.

### SEC-04 — Rate limiting is unbounded, per-process, and trusts an unverified forwarded header

**Priority:** P1
**Evidence:** `lib/server/http/api-handler.ts:8-36,51-89`

The module-level `Map` has no stale-key cleanup, so high-cardinality spoofed IPs can grow memory. Limits reset per instance and do not coordinate across Cloud Run instances. The first `x-forwarded-for` value is accepted without a documented trusted-proxy model. All wrapped endpoints share a coarse 100 requests/minute policy.

**Design direction**

Create a deep `RateLimiter` module:

```text
interface RateLimiter {
  consume(key, policy): Promise<Decision>
}
```

Adapters:

- shared production store or managed edge/Cloud Armor limit;
- bounded in-memory adapter for tests/local development.

The interface should hide counter storage, expiration, atomicity, and response-header calculation. Policies should be named by endpoint capability: calculation, portfolio read, portfolio mutation, share creation, import, observability, admin.

**Required change**

- derive client identity only through the trusted deployment proxy contract;
- cap and expire all local state;
- return `Retry-After` plus standardized `RateLimit-*` headers;
- combine user/account and IP limits for authenticated writes;
- add stricter cost-aware limits to import, share creation, and sync triggers.

**Tests**

- concurrent atomic consumption;
- reset/expiry and bounded memory;
- multi-instance integration against the production adapter;
- spoofed forwarded-header cases;
- correct endpoint policy and response headers.

### SEC-05 — Portfolio import accepts unbounded and weakly typed input

**Priority:** P1
**Evidence:** `app/api/portfolio/import/route.ts:10-24`

The route accepts any non-empty bond type and purchase-date string, unrestricted string/number amounts, unlimited notes/name/description lengths, and an unlimited lots array. This permits memory/CPU/database abuse and pushes validation failures into deeper layers.

**Required change**

- reuse one canonical portfolio lot schema;
- restrict bond types to supported enum values;
- validate a real ISO calendar date, not merely a non-empty string;
- require finite positive amounts within a documented business maximum and precision;
- set explicit maximums for portfolio name, description, notes, and lot count;
- reject unknown object keys;
- enforce request content type and maximum JSON body size before expensive work;
- return field-level RFC 9457-compatible validation details.

**Tests**

- boundary values for every length/count/amount;
- invalid dates including `2026-02-30`;
- unsupported bond type;
- `NaN`, infinity, exponent, excessive precision, and oversized numeric strings;
- unknown keys and oversized request body;
- fuzz/property tests for the import decoder.

### SEC-06 — Cookie-authenticated mutations lack an explicit origin/CSRF policy

**Priority:** P1
**Evidence:** portfolio mutation route family under `app/api/portfolio/`

SameSite cookies and JSON requests reduce classic cross-site form attacks, but the application should explicitly define its CSRF boundary, particularly for same-site subdomains and any future CORS changes.

**Required change**

- validate `Origin`/`Sec-Fetch-Site` for cookie-authenticated mutations;
- reject cross-site state-changing requests by default;
- keep CORS closed unless a documented client requires it;
- use CSRF tokens if cross-origin trusted clients are introduced;
- add `Secure` to the guest owner cookie in production (`lib/server/portfolio/access.ts`);
- document session, guest ownership, cookie lifetime, and logout semantics.

### SEC-07 — Detached public sync trigger is an abuse and reliability boundary

**Priority:** P1
**Evidence:** `app/api/sync/opportunistic/route.ts:12-36`

A GET request causes side effects, the cooldown is partly client-cookie based, and an un-awaited IIFE continues after the response. A serverless instance is not required to remain alive for that task. A caller can clear the cookie and repeatedly request work; database locking mitigates duplication but does not make the public trigger a sound queue.

**Required change**

- make synchronization operator/scheduler initiated;
- enqueue durable work through Inngest, Cloud Scheduler/Tasks, or Next.js `after()` only where its lifecycle guarantees are sufficient;
- use POST for intentional triggers;
- keep the database lock as concurrency defense, not as the only abuse control;
- cache/display freshness independently of initiating a full sync from every user session.

**Tests**

- repeated/concurrent trigger idempotency;
- process termination after response;
- queue retry and dead-letter behavior;
- sync lock expiry and recovery;
- unauthorized public users cannot initiate expensive work.

### SEC-08 — Public share URLs trust the request origin

**Priority:** P2
**Evidence:** `app/api/scenarios/share/route.ts:16-23`, `lib/server/shared-scenarios/service.ts:29`

Building a persisted or returned share URL from `req.nextUrl.origin` makes canonical output dependent on the host/proxy request. Use the configured canonical application URL after validating it at startup.

### SEC-09 — Public shared scenarios need quotas and retention

**Priority:** P2
**Evidence:** `app/api/scenarios/share/`, `lib/server/shared-scenarios/`

Unauthenticated share creation can accumulate rows indefinitely. Add account/IP quota, payload and text limits, expiration/retention policy, abuse reporting, and scheduled cleanup. Treat share IDs as unguessable but not authorization credentials for private data.

### SEC-10 — Observability ingestion can be spammed

**Priority:** P2
**Evidence:** `app/api/observability/vitals/`

Schema validation is useful, but public telemetry still needs sampling, size limits, rate limits, aggregation, bot handling, and log-injection-safe structured fields. Do not store full URLs, query values, account identifiers, or scenario inputs in performance telemetry.

### SEC-11 — OAuth token storage and privacy posture are undocumented

**Priority:** P1 documentation and operations
**Evidence:** Auth.js account schema in `db/schema.ts`; current security document

OAuth access/refresh tokens are sensitive database material. The current documentation claims a substantially different data model and stronger guarantees than the code demonstrates.

**Required change**

- inventory exactly which tokens and scopes are stored;
- request minimum scopes;
- define encryption-at-rest responsibility and whether application-level envelope encryption is required;
- define retention, account deletion, backup retention, incident response, and operator access;
- redact tokens and authorization headers in all logs;
- create a token-rotation/revocation runbook.

### SEC-12 — Supply-chain and deployment hardening is incomplete

**Priority:** P2

The dependency audit currently passes, Docker runs as non-root, and CSP/HSTS/security headers are a good foundation. Add:

- Renovate or Dependabot with controlled lockfile updates;
- secret scanning and push protection;
- CodeQL or equivalent SAST;
- container and OS-package scanning;
- SBOM generation and retained build provenance;
- pinned GitHub Action commit SHAs for sensitive release workflows;
- pinned base-image digest with an update process;
- artifact signing/attestation where practical;
- least-privilege workload identity and no long-lived cloud keys;
- production secrets supplied by Secret Manager references rather than a generated plaintext environment file.

### SEC-13 — Security-header follow-up

**Priority:** P2

Keep the existing nonce-based CSP, HSTS, frame restrictions, MIME sniffing protection, permissions policy, and strict referrer policy. Investigate:

- `Cross-Origin-Opener-Policy`;
- `Cross-Origin-Resource-Policy`;
- a reporting endpoint for CSP violations with sampling and privacy controls;
- whether `style-src-attr 'unsafe-inline'`, retained for chart/component behavior, can be reduced;
- safe JSON-LD serialization that escapes `<` before insertion.

Do not weaken CSP merely to make pages static. Performance work must preserve or improve the security boundary.

## 5. Financial Correctness and Domain Reliability

### COR-01 — Calculation cache omits authoritative offer/data revision

**Priority:** P0
**Evidence:** `features/bond-core/application-service.ts:49-70`

The key contains only `MODEL_VERSION` and sanitized request input. Bond definitions and freshness are fetched only after a cache miss. If an offer or macro dataset changes, identical inputs can receive the old envelope indefinitely until process eviction. In multiple instances, results can vary by which instance holds which cache.

**Required change**

- Fetch the minimum authoritative revision metadata before cache lookup.
- Include bond-offer revision, macro-data revision, tax-rule revision, and model version in the key as applicable.
- Give entries an explicit TTL and record cache age/revision in diagnostic metadata.
- Invalidate or namespace the cache after successful sync.
- Keep a per-process cache only as an opportunistic optimization, never as correctness state.
- Fetch independent definition/freshness dependencies concurrently after the revision decision.

**Tests**

- identical request + same revisions hits cache;
- offer revision change misses cache;
- data revision change misses cache;
- sync invalidates namespace;
- expired entries miss;
- two service instances produce the same result for the same declared revision;
- returned freshness matches the actual data used by the handler.

### COR-02 — Date validation is too permissive or inconsistent

**Priority:** P1
**Evidence:** `features/bond-core/types/schema-primitives.ts:25`; portfolio/import schemas

`Date.parse` accepts formats beyond the documented ISO date contract and can normalize invalid values unexpectedly. Other routes only check non-empty strings or a shape regex.

Create one `IsoCalendarDate` domain type and parser that:

- accepts exactly `YYYY-MM-DD`;
- verifies the actual Gregorian date;
- defines timezone conversion at the adapter boundary;
- rejects impossible and out-of-range dates;
- is reused by calculations, portfolio lots, imports, and URL state.

Use property tests around month ends, leap years, DST boundaries, maturity boundaries, and locale rendering.

### COR-03 — Database constraints do not fully enforce financial invariants

**Priority:** P1/P2

Application validation should be backed by database checks where corrupt values would be dangerous:

- positive finite lot/transaction amounts;
- supported status and transaction values;
- allowed visibility/state flags;
- end date not before start date;
- bounded or enum-backed risk/category values;
- required uniqueness and foreign keys;
- consistent timezone-aware timestamps.

Generate the checks through Drizzle migrations and test both valid and invalid writes against PostgreSQL.

### COR-04 — Financial-model versioning needs an explicit compatibility policy

**Priority:** P2

`MODEL_VERSION` is useful but insufficient by itself. Define:

- which inputs, data revisions, and tax rules determine a reproducible result;
- whether historical shared scenarios are recomputed or display the stored result/model version;
- how a user is warned when a saved result used old assumptions;
- golden fixtures for each supported model version;
- migration/deprecation policy for persisted envelopes.

## 6. Database and Data Integrity

### DATA-01 — Drizzle schema and migration history have materially drifted

**Priority:** P0/P1
**Evidence:** `db/schema.ts`, `drizzle/0000_unified_schema.sql` through `0003_portfolio_lot_indexes.sql`, `drizzle/meta/`, `lib/server/db/portfolio-schema-compat.ts`

The TypeScript schema defines tables/columns not represented by the reviewed migration sequence, including substantial auth, portfolio, data-series, bond-series, settings, tax, transaction, and shared-scenario state. Drizzle metadata contains only the initial snapshot. Request paths execute `ALTER TABLE`, backfill, index creation, and `CREATE TABLE IF NOT EXISTS`.

This creates three competing schema authorities:

1. `db/schema.ts`;
2. migration SQL;
3. request-time compatibility DDL.

That is unsafe for repeatable deployment, rollback reasoning, least-privilege runtime database access, and local/prod parity.

**Required change**

- Diff an empty database migrated from zero against `db/schema.ts`.
- Diff a sanitized production/preview schema against both.
- Create reviewed additive migrations for every intended table, column, constraint, index, and timestamp type.
- Backfill separately where volume or locking requires it.
- Remove `ensurePortfolioSchemaCompat` from request paths after all environments migrate.
- Remove DDL privileges from the runtime application role; reserve them for a migration identity.
- bring Drizzle journal/snapshots into one supported workflow.
- document expand/migrate/contract sequencing.

**Tests and gates**

- create an empty PostgreSQL database and apply all migrations;
- upgrade a fixture at each previously deployed schema version;
- compare the resulting database to the expected schema;
- run repository integration tests against the migrated database;
- assert the runtime role cannot create/alter/drop;
- CI fails on uncommitted schema diff.

**Done when**

- migrations are the single database deployment interface;
- application requests execute no DDL;
- schema docs, Drizzle schema, metadata, and real PostgreSQL agree.

### DATA-02 — Portfolio import is not atomic

**Priority:** P0/P1
**Evidence:** `lib/server/portfolio/commands.ts:177-221`

The function creates the portfolio, resolves lots concurrently, and creates lots through separate promises. A failure can leave an empty portfolio or a partially imported set. A large array also creates uncontrolled database concurrency.

**Design direction**

Expose one deep repository operation:

```text
importPortfolio(owner, validatedPackage): Promise<ImportResult>
```

The implementation should hide:

- transaction lifecycle;
- controlled concurrency or bulk insert;
- offer-context resolution;
- rollback;
- duplicate/idempotency policy;
- transaction/event creation.

**Tests**

- any invalid lot leaves no portfolio or lots;
- database failure on lot N rolls everything back;
- duplicate retry follows the declared idempotency policy;
- maximum supported import completes within budget;
- ownership and created transaction records are consistent.

### DATA-03 — Ownership checks and mutations are separate operations

**Priority:** P2
**Evidence:** `lib/server/portfolio/commands.ts`

Several commands read ownership and then update/delete by record ID. Encode ownership in the mutation query or execute both operations transactionally. This reduces time-of-check/time-of-use ambiguity and makes the authorization invariant visible at the repository boundary.

### DATA-04 — Backup, restore, and retention evidence is missing

**Priority:** P1 operations

Define and verify:

- managed backup schedule and retention;
- recovery point and recovery time objectives;
- point-in-time restore availability;
- quarterly restore drill into an isolated project;
- OAuth token and deleted-account behavior in backups;
- shared scenario and observability retention;
- who can restore/export data and how access is audited.

## 7. Reliability and Error Handling

### REL-01 — Calculation cancellation can be committed as success

**Priority:** P0/P1
**Evidence:** `shared/hooks/useCalculationRequest.ts:50-62`, `shared/hooks/useCalculatorSession.ts:72-85`

On `AbortError`, `useCalculationRequest.run` dispatches cancellation and returns `null as T`. `useCalculatorSession.runCalculation` sees a fulfilled promise and dispatches success with that value. The type cast conceals an impossible state instead of modeling it.

**Required change**

- Model cancellation explicitly as a discriminated result or throw a dedicated cancellation signal.
- Ensure session state has a cancel transition that preserves the last committed result.
- Let only a real successful envelope reach the commit action.
- Consolidate request lifecycle and calculator session ownership so two hooks do not independently interpret the same operation.

**Tests**

- abort before response never commits;
- abort after a previous success preserves the previous committed snapshot;
- stale request completion cannot overwrite a newer request;
- unmount abort does not report an error;
- network/validation/server failures remain distinct from cancellation;
- no `null as T` or equivalent unsafe cast exists in the workflow.

### REL-02 — Background work lifecycle is not durable

**Priority:** P1

Move opportunistic sync to durable orchestration as described in SEC-07. Add explicit retry count, exponential backoff, idempotency key, lock ownership, timeout, cancellation, dead-letter alerting, and operator replay.

### REL-03 — Error contracts are inconsistent

**Priority:** P2

Some routes use the shared problem-details mapper, while admin and selected route handlers build bespoke responses. Standardize:

- stable machine code;
- safe localized/user-facing message;
- HTTP status;
- correlation/request ID;
- field issues for validation;
- retryability;
- server-only cause chain.

Never return raw provider/database exceptions in production.

### REL-04 — Readiness should test dependencies, not only configuration presence

**Priority:** P2

Keep liveness cheap and process-local. Readiness should, with strict timeouts:

- validate required environment configuration;
- confirm database connectivity and expected migration version;
- confirm required OAuth configuration shape;
- expose stale critical data as degraded status where appropriate;
- avoid invoking expensive providers.

Add structured operator diagnostics while keeping public health responses non-sensitive.

## 8. Codebase Design and Refactoring

### 8.1 Design vocabulary to adopt

The codebase should use the following terms consistently:

- **Module:** a cohesive owner of a design decision;
- **Interface:** the narrow surface consumers use;
- **Implementation:** hidden mechanics behind that interface;
- **Seam:** the intentional substitution point;
- **Adapter:** a concrete implementation at an external boundary;
- **Depth:** substantial capability hidden behind a small interface;
- **Leverage:** how many consumers gain from one improvement;
- **Locality:** how few places must be understood or changed together.

The goal is not more layers. The goal is deeper modules: smaller interfaces, more hidden complexity, fewer duplicated decisions.

### ARC-01 — Deepen the calculator workflow module

**Priority:** P1
**Current owners:** `useCalculationRequest`, `useCalculatorSession`, calculator-specific hooks, calculation worker/client adapters

Create one workflow interface that owns:

- draft and committed state;
- persistence hydration;
- validation;
- request ID and stale-result rejection;
- cancellation;
- success/error states;
- calculation transport selection;
- result version/freshness compatibility.

Keep scenario-specific normalization and initial values outside as small adapters. Regular-investment and ladder hooks contain similar state choreography and should consume the same workflow if their behavior is genuinely the same.

Do not build a hypothetical local-calculation adapter unless it has a real consumer. The current worker primarily moves remote fetch/JSON work off the main thread; documentation and types should say that clearly.

**Deletion test:** the refactor is successful when the old overlapping request/session orchestration and source-shape contract tests can be removed.

### ARC-02 — Deepen the calculation application service

**Priority:** P1

The service is a valuable orchestration boundary. Improve its interface rather than wrapping it repeatedly:

- define a versioned authoritative calculation context;
- load independent context concurrently;
- make cache policy a coherent collaborator rather than three exposed cache methods;
- log failures for context acquisition as well as handler execution;
- return typed envelopes, avoiding `unknown` at consumer boundaries;
- keep handlers behind a scenario registry/factory interface.

### ARC-03 — Create a transactional portfolio module

**Priority:** P1

Portfolio authorization, validation, offer resolution, repository operations, and import/export are distributed across route, service, access, command, repository, and compatibility modules. Define a narrow application interface around user intentions:

- create/update/delete portfolio;
- create/update/delete lot;
- import/export;
- publish/unpublish;
- load owned/shared workspace.

External adapters should include session owner resolution, PostgreSQL repository, safe filename/export encoder, and offer resolver. Ownership must be enforced at the repository operation, not only in route choreography.

### ARC-04 — Replace the HTTP wrapper with composable server policies

**Priority:** P1/P2

`apiHandler` currently mixes rate limiting, client identity, logging, and exception mapping. Keep a small route wrapper, but hide each complex decision behind:

- `ClientIdentityResolver`;
- `RateLimiter`;
- `RequestBodyDecoder`;
- `ProblemDetailsMapper`;
- `RequestLogger`.

The route should declare policy, not reimplement mechanism.

### ARC-05 — Establish one schema/migration module

**Priority:** P1

The interface is the ordered migration history plus typed schema. Runtime compatibility DDL is not an adapter; it is a competing owner. Delete it after migration. Add an architecture decision explaining schema authority and expand/contract release order.

### ARC-06 — Reduce root layout coupling

**Priority:** P1/P2
**Evidence:** `app/layout.tsx:79-165`

The root includes internationalization, locale, theme, bond definitions, chart sync, tooltip, error, navigation, sync, focus, observability, and service-worker behavior. Audit which capabilities every route actually needs.

- keep truly global presentation providers global;
- move calculator/chart providers to route groups;
- pass server-loaded definitions as serialized data where practical;
- lazy-load chart/PDF/export capability at interaction boundaries;
- prevent admin and static education routes from hydrating calculator infrastructure.

### ARC-07 — Split oversized orchestration components by decision ownership

**Priority:** P2

Candidates include `ComparisonContainer`, `BondCalculatorContainer`, `useBondEffects`, `useComparison`, and large macro/display modules. Do not split by arbitrary line count. For each:

1. name the decisions it owns;
2. group state transitions and invariants;
3. extract a deep module only when it hides a coherent decision;
4. leave simple JSX composition local.

Success is improved locality and a smaller consumer interface, not more files.

### ARC-08 — Remove confirmed unused code and public surface

**Priority:** P2

The unused scan currently reports:

**Files**

- `features/comparison-engine/constants/comparison-table.ts`;
- `features/comparison-engine/hooks/useComparisonPersistenceEffects.ts`;
- `shared/components/chrome/SidebarSyncSummary.tsx`;
- `shared/components/results/PreviousOfferReference.tsx`;
- `shared/components/results/RateContextNote.tsx`.

It also reports 9 unused exports, 20 unused exported types, and 4 unlisted binaries. Verify dynamic/test consumers, then delete confirmed dead code or add real ownership. Do not keep exports “for later.”

**Completed sub-items (2026-08-13)**

- [x] `SingleBondScenarioRequest` is internal to its discriminated request union.
- [x] `RegularInvestmentScenarioRequest` is internal to its discriminated request union.
- [x] `BondComparisonScenarioRequest` is internal to its discriminated request union.
- [x] `PortfolioSimulationRequest` is internal to its discriminated request union.
- [x] `BondOptimizerRequest` is internal to its discriminated request union.

`CalculationScenarioRequest` remains the sole public request-union contract. TypeScript verifies that its internal constituent types remain valid while the unused-code scan verifies that these five types are no longer public surface.

### ARC-09 — Consolidate formatting and visual primitives

**Priority:** P2

- Use centralized `Intl.DateTimeFormat`/`Intl.NumberFormat` adapters for all user-facing values.
- Eliminate hard-coded `dd.MM.yyyy` output when English is selected.
- Consolidate Lucide and Phosphor into one icon system unless there is a documented semantic reason for both.
- Keep one canonical form-field interface for label, help, error, units, IDs, and focus behavior.
- Keep charts paired with accessible tables and exportable raw data.

## 9. Testing and Quality Engineering

### TEST-01 — The default full test suite is red

**Priority:** P0/P1
**Evidence:** `pnpm test:ci`

Observed:

- 44 failed files;
- 80 failed tests;
- 192 files and 1,032 tests passed;
- six Playwright suites are loaded by Vitest and fail because `test()` is called in the wrong runner.

`vitest.config.ts` has no explicit include/exclude boundary. CI runs only the curated 351-test release subset, so the repository has two conflicting definitions of acceptable quality.

**Required change**

- explicitly include Vitest patterns and exclude Playwright/browser directories;
- classify every remaining failure as product regression, stale contract, or obsolete test;
- repair behavioral regressions;
- replace stale source-shape tests with behavioral/component/integration tests;
- delete obsolete tests when their protected design no longer exists;
- make the normal full unit/integration suite a CI gate;
- keep a smaller release suite only for a clearly documented fast-path use case.

### TEST-02 — Source-shape contracts are overused

**Priority:** P1/P2

99 test files read implementation source via `readFileSync`; no tests reference Testing Library. Several failures reject behaviorally equivalent refactors or insist that a page import a dependency now correctly owned by a hook. Architecture boundaries are useful, but exact substrings are a brittle interface.

**Replace with**

- ESLint `no-restricted-imports` or a dependency-boundary tool for layer rules;
- TypeScript interfaces and compile-time tests for contracts;
- component interaction tests for UI behavior;
- service tests with injected adapters;
- database integration tests for ownership/transactions;
- Playwright for cross-route user journeys;
- a small number of source contracts only for security/build invariants that cannot be expressed more directly.

### TEST-03 — Behavioral component coverage is missing

**Priority:** P1

Introduce React Testing Library and `user-event` for:

- calculator input → validation → calculate → commit → edit → recalculate;
- cancellation and stale request behavior;
- error focus and inline error association;
- modal/popover focus return;
- date picker accessible name;
- portfolio CRUD/import workflows with mocked HTTP adapters;
- admin authorization states;
- keyboard/touch chart controls.

Test outcomes and accessibility semantics, not Tailwind class strings.

### TEST-04 — API route and database integration coverage is too small

**Priority:** P1

There are many API routes but only a handful of route-level behavioral tests and limited database-marked coverage. Build an isolated PostgreSQL test harness that runs real migrations and covers:

- authentication/authorization matrix;
- ownership isolation;
- input and body-size boundaries;
- import transaction rollback;
- share quotas/expiry;
- rate limiting;
- calculation revision cache;
- migration from representative old snapshots;
- error contract and redaction.

### TEST-05 — Coverage is not measured

**Priority:** P2

Add coverage for decision-making, not vanity percentages:

- branch coverage for calculation handlers, tax paths, date boundaries, authorization, and error mapping;
- mutation testing or targeted fault injection for the highest-risk math and permission modules;
- per-module minimums for critical modules;
- no global percentage target that encourages low-value snapshot/source tests.

### TEST-06 — Accessibility coverage is too narrow

**Priority:** P1/P2

The 10 browser checks cover home, education, single calculator, economic data, and retirement in desktop/mobile variants. Extend to:

- comparison, ladder, regular investment, optimizer;
- shared scenario and shared portfolio pages;
- notebook authenticated and guest flows;
- admin states;
- keyboard-only full workflows;
- 200% and 400% zoom/reflow;
- forced colors/high contrast;
- reduced motion;
- Polish and English;
- screen-reader manual passes for financial charts and result announcements.

Automated axe success is a baseline, not proof of understandable financial output.

### TEST-07 — Browser performance test can pass without measuring LCP

**Priority:** P1
**Evidence:** `tests/browser/web-vitals.spec.ts:54-58`

The test logs `lcpMs: null` and conditionally skips the assertion. Script limits of 80 requests and 1.5 MB are too loose to detect many regressions.

**Required change**

- install a `PerformanceObserver` before navigation or use Lighthouse/Web Vitals attribution;
- fail when a required metric is absent;
- test all critical route archetypes;
- establish compressed JS, request count, TTFB, LCP, INP proxy/TBT, and CLS budgets from the current baseline;
- ratchet budgets down rather than selecting aspirational values that stay permanently red.

### TEST-08 — Cross-browser and visual confidence is incomplete

**Priority:** P2

CI installs only Chromium while documentation implies broader coverage. Add a small Firefox/WebKit smoke matrix for critical interactions and targeted visual snapshots at mobile, tablet, desktop, dark mode, Polish, English, 200% zoom, and reduced motion.

### TEST-09 — Lighthouse environment is not portable or semantically aligned

**Priority:** P1/P2

The first local Lighthouse attempt chose an invalid WSL/Windows user-data path and created an `undefined:/Users/undefined/AppData` directory in the repository. The audit reran successfully by explicitly selecting Playwright Chromium. Harden launcher discovery to keep profiles in `/tmp` and support WSL/Linux consistently.

Every audited route scored 0.66 for SEO because the preview deployment tier intentionally emits `noindex`. CI must choose one of:

- run the SEO gate with a production-like indexable tier and separately assert preview `noindex`; or
- disable only the crawlability assertion in preview while keeping other SEO checks.

Never remove preview `noindex` merely to turn the gate green.

## 10. Performance and Core Web Vitals

### 10.1 Measured Lighthouse baseline

One local mobile Lighthouse run per route produced:

| Route                 | Performance | Accessibility | Best practices |  SEO |      LCP |   CLS |    TBT |
| --------------------- | ----------: | ------------: | -------------: | ---: | -------: | ----: | -----: |
| `/`                   |        0.94 |          1.00 |           1.00 | 0.66 | 2,933 ms | 0.000 |  92 ms |
| `/compare`            |        0.82 |          1.00 |           1.00 | 0.66 | 3,710 ms | 0.000 | 334 ms |
| `/economic-data`      |        0.74 |          1.00 |           1.00 | 0.66 | 3,683 ms | 0.000 | 577 ms |
| `/regular-investment` |        0.68 |          1.00 |           1.00 | 0.66 | 4,881 ms | 0.000 | 534 ms |
| `/single-calculator`  |        0.60 |          1.00 |           0.96 | 0.66 | 5,783 ms | 0.021 | 779 ms |

These are lab results, not field data. They are still sufficient to show that the current 2.5-second LCP target is missed on every route and interaction/main-thread work is excessive on complex calculators.

LCP was a text element on the sampled routes. Approximately 84–92% of LCP time was render delay after a roughly 460–470 ms response. This points primarily to hydration, client work, font/style readiness, and render scheduling rather than a large hero image.

### PERF-01 — Root `force-dynamic` disables static/cached delivery everywhere

**Priority:** P1
**Evidence:** `app/layout.tsx:30,89`

The root layout reads request headers for a nonce and exports `dynamic = 'force-dynamic'`. The build marks all application pages dynamic, responses are `no-store`, and Lighthouse reports back/forward-cache blocking.

**Required architecture spike**

- preserve strict CSP;
- investigate a static-safe CSP strategy using hashes for fixed inline scripts, external scripts, or a narrower nonce-bearing route group;
- remove the service-worker inline script if the PWA claim is not retained;
- separate public cacheable pages from authenticated/request-specific layouts;
- apply explicit revalidation to public data and definitions;
- verify locale behavior and metadata under the chosen route architecture.

**Success measures**

- eligible public pages are statically generated or cached/revalidated;
- authenticated pages remain private/no-store;
- CSP security tests remain at least as strict;
- bfcache eligibility improves;
- TTFB and LCP improve in repeatable three-run Lighthouse tests.

### PERF-02 — Too much client infrastructure is global

**Priority:** P1/P2

The root provider stack and 171 client TSX modules make hydration a major performance surface. Route-specific providers and UI should be moved down. Audit client boundaries with bundle analysis, starting with:

- `BondDefinitionsProvider`;
- `ChartSyncProvider`;
- global `TooltipProvider`;
- opportunistic sync trigger;
- Web Vitals reporter;
- route navigation/sidebar;
- calculator-only persistence and result controls.

Prefer server components for static explanatory content, result shell, and initial definitions. Pass only serializable data into focused interactive islands.

### PERF-03 — Main-thread and unused JavaScript are material

**Priority:** P1/P2

Observed unused JavaScript savings ranged from roughly 23–79 KiB by route. Single calculator main-thread work was about 3.0 seconds; economic data about 4.3 seconds. Single calculator showed a roughly 57 KiB unused portion in one 73 KiB chunk.

**Required change**

- add a reproducible bundle analyzer and per-route bundle report;
- lazy-load Recharts sections below the initial result/input viewport;
- load PDF/jsPDF only after export intent;
- inspect the `radix-ui` barrel import versus direct package imports;
- remove one icon library;
- defer non-critical panels, data tables, and educational expansions;
- avoid memoization by default; profile before adding it;
- use transitions/deferred values for non-urgent heavy chart/result updates;
- virtualize only genuinely large tables after measurement.

### PERF-04 — Font payload and typography configuration need simplification

**Priority:** P2
**Evidence:** `app/layout.tsx:2,26-28,100`

Geist Sans, Geist Mono, and Inter are loaded globally. Select one primary variable sans family and load mono only where required. Verify Polish glyph subset behavior, font-display, fallback metrics, and layout stability. Do not trade legibility for a synthetic performance score.

### PERF-05 — Calculation context loading is sequential

**Priority:** P2
**Evidence:** `features/bond-core/application-service.ts:63-64`

Freshness and definitions are independent and can be fetched concurrently after the cache-revision design is corrected. Record timings so the optimization remains observable.

### PERF-06 — Image and asset policy should be explicit

**Priority:** P2

Current metadata images declare dimensions, which is good. Add a repository rule:

- use `next/image` for content images where appropriate;
- always declare dimensions/aspect ratio;
- prioritize only the real LCP asset;
- use responsive sizes and modern formats;
- do not lazy-load above-the-fold LCP media;
- validate social-preview asset size separately from page performance.

### PERF-07 — Cloud Run configuration prevents meaningful scale testing

**Priority:** P2
**Evidence:** `cloudbuild.yaml:55-62`

The fallback Cloud Build path sets min instances 0, max instances 1, 512 MiB, and 1 CPU. This is acceptable for a private preview but not evidence of scalability. Before widening access:

- load test calculation, portfolio, share, and sync-read paths;
- measure cold starts, concurrency, DB pool/Neon connection behavior, CPU and memory;
- tune concurrency, min/max instances, timeouts, and connection strategy;
- ensure caches/rate limits do not depend on singleton deployment;
- define cost and saturation alerts.

### PERF-08 — Add real-user monitoring

**Priority:** P2

Collect privacy-preserving p75 LCP, INP, and CLS by route template, device class, and application version. Do not include scenario inputs or personal identifiers. Set initial SLOs:

- LCP p75 ≤ 2.5 s;
- INP p75 ≤ 200 ms;
- CLS p75 ≤ 0.1;
- API error rate and p95 latency per capability.

Use lab tests for prevention and field data for prioritization.

## 11. UI, UX, and Accessibility

### UI-01 — Comparison date trigger has an accessible-name mismatch

**Priority:** P1 accessibility
**Evidence:** Lighthouse on `/compare`

The visible date text was “29 lipca 2026” while the control's accessible name was “Data Zakupu.” This fails the WCAG 2.5.3 expectation that the visible label be contained in the accessible name, and can break voice-control selection.

Use a name such as “Data zakupu: 29 lipca 2026,” while preserving a separately associated field label. Test Polish and English with axe plus an explicit accessible-name assertion.

### UI-02 — Icon-only actions lack names and adequate targets

**Priority:** P1/P2
**Examples:**

- `shared/components/forms/AssumptionHistoryPopover.tsx`;
- `features/portfolio/components/PortfolioLotsTabSections.tsx`;
- `features/portfolio/components/PortfolioOverviewHeader.tsx`;
- `features/portfolio/components/PortfolioWorkspaceCard.tsx`.

Add localized `aria-label` or visible text, mark decorative icons `aria-hidden`, and provide at least a 44×44 CSS-pixel target on touch layouts. Tooltips may supplement but never replace accessible names.

### UI-03 — Admin secret form lacks a proper form-field interface

**Priority:** P1 if retained
**Evidence:** `app/admin/status/page.tsx:42-49`

The password input uses a placeholder as its only label and lacks `name`, autocomplete policy, described errors, and form submission semantics. The preferred fix is removing browser secret entry under SEC-02. If temporarily retained, use the canonical field component, a real label, `current-password` or explicit `off` policy based on the credential model, inline error association, and Enter submission.

### UI-04 — Date and number presentation is not consistently localized

**Priority:** P2

Hard-coded `dd.MM.yyyy` rendering appears in portfolio views even when English is available. Route all displayed dates, currency, percentages, and compact numbers through locale-aware formatters. Keep ISO only for machine fields, exports where specified, and URLs.

### UI-05 — Essential financial copy is sometimes too small

**Priority:** P2

The UI system includes frequent `text-xs`, 11 px, and 10 px metadata treatments. Small type is acceptable for secondary metadata only. Explanatory assumptions, validation, fees, taxes, warnings, and data-freshness information should generally remain at least 16 px on mobile with comfortable line height.

Audit at:

- 320 CSS-pixel width;
- 200%/400% zoom;
- Polish long-copy variants;
- dark mode;
- Windows text scaling.

### UI-06 — Financial-result hierarchy should prioritize decisions

**Priority:** P2

Each calculator should present, in order:

1. what the result means;
2. net outcome and invested principal;
3. assumptions and data freshness;
4. key trade-offs/risks;
5. timeline/chart;
6. detailed table/export.

Avoid making users compare many equally weighted cards. Preserve progressive disclosure and clearly distinguish draft inputs from the last calculated/committed result.

### UI-07 — Charts need complete non-visual and interaction parity

**Priority:** P1/P2

The existing accessible data-table fallback is a strong pattern. Complete it by verifying:

- every chart has a concise title and summary;
- series are not distinguishable by color alone;
- tooltip points can be reached by keyboard where interaction adds information;
- touch interaction does not require precise hover;
- data tables expose all observations when charts are sampled;
- raw CSV export uses the same source values;
- axis/legend contrast passes in both themes;
- screen readers are not forced through hundreds of SVG nodes.

### UI-08 — Responsive tables must communicate horizontal overflow

**Priority:** P2

Keep true financial tables as tables and allow contained horizontal scrolling. Add:

- visible affordance/fade or short instruction when overflow exists;
- sticky first column/header where it materially aids comparison;
- focusable scroll region with an accessible label;
- card transformation only when row/column relationships remain understandable.

### UI-09 — Loading, error, and status feedback need consistent semantics

**Priority:** P2

- reserve space for loading content to avoid layout shifts;
- use skeletons only when they match final geometry;
- announce calculation completion/failure through a restrained live region;
- do not spin a history icon as a generic loading indicator;
- move focus to the first invalid field or error summary after failed submission;
- keep previous valid result visible during recalculation and label it as previous/stale;
- disable only controls that truly cannot be used during work.

### UI-10 — Motion and focus rules should become enforceable

**Priority:** P2

The current reduced-motion and focus foundation is good. Add lint/design checks:

- animate only `transform` and `opacity` for routine motion;
- do not use `transition: all`;
- support `prefers-reduced-motion`;
- preserve visible focus rings;
- return focus after dialogs/popovers;
- do not remove outlines without an equivalent;
- pause non-essential looping animation.

### UI-11 — URL state and workflow recovery

**Priority:** P2

Shareable/filterable state such as selected scenario, comparison horizon, active data series, and relevant filters should live in the URL when it does not expose sensitive information. Large personal calculator inputs should remain in versioned local/session persistence or authenticated storage. Back/forward navigation must restore a coherent view.

### UI-12 — PWA/offline promise is not implemented

**Priority:** P1 documentation, P2 product decision
**Evidence:** `public/sw.js`, `public/manifest.json`

The service worker caches only `manifest.json`; navigation and application assets are network-only. The manifest has only an SVG icon. This is not an offline calculator.

Choose one:

- implement a versioned offline shell/calculator with safe cached assets, explicit data-as-of state, update flow, 192/512/maskable icons, and offline tests; or
- remove service-worker registration, PWA/offline claims, and standalone-install expectations.

For a financial app, silent stale financial data is worse than no offline mode.

## 12. SEO and Discoverability

### SEO-01 — Separate preview privacy from production indexability testing

**Priority:** P1/P2

Preview `noindex` is correct. Add distinct tests:

- preview/private deployment: `noindex, nofollow`, inaccessible to anonymous users where intended;
- production public deployment: indexable canonical pages, correct canonical base URL, sitemap, robots, locale metadata, and no accidental preview host references.

### SEO-02 — Validate metadata across all trusted public pages

**Priority:** P2

Ensure unique, localized title/description, canonical URL, Open Graph/Twitter values, structured-data validity, and a single meaningful H1. Pages that should not be search landing pages should be intentionally excluded rather than inheriting accidental defaults.

### SEO-03 — Performance is the main remaining page-experience SEO issue

**Priority:** P1/P2

Accessibility and semantic foundations are generally stronger than performance. Execute PERF-01 through PERF-04 before adding speculative SEO content. Do not create indexable thin calculator permutations or expose private/shared user data to crawlers.

## 13. Scalability and Operational Efficiency

### SCALE-01 — Remove process-local correctness assumptions

**Priority:** P1

Classify all module-level state:

- calculation cache: optimization only, versioned and expiring;
- rate limit: move to shared/edge enforcement;
- sync lock: database-backed with ownership/expiry;
- schema compatibility promise: delete;
- worker controller maps: bounded by active client operations.

Every component must behave correctly with zero, one, or many warm instances.

### SCALE-02 — Define database access budgets

**Priority:** P2

- instrument query count and duration by capability;
- eliminate N+1 reads in portfolio/result hydration;
- batch import writes;
- select only required columns;
- review indexes with production query plans;
- bound list pagination;
- define connection/concurrency settings for Neon and Cloud Run;
- add slow-query alerts without logging personal payloads.

### SCALE-03 — Make synchronization incremental and observable

**Priority:** P2

Provider sync should expose:

- idempotency key and dataset revision;
- per-provider result and latency;
- records scanned/inserted/updated/rejected;
- freshness transition;
- lock owner and retry state;
- last known good data;
- alert when stale thresholds are crossed.

Prefer incremental upserts over full refresh where source semantics permit.

### SCALE-04 — Align deployment paths

**Priority:** P1/P2

The GitHub deployment path migrates and verifies more carefully than `cloudbuild.yaml`, which can deploy a private preview with a mutable `latest` tag, no visible migration step, and incomplete runtime configuration.

- designate one release workflow as authoritative;
- make fallback build-only, or call the same migration/secret/readiness sequence;
- deploy immutable commit/digest references;
- use expand/contract migrations compatible with old and new revisions;
- document application rollback separately from database rollback;
- run post-deploy readiness and a small authenticated smoke suite.

## 14. Documentation Truth-Restoration Plan

### DOC-01 — Rewrite Security & Privacy

**Priority:** P0/P1
**Target:** `docs/technical/architecture/22_security_and_privacy.md`

The current document contains stale claims including no personal-data collection, client-only calculation, IndexedDB notebook storage, and future authentication. Replace it with:

- current data inventory and classification;
- Auth.js/OAuth flow and stored fields/tokens;
- authenticated and guest portfolio ownership;
- server-side calculation and logging flow;
- cookies/local storage/telemetry inventory;
- encryption responsibilities;
- authorization matrix;
- threat model and trust boundaries;
- retention/deletion/backup policy;
- secret management;
- vulnerability/incident response;
- known limitations and verification cadence.

### DOC-02 — Reconcile database documentation

**Priority:** P1
**Targets:** database/data-model documents, README, deployment docs

- declare migrations as the canonical deployment interface;
- list all current migrations including `0003`;
- remove or correct the stale compatibility-module path;
- remove contradictory statements about whether `db/schema.ts` is canonical;
- document runtime and migration database roles;
- update after DATA-01 is implemented, not before.

### DOC-03 — Rewrite non-functional requirements as measurable SLOs

**Priority:** P1/P2
**Target:** `docs/technical/architecture/18_non_functional_requirements.md`

Remove unsupported statements about offline behavior, anonymous client-only calculations, and guaranteed sub-two-second load. Define measurable:

- Core Web Vitals p75;
- API p95 latency and error rate;
- availability/readiness;
- data freshness;
- RPO/RTO;
- accessibility target and manual audit cadence;
- supported browsers/devices;
- security patch SLA;
- privacy/retention;
- maximum import/share sizes.

### DOC-04 — Update testing documentation to match real commands

**Priority:** P1
**Target:** `docs/technical/architecture/23_testing_and_quality_assurance.md`

Document:

- runner boundaries;
- full suite versus release suite;
- browser routes and browsers actually covered;
- the current LCP measurement gap until fixed;
- database integration setup;
- source-contract replacement policy;
- coverage/mutation strategy;
- required local and CI commands.

### DOC-05 — Consolidate UI documentation

**Priority:** P2

Root-level UI files violate current documentation governance and contain stale findings. Consolidate useful current rules into numbered `docs/product/` or `docs/technical/architecture/` documents, archive completed audits/plans, and remove contradictions:

- 14 px body rule versus legible mobile financial copy;
- light-only color tokens versus implemented dark theme;
- completed issues such as the toast dismiss label;
- claims that full verification is pending without current failing-suite context.

### DOC-06 — Update the documentation index and remove stale status labels

**Priority:** P2
**Target:** `docs/index.md`

Add all unindexed active architecture, domain, UI, and service-boundary documents or archive them. Remove long-lived `[NEW]` labels. Update the “last updated” statement based on current verified status rather than roadmap language.

### DOC-07 — Update README operational truth

**Priority:** P1/P2

Correct:

- schema authority and migrations;
- current unused-code baseline;
- authentication/database prerequisites;
- current test commands and known full-suite state;
- actual offline/PWA behavior;
- supported deployment path;
- security reporting contact/process.

### DOC-08 — Add codebase design principles

**Priority:** P2
**Target:** `docs/technical/architecture/26_engineering_and_coding_rules.md` or a linked numbered architecture document

Record:

- deep-module vocabulary from section 8;
- dependency direction and allowed layer imports;
- interface and adapter ownership;
- no runtime DDL;
- no browser-stored admin secrets;
- cancellation and async state modeling;
- transactional multi-write commands;
- validation at untrusted boundaries plus database invariants;
- behavioral-test preference;
- deletion test for refactors;
- documentation updated in the same change.

### DOC-09 — Archive completed execution plans promptly

**Priority:** P3

`docs/plans/` should contain only plans that drive work. At the end of this program, move this report to `docs/archive/plans/` with status and outcome links, then update the index. Do not leave a completed audit as a permanent active plan.

## 15. Recommended Execution Sequence

### Phase 0 — Safety containment

1. SEC-01 fail-closed admin authorization.
2. SEC-02 remove browser-persisted administration secret or disable browser admin until role auth exists.
3. SEC-03 sanitize admin errors and protect route.
4. COR-01 revision-aware calculation cache.
5. REL-01 explicit cancellation semantics.
6. Add regression tests for all five.

**Exit gate:** security/correctness regressions are green in CI and no compatibility bypass remains.

### Phase 1 — Data integrity and trustworthy CI

1. DATA-01 schema reconciliation and additive migrations.
2. DATA-02 bounded transactional import.
3. TEST-01 separate runners and make full unit suite green.
4. TEST-04 PostgreSQL migration/integration harness.
5. DOC-01 and DOC-02 truth restoration.

**Exit gate:** empty and upgrade databases migrate cleanly; runtime role cannot DDL; full unit/integration suite is green.

### Phase 2 — Server boundaries and operational reliability

1. SEC-04 shared rate-limiter adapter.
2. SEC-05/06 request limits and mutation-origin policy.
3. SEC-07 durable sync.
4. REL-03 standard error contract.
5. SCALE-04 deployment path unification.
6. backup/restore drill.

**Exit gate:** multi-instance correctness and recovery behavior are evidenced.

### Phase 3 — Architecture and performance

1. PERF-01 CSP/static-rendering spike.
2. ARC-01 calculator workflow deepening.
3. ARC-06 provider/client boundary reduction.
4. Bundle analysis and PERF-03 lazy loading.
5. Font consolidation.
6. real-user Web Vitals.

**Exit gate:** all critical routes meet ratcheted lab budgets and field instrumentation is available.

### Phase 4 — UI/UX and accessibility completion

1. UI-01/02 accessible names and touch targets.
2. UI-03/04 form and localization cleanup.
3. UI-05/06 financial hierarchy and typography.
4. UI-07/08 chart/table parity.
5. expanded cross-browser, zoom, keyboard, and screen-reader validation.
6. explicit PWA/offline decision.

**Exit gate:** all trusted routes pass automated checks and the manual accessibility/financial-comprehension checklist.

### Phase 5 — Cleanup and governance

1. remove unused code and obsolete tests;
2. consolidate UI and architecture documentation;
3. update README/index/status;
4. archive superseded plans;
5. run the final release and security checklist.

## 16. Suggested Work Packages

| Package                       | Main items                | Size | Dependencies                |
| ----------------------------- | ------------------------- | ---: | --------------------------- |
| WP-01 Admin safety            | SEC-01–03                 |  S/M | None                        |
| WP-02 Calculation correctness | COR-01, REL-01            |    M | None                        |
| WP-03 Schema authority        | DATA-01, COR-03           |    L | Production schema inventory |
| WP-04 Atomic portfolio        | SEC-05/06, DATA-02/03     |    L | WP-03                       |
| WP-05 Test reset              | TEST-01–05                |    L | Parallel with WP-01/02      |
| WP-06 HTTP security module    | SEC-04, REL-03            |  M/L | Deployment store decision   |
| WP-07 Durable sync            | SEC-07, SCALE-03          |  M/L | Queue/scheduler decision    |
| WP-08 Rendering/CWV           | PERF-01–06, ARC-06        |    L | CSP architecture spike      |
| WP-09 UX/a11y                 | UI-01–11, TEST-06/08      |    L | Component test harness      |
| WP-10 Operations              | SEC-12, DATA-04, SCALE-04 |    L | Cloud access                |
| WP-11 Documentation           | DOC-01–09                 |  M/L | Update alongside packages   |

## 17. Definition of Production-Ready

The application should not be declared production-ready until all of the following are true:

### Security

- admin authorization fails closed under all configuration states;
- no reusable admin credential is persisted client-side;
- sensitive routes have shared, multi-instance enforcement;
- raw internal errors and secrets cannot reach clients/log telemetry;
- cookie mutation origin policy is tested;
- dependency, secret, static, and container scanning are active;
- threat model and incident process reflect current architecture.

### Correctness and data

- cache keys identify every authoritative calculation revision;
- cancellation cannot commit;
- migrations are the only schema mutation mechanism;
- portfolio multi-write operations are transactional;
- critical database invariants are constrained;
- backup restore has been demonstrated.

### Quality

- typecheck, lint, build, full Vitest, database integration, and browser suites are green;
- Playwright and Vitest collect only their own tests;
- critical flows use behavioral tests;
- release suite does not hide a red default suite.

### Performance

- three-run Lighthouse median meets agreed route budgets;
- required Web Vitals never silently report as missing;
- eligible public pages regain cache/static delivery without weaker CSP;
- p75 field LCP/INP/CLS collection is operational;
- load testing demonstrates the intended Cloud Run/database scale.

### Accessibility and UX

- all trusted routes pass axe at mobile and desktop;
- keyboard, zoom, forced-colors, reduced-motion, and screen-reader checks are complete;
- visible and accessible names align;
- touch targets and financial text are legible;
- charts have equivalent table/export access;
- stale/offline data is never presented without an explicit as-of state.

### Documentation and operations

- README, security, database, testing, NFR, deployment, UI, and index docs match verified behavior;
- one deployment path is authoritative;
- migration, rollback, restore, sync, token-revocation, and incident runbooks exist;
- completed plans are archived.

## 18. Positive Foundations to Preserve

The remediation should preserve these strengths:

- strict TypeScript and lint checks currently pass;
- production build succeeds;
- calculation engine has extensive golden, precision, edge-case, and cross-calculator tests;
- release suite provides a useful fast correctness signal;
- current production dependency audit is clean;
- Docker runtime uses a non-root user and Next standalone output;
- CSP uses request nonces and security headers are broadly strong;
- input schemas and problem-details infrastructure already exist and can be deepened;
- accessible skip link, focus management, landmarks, reduced-motion support, and chart data tables provide a good a11y base;
- dynamic chart loading already exists in selected heavy features;
- sync locking and freshness concepts are present, even though orchestration needs hardening;
- documentation governance provides a clear place to maintain current versus archived truth.

## 19. Final Recommendation

Treat this as a correctness-and-trust program first, a performance program second, and a visual-polish program third. The highest-leverage work is to make the main interfaces deep and authoritative:

- one fail-closed admin authorization interface;
- one migration-owned database schema;
- one versioned calculation context and cache policy;
- one cancellation-safe calculator workflow;
- one transactional portfolio application interface;
- one multi-instance HTTP policy layer;
- one documented release truth.

Once those seams are stable, UI refinements and route-specific performance work will be safer, easier to test, and less likely to be invalidated by another architectural correction.

## 20. Completion Ledger

Each entry is completed only with the behavioral checks named in its delivery commit.
Operational evidence is redacted before it is linked here.

| Audit item | Status                         | Delivery                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-01     | Completed                      | `fix(admin): replace browser bearer auth with server-side admin sessions` — production secret validation, constant-time comparison, and fail-closed regression tests.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| SEC-02     | Completed                      | `fix(admin): replace browser bearer auth with server-side admin sessions` — browser secret persistence and bearer transport deleted; admin UI now relies on a server-side Auth.js allowlist.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| SEC-03     | Complete (repository evidence) | Admin endpoints and the remaining public catalogue, chart, defaults, and issued-series routes use the correlated shared API boundary. Unexpected failures return safe problem details with a request ID; server-side logging retains the original error.                                                                                                                                                                                                                                                                                                                                                       |
| SEC-11     | Complete (repository evidence) | `docs(operations): add OAuth token lifecycle runbook` records the Auth.js token inventory, retention boundary, provider revocation procedure, and quarterly review cadence. A redacted production-review record remains an external evidence-gate artifact.                                                                                                                                                                                                                                                                                                                                                    |
| DATA-01    | Completed                      | `fix(database): establish migration-only schema authority` — request-time DDL removed and replaced by ordered migration `0004_portfolio_share_schema.sql`.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ARC-05     | Completed                      | `fix(database): establish migration-only schema authority` — migrations, not runtime compatibility code, own persistent schema state.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| DOC-02     | Completed                      | `docs(database): establish migration-only operational truth` documents the full migration journal, canonical Drizzle schema role, and distinct migration/runtime database identities; deployed-role evidence remains tracked externally.                                                                                                                                                                                                                                                                                                                                                                       |
| UI-03      | Completed                      | `fix(admin): replace browser bearer auth with server-side admin sessions` — obsolete secret form removed rather than retained.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| SEC-05     | Completed                      | `fix(portfolio): complete import boundary validation` makes JSON media type and body-size checks precede parsing, retains strict unknown-key, enum, real-calendar-date, string/list, and bounded-decimal validation, and verifies rejection before any import work.                                                                                                                                                                                                                                                                                                                                            |
| SEC-06     | Completed                      | `fix(security): tighten mutation origin checks` rejects cross-site, opaque, malformed, and sibling-subdomain browser mutations; guest cookie, session, logout, and future cross-origin CSRF policy are documented and focused origin tests cover the contract.                                                                                                                                                                                                                                                                                                                                                 |
| COR-01     | Completed                      | `fix(calculation): invalidate derived results after authoritative sync` includes freshness and tax-rule revisions in the cache identity, clears data and calculation caches after a successful durable sync, and verifies dependency/cache-key behavior.                                                                                                                                                                                                                                                                                                                                                       |
| REL-01     | Completed                      | `refactor(calculation): centralize session workflow` and follow-up request integration tests make cancellation and superseded responses non-success terminal states before callers can commit stale results; committed snapshots remain intact.                                                                                                                                                                                                                                                                                                                                                                |
| ARC-01     | Completed                      | `fix(calculation): enforce versioned session result ownership` centralizes current-execution and model-version restore policy. Comparison, ladder, and recurring persistence now writes and requires `MODEL_VERSION`; stale envelopes retain editable drafts but cannot restore results. The single calculator already owns the same versioned restore contract.                                                                                                                                                                                                                                               |
| ARC-02     | Completed                      | `70e420f fix(calculation): version cache and cancel safely` makes freshness context part of calculation-service cache identity. The application service now exposes typed envelopes by scenario kind, logs context-acquisition and handler failures through one boundary, and the cache policy owns an explicit bounded TTL under focused regression coverage.                                                                                                                                                                                                                                                 |
| PERF-05    | Completed                      | `70e420f fix(calculation): version cache and cancel safely` loads independent definitions and freshness concurrently; focused dependency test proves both start before cache lookup.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| SCALE-01   | Complete (repository evidence) | `70e420f fix(calculation): version cache and cancel safely` makes cache freshness-aware. Production now always uses the shared PostgreSQL limiter (with a bounded local adapter only outside production), and the remote worker owns a tested 16-operation controller bound that releases capacity on completion and cancellation.                                                                                                                                                                                                                                                                             |
| ARC-03     | Completed                      | `portfolioApplication` is the route/page interface for owned portfolio, lot, import/export, visibility, simulation, summary, and public-share intents; owner-scoped repository operations, transaction import, offer resolution, and export encoding remain internal adapters.                                                                                                                                                                                                                                                                                                                                 |
| SEC-04     | Complete (repository evidence) | Trusted-proxy identity, bounded local fallback, PostgreSQL production counters, named data/chart/calculation cost policies, and standardized 429 headers are implemented. A deployed multi-instance receipt remains an external evidence-gate artifact.                                                                                                                                                                                                                                                                                                                                                        |
| ARC-04     | Complete (repository evidence) | The shared HTTP wrapper owns correlated request IDs, public problem responses, trusted identity, and named policy enforcement; public routes no longer duplicate internal-error response plumbing.                                                                                                                                                                                                                                                                                                                                                                                                             |
| ARC-08     | Completed                      | `refactor(types): remove unused scenario request exports` makes discriminated request constituents internal and retains `CalculationScenarioRequest` as the sole public request contract. `pnpm scan:unused` is clean after dynamic/test-consumer verification.                                                                                                                                                                                                                                                                                                                                                |
| TEST-01    | Completed                      | Vitest now has an explicit unit/component/service boundary that excludes Playwright and retired source-shape suites. `pnpm test:ci` is green; browser checks retain their dedicated Playwright CI gates. Source-shape replacement continues under separate TEST-02 ownership.                                                                                                                                                                                                                                                                                                                                  |
| TEST-05    | Completed                      | `pnpm test:coverage` measures the high-risk calculation, server, and shared-library set and enforces a 70% branch/function/line/statement threshold locally and in CI.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| DOC-04     | Completed                      | `docs(testing): record runner and browser verification truth` documents suite ownership, database isolation, source-contract replacement, current browser matrix, and mandatory LCP capture.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| UI-12      | Completed                      | `perf(rendering): remove unsupported offline promise` deletes the service worker, registration, and PWA metadata; README and NFR now state that stale financial data is never presented as offline output.                                                                                                                                                                                                                                                                                                                                                                                                     |
| PERF-01    | Complete (repository evidence) | `perf(rendering): remove unsupported offline promise` removes root-level service-worker JavaScript while retaining the nonce-based CSP boundary. Cache Components now lets the request-specific locale/CSP shell stream separately from cacheable public component trees; the root no longer forces every route dynamic.                                                                                                                                                                                                                                                                                       |
| SEC-13     | Complete (repository evidence) | `6a524b6 fix(security): escape inline JSON-LD` preserves nonce CSP and tests safe serialization; COOP/CORP now isolate browsing contexts and same-origin resources without an incompatible COEP policy. `b4f80fd3 fix(security): add private CSP reporting` adds bounded, schema-validated, sampled reports redacted before logging and a stable unsupported-media contract. Inline style attributes are now rejected and chart palette presentation uses reviewed utility classes.                                                                                                                            |
| SEO-02     | Completed                      | `test(seo): cover routed localized metadata` verifies that every metadata route has a unique non-empty title and description, a unique canonical mapping, safe JSON-LD rendering, and locale-key parity.                                                                                                                                                                                                                                                                                                                                                                                                       |
| SEC-12     | Complete (repository evidence) | Dependabot and CodeQL run on the repository; every workflow action is SHA-pinned; CI fails on fixable high/critical production-image findings; the digest-pinned base image has a documented update path; production Buildx pushes publish SBOM and maximum-mode provenance. Cloud IAM and artifact verification remain external evidence gates.                                                                                                                                                                                                                                                               |
| DATA-04    | Blocked                        | `chore(operations): add repository security controls` adds the redacted restore-evidence template; managed-backup and isolated-restore access are required.                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| SCALE-04   | Blocked                        | `chore(operations): add repository security controls` adds release-evidence records; Cloud Run/Secret Manager/IAM access is required to prove deployment controls.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| UI-04      | Completed                      | `fix(ui): localize portfolio financial dates` removes the remaining hard-coded notebook date formats in favour of the locale-aware financial formatter for purchase and maturity dates.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ARC-09     | Completed                      | `dcb2da4e feat(ui): centralize quantity formatting` extends locale adapters to general quantities. All application-facing date and number output now uses shared adapters, enforced by lint; calendar DOM data attributes are the documented non-display exception. Lucide is the sole icon system, `FormField` is the shared label/help/error interface, and charts retain paired tables/raw exports.                                                                                                                                                                                                         |
| COR-02     | Completed                      | `fix(validation): enforce canonical ISO calendar dates` adds the branded parser and applies it to calculator requests, portfolio lot creation, imports, portfolio schemas, and comparison URL state, with leap-year and invalid-instant regression coverage.                                                                                                                                                                                                                                                                                                                                                   |
| SEC-05     | Completed                      | `fix(portfolio): complete import boundary validation` covers supported bond types and impossible calendar dates through the canonical import schema.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| SEC-07     | Blocked                        | `feat(sync): enqueue administrative data refreshes` wires the administrative event to the retrying Inngest function and removes inline sync execution; deployed signed-delivery, retry, dead-letter, and replay evidence still requires Inngest operator access.                                                                                                                                                                                                                                                                                                                                               |
| SEC-07     | Blocked                        | Administrative refreshes enqueue durable Inngest work; the public opportunistic fire-and-forget trigger, client, and endpoint are now removed. Deployed signed-delivery, retry, dead-letter, and replay evidence still requires Inngest operator access.                                                                                                                                                                                                                                                                                                                                                       |
| SEC-08     | Completed                      | `fix(sharing): use canonical scenario URLs` removes request-origin URL construction; focused service test proves configured canonical output.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| SEC-09     | Complete (repository evidence) | Public share creation uses the durable production rate-limiter policy; `POST /api/scenarios/share/report` accepts only an opaque reference and bounded reason, records a redacted correlation event without resolving the share, and has its own stricter policy. A redacted deployed limiter/abuse-handling receipt remains an external evidence-gate artifact.                                                                                                                                                                                                                                               |
| SEC-10     | Complete (repository evidence) | Web-vital storage is sampled and aggregate-only, keyed by metric/path/rating/hour with no raw URL, account, payload, or user-agent fields. Persistence fallback logging remains redacted.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| COR-03     | Completed                      | The isolated PostgreSQL 17 fixture applied the full reviewed journal and passed all six constraint, aggregate-key, owner-isolation, and transaction-rollback checks on 2026-08-19. `task test:db:local` provides the same disposable local evidence path without touching preview or production.                                                                                                                                                                                                                                                                                                               |
| COR-04     | Completed                      | Versioned golden fixtures declare the active model, source inputs, exact serialized engine outputs, and rounding policy. Persisted historic results retain only editable drafts on exact-version rejection; shared scenarios always recompute against current authority.                                                                                                                                                                                                                                                                                                                                       |
| DATA-02    | Completed                      | The PostgreSQL 17 integration run passed the deliberate failed multi-write-import rollback check: no portfolio or lots remained after the transaction error. The production repository path remains one transaction through `importPortfolioAtomically`.                                                                                                                                                                                                                                                                                                                                                       |
| DATA-03    | Completed                      | `fix(portfolio): scope lot updates by owner` adds owner predicates to update and delete repository mutations; repository-boundary tests and type/lint checks cover the seam.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| REL-02     | Blocked                        | The remaining public detached sync lifecycle has been deleted; durable background lifecycle still requires deployed Inngest schedule/retry evidence.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| REL-03     | Complete (repository evidence) | `feat(server): add correlated API responses` adds stable request IDs to wrapped successes, rate limits, and problems. The shared boundary now also writes the ID into success metadata and legacy JSON/problem bodies; 429 responses carry a stable machine code. Admin sync uses the same error/rate-limit boundary, while operational/auth adapters remain intentionally bespoke.                                                                                                                                                                                                                            |
| REL-04     | Complete (repository evidence) | Readiness validates runtime configuration, database connectivity, required operational tables, and the exact reviewed migration journal with strict database timeouts. A deployed authenticated readiness receipt remains an external evidence gate.                                                                                                                                                                                                                                                                                                                                                           |
| ARC-06     | Complete (repository evidence) | Bond-definition loading lives behind a route-scoped boundary for calculator, comparison, education, economic-data, notebook, and shared-scenario flows. The root mounts neither global tooltip nor public-sync infrastructure, and Cache Components retain the strict nonce CSP while allowing a request-specific shell around cacheable public trees.                                                                                                                                                                                                                                                         |
| ARC-07     | Completed                      | Comparison deep-link parsing and every URL-backed edit transition now belong to `useComparisonUrlState`; `ComparisonContainer` composes decisions rather than owning router/search-param mutation details. Existing draft workspace, committed-result surface, receipt, and single-calculator action modules retain their focused boundaries.                                                                                                                                                                                                                                                                  |
| ARC-08     | Completed                      | Confirmed dead public types were made internal or deleted; external CLIs are explicitly declared in the unused-scan configuration. `pnpm scan:unused` now reports no files, exports, types, binaries, or configuration findings.                                                                                                                                                                                                                                                                                                                                                                               |
| TEST-02    | Completed                      | Retired 66 UI/layout source-shape contracts; 11 source readers remain only for security, deployment, migration, worker, and architecture invariants. Deep-link recovery is now runtime-tested, while existing model, component-interaction, and browser suites own UI behavior.                                                                                                                                                                                                                                                                                                                                |
| TEST-03    | Completed                      | Component interaction coverage owns form-associated recalculation, pending controls, comparison receipt edit/close, URL-state recovery, guardrail validation, and focus-to-error behavior. Browser accessibility coverage exercises keyboard skip links, mobile focus return, and invalid single-calculator submission on desktop and mobile.                                                                                                                                                                                                                                                                  |
| TEST-04    | Complete (repository evidence) | The isolated PostgreSQL 17 suite passes locally (6/6) and CI provisions its own PostgreSQL service, writes `test-results/database-integration.json`, and uploads it as `database-integration-result`. The first post-change CI execution must retain that artifact as external CI evidence.                                                                                                                                                                                                                                                                                                                    |
| TEST-06    | Completed                      | `pnpm test:a11y` passes all 72 Chromium desktop/mobile cases: axe scans for trusted routes including comparison, regular, ladder, optimizer and multi-asset; localized controls; keyboard skip links; invalid-form focus; mobile navigation focus return; reduced motion; and 200%/400% zoom plus narrow reflow checks.                                                                                                                                                                                                                                                                                        |
| TEST-07    | Completed                      | `test(browser): require observed LCP` installs the observer before navigation and asserts that the metric exists before enforcing the route budget.                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| TEST-08    | Completed                      | Firefox/WebKit run core smoke and axe coverage in CI. `pnpm test:browser:visual` owns committed Linux Chromium baselines for English/Polish, mobile/tablet/desktop, light/dark, 200% zoom, and reduced motion.                                                                                                                                                                                                                                                                                                                                                                                                 |
| TEST-09    | Completed                      | Lighthouse uses the installed Linux Playwright Chromium binary (or explicit `LHCI_CHROME_PATH`) with a portable `/tmp` profile, records three runs per route, and preserves preview crawlability behavior separately from the production SEO gate.                                                                                                                                                                                                                                                                                                                                                             |
| PERF-02    | Completed                      | Root no longer mounts Tooltip infrastructure; each actual Radix consumer provides its own local boundary. Bond definitions and opportunistic sync remain route-scoped. `pnpm analyze:bundles` writes 20 route records to `artifacts/route-bundle-report.json`, proving static/admin routes avoid calculator-only route chunks.                                                                                                                                                                                                                                                                                 |
| PERF-03    | Completed                      | Heavy economic, multi-asset, retirement, and portfolio analytics charts load at their result/interaction boundary with stable loading geometry; PDF generation loads only after export intent. `pnpm analyze:bundles` emits a tested Turbopack/App Router route report, and CI retains it as an artifact. The rendering contract records the reviewed Radix facade and sole Lucide icon system.                                                                                                                                                                                                                |
| PERF-04    | Completed                      | `perf(fonts): consolidate global typography` removes the redundant Inter payload, keeps Geist Sans as the single global variable sans family, and retains Geist Mono only for tabular/code consumers.                                                                                                                                                                                                                                                                                                                                                                                                          |
| PERF-06    | Completed                      | `docs(perf): define rendering performance contract` records dimensions, responsive asset sizing, true-LCP prioritization, above-the-fold loading, and separate social-preview validation.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| PERF-07    | Blocked                        | Cloud Run load testing requires production project, service, and monitoring access.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| PERF-08    | Blocked                        | A migration-backed 30-day aggregate-only vital store and durable cleanup are implemented. Field RUM remains blocked until a redacted deployed aggregate receipt demonstrates the approved sink and operator access.                                                                                                                                                                                                                                                                                                                                                                                            |
| UI-01      | Completed                      | `fix(ui): align comparison date names` keeps the localized visible purchase date in the trigger’s accessible name and proves the Polish and English control names in Chromium.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| UI-02      | Completed                      | `fix(ui): complete icon-action accessibility inventory` gives notebook/history/toast icon actions localized names, decorative-icon semantics, and 44px minimum touch targets.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| UI-05      | Completed                      | Financial decision, tax, horizon, and market-assumption copy uses the `ui-body` 16px/28px mobile baseline; 320px/200%/400% reflow and Polish comparison accessibility checks cover the critical calculator surfaces.                                                                                                                                                                                                                                                                                                                                                                                           |
| UI-06      | Completed                      | Committed comparison output now presents its decision verdict, assumptions/freshness and warnings, performance evidence, then detailed timeline table; single-calculator draft and committed-result presentation remains explicitly separated.                                                                                                                                                                                                                                                                                                                                                                 |
| UI-07      | Completed                      | `ChartContainer` exposes one labelled, keyboard-focusable region with concise summary while hiding Recharts SVG internals from assistive technology; legends use text plus line style, and the paginated data-table fallback remains keyboard/touch reachable. Chromium desktop/mobile axe coverage passes for comparison.                                                                                                                                                                                                                                                                                     |
| UI-08      | Completed                      | Shared `Table` regions provide a focusable labelled horizontal-scroll boundary; financial tables pair it with a visible mobile scroll hint and retain sticky headers/first columns where comparison needs them.                                                                                                                                                                                                                                                                                                                                                                                                |
| UI-09      | Completed                      | Shared calculator workspaces now expose `aria-busy` during recalculation while preserving the last valid result; existing page-status live regions, geometry-matched loading states, and invalid-submission focus-to-error-summary behavior form one verified feedback contract across single, regular-investment, and ladder calculators.                                                                                                                                                                                                                                                                     |
| UI-10      | Completed                      | The repository ESLint policy rejects `transition-all` in production source, global CSS supplies reduced-motion overrides, and browser accessibility coverage verifies reduced-motion navigation and focus return after closing mobile navigation. Shared primitives retain visible `focus-visible` treatments.                                                                                                                                                                                                                                                                                                 |
| UI-11      | Completed                      | Comparison setup writes through Next navigation rather than unobserved raw history mutations; versioned URL snapshots are reapplied once on search-param changes, so browser back/forward restores validated scenario state without a persistence loop.                                                                                                                                                                                                                                                                                                                                                        |
| SEO-01     | Completed                      | `test(seo): distinguish preview and production indexability` verifies preview disallow/noindex behavior separately from production robots, sitemap, and canonical behavior.                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| SEO-03     | In progress                    | The 1 October 2026 route tranche server-seeds authoritative bond definitions for single, comparison, regular-investment, and education setup, removing their first-paint dependency on client SWR revalidation. Browser tests hold that request and still see each setup. Lighthouse summaries now read only the current run manifest; three-run median ceilings cover all six routes and fail CI rather than accepting one lucky fast run. Local single, regular, and education medians improved materially, but all six routes still exceed the 2.5-second LCP goal, so further measured route work remains. |
| SCALE-02   | Blocked                        | Production query plans and Neon/Cloud Run access budgets require deployed database evidence.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| SCALE-03   | Blocked                        | Incremental sync observability requires deployed provider and Inngest evidence.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| DOC-01     | Complete (repository evidence) | Privacy, retention, HTTP, and ledger contracts now state telemetry keys, fields, retention duration, cleanup ownership, and the external evidence gate.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| DOC-03     | Completed                      | `docs(nfr): define measurable service objectives` records CWV, latency, availability, freshness, recovery, accessibility, browser, patch, privacy, and request-size targets with their evidence sources.                                                                                                                                                                                                                                                                                                                                                                                                       |
| DOC-05     | Completed                      | Current UI direction, rules, design-system, and accessibility contracts live under numbered `docs/ui/`; stale unused-scan/readiness claims were corrected and the documentation-integrity test verifies every local link plus active-plan and archive indexing.                                                                                                                                                                                                                                                                                                                                                |
| DOC-06     | Completed                      | `docs(index): expose current operational evidence contracts` adds the durable-sync and external-evidence operational contracts to the documentation index.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| DOC-07     | Completed                      | `docs(readme): reconcile operational commands and boundaries` records migration-only schema authority, test-suite roles, isolated database tests, offline behavior, deployment evidence, and private security reporting.                                                                                                                                                                                                                                                                                                                                                                                       |
| DOC-08     | Completed                      | `docs(engineering): define deep-module delivery rules` records dependency direction, interface/adapter ownership, authoritative server boundaries, and documentation-plus-behavioral-test completion discipline.                                                                                                                                                                                                                                                                                                                                                                                               |
| DOC-09     | In progress                    | Archive this execution plan only after all repository items are complete.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

### External evidence gate

Repository changes are not evidence of production state. The following items
remain blocked until a redacted record based on
`docs/operations/evidence-template.md` exists: managed backup/PITR and an
isolated restore drill (DATA-04); deployed Inngest schedule/retry observation
(SEC-07, REL-02, SCALE-03); Cloud Run IAM, Secret Manager, immutable revision,
and authenticated post-deploy smoke (SCALE-04); load-test saturation results
(PERF-07); aggregate field-Web-Vitals receipt (PERF-08); and production database
query-plan/role evidence (SCALE-02 and the runtime-role portion of DATA-01).

### Maintainer scope decision — 2026-08-25

The project remains a private preview. The maintainer has deliberately deferred
new cloud-managed operational work, including GCP IAM/Secret Manager expansion
and the associated Cloud Run, backup, managed-database, Inngest, load-test, and
field-Web-Vitals evidence collection. Existing repository controls remain in
place; this is not a claim that the deferred controls have been implemented or
verified.

Keep the affected rows as `Blocked`, do not introduce recurring cloud spend or
operational complexity solely to close this plan, and revisit the evidence gate
before any public-launch or production-readiness claim.

The ledger is deliberately explicit about incomplete work. `In progress` means
the repository-owned implementation remains outstanding; `Blocked` means the
missing action is outside repository authority. No item may be relabeled
`Completed` without the code, its focused tests, and—where listed—the redacted
external evidence in the same delivery record.

### Repository completion checklist

Before changing an internal item to `Completed`, the delivery commit must show:

1. a narrow public interface or route contract for the changed boundary;
2. focused tests that exercise both the success path and the relevant failure,
   authorization, freshness, cancellation, or validation branch;
3. typecheck, lint, and the applicable release/browser/build verification; and
4. deletion of the replaced compatibility path, stale test, or documentation
   claim when one exists.

For an external item, attach a redacted evidence record after the repository
checks pass. A passing local test, workflow YAML file, or runbook template is
not a substitute for a deployed permission, restore drill, provider schedule,
or production measurement. This rule keeps the audit useful as a completion
ledger rather than a list of intentions.

## 21. Delivery Tranche Evidence Record

### Repository-delivered boundaries

| Delivery                       | Evidence retained in repository                                  | Ledger implication                                           |
| ------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------ |
| Transactional portfolio import | `importPortfolioAtomically` and owner-scoped delete queries      | DATA-02/DATA-03 advanced; PostgreSQL rollback proof remains. |
| Calculation cache              | Revision-aware key, explicit TTL, namespace invalidation tests   | COR-01 advanced; tax revision/sync event remains.            |
| HTTP response context          | Safe request IDs on wrapped successes, errors, and rate limits   | REL-03 advanced; bespoke routes remain.                      |
| Canonical sharing              | Configured canonical URL service test                            | SEC-08 completed.                                            |
| Sync contract                  | Durable event/lock/retry/dead-letter contract                    | External Inngest observation remains blocked.                |
| Rendering contract             | Provider, cache, asset, bundle, and budget acceptance rules      | PERF/ARC implementation remains tracked.                     |
| Accessibility contract         | Financial workflow names, focus, chart parity, and review checks | UI/TEST route implementation remains tracked.                |
| Behavioral test contract       | Unit/component/integration/browser seam rules                    | TEST contract replacement remains tracked.                   |
| Evidence gate                  | Cloud, IAM, backup, sync, and RUM artifact requirements          | External items remain blocked.                               |

### Required verification per future delivery

- Run focused tests that exercise the changed decision boundary.
- Run TypeScript and lint for touched source.
- Run the default behavioral suite when its configured surface changes.
- Run the release suite for financial, deployment, or public metadata changes.
- Run a production build for layout, route, metadata, or configuration changes.
- Record a redacted external artifact when cloud state is claimed.
- Update the row for every affected audit ID in the same commit.
- Delete replaced compatibility paths and stale source-shape checks.

### Explicitly non-completed external controls

- DATA-04: managed backup/PITR and isolated restore drill.
- PERF-07: Cloud Run load/cold-start/database saturation evidence.
- PERF-08: aggregate deployed field-Web-Vitals receipt.
- SCALE-02: production query-plan and connection-budget evidence.
- SCALE-03: deployed incremental-sync/provider observation.
- SCALE-04: IAM, Secret Manager, immutable revision, and post-deploy smoke.
- SEC-07/REL-02: deployed Inngest schedule, retry, dead-letter, and replay.

These remain `Blocked` until the evidence-template record names the artifact,
date, reviewer, and successful result without exposing credentials or user
data.

### Audit-item handoff matrix

| Area           | Repository next action                        | Evidence gate                      |
| -------------- | --------------------------------------------- | ---------------------------------- |
| Administration | Migrate remaining routes to shared policies   | authenticated deployed smoke       |
| Imports        | Run rollback and ownership integration tests  | migrated PostgreSQL fixture        |
| Sharing        | Add quota, retention, and cleanup job         | cleanup-run record                 |
| Telemetry      | Add aggregate sampling/storage boundary       | privacy review receipt             |
| Sync           | Wire contract into Inngest implementation     | signed delivery/retry record       |
| Rendering      | Split public/private route provider ownership | cache/CSP observation              |
| Bundles        | Capture and ratchet route reports             | three-run lab median               |
| Typography     | Consolidate font payloads                     | Polish glyph/layout review         |
| Charts         | Add keyboard/touch/table/export parity        | manual screen-reader record        |
| Forms          | Adopt canonical accessible field primitives   | keyboard/focus regression suite    |
| Tests          | Replace legacy source contracts behaviorally  | full suite/release artifacts       |
| Database       | Add invariant constraints and upgrade harness | migration-role and schema evidence |
| Documentation  | Reconcile security, NFR, README, and index    | reviewer sign-off                  |

### Status discipline

`Completed` is reserved for a delivered implementation with its named tests and
all required evidence. `In progress` means the repository implementation is not
finished. `Blocked` means an external action, credential, cloud environment, or
production observation is specifically required. `Not applicable` must retain a
plain-language justification. A future tranche must not erase blocked rows to
make the ledger appear healthier than the actual operating state.

### Release-review questions

- Does the change introduce a new public or authenticated capability?
- Does the server fail closed when its configuration is missing?
- Does an authoritative financial revision invalidate derived output?
- Does a database multi-write path have transactional rollback coverage?
- Does an HTTP error reveal only a stable safe code and correlation ID?
- Does an interactive control work with keyboard, touch, and a visible label?
- Does a performance optimization preserve CSP and private caching?
- Does a documentation claim link to current implementation or evidence?
- Does an external control remain honestly blocked until observed?

### Commit review record

For each delivery commit, reviewers record the audit IDs, changed public
interfaces, deleted legacy path, focused command output, migration impact,
documentation updates, and external evidence status. This makes a later
maintenance handoff able to distinguish a code-complete repository boundary
from a production claim that is still awaiting an operator action.

If a commit intentionally leaves a follow-up, its ledger row names the exact
missing behavior and the planned successor. Broad statements such as “harden
later” or “verify in production” are insufficient because they do not identify
an owner, an observable success condition, or an evidence artifact.

This record is reviewed during release readiness.

It is retained with the release record.

It remains redacted.

It is auditable.

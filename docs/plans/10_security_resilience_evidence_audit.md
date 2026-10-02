# 10. Security, Resilience, and Adversarial Evidence Audit

**Status:** Active security and resilience remediation plan
**Audit date:** 2026-07-29
**Relationship:** Evidence-focused companion to [09. Comprehensive Codebase Quality, Security, and Refactor Plan](./09_comprehensive_codebase_quality_security_refactor_plan.md)
**Scope:** Threat model, endpoint authorization, secrets and supply chain, database migration reproducibility, CI/CD, runtime headers, adversarial HTTP behavior, local concurrency, cross-browser compatibility, WCAG 2.2 automation, failure paths, and operational readiness
**Target deployment:** Private Cloud Run preview progressing toward a public production service

## 1. Executive Summary

This second audit validates and deepens the most security-sensitive claims from the comprehensive codebase report. It combines static source inspection with controlled runtime requests, local concurrency, a redacted scan across 1,174 commits, dependency/license inspection, direct Drizzle migration-loader inspection, expanded browser testing, and adversarial accessibility modes.

Three findings are now directly demonstrated rather than inferred:

1. **The production administration boundary fails open when `SYNC_SECRET` is absent.** Requests without authorization and with a wrong bearer token returned HTTP 401. The same endpoint returned HTTP 200 for `Authorization: Bearer undefined`.
2. **The production deployment migration command does not load three committed SQL migrations.** Drizzle's own migration reader returned exactly one migration because `drizzle/meta/_journal.json` contains only `0000_unified_schema`. The committed `0001`, `0002`, and `0003` files are not journal entries.
3. **Unbounded input can become unbounded log output.** A 2 MiB `theme` value was accepted by the settings schema, reached a database query, and was printed almost verbatim inside the Drizzle error by the generic logger. The single request produced more than 500,000 tokens of captured server output.

The audit also demonstrated:

- a caller-controlled `x-forwarded-for` value bypasses the current rate limiter in a direct runtime test;
- 2,000 requests with distinct forwarded values all received HTTP 200;
- the shared-IP calculation policy produced the expected 429 responses after 100 requests, proving that the bypass is identity-resolution related rather than a missing wrapper;
- Firefox reports that strict production CSP blocks Zod 4 runtime code generation on the single-calculator route;
- forced-colors testing finds serious contrast failures across primary calculator controls;
- the multi-asset chart contains nested interactive semantics and Recharts slider labels with `undefined` values;
- the multi-asset page emits a server-side internationalization formatting error not covered by the normal smoke matrix;
- Chromium workflow tests pass but repeatedly emit Auth.js `UntrustedHost` errors that current browser diagnostics do not treat as failures;
- WebKit could not launch because system libraries are missing, demonstrating that WebKit coverage is not operational in the current environment or CI configuration.

### 1.1 Security posture

| Domain                           | Assessment               | Reason                                                                                             |
| -------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------- |
| Admin authentication             | **Critical**             | Confirmed fail-open request                                                                        |
| Migration and database integrity | **Critical**             | Deployment loader ignores 3 of 4 committed migration files                                         |
| Logging and input bounds         | **Critical/High**        | Attacker-controlled 2 MiB value reproduced in error logs                                           |
| Rate limiting                    | **High**                 | Spoofable identity, unbounded per-process map, no cross-instance enforcement                       |
| Portfolio integrity              | **High**                 | Import remains unbounded and non-transactional                                                     |
| OAuth/session handling           | **High review priority** | Browser admin secret persistence, database token storage, guest fallback semantics                 |
| CI/CD security                   | **High/Medium**          | Direct workflow expression interpolation, plaintext environment file, unpinned action SHAs         |
| Browser/CSP compatibility        | **High**                 | Firefox CSP violation on a trusted calculator route                                                |
| Accessibility resilience         | **High/Medium**          | Forced-colors and chart semantics fail outside normal axe coverage                                 |
| Supply chain                     | **Moderate foundation**  | No current advisory or high-confidence committed secret found; stronger continuous controls absent |
| Operational recovery             | **Incomplete**           | No demonstrated migration-from-zero, restore drill, container scan, or live IAM audit              |

### 1.2 Immediate containment order

1. Fix the missing-secret administration bypass and disable browser administration until the fix is deployed.
2. Stop using the current migration sequence for a new environment until journal/schema reconciliation is complete.
3. Add request-size limits and structured log redaction/truncation before accepting wider traffic.
4. Stop trusting the first raw `x-forwarded-for` entry and move production limiting to a shared/managed control.
5. Configure Zod for CSP-safe client parsing; do not add production `unsafe-eval`.
6. Correct forced-colors styles, multi-asset chart semantics, and the mismatched translation contract.
7. Establish a production Auth.js, Inngest, OAuth-token, and guest-ownership configuration contract.

## 2. Audit Method, Evidence, and Safety

### 2.1 Evidence sources

The audit reviewed:

- all 31 API route modules;
- authentication and provider configuration;
- portfolio ownership, commands, queries, repositories, and sharing;
- calculation route/service/cache/request/session boundaries;
- HTTP body parsing, problem details, logging, response helpers, and rate limiting;
- CSP, runtime headers, middleware/proxy matching, and metadata;
- Drizzle schema, migration SQL, migration metadata, and deployment commands;
- GitHub CI, deploy, and rollback workflows;
- Dockerfile, Compose, environment example, and Cloud Build fallback;
- Inngest client, serve route, and scheduled sync function;
- external provider HTTP gateway and provider adapters;
- browser configuration and every browser spec;
- documentation statements related to security and operations.

### 2.2 Executed checks

| Check                                               | Result                                                                      |
| --------------------------------------------------- | --------------------------------------------------------------------------- |
| Production dependency audit at low threshold        | No known vulnerabilities                                                    |
| Production license inventory                        | Completed; 570 unique production dependency paths                           |
| High-confidence secret scan of current tree         | No match                                                                    |
| High-confidence secret scan across 1,174 commits    | No match                                                                    |
| Tracked environment-like files                      | Only `.env.example`                                                         |
| Drizzle migration loader                            | Loads 1 migration                                                           |
| Admin runtime authorization probes                  | 401, 401, and 200 for missing, wrong, and `Bearer undefined` respectively   |
| Shared-IP calculation load                          | 99×200 and 51×429 after one warm-up request                                 |
| Spoofed-XFF calculation load                        | 150/150 HTTP 200                                                            |
| High-cardinality XFF probe                          | 2,000/2,000 HTTP 200                                                        |
| Health concurrency                                  | 300/300 HTTP 200                                                            |
| Oversized settings request                          | 2,097,164 bytes accepted through validation path; HTTP 500 after DB failure |
| Chromium broader workflow suite                     | 14 passed, 4 mobile-inapplicable tests skipped                              |
| Firefox smoke/a11y/workflow matrix                  | 16 passed, 2 failed, 4 skipped                                              |
| WebKit matrix                                       | Browser could not launch due missing system libraries                       |
| Expanded forced-colors/reduced-motion Chromium scan | 14 passed, 14 failed                                                        |
| Mobile 320 px forced-colors route map               | 6 passed, 8 failed                                                          |
| Skip-link focus test                                | Passed on Chromium desktop and mobile                                       |
| Focused server/failure Vitest suite                 | 57 passed, 1 brittle source-boundary test failed                            |

### 2.3 Redaction and mutation safety

- Secret scans emitted only path/rule metadata, never candidate values.
- Admin probes recorded status codes, not endpoint payloads.
- The readiness payload was structurally inspected with all strings redacted.
- The oversized settings mutation reached the configured database but failed its foreign-key constraint; no settings row was created.
- Load tests used calculation and health endpoints. Calculation requests do not persist user records.
- Temporary audit browser configuration and specs were deleted after use.
- Downloaded Firefox/WebKit binaries reside in the user Playwright cache, not the repository.

### 2.4 Limitations and blocked checks

The following were not possible locally:

- Docker image build/runtime scan because the Docker daemon is unavailable;
- fresh PostgreSQL migration execution because neither Docker nor a local PostgreSQL server binary is available;
- WebKit execution because required GTK/GStreamer/WebKit libraries are absent;
- a full gitleaks/trufflehog scan because those tools are not installed;
- Syft/Grype/Trivy/OSV SBOM and container checks because those tools are not installed;
- live Cloud IAM, Secret Manager, Artifact Registry, Cloud Armor, and OAuth console review;
- read-only production database schema comparison;
- production field Core Web Vitals, multi-instance load, or managed backup restore;
- manual NVDA, VoiceOver, or TalkBack validation;
- third-party penetration testing or independent financial certification.

Where a dynamic check was blocked, the report labels the finding as configuration/static evidence rather than a completed runtime assertion.

## 3. Threat Model

### 3.1 Protected assets

| Asset                                     | Sensitivity                | Required invariant                                                           |
| ----------------------------------------- | -------------------------- | ---------------------------------------------------------------------------- |
| Admin synchronization capability          | Critical                   | Only an authorized administrator/system can invoke it                        |
| `SYNC_SECRET`, OAuth secrets, Auth secret | Critical                   | Never exposed to browser, source, logs, artifacts, or unauthorized operators |
| OAuth access/refresh/ID tokens            | Critical                   | Least privilege, encrypted/controlled storage, redacted logs, revocable      |
| Session tokens                            | Critical                   | Unpredictable, HttpOnly, Secure, bounded lifetime, invalidatable             |
| Portfolio and lot data                    | Personal/financial         | Owner isolation and intentional-only sharing                                 |
| Shared scenario/portfolio identifiers     | Sensitive capability links | Unguessable, revocable where promised, rate limited                          |
| Calculation definitions and macro history | Integrity critical         | Versioned, fresh, reproducible, trusted-source provenance                    |
| Calculation results                       | Financial correctness      | Match declared model and data revision                                       |
| Database schema/migrations                | Integrity critical         | Reproducible and controlled by reviewed migrations                           |
| Synchronization pipeline                  | Integrity/availability     | Authenticated, idempotent, locked, observable, recoverable                   |
| CI/CD identity and artifacts              | Critical                   | Least privilege, immutable, provenance verified                              |
| Logs and telemetry                        | Sensitive operational data | Bounded, structured, redacted, retention controlled                          |
| Service availability and cost budget      | Operational                | Abuse resistant and scalable                                                 |

### 3.2 Actors

- anonymous calculator user;
- authenticated portfolio owner;
- user possessing an intentionally shared link;
- authorized administrator/operator;
- Cloud Scheduler/Inngest/provider system;
- external data providers;
- GitHub Actions deployment identity;
- Cloud Run runtime identity;
- malicious unauthenticated internet client;
- malicious authenticated user;
- compromised browser script/extension;
- compromised dependency or CI action;
- operator with excessive database/log access;
- attacker who obtains a shared identifier, cookie, OAuth token, or stale secret.

### 3.3 Trust boundaries

1. Browser to Next.js page/API runtime.
2. Cloud Run edge/proxy to application client-identity resolver.
3. Application to PostgreSQL/Neon.
4. Application to Auth.js OAuth providers.
5. Application to Inngest.
6. Synchronization workers to NBP, GUS, Yahoo Finance, and bond-offer sources.
7. GitHub Actions to Google Cloud via workload identity.
8. Build system to container registry and Cloud Run revision.
9. Application/logger to Cloud Logging or another log sink.
10. Public shared URL to intentionally published user data.
11. Client persistence/worker boundary to calculation API.

### 3.4 Primary abuse cases

| ID    | Abuse case                                              | Existing defense                    | Gap                                                                |
| ----- | ------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------ |
| AB-01 | Invoke admin sync without configured secret             | Production comparison               | Optional secret creates `Bearer undefined`                         |
| AB-02 | Steal browser admin bearer secret                       | CSP, password input                 | Secret persists in `localStorage`                                  |
| AB-03 | Exhaust calculation capacity                            | 100/minute map                      | Spoofable XFF, per-instance state                                  |
| AB-04 | Exhaust memory/log quota                                | Zod validation and generic logger   | No body cap; raw DB errors contain values                          |
| AB-05 | Create inconsistent DB state                            | Some transactions                   | Portfolio import is multi-write without one transaction            |
| AB-06 | Deploy incomplete database                              | Deployment calls `migrate`          | Journal loads only migration 0000                                  |
| AB-07 | Access another portfolio                                | Owner filters, authenticated writes | Some check-then-ID mutation patterns; guest token contract unclear |
| AB-08 | Trigger expensive synchronization repeatedly            | Cookie cooldown and DB lock         | Public GET side effect; detached work; cookie clearable            |
| AB-09 | Forge callback/background execution                     | SDK signature support               | Production Inngest signing keys absent from deployment config      |
| AB-10 | Inject commands into privileged workflow                | Environment protection              | Dispatch input inserted directly into shell script                 |
| AB-11 | Persist unlimited shared records                        | UUID identifiers                    | No clear quota/expiry/retention                                    |
| AB-12 | Inject host into share URL                              | Random share ID                     | Uses request origin instead of canonical configuration             |
| AB-13 | Exfiltrate data through logs                            | Limited public error messages       | Server logger prints raw error details/query parameters            |
| AB-14 | Break calculator under strict CSP/browser               | Nonce CSP                           | Zod client JIT uses `Function`                                     |
| AB-15 | Make critical controls invisible in accessibility modes | Normal color contrast               | Forced-colors mode collapses primary contrast                      |
| AB-16 | Confuse assistive technology in chart                   | Chart wrapper summary               | Focusable `role=img` contains focusable sliders                    |

### 3.5 STRIDE summary

**Spoofing**

- caller-controlled forwarded identity;
- bearer secret missing-state bypass;
- guest ownership represented by an unsigned bearer UUID;
- Inngest trust depends on environment keys not included in deployment contract.

**Tampering**

- schema state can be changed by request-time DDL;
- incomplete migration journal creates environment-dependent schema;
- weak settings/import schemas accept arbitrary values;
- external gateway has no central origin/content-size allowlist.

**Repudiation**

- admin actions lack actor-oriented structured audit events;
- logs lack stable correlation IDs and consistent event schemas;
- no demonstrated immutable deployment/SBOM provenance.

**Information disclosure**

- reusable admin secret in browser storage;
- OAuth tokens in database;
- raw database/query error details in logs;
- readiness reveals configuration health categories;
- public shares expose names/descriptions by design and need explicit user consent.

**Denial of service**

- unbounded request bodies;
- unbounded log messages;
- unbounded per-process IP map;
- spoofable client identity;
- public synchronization side effect;
- unlimited shared records/import lots;
- heavy uncached dynamic rendering.

**Elevation of privilege**

- confirmed admin bypass;
- privileged workflow interpolation risk;
- runtime database role performs DDL;
- production auth failure can fall back to a different guest trust mode.

## 4. Endpoint Authorization Matrix

### 4.1 Public and operational endpoints

| Endpoint                          | Methods         | Intended access    | Current controls                             | Required follow-up                                              |
| --------------------------------- | --------------- | ------------------ | -------------------------------------------- | --------------------------------------------------------------- |
| `/api/health`                     | GET             | Public/infra       | Minimal payload                              | Keep liveness local and non-sensitive                           |
| `/api/readiness`                  | GET             | Infra/operator     | Dependency/config status                     | Consider private/internal exposure; sanitize detail             |
| `/api/auth/[...nextauth]`         | Auth.js methods | Public protocol    | Auth.js adapter/provider                     | Verify trust host, cookies, callback URLs, OAuth scopes         |
| `/api/bond-definitions`           | GET             | Public             | Error mapping only                           | Cache/revalidate and rate/cost policy                           |
| `/api/calculation-defaults`       | GET             | Public             | Error mapping only                           | Cache and failure contract                                      |
| `/api/calculate/bond-series`      | GET             | Public             | Parameter read                               | Validate symbol length/enum, cache                              |
| `/api/charts/inflation`           | GET             | Public             | Error mapping                                | Cache and upstream failure budget                               |
| `/api/charts/nbp-rate`            | GET             | Public             | Error mapping                                | Cache and upstream failure budget                               |
| `/api/charts/multi-asset-history` | GET             | Public             | Error mapping                                | Cache, response-size budget                                     |
| `/api/observability/vitals`       | POST            | Public telemetry   | Bounded Zod fields                           | Add sampling, rate limit, bot/retention policy                  |
| `/api/scenarios/share`            | POST            | Public             | Generic rate limiter, Zod then domain schema | Add quota, body/text limits, expiry, canonical origin           |
| `/api/sync/opportunistic`         | GET             | Public side effect | Cookie cooldown, DB lock                     | Remove public GET side effect; use durable scheduler            |
| `/api/inngest`                    | GET/POST/PUT    | Inngest only       | SDK adapter                                  | Require signing/event keys; verify private-service reachability |

### 4.2 Calculation endpoints

| Endpoint                    | Access | Wrapper      | Cost consideration                 |
| --------------------------- | ------ | ------------ | ---------------------------------- |
| `/api/calculate/single`     | Public | `apiHandler` | Long timeline; bounded schema      |
| `/api/calculate/compare`    | Public | `apiHandler` | Multiple scenarios/assets          |
| `/api/calculate/regular`    | Public | `apiHandler` | Up to 600 months                   |
| `/api/calculate/retirement` | Public | `apiHandler` | Long-horizon projections           |
| `/api/calculate/optimize`   | Public | `apiHandler` | Potential search/optimization cost |

All five share one coarse IP policy. They need cost-aware endpoint policies and trusted identity. Model limits are helpful but do not replace request-size or aggregate compute limits.

### 4.3 Portfolio and settings endpoints

| Endpoint                   | Methods      | Current access                                 |
| -------------------------- | ------------ | ---------------------------------------------- |
| `/api/portfolio/access`    | GET          | Guest or authenticated owner context           |
| `/api/portfolio`           | GET          | Guest/authenticated read; writes authenticated |
| `/api/portfolio/summary`   | GET          | Guest/authenticated owner context              |
| `/api/portfolio/lots`      | GET          | Owner-context read; writes authenticated       |
| `/api/portfolio/lots/[id]` | PATCH/DELETE | Authenticated                                  |
| `/api/portfolio/lots/save` | POST         | Authenticated                                  |
| `/api/portfolio/import`    | POST         | Authenticated                                  |
| `/api/portfolio/export`    | GET          | Authenticated                                  |
| `/api/portfolio/share`     | POST         | Authenticated                                  |
| `/api/portfolio/simulate`  | POST         | Authenticated                                  |
| `/api/user/settings`       | GET/PATCH    | Guest or authenticated owner context           |

The current source is stronger than a broad “all portfolio routes are guest writable” characterization: important portfolio mutations use `withAuthenticatedPortfolioOwner`. Remaining work is to make the policy explicit, test every method, fix request-time DDL, harden guest settings/cookies, and ensure owner checks are atomic with mutations.

### 4.4 Administration

| Endpoint            | Methods | Current access                                 | Assessment                                |
| ------------------- | ------- | ---------------------------------------------- | ----------------------------------------- |
| `/api/admin/status` | GET     | Bearer in production; bypass in non-production | Critical missing-secret flaw              |
| `/api/admin/sync`   | POST    | Bearer in production; bypass in non-production | Critical boundary plus raw error response |
| `/api/admin/sync`   | GET     | Public informational response                  | Remove/minimize unless required           |

## 5. Confirmed Critical Findings

### SR-01 — Missing `SYNC_SECRET` produces a working bearer credential

**Severity:** Critical
**Evidence:** `lib/server/admin/auth.ts:13-19`; controlled production-runtime request

Observed:

| Authorization header | HTTP status |
| -------------------- | ----------: |
| absent               |         401 |
| `Bearer wrong`       |         401 |
| `Bearer undefined`   |         200 |

The endpoint returned success for the missing-secret representation. This is a direct authorization bypass, not only a theoretical string-comparison concern.

**Containment**

- Temporarily disable browser/admin sync routes at the edge unless a secret is definitely configured.
- Rotate `SYNC_SECRET` after deploying the fix because the old browser-persisted secret model should be considered weak.
- Search logs for `Bearer undefined` only through secure server-side tooling; never log authorization headers.

**Permanent design**

- `AdminAuthorizer` constructor requires a validated secret or refuses to start.
- Production mode never has an implicit bypass.
- Use constant-time comparison.
- Return unauthorized or service-unavailable without exposing configuration details.
- Migrate browser administration to an authenticated administrator session and step-up confirmation.

**Required tests**

- table-driven environment/header matrix;
- route integration using the built production server;
- configuration property tests for undefined, empty, whitespace, Unicode, and too-short secrets;
- negative test proving readiness validation cannot be the only defense.

### SR-02 — Deployment migration loader ignores migrations 0001–0003

**Severity:** Critical
**Evidence:** `drizzle/meta/_journal.json`; `drizzle-orm/migrator` runtime inspection

The repository contains:

- `0000_unified_schema.sql`;
- `0001_sync_runs.sql`;
- `0002_auth_tables.sql`;
- `0003_portfolio_lot_indexes.sql`.

The journal contains only `0000_unified_schema`. Calling Drizzle's installed `readMigrationFiles({ migrationsFolder: './drizzle' })` returned:

```json
{
  "migrationCount": 1
}
```

The primary deployment workflow executes `pnpm exec drizzle-kit migrate`, so a new database is not guaranteed to receive sync, auth, or later portfolio migrations. Request-time compatibility DDL obscures some missing structures but cannot make the schema reproducible.

**Containment**

- Do not provision a new environment from the current migration folder.
- Snapshot and compare the real preview schema before changing the journal.
- Back up before applying corrective migrations.
- Do not manually edit already-recorded production migration hashes.

**Permanent remediation**

1. Capture current schemas from empty, preview, and intended TypeScript schema.
2. Decide the authoritative intended model.
3. Generate a new additive reconciliation migration with correct journal metadata.
4. Backfill in bounded steps.
5. Test upgrades from every deployed baseline.
6. Remove runtime compatibility DDL.
7. Give the runtime role no DDL privilege.
8. Add an empty-database migration CI job and schema-diff gate.

**Local blocker**

The audit could inspect the loader but could not execute PostgreSQL because Docker and the PostgreSQL server binary were unavailable. The new CI job must perform the real empty/upgrade test.

### SR-03 — User-controlled values are emitted through raw database errors

**Severity:** Critical/High
**Evidence:** `lib/server/logging.ts`; `lib/server/http/api-handler.ts:80-89`; controlled oversized settings request

A settings PATCH accepted a 2,097,164-byte JSON body because `theme` is an unrestricted string. The insert failed on a foreign key. The generic logger printed the entire Drizzle error, including:

- SQL statement;
- generated guest owner UUID;
- query parameter array;
- almost the entire 2 MiB user value;
- database schema/table/constraint metadata;
- stack and driver details.

The captured output exceeded 500,000 tokens.

**Impact**

- log-storage and ingestion denial of service;
- cost amplification;
- leakage of portfolio notes, descriptions, identifiers, or future personal fields;
- log search/UI degradation;
- alert flooding;
- retention of data beyond application deletion;
- potential terminal/control-character log injection.

**Required change**

- Enforce endpoint-specific byte limits before parsing.
- Restrict settings to enums with very short maximums.
- Replace raw console error details with a centralized structured serializer.
- Redact query parameters, headers, cookies, authorization, tokens, email, IDs where unnecessary, and user text.
- Truncate every field and the total event.
- Add correlation ID, error class/code, safe database code, endpoint template, and retryability.
- Keep detailed diagnostics only in a controlled exception system with explicit scrubbing.

**Required tests**

- oversized body rejected with 413 before service/database access;
- secrets and user values absent from captured logs;
- newline/control-character input cannot forge a second log event;
- repeated oversized attempts generate a bounded number and size of events;
- database error maps to a stable public response and safe operator record.

## 6. High-Risk Security and Resilience Findings

### SR-04 — Forwarded-header spoofing bypasses rate limiting

**Severity:** High
**Evidence:** `lib/server/http/api-handler.ts:55-59`; controlled load

The limiter uses the first `x-forwarded-for` entry directly. Results:

- one shared identity: 99 successful calculations and 51 HTTP 429 after a warm-up request;
- 150 unique forwarded identities: 150 HTTP 200;
- 2,000 distinct forwarded identities: 2,000 HTTP 200.

The shared policy is functioning, but identity can be changed by the direct client. Cloud Run's exact proxy rewrite/append behavior must be verified; the application should not assume the first raw value is trustworthy.

**Required change**

- use a documented trusted proxy/header contract;
- prefer Cloud Armor/edge limiting for anonymous traffic;
- use authenticated user ID plus trusted network identity for account traffic;
- store counters atomically in a shared backend if application-level limits remain;
- name cost-aware policies by endpoint;
- cap local development map size and expire entries;
- include `Retry-After`;
- monitor rate-limit decisions without logging raw spoofable headers.

### SR-05 — Rate-limit storage is per-instance and unbounded

**Severity:** High
**Evidence:** module-level `Map` without cleanup

High-cardinality identities remain in memory for process lifetime. Each Cloud Run instance has independent counters, so scaling multiplies the effective limit. The module should be a bounded local adapter, not the production policy authority.

### SR-06 — Request bodies and several schemas are insufficiently bounded

**Severity:** High

Confirmed/requested examples:

- settings strings have no enum or length;
- portfolio import has no lot-count or package-size maximum;
- imported notes/name/description and amount strings are weakly bounded;
- shared scenario description has no explicit maximum at the route boundary;
- observability parses JSON directly without a general body guard;
- no shared content-type/byte-limit policy exists.

**Recommended initial limits**

These must be validated against real product needs:

| Capability                            |          Suggested maximum |
| ------------------------------------- | -------------------------: |
| Settings PATCH                        |                      8 KiB |
| Web Vitals                            |                      4 KiB |
| Single/regular/retirement calculation |                    128 KiB |
| Comparison/optimizer calculation      |                    256 KiB |
| Shared scenario                       |                    256 KiB |
| Portfolio mutation                    |                     32 KiB |
| Portfolio import                      |     1 MiB and bounded lots |
| Inngest endpoint                      | 4 MiB per Inngest guidance |

Return 415 for unsupported media type and 413 for size. Do not rely on Zod after full allocation as the byte limiter.

### SR-07 — Browser administration secret remains extractable

**Severity:** High
**Evidence:** `features/admin/status/hooks/useAdminStatusDashboard.ts:64-80`

`SYNC_SECRET` is stored in `localStorage` and sent as a bearer token. Any same-origin script can read it. Keep the admin UI disabled until role/session authorization replaces this design. CSP reduces injection probability but is not a credential-storage control.

### SR-08 — Guest ownership and auth-failure fallback require a formal security contract

**Severity:** High/Medium
**Evidence:** `lib/server/portfolio/access.ts`

Current behavior:

- authenticated session wins;
- missing/invalid auth configuration or missing auth tables can fall back to guest;
- guest owner is a random UUID stored for one year;
- cookie is HttpOnly and SameSite Lax but lacks `Secure`;
- guest settings are writable;
- major portfolio mutations require authentication.

**Risks**

- production authentication outage silently changes the user's trust mode instead of failing clearly;
- guest state can become detached/inconsistent;
- bearer UUID handling and account merge semantics are undocumented;
- long-lived cookies on non-TLS development are expected, but production must set `Secure`;
- returning owner IDs in access payloads reduces the benefit of treating them as secret capabilities.

**Required decisions**

- whether guest notebook data is a supported product capability or only preview fallback;
- whether production auth failure should fail closed;
- guest-to-account migration and collision/idempotency behavior;
- cookie prefix, Secure, lifetime, rotation, revocation, and device transfer policy;
- which routes may operate for guests.

### SR-09 — Portfolio import remains an atomicity and resource-abuse risk

**Severity:** High

The import creates a portfolio before resolving/writing lots and performs parallel independent inserts. Add:

- canonical bounded schema;
- content-size and lot-count limits;
- one database transaction;
- controlled concurrency/bulk insert;
- idempotency key or clear duplicate policy;
- rollback tests at each lot index;
- database constraints for financial invariants.

### SR-10 — Production Inngest security/configuration is absent from deployment

**Severity:** High if Inngest is active; otherwise remove dormant surface
**Evidence:** `/api/inngest`, `lib/inngest.ts`, deploy workflow, `.env.example`

Official Inngest guidance states that serve requests are authenticated with `INNGEST_SIGNING_KEY`, use timestamped signatures for replay defense, and production integrations need signing/event keys. The deploy workflow does not configure these keys. The Cloud Run service is private, so Inngest also needs an intentional authenticated reachability design.

**Required decision**

- If unused: remove the route, client, function, dependencies, and documentation.
- If used: configure signing and event keys in Secret Manager, rotation fallback, service reachability, app version, sync-on-deploy, event-data classification, retries, idempotency, and monitoring.
- Never set `INNGEST_DEV=1` in production.

### SR-11 — GitHub rollback input is interpolated directly into privileged shell

**Severity:** High/Medium
**Evidence:** `.github/workflows/rollback-cloud-run.yml:59-71`

`${{ inputs.revision }}` is inserted into the generated shell script. GitHub's security guidance recommends passing potentially untrusted context through an intermediate environment variable or an action input so it cannot alter script syntax.

Only users allowed to dispatch the protected production workflow can supply this value, which reduces exposure, but privileged automation should remain safe under compromised or mistaken operator input.

**Required change**

- bind the input through `env: TARGET_REVISION`;
- validate against the Cloud Run revision-name grammar;
- quote the shell variable;
- confirm the revision belongs to the expected service/project;
- require environment approval;
- record actor and target revision.

### SR-12 — Runtime secrets are rendered into a plaintext YAML file

**Severity:** High/Medium
**Evidence:** `.github/workflows/deploy-cloud-run.yml:90-140`

Database and auth secrets are interpolated into `.cloud-run-env.yaml`, then passed to `gcloud`. Risks include quoting/newline breakage, expression-to-shell interpolation, workspace residue, accidental artifact inclusion, and expanded exposure to later steps.

Use Secret Manager-backed `--set-secrets` and non-sensitive `--set-env-vars`. Add cleanup as defense in depth, but avoiding plaintext materialization is preferred.

### SR-13 — GitHub Actions are pinned to mutable major tags

**Severity:** Medium

Actions use tags such as `actions/checkout@v4` and `google-github-actions/auth@v2`. Pin privileged workflow actions to reviewed commit SHAs and use a dependency bot to update them with changelog review.

### SR-14 — Strict CSP conflicts with Zod client JIT in Firefox

**Severity:** High compatibility/security
**Evidence:** Firefox single-calculator smoke and accessibility failures; built chunk; Zod 4 source

Firefox reported:

```text
Content-Security-Policy blocked JavaScript eval because script-src lacks unsafe-eval
```

The built client chunk contains Zod 4 `Function("")` capability detection and generated parser compilation. The installed Zod version exposes a `jitless` configuration specifically for environments that disallow eval.

**Required change**

- configure client-side Zod parsing as `jitless`;
- or keep heavy/domain Zod parsing server-side and use CSP-safe lightweight client validation;
- verify no other dependency requires eval;
- retain production CSP without `unsafe-eval`;
- add Firefox to CI.

### SR-15 — Auth.js host configuration is not exercised correctly in browser tests

**Severity:** Medium/High test reliability

Chromium and Firefox emitted repeated `UntrustedHost` errors for `/api/auth/session` on notebook routes. `AUTH_TRUST_HOST=true` exists in deployment/container commands but not in the standard Playwright server environment. Current browser diagnostics observe page console/network errors but not server stderr, allowing these errors to coexist with passing tests.

**Required change**

- provide the real production auth environment to browser tests;
- capture server stderr and fail on unexpected Auth.js/server errors;
- test trusted and hostile host behavior separately;
- add authenticated session fixtures without weakening production host validation.

### SR-16 — External synchronization HTTP gateway lacks central egress policy

**Severity:** Medium/High

The gateway has a 10-second timeout, which is good. It should additionally enforce:

- HTTPS-only URLs;
- explicit host allowlist per provider;
- redirect count and cross-host redirect policy;
- maximum response bytes before buffering JSON/text/array buffer;
- expected content type;
- decompression-size limits;
- sanitized URLs in errors/logs;
- provider-specific retry/backoff and circuit breaker;
- provenance and checksum/validation for imported datasets.

Provider adapters currently use trusted constants, so this is hardening against future dynamic input and compromised/changed upstream pages, not a confirmed public SSRF.

### SR-17 — Public shares and telemetry lack lifecycle controls

**Severity:** Medium

Add:

- per-account/IP creation quota;
- maximum stored size;
- expiry and deletion;
- revocation for portfolio shares;
- abuse reporting;
- scheduled cleanup;
- telemetry sampling/retention;
- explicit non-indexing tests;
- no query strings or personal data in Web Vitals.

### SR-18 — Share URL origin and export filename need safe adapters

**Severity:** Medium

- Build share URLs from validated canonical configuration, not request origin.
- Sanitize portfolio names into a conservative filename grammar.
- Use RFC-compatible `Content-Disposition` handling.
- Test quotes, control characters, Unicode, empty output, reserved device names, and very long names.

### SR-19 — OAuth tokens need operational controls

**Severity:** High governance

Auth.js stores provider tokens in the account table. Establish:

- least OAuth scopes;
- encryption-at-rest and optional application-level envelope encryption decision;
- database role/operator access;
- log redaction;
- token rotation/revocation;
- account deletion and backup retention;
- provider compromise runbook;
- monitoring for unusual callback/session behavior.

## 7. Browser, Accessibility, and UX Resilience

### 7.1 Baseline results

The normal Chromium accessibility suite remains valuable and passed its currently scoped routes. The broader workflow test also passed:

- 14 assertions passed;
- 4 desktop/mobile-inapplicable assertions skipped;
- regular investment, ladder, notebook, and comparison rendered at desktop/mobile;
- exactly one visible H1 was present;
- mobile navigation/content remained reachable;
- skip-link focus transfer passed.

These results should be preserved.

### 7.2 Firefox CSP failure

The expanded Firefox matrix produced:

- 16 passed;
- 2 failed on the single calculator due CSP/eval diagnostics;
- 4 mobile-only assertions skipped.

This confirms why Chromium-only CI is insufficient for the current dependency/CSP combination.

### 7.3 WebKit coverage is not operational

All 22 intended WebKit tests failed at browser launch because host libraries were missing. This is an environment failure, not evidence that the application itself fails Safari.

**Required change**

- add a Linux CI job that runs `playwright install --with-deps webkit`;
- run a compact trusted-route matrix;
- add real iOS Safari manual checks for date controls, downloads, sticky/overflow behavior, and OAuth.

### 7.4 Forced-colors failures

Under reduced motion, forced colors, and a 320 px mobile viewport:

| Route                 | Result | Violations                                    |
| --------------------- | ------ | --------------------------------------------- |
| `/`                   | Pass   | None                                          |
| `/education`          | Pass   | None                                          |
| `/single-calculator`  | Fail   | Primary control contrast                      |
| `/compare`            | Fail   | Primary control contrast                      |
| `/regular-investment` | Fail   | Primary control contrast                      |
| `/ladder`             | Fail   | Primary control contrast                      |
| `/retirement`         | Fail   | Primary control contrast                      |
| `/optimize`           | Fail   | Primary control contrast                      |
| `/economic-data`      | Fail   | Two selected-control contrast failures        |
| `/multi-asset`        | Fail   | Primary contrast and nested interactive chart |
| `/recovery-lab`       | Pass   | None                                          |
| `/notebook`           | Pass   | None                                          |
| `/login`              | Pass   | None                                          |

The common foreground/background token combination became approximately `#f9f8f6` on `#ffffff`, reported at 1.06:1. Use system colors and explicit forced-colors rules for primary/selected states. Do not globally disable `forced-color-adjust`.

### 7.5 Multi-asset chart semantics are invalid

The outer `ChartContainer` is focusable and uses `role="img"`, but Recharts `Brush` creates focusable slider descendants. Axe reports nested interactive controls. The brush also emits labels:

```text
Min value: undefined, Max value: undefined
```

**Required change**

- use `<figure>` or a labeled `region` when interactive descendants exist;
- do not make the outer chart image itself a competing tab stop;
- give brush controls meaningful localized names and values;
- provide buttons/inputs as a non-drag alternative;
- add a complete accessible table and raw export;
- test keyboard arrow behavior and focus order.

### 7.6 Multi-asset translation contract is broken

The multi-asset summary model passes:

- `leader`;
- `leaderValue`;
- `trailing`;
- `trailingValue`.

It calls `comparison.chart_accessible_summary`, whose ICU string requires:

- `startA`;
- `endA`;
- `startB`;
- `endB`.

The runtime emitted a formatting error in Polish. Existing locale parity checks confirm keys but not variable contracts.

**Required change**

- create a separate multi-asset summary translation key matching the model;
- extract/type ICU placeholders;
- test English and Polish interpolation with representative data;
- include `/multi-asset` in smoke and accessibility CI.

### 7.7 Accessibility test architecture improvements

- Keep normal-color axe scans.
- Add forced-colors as a separate suite so failures are clearly attributed.
- Test 320 px reflow, 200%/400% zoom, text spacing, reduced motion, and dark mode separately.
- Include every trusted public route.
- Include admin/authenticated/shared states with fixtures.
- Capture server logs.
- Add explicit accessible-name assertions for date controls.
- Test minimum 24×24 WCAG target size and prefer 44×44 for primary touch actions.
- Complete manual NVDA/VoiceOver/TalkBack validation before public launch.

## 8. Concurrency and Availability Evidence

### 8.1 Local lab results

These are single-process local smoke-mode measurements, not production capacity:

| Scenario                | Total | Concurrency | Wall time |  Throughput |    p50 |    p95 |    p99 | Status         |
| ----------------------- | ----: | ----------: | --------: | ----------: | -----: | -----: | -----: | -------------- |
| Health                  |   300 |          40 |    900 ms | 333.5 req/s |  90 ms | 185 ms | 449 ms | 300×200        |
| Calculation, shared IP  |   150 |          20 |  2,160 ms |  69.4 req/s | 344 ms | 548 ms | 708 ms | 99×200, 51×429 |
| Calculation, unique XFF |   150 |          20 |  2,714 ms |  55.3 req/s | 343 ms | 481 ms | 625 ms | 150×200        |

The high-cardinality follow-up sent 2,000 cached calculation requests with 80-way concurrency in 5.4 seconds; all returned HTTP 200.

### 8.2 What these numbers mean

- Calculation endpoints can consume material CPU/time even in smoke mode.
- The limiter activates for one identity.
- Spoofing identity bypasses it.
- Health is responsive under modest local concurrency.
- The results do not cover cold starts, real database access, provider I/O, multiple Cloud Run instances, or production networking.

### 8.3 Required production load plan

Test:

- cold and warm public pages;
- each calculator with representative worst-case bounded input;
- authenticated portfolio list/simulate/export;
- import at maximum supported size;
- public share creation and reads;
- sync status and provider failure;
- Web Vitals ingestion;
- 1, 2, and N Cloud Run instances;
- database pool/concurrency saturation;
- rate-limit shared-store failure.

Capture:

- p50/p95/p99 latency;
- throughput and errors;
- CPU, memory, event-loop delay, GC;
- database connections/query latency;
- instance count/cold starts;
- response bytes and egress;
- log volume/cost;
- limiter decisions;
- cost per 1,000 requests.

Stop conditions should protect the database and cost budget.

## 9. Supply Chain and Secrets

### 9.1 Positive evidence

- `pnpm audit --prod --audit-level=low` reports no known vulnerability.
- Lockfile integrity hashes are present.
- No high-confidence Google, GitHub, AWS, Slack, or private-key pattern was found in the current tracked tree.
- No high-confidence pattern was found in 1,174 commits.
- Only `.env.example` appears as a tracked environment-like path.
- Docker runtime uses a non-root user.
- No third-party runtime script/CDN dependency was found in application markup.
- No HTTP production resource URL was found outside local development.
- Public client environment references do not expose a named secret/token/database variable.
- Browser source maps contain no source content; server maps inspected also omit sources content.

### 9.2 Limitations

The pattern scan is narrower than gitleaks/trufflehog and cannot detect arbitrary secrets. Add continuous secret scanning and push protection, then perform one full historical scan with an established scanner.

### 9.3 License inventory

Observed production license groups include:

- MIT: 325 entries;
- Apache-2.0: 108;
- ISC: 33;
- BSD variants;
- two LGPL-3.0-or-later `sharp`/libvips platform packages;
- one CC-BY-4.0 `caniuse-lite` entry;
- smaller permissive/composite groups.

The repository has no root `LICENSE` or third-party notice file and no package license field. Because the project is private this may be intentional, but deployment still distributes client code and container dependencies. Generate a reviewed third-party notice/SBOM and obtain legal guidance for LGPL/container obligations before external distribution.

### 9.4 Required continuous controls

- Dependabot/Renovate;
- production audit at moderate/low policy with triage SLA;
- CodeQL;
- secret scanning and push protection;
- SBOM on every release;
- container/OS scan;
- action SHA pinning;
- base-image digest pinning and updates;
- artifact attestation/signing;
- retained dependency/license report;
- emergency vulnerable-dependency response runbook.

## 10. CI/CD and Cloud Deployment Review

### 10.1 Strengths

- Production deploy is manual and restricted to `main`.
- GitHub environment protection can be applied.
- Workload identity avoids a long-lived Google service-account key.
- Workflow permissions are narrow: contents read and OIDC token write.
- Concurrency prevents simultaneous production deploy/rollback.
- Images have immutable commit tags in addition to `latest`.
- Deployment performs release checks, migration, revision capture, and authenticated verification.
- Cloud Run preview is private.
- Docker runtime is non-root and has a health check.

### 10.2 Required fixes

1. Fix migration journal before relying on deployment migration.
2. Move secrets to Secret Manager references.
3. Pin actions to SHAs.
4. Validate rollback input through an environment variable.
5. Deploy/verify by image digest.
6. Generate SBOM and provenance.
7. Add post-deploy admin-auth negative test.
8. Add schema version to readiness.
9. Align or remove `cloudbuild.yaml`, which currently has a weaker path.
10. Add cleanup/rollback rules for failed deployment after migration.

### 10.3 Expand/contract release requirement

Migrations run before the new revision is deployed. Therefore every schema change must be compatible with the currently serving revision:

1. expand schema;
2. deploy code that supports old/new;
3. backfill;
4. switch reads/writes;
5. verify;
6. remove old schema in a later release.

Routing traffic to an old revision does not roll back a destructive database migration.

## 11. Logging, Monitoring, and Incident Response

### 11.1 Logging contract

Every server event should have:

- timestamp from platform;
- application version/revision;
- severity;
- event name;
- route template, not raw URL query;
- request/correlation ID;
- actor class, not raw identity;
- safe error code/class;
- bounded timing/count fields;
- data revision for calculation/sync events.

Never include:

- authorization/cookies;
- OAuth/session tokens;
- secret values;
- full database URLs;
- SQL query parameter arrays;
- portfolio names/descriptions/notes by default;
- calculation input payloads;
- raw request bodies;
- full external URLs containing queries;
- unbounded provider bodies/errors.

### 11.2 Alert set

- any admin unauthorized spike or `Bearer undefined` attempt;
- admin sync invoked outside an approved actor/window;
- migration version mismatch;
- database DDL from runtime identity;
- elevated 400/413/429/500;
- log bytes per request/event above budget;
- calculation p95/CPU saturation;
- data freshness breach;
- sync lock stuck or repeated retry;
- OAuth callback/session error rate;
- CSP violations by route/browser;
- share/import quota abuse;
- backup or restore verification failure.

### 11.3 Incident runbooks

Prepare:

- admin secret compromise;
- OAuth token compromise;
- database credential compromise;
- unauthorized portfolio access;
- corrupted/stale bond data;
- calculation-model defect;
- failed/partial migration;
- dependency/container CVE;
- provider compromise;
- log data exposure;
- denial-of-service/cost spike.

Each runbook needs containment, evidence preservation, rotation/revocation, customer impact assessment, notification ownership, restoration, and postmortem actions.

## 12. Required Adversarial Test Suite

### 12.1 Administration

- missing, blank, whitespace, malformed, correct, prefix/suffix, and `undefined` secrets;
- constant-time decision path;
- rate-limit failures;
- admin role/session matrix;
- session revocation and step-up;
- raw errors never returned/logged;
- audit event contains actor and correlation only.

### 12.2 Identity and ownership

- authenticated user A cannot read/write/delete user B portfolio/lot;
- guessed UUID/shared ID returns 404 without timing/detail leak;
- private shared portfolio remains private;
- unpublishing revokes access;
- guest cookie tampering;
- missing auth table/secret behavior in production;
- guest-to-account migration;
- concurrent ownership change and mutation;
- origin/CSRF matrix.

### 12.3 Input/resource abuse

- unsupported content type;
- invalid and oversized content length;
- chunked/streamed oversized body;
- deeply nested JSON;
- huge arrays/strings/numbers;
- prototype-related keys;
- invalid Unicode/control characters;
- import rollback;
- share quota/expiry;
- filename/header safety;
- bounded logs.

### 12.4 Calculation correctness under attack

- worst-case valid horizon/paths;
- NaN/infinity/exponent/precision cases;
- impossible dates and leap boundaries;
- stale data revision;
- cache invalidation;
- concurrent duplicate requests;
- cancellation/stale response;
- timeout and overload response;
- model version mismatch.

### 12.5 Synchronization

- unsigned/invalid/replayed Inngest request;
- missing key in production;
- overlapping jobs;
- provider timeout/oversize/redirect/wrong content type;
- partial provider failure;
- lock expiry and process death;
- idempotent retry;
- last-known-good preservation;
- data provenance verification.

### 12.6 Browser/accessibility

- Chromium, Firefox, WebKit;
- 320 px reflow;
- 200% and 400% zoom;
- forced colors;
- dark mode;
- reduced motion;
- keyboard-only full workflow;
- Polish/English placeholder parity;
- chart brush single-pointer alternative;
- screen-reader manual scripts.

## 13. Remediation Program

### 13.1 Current completion ledger

This table reconciles the security findings below with the delivery ledger in
[09. Comprehensive Codebase Quality, Security, and Refactor Plan](./09_comprehensive_codebase_quality_security_refactor_plan.md).
`Done` means repository implementation and its focused checks are recorded;
it does not replace any required deployed evidence. `In progress` means a
foundation exists but this finding's acceptance criteria are not met.

| Finding | Status  | Current position                                                                                                             |
| ------- | ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| SR-01   | Done    | Fail-closed service secret validation and server-side admin sessions replaced browser bearer access.                         |
| SR-02   | Done    | Migration-only schema authority and reconciled migration history recorded under DATA-01.                                     |
| SR-03   | Done    | Shared safe problem responses plus bounded, structured, secret-redacted server logging implemented.                          |
| SR-04   | Done    | Trusted-proxy identity, named policies, shared production limiter, and 429 headers implemented.                              |
| SR-05   | Done    | Bounded local adapter and shared production counters implemented; deployed multi-instance receipt remains external evidence. |
| SR-06   | Done    | Shared bounded JSON reader now enforces media type/bytes before parsing; settings and telemetry use strict bounded schemas.  |
| SR-07   | Done    | Browser-stored secret and bearer transport removed; admin UI uses server-side allowlist/session authorization.               |
| SR-08   | Done    | Mutation-origin, guest-cookie, session, and fallback contract completed and documented.                                      |
| SR-09   | Done    | Transactional, bounded portfolio import and rollback coverage completed.                                                     |
| SR-10   | Blocked | Durable admin Inngest enqueue exists; signed delivery, retry, dead-letter, and replay proof need operator access.            |
| SR-11   | Done    | Rollback workflow hardened as part of CI/CD security controls.                                                               |
| SR-12   | Done    | Deployment now uses Secret Manager references; plaintext runtime-secret YAML path removed.                                   |
| SR-13   | Done    | Workflow actions SHA-pinned; CodeQL, Dependabot, image scanning, SBOM, and provenance controls added.                        |
| SR-14   | Done    | Client share path no longer bundles Zod; strict-CSP Firefox calculator regression runs in CI without `unsafe-eval`.          |
| SR-15   | Done    | Playwright server supplies trusted Auth.js environment and fails on captured `UntrustedHost`/Auth.js stderr diagnostics.     |
| SR-16   | Done    | Synchronization gateway enforces HTTPS allowlist, redirect denial, response byte limits, JSON media type, sanitized errors.  |
| SR-17   | Done    | Share/telemetry quotas, retention, cleanup, and reporting controls completed.                                                |
| SR-18   | Done    | Canonical share URLs and safe export filename/content-disposition adapters completed.                                        |
| SR-19   | Done    | OAuth-token lifecycle, revocation, retention, and review runbook completed; deployed review stays external.                  |

### Maintainer scope decision — 2026-08-25

This remains a private-preview project. The maintainer has deferred the
cloud-managed operational expansion and external evidence work, including GCP
IAM/Secret Manager changes, Cloud Run review, managed backup/restore proof,
Inngest operator verification, production load testing, and field telemetry
receipts. SR-10 and the related external gates therefore remain `Blocked`; they
are not waived or complete. Revisit them before public launch or any
production-readiness representation.

### Phase A — 24-hour containment

- SR-01 fail-closed admin authorization.
- Disable/remove browser-stored admin secret.
- SR-03 log redaction/truncation.
- Settings enum/length limits and a global small-body guard.
- Negative runtime tests for admin bypass.

**Exit:** `Bearer undefined` is 401/503, logs are bounded, oversized settings return 413.

### Phase B — Database and deployment safety

- Reconcile journal and schema.
- Build empty/upgrade PostgreSQL CI.
- Remove runtime DDL.
- Separate migration/runtime roles.
- Back up and rehearse recovery.
- Align Cloud Build with GitHub deployment.

**Exit:** new database plus upgraded snapshots match intended schema and runtime cannot DDL.

### Phase C — Edge and endpoint security

- Trusted client identity.
- Managed/shared limiter.
- Endpoint-specific quotas.
- Origin/CSRF validation.
- Guest ownership contract.
- Atomic import.
- share/telemetry retention.

**Exit:** spoofed XFF cannot multiply quota; abuse matrix passes across two instances.

### Phase D — CI/CD and integration security

- Secret Manager references.
- action SHA pins;
- rollback input hardening;
- CodeQL/secret/SBOM/container scans;
- Inngest configure-or-delete decision;
- OAuth token/rotation controls.

**Exit:** provenance and key configuration are verifiable from deployment evidence.

### Phase E — Browser and accessibility resilience

- Zod jitless/CSP compatibility;
- Firefox CI;
- operational WebKit job;
- forced-colors primary styles;
- multi-asset chart semantic redesign;
- translation placeholder tests;
- complete route matrix and server-log capture.

**Exit:** normal and adversarial accessibility matrices pass in supported engines; manual review recorded.

### Phase F — Production resilience validation

- Cloud Run/Neon load test;
- cold-start and scaling test;
- backup restore drill;
- provider outage and sync replay;
- field Web Vitals and security alerts;
- penetration test and independent financial review.

## 14. Evidence-Based Acceptance Criteria

### Administration

- every missing/malformed secret request is rejected;
- no browser stores a reusable machine secret;
- admin actions have server-side role checks and audit events;
- no public raw admin error details.

### Database

- Drizzle loader count equals committed intended migration count;
- empty database reaches the expected schema;
- each deployed baseline upgrades;
- runtime role fails `CREATE/ALTER/DROP`;
- no request path imports compatibility DDL.

### HTTP security

- byte limits are enforced before parsing;
- 413/415 contracts are tested;
- trusted client identity is documented;
- limits hold across multiple instances;
- logs are redacted and capped;
- origin policy covers cookie-authenticated writes.

### Browser/accessibility

- Firefox has no CSP eval diagnostic;
- WebKit job launches and passes selected critical flows;
- forced-colors matrix passes;
- chart has no nested interactive control;
- no accessible label contains `undefined`;
- multi-asset translation interpolates in both locales;
- server stderr is part of browser pass/fail.

### Supply chain

- historical secret scan completed with a dedicated tool;
- actions/base image pinned;
- SBOM and container scan attached to release;
- third-party license obligations reviewed;
- high-severity advisory SLA documented.

### Operations

- real backup restore evidence;
- alert tests;
- incident runbooks;
- load test meets agreed p95/error/cost budgets;
- production IAM and OAuth configuration reviewed independently.

## 15. Positive Security Foundations to Preserve

- Nonce-based production CSP excludes `unsafe-eval`.
- CSP includes `base-uri`, `object-src`, `frame-ancestors`, and `form-action`.
- HSTS, MIME sniffing protection, referrer policy, permissions policy, and frame fallback are present.
- Production dependency audit is currently clean.
- Auth.js uses an established adapter rather than a custom session protocol.
- Important portfolio writes require authenticated ownership.
- Owner-aware repository queries exist for portfolio and lot reads.
- Selected lot creation plus transaction write is already transactional.
- Calculation schemas bound many numeric ranges and horizons.
- External fetches have timeouts.
- Sync has a database lock and retries in the Inngest function definition.
- Shared pages are marked non-indexable.
- Docker runs as non-root.
- GitHub deploy uses OIDC workload identity and narrow workflow permissions.
- Chromium normal-color axe checks and skip-link behavior pass on scoped routes.
- The application already has a useful CSP regression test and browser diagnostic helper that can be extended.

## 16. External Verification Still Required

This repository audit materially increases confidence but cannot replace:

- Google Cloud IAM/Secret Manager/Cloud Run/Artifact Registry inspection;
- production database schema and permission audit;
- managed backup restore;
- production OAuth console/scope/callback review;
- Cloud Armor and real forwarded-header verification;
- third-party penetration test;
- independent Polish treasury-bond calculation review;
- legal/GDPR/license review;
- human screen-reader and real-device Safari testing;
- production load and field Web Vitals.

## 17. Reference Standards

- [WCAG 2.2 Recommendation](https://www.w3.org/TR/WCAG22/)
- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [GitHub Actions script-injection guidance](https://docs.github.com/en/actions/concepts/security/script-injections)
- [GitHub Actions secure-use reference](https://docs.github.com/en/actions/reference/security/secure-use)
- [Inngest signing-key security](https://www.inngest.com/docs/platform/signing-keys)
- [Inngest `serve()` reference](https://www.inngest.com/docs/reference/typescript/serve)
- [Drizzle `migrate` documentation](https://orm.drizzle.team/docs/drizzle-kit-migrate)

## 18. Final Assessment

The application has good security primitives, but several primitives are not yet composed into a fail-closed production system. The critical path is concrete:

```text
fail-closed admin
→ bounded/redacted HTTP boundary
→ reproducible migration authority
→ trusted shared rate limiting
→ durable/authenticated sync
→ CSP-compatible cross-browser client
→ adversarial accessibility
→ production IAM, restore, load, and penetration evidence
```

Do not trade away the strong nonce CSP to solve the Firefox failure. Do not use request-time DDL to compensate for incomplete migrations. Do not treat readiness validation as authorization. Do not make a curated passing suite conceal server stderr, unrun routes, or unsupported browsers.

Production readiness should be declared only when these security invariants are expressed simultaneously in code, tests, deployment configuration, runtime evidence, and current documentation.

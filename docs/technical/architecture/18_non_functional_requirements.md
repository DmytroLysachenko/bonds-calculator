# 18. Non-Functional Requirements

## Offline-data safety

The application does not promise offline calculations. It must show a clear
network or data failure rather than silently using stale financial inputs. An
offline mode may be introduced only with versioned assets, explicit data-as-of
state, update handling, and dedicated browser tests.

Quality and performance standards for the platform. Numeric budgets below are
release targets verified by browser/lab checks, not promises about every
network, device, or third-party provider condition.

## Service-level objectives and measurement

| Area                     | Target                                                                                                                       | Measurement and evidence                                                                                                      |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Core Web Vitals          | p75 LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 on public routes                                                                    | Aggregate-only field telemetry after the external-evidence gate; lab budgets prevent regression before field evidence exists. |
| API reliability          | p95 successful API latency ≤ 800 ms and 5xx rate < 1% per rolling 30 days                                                    | Correlated server metrics, excluding expected client validation failures.                                                     |
| Availability             | Monthly authenticated readiness success ≥ 99.5%                                                                              | Cloud Run readiness observation and post-deploy smoke receipt.                                                                |
| Reference-data freshness | Current offer/sync status displayed with its as-of value; failed sync never claims current data                              | Sync ledger and freshness UI checks.                                                                                          |
| Recovery                 | RPO ≤ 24 h and RTO ≤ 4 h                                                                                                     | Managed backup/PITR and isolated restore drill; this remains externally gated.                                                |
| Accessibility            | WCAG 2.2 AA automated checks on trusted routes; manual keyboard, zoom, forced-colors, and chart review every release tranche | Playwright/axe artifacts plus manual review record.                                                                           |
| Supported browsers       | Current stable Chromium, Firefox, and WebKit desktop; current Chromium mobile viewport                                       | CI smoke matrix and release-browser record.                                                                                   |
| Security patches         | Critical dependency/security fixes assessed within 24 h and remediated or mitigated within 7 days                            | Dependabot/CodeQL findings and release record.                                                                                |
| Privacy and retention    | No scenario inputs, raw URLs, account IDs, or user agents in vital telemetry; aggregate vital data retained for 30 days      | Schema, cleanup job, and privacy review receipt.                                                                              |
| Boundary size            | Portfolio imports ≤ 256 KiB and 500 lots; share payloads follow their route schema limits                                    | Route-schema boundary tests.                                                                                                  |

## 1. Correctness & Precision

- **NFR1.1:** Supported calculation scenarios must have reviewed golden and edge-case regressions; discrepancies with official offer terms block release until understood.
- **NFR1.2:** Financial arithmetic uses Decimal.js at defined rounding boundaries; JavaScript floating-point values are not used for settlement decisions.
- **NFR1.3:** Touched financial behavior must add focused regression coverage rather than rely on a fixed test-count claim.

## 2. Performance

- **NFR2.1:** Public-route lab budgets are enforced by Lighthouse and browser diagnostics; production field targets require a separate aggregate RUM evidence record.
- **NFR2.2:** Calculation interactions must preserve cancellation and never commit a stale response; performance changes require a measured regression test or benchmark.
- **NFR2.3:** Charts expose an accessible summary and data-table path, and performance work preserves those fallbacks.

## 3. Availability & Reliability

- **NFR3.1:** The app does not offer offline calculation. A network failure is shown instead of a potentially stale financial result.
- **NFR3.2:** Sync failures preserve last-known-good reference data and expose freshness status; they do not silently claim current data.

## 4. Security & Privacy

- **NFR4.1:** Anonymous calculation requests are processed by server APIs only as needed to calculate; telemetry excludes query strings, account IDs, and scenario inputs.
- **NFR4.2:** Account and shared-scenario data processing follows the published retention and operational-evidence policy; production deletion/backup evidence remains an operations gate.
- **NFR4.3:** Use CSP (Content Security Policy) to prevent XSS.

## 5. Accessibility

- **NFR5.1:** WCAG 2.1 Level AA compliance.
- **NFR5.2:** Screen reader support for charts (via ARIA descriptions or data tables).
- **NFR5.3:** High-contrast mode support.

## 6. Maintainability

- **NFR6.1:** Separation of concern: Calculation logic must be in a standalone, framework-agnostic package.
- **NFR6.2:** API response caching to minimize external provider costs/load.
- **NFR6.3:** Modular instrument definitions (JSON-based) to allow adding new bonds without code changes.
- **NFR6.4:** User-facing translated content must be locale-driven through the i18n layer. Inline language branches and inline `pl/en` translation objects in code are not acceptable.
- **NFR6.5:** Commented-out code, dead legacy branches, and duplicate touched-scope logic must be removed rather than preserved.
- **NFR6.6:** UI components must stay narrowly scoped, with route-level orchestration separated from calculation truth, display adapters, and export semantics.
- **NFR6.7:** Internationalized content may be stored as strings, arrays, or nested objects in locale resources, but not as hardcoded translated values in application files.
- **NFR6.8:** The application standard for internationalization is `next-intl`. Custom translation runtimes and custom translation-node resolution layers are not acceptable as long-term architecture.
- **NFR6.9:** Client-side translation access must use the project hook from `@/i18n/client`; SSR/server translation access must use `next-intl/server`; non-React shared utilities must use explicit locale-driven helpers rather than app-level compatibility shims.
- **NFR6.10:** API route handlers must stay thin and delegate business logic and DB access to `lib/server/**` services or repositories.
- **NFR6.11:** Shared UI must be grouped by subdomain under `shared/components/**`; compatibility shims are temporary and must be removed after migration.
- **NFR6.12:** Data reads belong in `lib/data/**`; server-only orchestration belongs in `lib/server/**`; the canonical Drizzle schema lives in `db/schema.ts`, while seed concerns stay under `db/seed/**`.
- **NFR6.13:** Guest users may calculate and preview, but notebook/portfolio workspace mutations must be explicitly gated behind signed-in access.
- **NFR6.14:** Shared workspace selection state belongs in `shared/lib/workspace/**`; feature-local storage helpers must not become cross-feature dependencies.
- **NFR6.15:** Display options such as chart granularity must never alter calculation truth. Chart, table, and export layers must derive from one normalized display contract.
- **NFR6.16:** Simple-mode projected NBP defaults must be sourced from synced data and represented as a flat path until the user overrides them.
- **NFR6.17:** Shared number/date/currency/percent formatting must use centralized formatter helpers instead of repeated page-local formatter construction.
- **NFR6.18:** Calculator pages should follow a stable shell hierarchy: inputs, primary result, chart, detailed table/timeline, then secondary meta.
- **NFR6.19:** Simple vs advanced market-assumption controls must remain explicit and behaviorally truthful; advanced yearly paths must stay behind deliberate expansion.
- **NFR6.20:** Product UI flows must use app-native confirmation and feedback components rather than browser-native prompts.
- **NFR6.21:** Reference dashboards should minimize redundant nested card chrome and keep charts primary, with scope/status guidance in secondary rails or accordions.
- **NFR6.21a:** Dense informational UI should prefer separators, compact grids, and bordered rows over repeated nested card stacks.
- **NFR6.22:** Calculator API endpoints that share the same contract should use shared thin-route helpers instead of duplicating parse/execute/respond wiring per route.
- **NFR6.23:** Structured JSON API routes must use shared validated-body parsing instead of repeated ad hoc `req.json()` handling.
- **NFR6.24:** Secondary tools such as multi-asset and recovery-lab should stay explicitly demoted and framed as supporting/reference surfaces, not peer flagship calculators.
- **NFR6.25:** CPI and NBP reference overlays must be rendered from truthful reference display series rather than smoothed or interpolated through unrelated bond checkpoints.
- **NFR6.26:** Sidebar and workspace utility chrome should prefer compact grouped rails and separators over stacks of visually identical floating mini-cards.
- **NFR6.27:** Shared ready, support, and explanation panels should favor dense rows and light section framing over nested decorative cards.

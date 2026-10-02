# 28. Project Map

This map defines where code belongs and which layer owns each responsibility.
Use it before adding files or moving logic.

## Runtime Entry Points

- `app/`: Next.js route segments, layouts, metadata, API controllers, and thin page composition. Retained page clients belong under `features/**/components`.
- `app/api/**/route.ts`: HTTP controllers only. They parse input, resolve auth/ownership, call server services, and return shared response helpers.
- `features/**`: product workflows grouped by domain surface. Components render workflows; hooks own UI state; `lib` folders own feature-local pure models such as calculator state and dashboard state; `tests` folders own feature-local test files.
- `shared/**`: browser-safe primitives reused by multiple features: components, hooks, clients, display helpers, formatters, workers, and persistence helpers.
- `shared/lib/client-logger.ts`: browser-facing error/warning logging helper.
  Feature hooks and client components should use it instead of direct
  `console.error` calls. Server and API logging goes through
  `lib/server/logging.ts`; sync logging goes through `lib/sync/sync-logger.ts`;
  global error boundaries also use the client logger.

## Server And Data Layers

- `lib/server/**`: server-only application services, route helpers, auth helpers, commands, queries, sync orchestration, and page-read services.
- `lib/server/logging.ts`: scoped server/API logger. Route controllers and
  server services should use it instead of direct `console.*` calls.
- `lib/server/runtime/env.ts`: centralized runtime environment access. Server
  services and scripts should depend on these helpers instead of reading
  `process.env` directly in multiple places.
- `lib/server/auth/provider-config.ts`: Auth.js runtime configuration boundary.
  It owns OAuth provider discovery, compatibility fallback for `NEXTAUTH_SECRET`,
  and the development-only auth secret fallback.
- `lib/server/readiness/**` and `lib/server/health/**`: operational endpoint services. Routes delegate payload and check construction here.
- `lib/server/**/repository.ts`: Drizzle query/mutation ownership for server domains that need persistence.
- `lib/server/admin/status-read-model.ts`: admin status projection for data-series
  point counts, latest data-point coverage, recent sync attempt evidence, and
  environment snapshot fields.
- `lib/data/**`: read models, repositories, market-data caches, and source-neutral data access.
  Direct database reads are intentional in this layer because it is the shared
  data retrieval boundary for routes, layouts, and calculation services.
- `lib/data/chart-reference-series.ts` and `lib/data/multi-asset-history.ts`: chart reference envelopes, fallback coverage, stale/partial status decisions, and data-layer fallback builders for chart APIs.
- `lib/api-clients/**`: external provider adapters that convert public API responses into internal records. HTTP transport goes through `lib/sync/http-gateway.ts`.
- `lib/sync/**`: CLI sync orchestration, seed scripts, provider sync services, sync history writing, and the shared sync HTTP gateway.
  Seed scripts may use direct database access; long-lived sync services should
  keep table access behind focused repository or persistence helpers. Providers
  and CLI entrypoints use `sync-logger.ts` for operational logging rather than
  direct console calls.
- `db/**`: Drizzle schema, migrations, seed data, and low-level database connection code.
- `compose.yaml` and `Taskfile.yml`: local development orchestration. WSL with
  Docker Compose is the recommended path; Windows-native `pnpm` scripts remain
  available as fallback commands.
- `scripts/smoke-local.ts`: no-secret local container smoke checks for the app
  shell, health endpoint, and calculation defaults.

## Domain Ownership

- `features/bond-core/**`: calculation truth, schemas, scenario handlers, validation, domain errors, and financial regression tests.
  Public calculation entrypoints are exported through `features/bond-core/utils/calculations.ts`, while implementation lives in `features/bond-core/utils/engine/**` by engine family (`single-bond-engine`, `reverse-bond-engine`, `regular-investment-engine`, and shared engine helpers). Large engines should delegate schedule, cycle, period-rate resolution, period accrual setup, period execution, mutable simulation state, accounting, terminal notes, tax-relief setup, and lot/contribution details to focused sibling helpers such as `single-bond-cycle.ts`, `single-bond-period-rate.ts`, `single-bond-period-step.ts`, `single-bond-period-runner.ts`, `single-bond-simulation-state.ts`, `single-bond-accounting.ts`, `single-bond-terminal.ts`, `single-bond-tax-relief.ts`, `regular-investment-schedule.ts`, and `regular-investment-orchestration.ts`.
  Comparison scenario result assembly lives in `handlers/comparison-result.ts`
  so normalized and independent comparison paths share rollover/result assembly.
  Zod schema primitives live in `features/bond-core/types/schema-primitives.ts`;
  `features/bond-core/types/schemas.ts` remains the public scenario schema
  entrypoint.
- `features/comparison-engine/**`: comparison workflows, comparison-specific display models, chart/table composition, and comparison persistence. Page clients for comparison and multi-asset live in feature components. Active comparison results are rendered through `ComparisonResultsPanel.tsx`; comparison container labels, readiness, and layout decisions live in `lib/comparison-container-model.ts`; comparison results metrics live in `lib/comparison-results-panel-model.ts`; comparison value-chart rows, domains, summaries, and series live in `lib/comparison-results-chart-model.ts`; comparison persistence lives in `lib/comparison-persistence.ts`; comparison hook update decisions live in `lib/comparison-update-actions.ts`; comparison hook client-state and persistence snapshot decisions live in `lib/comparison-client-state.ts`; persistence restore/save and macro/default effect wiring lives in `hooks/useComparison.ts`; aligned table interpolation and scenario snapshots live in `lib/comparison-table-projection.ts`; table pagination and scenario cells live in `components/comparison-table/ComparisonTablePaginationControls.tsx` and `components/comparison-table/ComparisonTableScenarioCells.tsx`. Multi-asset metadata lives in `constants/multi-asset.ts`; multi-asset draft/query state lives in `lib/multi-asset-state.ts`; chart rows, ending snapshots, availability summaries, and chart legends live in `components/multi-asset-chart-model.ts`.
- `features/single-calculator/**`: single-bond calculator UI, single scenario sharing, notebook save action wiring, single-route display, and pure single-calculator state/result models. Hook-facing initial state, persistence snapshots, field updates, replacement inputs, and selected-series decisions live in `lib/single-calculator-client-state.ts`; input and series normalization live in `lib/single-calculator-state.ts`; macro/default and definition-sync effect transitions live in `lib/single-calculator-effect-state.ts`; persistence restore/save, series-fetch, definition-sync, macro/default, and auto-calculation effect wiring lives in `hooks/useBondCalculatorEffects.ts`; async calculation/series actions live in `lib/single-calculator-actions.ts`; container labels and save/export metadata live in `lib/single-calculator-container-model.ts`; result summary metrics, financial insights, and scenario facts live in `lib/bond-results-summary-model.ts`; timeline renderers live in `components/timeline/`, while their stable feature type contract remains in `types/timeline.ts`.
- `features/economic-data/**`: economic reference charts, dashboard state models for CPI/NBP metadata display, page-level labels/metrics in `lib/economic-page-model.ts`, dashboard section composition in `features/economic-data/components/EconomicDashboardSections.tsx`, and CPI/NBP status-card rendering in `features/economic-data/components/EconomicSeriesStatusCard.tsx`.
- `features/notebook/**`: portfolio workspace UI, portfolio details, notebook commands through `portfolio-client`, notebook-specific contracts, and pure workspace models in `features/notebook/lib/**`. `useNotebookWorkspaceController.ts` owns the access capability, workspace resource, selection/navigation, feedback, and named actions; `NotebookContainer.tsx` only composes its prepared view. Reusable container labels live in `lib/notebook-container-labels.ts`; local detail/import/delete navigation state lives in `hooks/useNotebookContainerWorkspace.ts`; derived workspace view state lives in `buildNotebookWorkspaceViewModel`; stored-portfolio and scope-note rendering lives in `NotebookContainerPanels.tsx`; portfolio detail renderers live in `components/portfolio-details/`; portfolio lots rendering composes `PortfolioLotsTabSections.tsx` rather than keeping the table and liquidity panel inline. UI-facing portfolio row types are imported from `shared/types/portfolio.ts`, not directly from `db/schema`.
- `features/optimizer/**`: optimizer UI sections, optimizer state models, and recommendation orchestration. Optimizer calculation state/effects live in `hooks/useOptimizerCalculator.ts`; route/page code should consume `features/optimizer/lib/**` state helpers instead of recomputing readiness or default input rules inline. Input controls belong in `features/optimizer/components/OptimizerInputPanel.tsx`, result/ready/audit rendering belongs in `features/optimizer/components/OptimizerResultsPanel.tsx`, and the page client owns top-level shell composition.
- `features/home/**` and `features/education/**`: retained entry and education surfaces. Home navigation metadata lives in `features/home/constants/dashboard.ts`; education concept/starter metadata lives in `features/education/constants/education-content.ts`.
- `features/regular-investment/**`: retained recurring-investment surface.
  The calculator hook owns persisted input state and delegates deterministic input normalization to `lib/regular-investment-state.ts`; result summary constants/types
  live in `constants/` and `types/`, result summary view-model assembly lives in
  `lib/regular-investment-results-model.ts`, and the yearly bucket table is
  owned by `components/RegularInvestmentYearlyBucketsSection.tsx`.
- `features/ladder-strategy/**`: retained ladder surface built on the regular
  investment model. Timeline mode/filter vocabulary lives in `types/` and
  `constants/`; `lib/ladder-state.ts` owns deterministic input state updates;
  `lib/ladder-timeline-model.ts` owns timeline buckets, stats, filters, and
  metric items; `LadderTimeline.tsx` coordinates state/model output; and
  `LadderTimelineSections.tsx` plus `LadderTimelineTable.tsx` render the chart,
  yearly summary, notices, and detail rows.
- `features/retirement/**`: retained retirement planner surface. Durable
  planner inputs live in `types/`, default inputs in `constants/`, display
  formatting and planner view models live in `lib/`, and summary/result panel
  rendering lives in feature components such as `RetirementPlannerPanels.tsx`.

## Feature Folder Vocabulary

Feature folders should use the same structural vocabulary when the category exists:

- `components/`: React containers, sections, controls, and presentational parts for that feature
- `hooks/`: feature-local React hooks and UI orchestration
- `lib/`: pure state, display, dashboard, and adapter models owned by one feature
- `utils/`: low-level feature utilities that are not UI models
- `types/`: durable type exports and schema-adjacent feature types
- `constants/`: durable static values owned by the feature
- `tests/`: feature-owned tests, with optional subfolders mirroring the tested ownership such as `tests/lib/**`, `tests/components/**`, or `tests/utils/**`

Do not add empty folders as placeholders. Use the vocabulary when a feature actually has that responsibility.

When one feature has two independently owned UI workflows, use
`components/<workflow>/` only after the workflow has a named prepared-model or
controller interface and focused behavioral proof. Keep the feature entry
container at `components/` and make it import those workflow modules. Do not
create folders for visual taxonomy, file length, or one-file wrappers.

## Boundary Rules

- Browser API calls belong behind `shared/lib/*-client.ts`, `shared/hooks`, or approved workers.
- Browser feature logging belongs behind `shared/lib/client-logger.ts`; do not
  add feature-local direct `console.error` calls in client components/hooks.
- Browser-facing DB row types belong behind app-facing type barrels such as
  `shared/types/portfolio.ts`; feature components should not import
  `db/schema` directly.
- Route controllers use `lib/server/http/responses.ts` unless they intentionally return non-envelope operational JSON.
- `/api/health` and `/api/readiness` intentionally return raw operational JSON
  rather than the app success-envelope shape.
- Route JSON bodies use `lib/server/http/read-json-body.ts`; route families with repeated auth/owner behavior use their family controller helpers.
- Calculation route handlers are created through `lib/server/http/calculation-route.ts`;
  they parse with `readJsonBody` and return envelopes with `okJson`.
- Portfolio writes live in `lib/server/portfolio/commands.ts`; reads and simulations live in `lib/server/portfolio/queries.ts`; public shared-page reads live in `shared-page-service.ts`.
- Pure display and state logic should sit in `shared/lib` when reused or in `features/**/lib` when feature-local.
- Shared export code is split by concern: `shared/lib/csv-format.ts` owns pure
  CSV value/date formatting, `shared/lib/csv-download.ts` owns browser download
  side effects, `shared/lib/csv-bond.ts` owns single-bond and lot CSV
  conversion, `shared/lib/csv-comparison.ts` owns comparison CSV conversion,
  and `shared/lib/csv-utils.ts` remains the stable export barrel.
- Large components should be reduced by extracting pure models first, then extracting presentational subcomponents.
- Shared market-assumption UI uses `shared/lib/market-assumptions-form-model.ts` for state/format decisions and `shared/components/market-assumptions/**` for render primitives. `AdvancedRatePathSection.tsx` owns shared advanced path editor framing so calculator pages do not duplicate CPI/NBP setup-mode or path-editor logic.
- Operational API routes stay thin. Health, readiness, admin, and sync routes call server services for payloads, mode defaults, DB checks, and command responses.
- Production runtime checks use `scripts/check-production-config.ts` and
  `lib/server/runtime/env.ts`; do not duplicate Cloud Run env validation in
  ad hoc scripts or route modules.
- Chart routes call data-layer envelope helpers for fallback behavior instead of constructing fallback payloads inside route handlers.
- Shared chart components may have companion `*Parts.tsx`, `*Toolbar.tsx`, `*TooltipParts.tsx`, `*TooltipPrimitives.tsx`, or `*Plot.tsx` files for presentational sections, while pure chart decisions stay in model helpers.
- Shared chrome may split route shell, navigation models, and utility panels. `Sidebar.tsx` owns the responsive shell; `SidebarNavigation.tsx` owns navigation section construction and item rendering.
- Sync providers and API clients must not call raw `fetch`; use `lib/sync/http-gateway.ts`.
- Broad lint-disable comments are only allowed in the explicit clean-code
  contract allowlist. Additions require updating the contract and documenting
  why the local escape hatch is safer than changing the shared rule.
- Unused-code inventory is collected with `pnpm scan:unused`. Treat findings as
  candidates: remove confirmed dead code, but document or ignore framework,
  route, schema, seed, or operator entrypoints that Knip cannot infer safely.
  The current target is no confirmed unused files; remaining unused-export
  findings are API-surface review items, not automatic deletion work.

## Documentation Ownership

- `docs/product/**`: user-facing product intent, support matrix, UX principles, and scope decisions.
- `docs/technical/domain/**`: financial and domain rules.
- `docs/technical/architecture/**`: code architecture, quality gates, deployment, testing, and engineering rules.
- `docs/technical/features/**`: feature behavior and implementation notes.
- `docs/plans/**`: active roadmap and release plans only. Completed historical plans live under `docs/archive/plans/**`.
- `docs/ui/**`: UI system rules, visual regression contracts, and design migration notes.

## Test Ownership

- Domain math changes require focused `features/bond-core/tests/**` regression tests.
- Engine file moves require source-contract tests to follow the canonical implementation files, not only the public barrel exports.
- API/controller boundary changes require architecture contract tests.
- Display-model changes require pure model tests before UI assertions.
- UI section splits require contract tests to assert the new component/model ownership when source-level contracts already exist.
- Route boundary changes require contract coverage for body parsing and response envelopes.
- Provider HTTP changes require gateway tests and sync boundary contracts.
- Operational endpoint changes require `app/api/operational-endpoints-contract.test.ts` coverage and focused service tests.
- Admin status changes require read-model tests proving latest data point and
  latest sync attempt remain separate fields.
- Chart fallback/status changes require pure helper tests in `lib/data/**` plus route contract coverage when route ownership changes.
- Docs that define release, architecture, or support status should have a matching contract test when the rule is executable.

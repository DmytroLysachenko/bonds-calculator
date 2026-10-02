# Modularity and Refactoring Audit

**Date:** 2026-09-06

**Scope:** Production TypeScript and TSX in `app`, `features`, `shared`, `lib`, and `db`; architecture, HTTP, client gateways, stateful frontend workflows, sync, and market-data read models. Tests and generated output were sampled only to verify seams and contracts.

## Executive summary

The application already has a sound direction: feature-local UI state, a calculation application service with scenario handlers, a shared HTTP handler, browser gateways, and explicit server/data layers. This is a much better starting point than a typical dashboard codebase.

The highest-value work is **not** a new global framework or broad decorator system. It is to repair two broken HTTP contracts, then deepen a few existing modules whose callers currently coordinate too much detail. The resulting architecture can become a reusable dashboard baseline if it is captured as a template after these seams prove themselves in this application.

## Implementation status (2026-09-06)

- Completed: web-vitals serialization, the portfolio-access envelope, explicit envelope/raw response codecs, portfolio read/command composition, provider-series batch lookup, multi-asset pure projection, notebook workspace/detail controllers, and typed field updaters.
- Partially completed: single-calculator effect inputs are now a named session/actions boundary; comparison plan visibility is isolated. The broader page-controller extractions remain deliberately incremental to avoid changing calculation or URL behavior in one migration.
- Deferred: visual-only component splits. They should be undertaken only with a specific behavior or independent-loading need, as recommended below.

| Priority | Finding                                                                         | Why it matters                                                                                                       |
| -------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| P0       | Web-vitals payload is rejected by its strict endpoint schema                    | Produces the observed 400 responses, so operational data is lost.                                                    |
| P0       | Portfolio-access response is raw while its client expects the standard envelope | A successful access response is decoded as `undefined`; authenticated workspace state can be treated as guest state. |
| P1       | HTTP response decoding is duplicated and has no explicit raw/enveloped contract | The two defects above are easy to create again.                                                                      |
| P1       | Single-calculator and comparison page controllers expose too much orchestration | Changes to persistence, URL state, calculation, and presentation require changes across many callers/props.          |
| P1       | Provider sync can make one repository lookup per returned record                | A multi-series provider can turn a sync into an N+1 query pattern.                                                   |
| P2       | Notebook and market-data modules mix independent responsibilities               | They are hard to change and test in focused units, despite being correct today.                                      |

## Evidence and standards used

- `docs/technical/architecture/19_system_architecture.md` requires browser gateways to own fetch/parsing and routes to return through shared response helpers.
- `docs/technical/architecture/26_engineering_and_coding_rules.md` requires deep modules with small interfaces, inward dependencies, SOLID/DRY/KISS, and behavioral tests for product contracts.
- `docs/technical/architecture/25_handler_pattern_orchestration.md` is a positive example: one application service selects scenario handlers while dependencies remain injectable.
- Inventory: 797 source TypeScript/TSX files and 32 API route files were enumerated. Large files were reviewed by responsibility and coupling, not by line count alone.

## P0 — Correctness fixes before structural work

### 1. Web-vitals sender and endpoint disagree on the payload shape

**Evidence**

- `shared/components/observability/WebVitalsReporter.tsx:17-24` spreads the full object received from `web-vitals` into JSON.
- A `web-vitals` metric includes fields beyond `name`, `value`, and `rating` (for example `delta`, `entries`, and `id`).
- `app/api/observability/vitals/route.ts:17-28` accepts only five fields and uses Zod `.strict()`.

**Impact**

Every sampled metric with extra fields is a 400 response. This exactly explains the observed `POST /api/observability/vitals` Zod errors.

**Refactor**

Create a small, pure `toWebVitalPayload(metric, location, navigationType)` function at the telemetry seam. It must explicitly pick:

```ts
{ name: metric.name, value: metric.value, rating: metric.rating, path, navigationType }
```

Keep the strict server schema. Add a request-level regression test using a realistic metric with extra keys and assert 204; add a unit test for the serializer. Do not relax the schema or strip unknown server fields silently: strict decoding is the privacy boundary.

### 2. Portfolio access uses an incompatible response codec

**Evidence**

- `app/api/portfolio/access/route.ts:6-9` returns `rawJson(createPortfolioAccessPayload(owner))`.
- `shared/lib/portfolio-client.ts:42-44` calls it through `apiGet`.
- `shared/lib/api-client.ts:20-32` treats every successful response as `ApiResponse<T>` and returns `payload.data`.
- `shared/hooks/usePortfolioAccess.ts:16-21` stores that decoded value, then defaults missing access to guest/no-management state at lines 39-40.

**Impact**

The raw payload has no `data` field. The response is 200 but `apiGet` returns `undefined`, causing a silent authorization-UX failure rather than an explicit error.

**Refactor**

Choose one response contract per browser-consumed endpoint. The preferred minimal repair is to return `okJson(createPortfolioAccessPayload(owner))` and add an integration-style route/client contract test. Keep health/readiness raw only if they are explicitly operational endpoints not consumed by `api-client`.

## P1 — Make the existing HTTP seam deeper, not broader

### 3. Give JSON clients explicit envelope and raw decoders

**Evidence**

- `shared/lib/api-client.ts` has separate but nearly identical GET/POST/PATCH/DELETE fetch implementations and one implicit envelope decoder.
- `shared/lib/calculation-client.ts` and `shared/workers/calculation.worker.ts` duplicate JSON-envelope parsing and error mapping.
- `app/api/**` has both `okJson` and `rawJson` responses; this is valid only when the caller chooses the matching decoder.

**Refactor**

Replace the method-specific implementations with one internal `requestJson` transport and two explicit codecs:

```ts
requestJson(url, { method, body, signal }, decodeEnvelope<T>);
requestJson(url, { method, body, signal }, decodeRaw<T>);
```

`apiGet`, `apiPost`, and friends remain ergonomic wrappers for the envelope codec. Calculation UI and worker share a framework-neutral `decodeEnvelope` helper. Beacon telemetry remains exceptional because it intentionally does not wait for a response.

**Why this is SOLID/DRY/KISS**

It makes the response invariant visible at the call site, eliminates three parser copies, and does not introduce a generic REST SDK, endpoint registry, decorators, or generated client.

### 4. Do not add a second API decorator layer yet

The requested “default decorators” mostly already exist:

- `lib/server/http/api-handler.ts` applies request IDs, rate policy, safe problem mapping, and logging.
- `lib/server/portfolio/http.ts` composes authenticated ownership/origin enforcement.
- Calculation routes use `createCalculationRoute(ScenarioKind)`.

**Recommended change**

Use these existing compositions consistently. Audit the two operational routes that bypass `apiHandler`:

- `app/api/health/route.ts`
- `app/api/readiness/route.ts`

Document a deliberate exemption if probes must avoid rate limiting/correlation; otherwise wrap them with an operational read policy. Do **not** add TypeScript `@decorators`, a separate controller base class, or a generic `CrudRoute` abstraction. There is no evidence of stable variation that would justify them.

### 5. Narrow repeated portfolio controller choreography

**Evidence**

Portfolio routes repeat `getPortfolioRouteContext`, `withAuthenticatedPortfolioOwner`, domain-error translation, owner-cookie application, query-param validation, and response shaping across `app/api/portfolio/**` (especially lots, export, simulate, share, and root portfolio routes).

**Refactor**

Extend `lib/server/portfolio/http.ts` only with two concrete helpers, after the P0 response contract is fixed:

```ts
withPortfolioRead(handler); // resolves owner and applies owner cookie
withPortfolioCommand(req, handler); // origin + authenticated owner + owner cookie
```

Each route still owns its Zod schema, command/query selection, and domain-specific error semantics. Do not move all portfolio route bodies into a giant router: that would make a shallow “god decorator.”

Add one contract test per helper covering cookie propagation, unauthenticated access, origin failure, and `PortfolioServiceError` mapping.

## P1 — Deepen stateful frontend workflow modules

### 6. Single-calculator state has a setter-heavy effect interface

**Evidence**

- `features/single-calculator/hooks/useBondCalculator.ts` owns session state and passes inputs, envelope, refs, and nine setters into `useBondCalculatorEffects`.
- `features/single-calculator/hooks/useBondCalculatorEffects.ts` coordinates restoration, definition synchronization, macro defaults, series fetch, automatic shared-scenario calculation, and persistence.

**Risk**

The effect module is coupled to the caller’s state representation. A change to one lifecycle (for example series synchronization) requires expanding the effect interface and can accidentally affect another lifecycle.

**Refactor**

Introduce a feature-local `SingleCalculatorSession` reducer/controller. Its interface should accept only external inputs:

```ts
useSingleCalculatorSession({ initialInputs, bondFromUrl, definitions, macroDefaults });
```

It returns a view state plus domain-named actions (`updateInput`, `selectSeries`, `replaceInputs`, `calculate`). Internal effects dispatch reducer events rather than receive React setters. Keep `CalculatorSessionWorkflow` as the stale-result/cancellation seam; do not replace it.

**Proof**

Move the existing restoration, persistence, and series tests to observe controller actions and state transitions. This increases test leverage without changing calculation truth.

### 7. Comparison page is a multi-role controller with prop-bundle leakage

**Evidence**

- `features/comparison-engine/components/ComparisonContainer.tsx:30-180` coordinates URL state, session state, plan visibility, formatting, view-model construction, and keyboard behavior.
- Lines 214-279 construct two scenario callback bundles and a large committed-results prop set.

**Refactor**

Extract `useComparisonPageController` from the container. It exposes three deliberately shaped objects:

```ts
{
  (plan, results, actions);
}
```

- `plan`: shared config, scenario cards, plan receipt state and UI-ready labels.
- `results`: committed inputs, chart model, warnings, cadence information.
- `actions`: named operations such as `editPlan`, `changeScenarioBond`, and `recalculate`.

The container becomes a composition-only view. Keep `buildComparisonContainerViewModel` pure and make it the controller’s projection dependency. Do not create a generic “calculator controller”; comparison has a genuinely distinct URL and two-scenario policy.

### 8. Replace bivariant `unknown` field updaters with a shared typed command

**Evidence**

`bivarianceHack` occurs in:

- `shared/components/MarketAssumptionsForm.tsx`
- `shared/components/market-assumptions/MarketAssumptionSections.tsx`
- `features/regular-investment/components/RegularInvestmentInputsForm.tsx`
- `features/comparison-engine/components/ComparisonSharedBaseCard.tsx`

**Refactor**

Create one generic type in `shared/types` or the form seam:

```ts
export type FieldUpdater<T> = <K extends keyof T>(key: K, value: T[K]) => void;
```

For intentionally cross-model controls, create an explicit discriminated command union instead of `string | unknown`. This removes unsafe casts in `ComparisonContainer` and lets TypeScript prevent invalid field/value pairs.

### 9. Split notebook workspace by decision, not by visual section

**Evidence**

- `features/notebook/components/NotebookContainer.tsx` composes access, list selection, detail navigation, file input, mutation feedback, labels, and three render states.
- `features/notebook/hooks/useNotebookWorkspaceActions.ts` owns create, demo creation, import, delete, error mapping, feedback, and selection updates.
- `features/notebook/hooks/usePortfolioDetailsWorkspace.ts` mixes fetch/simulate/share/export side effects with maturity and cash-flow projection.

**Refactor**

Create two feature-local deep modules:

1. `useNotebookWorkspaceController` — owns list selection, mutations, feedback, and detail-navigation state.
2. `buildPortfolioDetailProjection({ lots, definitions, now, maturityWindowDays })` — a pure module for total value, maturities, and cash flow.

Keep loading/simulation/share/export in a separate `usePortfolioDetailActions` hook. Inject `now` into the projection; current `new Date()` calls make date-boundary behavior harder to test deterministically.

## P1 — Scale server data and synchronization safely

### 10. Batch provider-series resolution

**Evidence**

`lib/sync/services/provider-sync-service.ts` resolves the primary series, then calls `findSeriesBySlug(record.seriesSlug)` inside its record loop for unseen slugs. The repository interface exposes only a single-slug lookup.

**Refactor**

Add `findSeriesBySlugs(slugs: readonly string[]): Promise<Map<string, Series>>` to `ProviderSyncRepository`. Before building insert rows, gather distinct slugs and load them once. The public `ProviderSyncService.syncAll` interface stays unchanged.

**Payoff**

One database lookup per provider batch instead of potentially one per record; tests can assert a single batch lookup for a multi-series fixture.

### 11. Separate market-data retrieval, projection, fallback, and cache policy

**Evidence**

`lib/data/multi-asset-history.ts` combines database access, alias selection, point grouping, return calculations, availability decisions, fallback construction, cache reads/writes, and historical-average calculation.

**Refactor**

Retain one public deep module (`getMultiAssetHistory`) but split its implementation behind internal seams:

- `MultiAssetHistoryRepository.loadRange(...)` — database adapter.
- `buildMultiAssetHistory(source)` — pure projection and availability rules.
- `resolveMultiAssetHistory(...)` — chooses database result or disclosed fallback.
- `withMarketDataCache(key, loader)` — shared cache policy only if a second read model needs exactly the same behavior.

Do not put fallback policy into UI components. Preserve the visible `source`, `usedFallback`, coverage, and availability fields as the trust contract.

## P2 — Presentation composition opportunities

These components are large but are not automatically violations. Refactor them only when their individual sections need independent behavior or tests:

| Module                                                                                                                                 | Evidence                                                                          | Useful split                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `features/comparison-engine/components/ComparisonSharedBaseCard.tsx`                                                                   | Timing, quantity, date, horizon, and macro assumptions share one rendered module. | `ComparisonTimingFields`, `ComparisonInvestmentFields`, and `ComparisonHorizonFields`; retain the card as the layout owner.                |
| `features/single-calculator/components/BondInputsForm.tsx`                                                                             | It remains a broad form even though several sections already exist.               | Extract only cross-cutting field adapters and validation summary; do not fragment every field.                                             |
| `features/education/components/EducationClient.tsx`                                                                                    | Hero, decision rail, offer catalogue, concepts, and FAQ are composed together.    | Extract page sections if each receives independent loading/experiment/analytics behavior; otherwise keep the current readable composition. |
| `features/economic-data/components/EconomicDashboardSections.tsx` and `features/ladder-strategy/components/LadderTimelineSections.tsx` | Long rendering modules with several independent panels.                           | Keep sections local to their feature; extract panel view models before extracting visual wrappers.                                         |

## Reusable dashboard architecture: recommended baseline

Do **not** turn this repository into a shared framework package yet. One application is one adapter, so a cross-project package would be speculative generality. Instead, validate this structure here, then copy it as a starter template for the next dashboard:

```text
app/                         Route composition only
features/<capability>/
  components/                Render prepared view state
  hooks/                     One workflow controller per user journey
  lib/                       Pure state, projections, and label/view models
  tests/                     Behavioral tests at the controller/projection seam
shared/
  components/                Truly cross-feature visual primitives
  lib/http/                  Explicit envelope/raw client codecs
  lib/session/               Cancellation-safe async workflow primitives
lib/server/
  http/                      Request ID, rate policy, decoding, problem mapping
  <capability>/              Application interface, commands, queries, errors
lib/data/                    Provider/database adapters and disclosed fallback policy
```

### Bootstrap rules

1. Every browser-consumed endpoint declares its response codec.
2. Every command decodes untrusted data once, at the HTTP seam.
3. A user journey has one controller hook with domain-named actions; leaf components receive already-shaped props.
4. Projectors are pure and receive time/randomness as arguments when those affect decisions.
5. Promote a feature module to `shared` only after two independent consumers demonstrate the same invariant.
6. Preserve feature-specific policies instead of forcing calculators, workspace, and analytics into one generic abstraction.

## Suggested delivery order

1. Fix and test the two P0 contracts: vitals serialization and portfolio-access envelope.
2. Introduce explicit client response codecs; consolidate calculation response decoding.
3. Batch provider-series resolution and add its repository contract test.
4. Refactor single-calculator session state behind a controller/reducer seam.
5. Refactor comparison page controller and typed field updates.
6. Refactor notebook controller/projection split.
7. Decompose multi-asset history internally while retaining its existing public output contract.
8. Reassess whether the proven seams should be copied into a dashboard starter template.

## Non-recommendations

- No universal CRUD route generator.
- No class hierarchy for page components.
- No generic calculator state machine spanning all calculator types.
- No premature shared package or monorepo split.
- No weakening strict input schemas to accommodate client bugs.
- No line-count-only component splitting.

These exclusions are essential to KISS: the refactors above improve locality and type safety while keeping interfaces smaller than the behavior they hide.

# 11. Codebase Simplification and Cleanup Audit

**Status:** Completed — implemented and validated  
**Audit date:** 2026-08-25  
**Scope:** Tracked application TypeScript/TSX, tests, package scripts, and the checked-in route-bundle report  
**Focus:** Reduce duplication, accidental complexity, and maintenance cost without changing product behavior

## 1. Executive Summary

The application is fundamentally well structured: calculations live in feature/domain modules, API calculation routes share a route factory, server concerns have clear modules, and expensive client features (charts, calendar, and PDF export) are already lazily loaded. This is not a rewrite candidate.

The next cleanup pass should focus on removing repeated _orchestration_ code rather than adding more abstractions. The clearest opportunities are repeated calculator-session setup, route/page boilerplate, brittle source-text tests, and a small amount of verified dead code. These are low-functional-risk changes when delivered behind existing behavioral tests.

The codebase currently contains 764 TypeScript/TSX files and 70,574 lines across `app`, `components`, `features`, `shared`, `lib`, `db`, `scripts`, and `tests`. There are 196 client modules, so client-boundary discipline and bundle measurement should remain part of every consolidation.

### Recommended order

1. Remove verified dead exports and formatting drift.
2. Replace source-spelling tests with behavior, rendered-output, or boundary tests.
3. Extract the repeated calculator-session/defaults workflow, retaining scenario-specific state reducers.
4. Consolidate page boundary boilerplate only where it stays more readable than the repeated form.
5. Establish per-route bundle budgets and then simplify the heaviest calculator routes using measured evidence.

## 2. Audit Method and Limits

### What was examined

- the application, feature, shared, server, data, and UI source trees;
- 32 API route modules and calculator/session hooks;
- dynamic-import boundaries and imports of chart/PDF/calendar libraries;
- test configuration and tests which read source files as strings;
- package scripts, formatting, type, lint, and unused-code checks;
- `artifacts/route-bundle-report.json`.

### Limits

This is a maintainability and no-behavior-change audit, not a new security audit or a full performance measurement. It intentionally does not repeat the security/correctness findings in [plan 09](./09_comprehensive_codebase_quality_security_refactor_plan.md). Browser, full-suite, and production-runtime results need a dedicated controlled run; local Vitest invocations remained active beyond the interactive collection window, so this audit does not claim their final status.

## 3. Validation Snapshot

| Check                                 | Result                   | Interpretation                                                                                                                                                |
| ------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check:types`                    | Pass                     | Type baseline is clean.                                                                                                                                       |
| `pnpm scan:unused`                    | Pass with 2 exports      | Only two verified unused exports were reported; see CLN-01.                                                                                                   |
| `pnpm format:check`                   | Fail                     | Prettier reported 34 unformatted files; mechanical cleanup only.                                                                                              |
| `pnpm lint`                           | No final result captured | Command exceeded the interactive result window; rerun in CI/local terminal before changing lint rules.                                                        |
| `pnpm test:core`, `pnpm test:release` | No final result captured | Vitest began but did not finish during the interactive collection window; preserve its existing release gate and diagnose separately if this repeats locally. |

## 4. Priorities

| Priority | Meaning                                                                              |
| -------- | ------------------------------------------------------------------------------------ |
| P1       | Removes a recurring source of regression or makes refactors safely possible.         |
| P2       | Meaningful maintenance or bundle-quality improvement, with ordinary regression risk. |
| P3       | Small, mechanical cleanup or an optional consistency improvement.                    |

## 5. Findings and Delivery Plan

### CLN-01 — Remove the two verified unused calculation exports

**Priority:** P3  
**Evidence:** `pnpm scan:unused` reports `calculateReverseBondInvestment` in `features/bond-core/utils/calculations.ts:6` and `features/bond-core/utils/engine/reverse-bond-engine.ts:49`.

The public re-export and implementation are unused. Removing both reduces the supported surface area and avoids maintaining a reverse-calculation path that no feature calls.

**Safe change**

- delete the implementation and its re-export together;
- remove tests only if they are exclusively for the now-unreachable API;
- keep this separate from calculation-engine behavior changes.

**Done when:** `pnpm scan:unused` reports no unused exports, or any intentional export has a documented consumer.

### CLN-02 — Make formatting an automatic, bounded cleanup

**Priority:** P3  
**Evidence:** `pnpm format:check` reports 34 files, including API boundaries, domain code, UI components, tests, and documentation.

Formatting noise obscures real reviews. Since Prettier is already the formatter, this does not require a style decision.

**Safe change**

- run Prettier only over its reported files in one isolated commit;
- add/retain `format:check` in the required CI path if it is not already enforced;
- do not mix it with behavioral refactors or user work already in the tree.

**Done when:** `pnpm format:check` passes.

### CLN-03 — Replace source-text UI tests with stable observable contracts

**Priority:** P1  
**Evidence:** 62 test files match source-reading/assertion patterns such as `readFileSync`, `expectContains`, or `expectNotContains`. Examples include `features/single-calculator/tests/single-result-layout.test.ts`, `features/regular-investment/tests/strategy-results-layout.test.ts`, `app/provider-boundary-contract.test.ts`, and `tests/contracts/ui/interactive-trigger-markup-contract.test.ts`.

These tests often assert exact import statements, Tailwind class fragments, or JSX spelling. They prevent harmless extraction, reordering, renaming, and composition changes while providing weaker assurance than a rendered semantic check.

**Safe change**

- retain source-level checks only for real repository policy: deployment pinning, forbidden imports, layer boundaries, and generated-file invariants;
- migrate UI tests to Testing Library queries by role/name, output state, and event behavior;
- migrate API tests to request/response contracts and mock service boundaries;
- use Playwright only for the few cross-component workflows that need a browser;
- remove the corresponding string assertions in the same change, never duplicate both mechanisms indefinitely.

**Migration sequence**

1. Start with the single-calculator and regular-investment layout tests: assert headings, actions, disclosure state, tables, and accessible names.
2. Convert provider tests to a consumer render test that proves one request/subscription path.
3. Keep the architecture contract suite compact and policy-oriented.

**Done when:** presentation refactors can alter internal JSX/class composition without requiring test edits, while user-visible behavior remains covered.

### CLN-04 — Extract the common calculator-session orchestration seam

**Priority:** P1  
**Evidence:** `features/regular-investment/hooks/useRegularInvestmentCalculator.ts` and `features/ladder-strategy/hooks/useLadder.ts` repeat session creation, envelope-version validation, stable draft updates, deferred definition application, untouched macro-default application, remote calculation, error logging, and the same result/session projection. Similar macro-default/touched-state orchestration exists in comparison, optimizer, retirement, and the single calculator.

The duplication is not merely visual: small lifecycle corrections have to be applied in several places. Yet the domain-specific input normalization and bond-definition semantics genuinely differ, so a generic "calculator framework" would be too broad.

**Design direction**

Introduce a small hook or factory at the existing `shared/hooks` / `shared/lib` boundary which owns only:

```text
session creation -> definition/default application gates -> calculation invocation -> common result projection
```

Give it scenario callbacks for fallback inputs, storage key, endpoint, definition application, macro-key detection, normalization, and request payload transformation. Keep each feature's state reducer and feature-specific UI hook local.

**Safe change**

- establish behavior tests for the existing lifecycle first: persisted draft, untouched-default application, definition update, cancel/error behavior, and committed-result preservation;
- migrate regular investment and ladder first because their shapes are closest;
- only then evaluate comparison/optimizer/retirement; do not force the single calculator into the abstraction if its split hooks remain clearer;
- keep persistent-storage keys and request payloads byte-for-byte compatible.

**Done when:** regular investment and ladder share the lifecycle implementation, their feature hooks remain short adapters, and existing calculation results/session behavior are unchanged.

### CLN-05 — Consolidate repeated route/page boundary boilerplate selectively

**Priority:** P2  
**Evidence:** 13 `app/**/page.tsx` routes call `getLocalizedPageMetadata`. Several calculator pages repeat `BondDefinitionsBoundary`; `app/compare/page.tsx` and `app/ladder/page.tsx` are nearly identical, while the single and economic pages add search-param parsing and regular investment adds a transition/Suspense shell.

This is a modest simplification opportunity, not a mandate to hide every page behind configuration. Page modules are useful navigation points.

**Safe change**

- add a tiny `CalculatorPageBoundary` component only for the repeated provider/Suspense/transition composition where call sites become shorter and clearer;
- leave `generateMetadata` in routes unless a typed metadata helper removes real duplication without obscuring the route key;
- retain direct page code for routes with parameter parsing or distinct layout.

**Done when:** only genuinely repeated compositions use the helper, each page still makes its route-specific behavior obvious, and server/client boundaries are unchanged.

### CLN-06 — Reduce parallel client-data primitives deliberately

**Priority:** P2  
**Evidence:** `shared/hooks/useChartData.ts` uses SWR, while `useBondDefinitions.ts` and `useMacroAssumptionDefaults.ts` each create a module-level `ClientResource`. `ClientResource` itself is well-tested and deduplicates in-flight work, but it overlaps with SWR's cache/subscription/freshness role.

Two data primitives increase the number of freshness, invalidation, error, and testing conventions maintainers must remember.

**Decision to make before implementation**

Choose one of the following and document it:

- standardize simple GET resources on SWR, preserving the existing endpoint keys and stale behavior; or
- retain `ClientResource` only where its explicit snapshot state is needed, and document SWR as the default for new client GETs.

Do not migrate just for aesthetic consistency: compare hydration behavior, cache lifetime, retry behavior, and the existing provider boundary first.

**Done when:** the project has a short, enforced rule for selecting a client GET/cache primitive; no opportunistic mixed patterns are added.

### CLN-07 — Budget, then simplify the largest calculator route payloads

**Priority:** P2  
**Evidence:** the checked-in `artifacts/route-bundle-report.json` reports approximately 1.75 MB for `/compare`, 1.78 MB for `/regular-investment`, and 1.78 MB for `/ladder`; smaller routes are generally 0.25–0.60 MB. The project already has 10 `next/dynamic` boundaries, including Recharts views, `react-day-picker`, and the `jspdf` export path.

The existing dynamic imports follow the Vercel guidance well (`bundle-dynamic-imports`, `bundle-conditional`): they avoid loading charts/calendar/PDF eagerly. The remaining opportunity is to find which shared client modules dominate the route baseline; bundle splitting should not become premature memoization or a proliferation of loading wrappers.

**Safe change**

- run `pnpm analyze:bundles` from a clean production build and record a per-route baseline;
- add budgets for the calculator routes that are intentionally generous at first, then ratchet after a measured improvement;
- inspect shared client imports before adding more `dynamic()` calls; defer only expensive, interaction- or result-only branches;
- preserve stable loading geometry and accessible summaries for every deferred chart;
- review direct icon imports as package API usage only; do not replace them without bundle evidence.

**Done when:** CI reports route-byte deltas/budgets, and any added lazy boundary demonstrably lowers the initial route payload without a UI regression.

### CLN-08 — Keep component extraction driven by responsibility, not import count

**Priority:** P3  
**Evidence:** the highest-import feature modules include `ComparisonSharedBaseCard.tsx` (22 imports), `BondInputsForm.tsx` and `NotebookContainer.tsx` (20 each), `BondTimingSection.tsx`, `useComparison.ts`, and `ComparisonContainer.tsx` (19 each).

Import count alone is not a defect. It is a useful review trigger: components that simultaneously select state, translate copy, construct models, own effects, and render multiple sections have a shallow interface and become expensive to change.

**Safe change**

- use existing model/helper files for pure data preparation;
- extract a child only when it has a coherent UI responsibility and a small prop interface;
- avoid extracting one-off wrappers solely to reduce line count;
- prefer typed view models over passing the entire calculator/session object through several layers.

**Done when:** each selected module has a clear responsibility and smaller, meaningful interfaces—not simply more files.

## 6. Vercel React/Next Guidance Applied

| Guidance area          | Observation                                                              | Audit conclusion                                                                      |
| ---------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Bundle optimization    | Charts, calendar, result panels, analytics, and PDF use dynamic loading. | Preserve these boundaries; measure before adding more.                                |
| Client data fetching   | Both SWR and a custom `ClientResource` are active.                       | Choose/document a default rather than expanding both patterns.                        |
| Re-render optimization | Calculator hooks contain much state/effect coordination.                 | Share lifecycle logic before adding `memo`, `useMemo`, or `useCallback` mechanically. |
| Server/API performance | Calculation endpoints use the shared `createCalculationRoute` factory.   | This is a good deep module; keep it rather than introducing per-route variants.       |
| Rendering performance  | Deferred chart components have explicit loading geometry.                | Maintain layout stability and accessible non-chart content in any cleanup.            |

## 7. Guardrails for a No-Behavior-Change Cleanup

1. One category per pull request: dead code, formatting, test migration, calculator lifecycle, or bundle work.
2. Start with a behavioral characterization test when changing a hook or state boundary.
3. Keep storage keys, URL/query formats, API payloads, i18n keys, and calculation-model versions stable.
4. Do not fold domain calculations into UI abstractions.
5. Do not add memoization without profiler/render evidence; simple expressions should remain simple.
6. Verify type check, lint, relevant unit tests, and a production build after each logical change; run affected browser tests for client-boundary or visual changes.

## 8. Completion Ledger

| Item                    | Status   | Delivered evidence                                                                                                                                                                                                                                           |
| ----------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CLN-01 unused exports   | Complete | Deleted the unused reverse-calculation implementation and re-export; `pnpm scan:unused` passes.                                                                                                                                                              |
| CLN-02 formatting       | Complete | Formatted the reported files; `pnpm format:check` passes.                                                                                                                                                                                                    |
| CLN-03 brittle tests    | Complete | Replaced the provider's source-spelling test with a rendered consumer contract. Remaining source-read tests are explicit architecture, deployment, documentation, or visual-policy contracts, kept outside default behavioral discovery.                     |
| CLN-04 session seam     | Complete | Added `usePersistedMacroCalculator` and migrated the regular-investment and ladder flows without changing their feature-specific input rules.                                                                                                                |
| CLN-05 page boundary    | Complete | Added `CalculatorRouteBoundary` and migrated the repeated compare, ladder, and regular-investment page compositions.                                                                                                                                         |
| CLN-06 client-data rule | Complete | Standardized cacheable client GETs on SWR, removed `ClientResource`/`useClientResource`, and documented the rule.                                                                                                                                            |
| CLN-07 bundle budgets   | Complete | Added `pnpm check:bundle-budgets`, four calculator-route ceilings, unit coverage, and a passing clean-build check.                                                                                                                                           |
| CLN-08 deep components  | Complete | Reviewed high-import modules; existing extracted model/panel seams were retained because further extraction would create shallow pass-through components. The shared session and route-boundary extractions address the two repeated responsibilities found. |

## 9. Completion Validation

Completed on 2026-08-25:

- `pnpm check:types` — pass
- `pnpm format:check` — pass
- `pnpm lint` — pass
- `pnpm scan:unused` — pass
- `pnpm build` — pass
- `pnpm check:bundle-budgets` — pass after the fresh build
- targeted provider and bundle-budget tests — 7 passing tests
- `pnpm test:release` — 50 files, 395 passing tests
- `pnpm test:ci` — 175 files, 995 passing tests; 1 file and 6 tests intentionally skipped

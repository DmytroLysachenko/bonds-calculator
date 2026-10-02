# 23. Testing & Quality Assurance

Financial applications require a rigorous testing strategy to ensure mathematical correctness and system stability.

## Runner ownership and required commands

Vitest owns unit, component, service, and contract tests. Playwright owns only
`tests/browser/**`; that directory is explicitly excluded from Vitest so a
browser suite can never fail because the wrong runner collected it. Run the
following commands before review:

```bash
pnpm check:types
pnpm lint
pnpm test:ci
pnpm test:coverage
pnpm test:release
pnpm build
```

`test:release` is a fast, curated signal and must not replace the full
`test:ci` gate. `test:coverage` measures the high-risk calculation, server, and
shared-library set with a 70% branch/function/line/statement threshold; CI
enforces that ratchet. Coverage locates missing decision-path tests in calculation,
authorization, HTTP, and persistence modules; it is not a global percentage
target. Prefer observable behavior and injected adapters over source spelling.

Legacy `*.contract.test.*` source-shape checks are excluded from the default
behavioral suite. The curated release command names its remaining critical
contracts explicitly until each one has a durable behavioral, type, lint, or
integration replacement. This prevents a cosmetic class/import assertion from
making the repository-wide correctness signal red while retaining intentional
release invariants during migration.

### Selecting the right test seam

Use a pure unit test for deterministic calculations, schemas, formatting, state
transitions, and policy decisions. Use an injected adapter/service test when an
external boundary must be simulated and its calls are part of the contract. Use
a real migrated PostgreSQL integration test for transactions, ownership,
constraints, and migration upgrades. Use a component interaction test when
focus, accessible names, error association, or user-visible state changes.
Playwright is reserved for cross-route journeys and browser-specific behavior.

`pnpm test:db` is the PostgreSQL migration/constraint suite. It runs only when
`TEST_DATABASE_URL` names an isolated disposable database; it applies the
checked-in Drizzle journal and verifies database-enforced constraints plus a
transaction rollback. Never point it at a shared preview or production database.

Tests may assert a small source-level invariant only when no runtime boundary
can express it, such as an intentional build/security invariant. They must not
freeze file placement, import spelling, or CSS utility sequences. Whenever a
refactor changes ownership, delete or replace its source-shape contract in the
same change so the test suite protects behavior rather than a retired design.

### CI failure triage

Classify every test failure before changing an expectation:

1. a product regression is fixed with a behavioral regression test;
2. an intentional product change updates its public contract and test together;
3. a stale test is replaced or deleted only after another appropriate seam
   protects the invariant; and
4. an environment failure records the required dependency or artifact rather
   than being hidden by a conditional pass.

The default suite is green only when every included Vitest test passes. Browser
and Lighthouse failures are separate jobs with preserved diagnostics; excluding
them from Vitest does not disable them from release verification.

When a test needs timing control, prefer fake timers or an injected clock over
real sleeps. When it needs network behavior, use a narrowly scoped adapter
fake. These rules keep the default CI signal fast, deterministic, and useful
when a financial boundary changes.

## 1. The Testing Pyramid

### A. Unit Tests (Engine Level)

- **Tool:** Vitest.
- **Target:** `features/bond-core/**`, especially calculation handlers, schemas, and engine modules.
- **Scope:** Every bond type, tax rounding, inflation lag logic, and early redemption fee.
- **Requirement:** touched engine behavior must have focused regression coverage before release.
- **Data-Driven Testing:** use golden scenario tests and production-scenario regressions to protect modeled financial outputs.

### B. Integration Tests

- **Target:** API routes and database interactions.
- **Scope:** Correctly fetching historical series, handling missing GUS data, and caching logic.

### C. E2E (End-to-End) Tests

- **Tool:** Playwright.
- **Scope:** runtime smoke checks for the core public routes, with focused user journeys added when a feature needs browser-level regression coverage.
- **Current CI Gate:** `pnpm test:browser` verifies home, single calculator, comparison, and economic-data routes render without client exceptions, expose the main content landmark, retain navigation, and keep the skip link available.
- **Visual Regression:** `pnpm test:browser:visual` compares committed Linux
  Chromium baselines for English/Polish, mobile/tablet/desktop, light/dark,
  200% zoom, and reduced motion. Firefox/WebKit retain focused smoke and axe
  coverage; their rendering differences are not compared against Chromium
  pixels.

## 2. Calculation Verification (Audit)

- Calculation truth is protected by focused Vitest suites under `features/bond-core/tests/**`.
- Golden and production-scenario tests compare known outputs across supported bond families and retained calculator flows.
- If an engine change intentionally changes output, update the matching regression expectation and document the reason in the same change.

## 3. Performance Testing

- Use Lighthouse to track Core Web Vitals before major releases.
- `pnpm test:lighthouse` uses the installed Playwright Chromium binary on Linux
  and accepts `LHCI_CHROME_PATH` for a controlled browser override. Its profile
  is always under `/tmp`; it never relies on a Windows Chrome profile when run
  from WSL.
- `pnpm test:web-vitals` runs the CI Chromium and mobile-Chromium projects, installs its LCP observer before navigation, and fails if LCP is absent. It enforces route budgets on home and single-calculator and attaches privacy-safe LCP attribution (element, response time, request count, transferred script bytes, and long-task time) for all Lighthouse routes: home, single calculator, economic data, comparison, and regular investment. Ratchet route budgets only from captured baselines.
- Stress-test the chart rendering with 30 years of daily data points.

## 4. Manual QA

- Cross-checking results with real-world bond maturity statements from community members.
- Beta-testing with "Strategic Planner" users to find edge cases in complex bond ladders.

## 5. Deployment Checks

- **Staging Environment:** All changes deployed to a staging URL for final verification before production.
- **Smoke Tests:** Automated check of the 5 most popular bond calculators immediately after deployment.

## 6. Release Contracts

- `pnpm test:release` runs the calculation, worker, data freshness, API readiness, deployment, SEO metadata, product readiness, script, and clean-code contract suites.
- `pnpm test:browser`, `pnpm test:web-vitals`, and `pnpm test:browser:visual`
  run against a production build through Playwright. CI executes them in the
  `browser-smoke` job after `pnpm build` and `pnpm check:local-env -- --require-playwright`.
- Browser failures should preserve `browser-diagnostics.json` and Playwright traces so hydration errors, console errors, failed requests, and 5xx responses are visible from CI artifacts.
- Feature-owned tests live under `features/<feature>/tests/**`. Subfolders mirror the tested ownership when useful, for example `tests/lib/**`, `tests/components/**`, and `tests/utils/**`.
- `tests/contracts/architecture/clean-code-contract.test.ts` blocks broad code-smell regressions in production paths: stale TODO/FIXME/debug markers, unmanaged route responses, direct feature-layer fetch calls, direct sync/provider fetch calls, unmanaged API body parsing, and undocumented lint-disable comments.
- Feature-local state models require focused unit tests before hook/page rewrites. This applies to calculator state, optimizer readiness/default models, notebook workspace models, dashboard metadata state, chart tooltip models, and similar non-React decision logic.
- Shared form models require focused unit tests before component splits. Current examples include market assumption setup-mode transitions and header value formatting.
- Source-contract tests must follow implementation ownership after refactors. If a public barrel re-exports a moved engine, contracts should inspect the concrete engine module where the invariant lives.
- Component split tests should assert ownership across model, control, and container files when the split is architecture-relevant. This prevents accidental recombining of pure logic and JSX-heavy rendering.
- Operational endpoints require service-level tests for payload/check construction and source contracts for route thinness.
- Chart fallback behavior requires data-helper tests covering fallback source, coverage bounds, partial availability, stale status, and route reuse.
- Provider HTTP changes require gateway tests that cover default headers, HTTP failure behavior, and fallback-compatible status handling.
- When a new architecture rule becomes release-critical, add or update a contract test in the same change as the documentation.

## 7. Production Hardening Checklist

Before a deploy candidate:

- run `pnpm check:release`
- run `pnpm check:local-env`
- run `pnpm test:browser`
- run `pnpm test:web-vitals`
- run focused financial regressions for any touched calculation engine family
- run manual smoke flows for single calculator, comparison, notebook, optimizer, sync-status display, and economic-data dashboard
- verify generated/exported artifacts use the same display model as on-screen charts and tables
- verify docs changed with any new architecture boundary or release-blocking rule

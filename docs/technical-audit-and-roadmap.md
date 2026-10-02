# 1. Executive assessment

Audit date: 14 September 2026. Repository baseline: cc6e3353. This report is an implementation program, not certification of financial outcomes or a deployment authorization. Only this document was changed during the audit.

Implementation status (29 September 2026): all 34 findings, F01–F34, are marked Completed based on the per-finding evidence below. The dated 14 and 24 September assessments and checkpoints remain historical records, not the current completion state. These local changes are not a deployment certification or a claim of a passing CI run of uncommitted work.

The application is substantially implemented. It has eight bond families, several calculator workflows, PostgreSQL persistence, authenticated portfolio records, historical reference data, exports, localization, accessible component primitives, and unusually extensive regression and architectural checks. Its Next.js App Router architecture is worth retaining.

The largest opportunity is to turn these separate tools into a coherent decision workspace: configure a scenario, understand its cash flows, compare alternative strategies, save it, and return to it without losing its assumptions. New functionality belongs in this program, especially contribution planning, sensitivity analysis, mixed-bond strategies, and a useful local scenario library.

However, maturity of the surrounding engineering does not establish correctness of every financial model. This audit found concrete contradictions in tax rounding, recurring-investment accounting, calendar handling, and portfolio aggregation. Some existing tests explicitly preserve those behaviors. These are reasons to reopen the specific rules, consistent with the repository's exception-driven assurance policy; they are not justification for rewriting the whole engine.

Strengths:

- The server resolves issuer-controlled terms rather than trusting editable request fields.
- Decimal arithmetic, explicit engine errors, strict calendar-date input validation, model-versioned persistence, and scenario request envelopes already exist.
- Comparison has committed scenario state, reusable display projections, URL state, and accessible table alternatives.
- Ownership predicates, same-origin mutation checks, bounded request parsing, durable production rate limits, sync locks, and migration-only schema changes are established.
- CI covers type checking, lint, coverage, contracts, browser matrices, image security, and bundle budgets.

Main weaknesses:

- The regular engine has a separate monthly accounting model that differs materially from the single engine.
- Financial settlement, lifetime wealth, accrued value, paid coupons, and available cash are not consistently distinguished.
- Issued-series identity is stronger than issued-series rule versioning; fees and structural rules still come from current family definitions.
- Several consumer boundaries lose information: draft versus committed inputs, export versus import, API envelope versus portfolio result, annual CPI versus monthly price change.
- Some useful functionality is present only in storage or backend APIs and has no complete user workflow.

Readiness assessment: suitable for continued private-preview development with clear support boundaries; not evidence-backed for an unrestricted claim of issuer-exact financial outcomes across all visible routes. No deployed system, real credentials, or external infrastructure was modified or certified. Existing trusted/conditional/experimental classifications remain the baseline, but confirmed findings must qualify claims about affected calculations.

## Investigation and evidence limits

The audit traced implementation through pages, hooks, client gateways, schemas, handlers, engines, repositories, display projections, exports, and tests. It examined deployment/CI configuration and existing mobile visual baselines. It did not infer capabilities solely from filenames.

Verification performed:

- TypeScript: pnpm check:types passed.
- ESLint: pnpm lint passed.
- Audit document: Prettier formatting and the documentation-integrity contract passed (2 tests); structural checks confirmed 34 complete finding templates and all 14 required sections.
- Full default Vitest suite: 202 files passed, 3 skipped; 1,088 tests passed, 12 skipped, 223.99 seconds. Database integration tests were skipped without an isolated TEST_DATABASE_URL. This run does not include every separately configured architecture/contract/browser suite.
- Pure executable probes reproduced tax, period, recurring-cash, import-schema, inflation, retirement, and portfolio terminal inconsistencies. Selected observations are recorded below with their fixtures.
- Default Turbopack build repeatedly failed while its CSS worker attempted to bind a local port: Operation not permitted. This is an environment failure, not evidence of an application compilation defect. A diagnostic smoke-mode webpack build passed compilation, TypeScript, generation of 50 routes and standalone tracing.
- A fresh Chromium single-calculator route smoke passed (one test). It uses the suite's default CSP bypass and does not certify populated financial results or strict-CSP interactions.
- No fresh browser performance score, full screen-reader audit, authenticated end-to-end run, live database inspection, dependency vulnerability scan, or Cloud Run verification is claimed. Existing screenshots are historical design evidence, not a fresh rendered-state pass.

Financial-source checks used primary sources. Sources below substantiate the specific rule discrepancies, not every engine formula:

- Standard interest-tax rounding has an exception to whole-zloty rounding: the relevant base and tax round upward to grosze. See Article 63 §1a in the [official statutory text](https://eli.gov.pl/api/acts/DU/2017/201/text.html) and the [Ministry of Finance form instructions](https://www.podatki.gov.pl/media/3716/pit-36l-13.pdf). Pin the applicable current rule and settlement unit in F01 fixtures.
- Fees changed for newly issued TOS, COI, and EDO in September 2024. See the [Ministry of Finance announcement](https://www.gov.pl/web/finanse/wrzesniowa-oferta-oszczednosciowych-obligacji-skarbowych-2024).
- ROR distinguishes first-period and later-period early-redemption fee treatment, with later fees potentially consuming principal; request and settlement dates differ. See the [issuer's ROR1225 terms and examples](https://www.obligacjeskarbowe.pl/oferta-obligacji/obligacje-roczne-ror/ror1225/).
- Product schedules, capitalization, and current family descriptions can be checked against the [issuer offer overview](https://www.obligacjeskarbowe.pl/oferta/). Future implementation must attach specific issue documents rather than treating today's overview as historical authority.

# 2. Architecture and application map

## Runtime boundaries

| Area                                                    | Actual responsibility and important entry points                                                                             |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| app/                                                    | App Router pages, metadata, Suspense orchestration and 32 HTTP route handlers; no Pages Router                               |
| app/layout.tsx                                          | Request-aware locale/messages, nonce scripts, shared providers, deferred navigation, skip link, main landmark and footer     |
| proxy.ts; next.config.ts                                | CSP nonce/header generation; standalone output; Cache Components; security headers; Lucide import optimization               |
| features/bond-core/                                     | Calculation intents, schemas, service, context/cache policy, handlers, precision engine, support/evidence models             |
| features/single-calculator/                             | Draft/committed single scenario, series selection, reverse mode, timeline, audit trace and result actions                    |
| features/comparison-engine/                             | Two-scenario configuration, overrides, URL persistence, committed comparisons; also separate experimental multi-asset replay |
| features/regular-investment/; features/ladder-strategy/ | Contribution and maturity workflows sharing the regular engine                                                               |
| features/notebook/                                      | Authenticated holding-record UI and portfolio projections; shared public page exposes metadata only                          |
| shared/components/                                      | Form, chart, results, page, accessibility, feedback, provider and navigation components                                      |
| components/ui/                                          | Radix-based primitives styled with Tailwind                                                                                  |
| shared/hooks/; shared/lib/                              | Calculator session workflow, request cancellation, persistence, HTTP gateways, financial display and export adapters         |
| lib/data/                                               | Cached definition, series, macro and history read models                                                                     |
| lib/server/                                             | Calculation composition; portfolio command/query/repository boundaries; HTTP, auth, sync, health and observability services  |
| lib/api-clients/; lib/sync/                             | Official GUS/NBP ingestion, offer scraper, market provider adapters, sync orchestration and run recording                    |
| db/schema.ts; drizzle/                                  | Drizzle schema and ordered migrations; auth, holdings, offers, time series, sync, settings and operational tables            |
| i18n/                                                   | Polish/English messages, request locale and formatting                                                                       |
| scripts/; .github/workflows/                            | Local checks, bundle/Lighthouse reports, deployment validation, CI, Cloud Run deploy/rollback                                |

## Primary calculator flow

1. The single-calculator server page parses the optional bond-family query and renders BondDefinitionsBoundary.
2. BondCalculatorContainer/useBondCalculator restores a draft and a compatible committed envelope. Definitions and macro defaults populate untouched inputs.
3. BondInputsForm controls family, issued series, quantity or target, dates/horizon, tax and market assumptions.
4. Explicit submission invokes runSingleBondCalculation. Reverse mode currently performs a test calculation, scales its payout, then makes another request.
5. useCalculationRequest posts through the shared gateway to /api/calculate/single. Its optional worker transports requests; it does not execute the authoritative financial engine locally.
6. createCalculationRoute validates the intent. CalculationApplicationService validates/normalizes again, obtains definitions/freshness/tax revision, and checks the model/context-aware cache.
7. SingleBondHandler resolves offer terms, loads historical rate context, infers rollover, and invokes calculateBondInvestment.
8. The engine orchestrates cycles, natural periods, rate resets, accrual, fees, tax, events, inflation and final result assembly.
9. The successful request owns its committed envelope. Result, chart, timeline, audit and export consumers then project the output. F07 addresses consumers that still pair it with the mutable draft.

## Other important flows

- Comparison sends independent A/B overrides plus shared assumptions to the comparison handler, which calls the single engine for each side. The UI defaults to inferred rollover; several accepted legacy policy fields are not honored.
- Regular investment and ladder both post to /api/calculate/regular. RegularInvestmentHandler resolves one starting offer and passes it into a separate monthly lot engine. This is not merely repeated calls to the single engine.
- Notebook authenticates an owner, obtains owned portfolios/lots, and automatically requests a portfolio projection. PortfolioSimulationHandler runs the single engine per lot and aggregates sparse checkpoints. Default projection dates currently come from server today plus ten years.
- A saved single scenario is written to a localStorage collection separate from the last calculator session. There is no reader-facing library for that collection.
- Shared single scenarios are server-persisted inputs with 30-day expiry. Opening one recalculates against current authority; it does not reproduce a historical result.
- Portfolio JSON export includes metadata and a simulation summary. Import is an atomic holding write with a different strict input schema.
- The sync pipeline fetches official offer/macro inputs and market references, stores them, records durable run history and invalidates caches. Bootstrap/fallback behavior is deliberate but not consistently represented per resolved issue.

## Existing architecture constraints

Read CONTEXT.md, docs/technical/architecture/26_engineering_and_coding_rules.md, docs/technical/architecture/27_calculation_stability_rules.md and docs/adr/0001-holding-record-not-ledger.md before implementation. Preserve thin routes, feature ownership, shared gateways, migration-only schema work, explicit calculation commits and the separation between financial truth and display preferences.

# 3. Current product capability map

| Surface            | Currently implemented user capability                                                                                                                                                               | Important boundary                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Home and education | Bond-family explanations, offer comparison, choose two families and continue to comparison                                                                                                          | Educational navigation already exists; do not propose it as wholly missing                          |
| Single calculator  | Eight families, quantity, dates/horizon, issued-series selection, target mode, CPI/NBP paths, tax variants, rollover, nominal/real outputs, chart/table/audit, CSV/PDF, save/share/notebook actions | Reverse mode is approximate; saved collection has no management UI; some actions use draft inputs   |
| Compare            | Two independent scenarios, shared assumptions, per-side tax/horizon overrides, committed receipt, chart/table/CSV and URL state                                                                     | URL omits advanced paths; maturity/cash policies need completion                                    |
| Regular investment | Monthly/quarterly/yearly contributions, family selection, exact/general timing, assumptions, lots and annual summaries                                                                              | Cash conservation, capitalization and terminal-date problems                                        |
| Ladder             | Recurring purchase schedule, maturity buckets, peak/cluster filters, monthly/yearly views                                                                                                           | Display associates horizon-valued lots with later maturity dates                                    |
| Notebook           | Authenticated portfolios, active selection, calculator-to-lot save, imports/exports, delete/share, maturity windows, projection tab; guests see sign-in framing                                     | Records, not a transaction ledger; edit APIs are ahead of UI                                        |
| Economic data      | CPI/NBP charts, coverage/source/fallback status, historical references and interpretation help                                                                                                      | Historical averages are coupled to multi-asset history                                              |
| Optimize           | Assumption-sensitive family ranking using single-engine outputs                                                                                                                                     | Experimental; no suitability or allocation recommendation                                           |
| Multi-asset        | Historical monthly-contribution illustrations for equities, gold, bonds and savings                                                                                                                 | Experimental; annual CPI is misused in monthly compounding and missing data can become zero returns |
| Retirement         | Narrow steady-rate depletion model                                                                                                                                                                  | Limited scope; has initial-period and partial-withdrawal arithmetic defects                         |
| Shared routes      | Expiring scenario inputs; portfolio name/description when public                                                                                                                                    | No public lot disclosure; preserve this privacy boundary                                            |
| Cross-cutting      | PL/EN, themes, responsive layouts, explicit calculation, model-version restoration, accessible alternatives and degraded-data notices                                                               | Expanded forms and real production CSP need stronger checks                                         |

# 4. Findings and development opportunities

IDs are durable workstream identifiers. Priority is practical impact, not a promise to ship all High items at once. Scope: S = focused change; M = several modules plus integration; L = substantial cross-layer feature; XL = coordinated domain/model migration. Dependencies listed are completion prerequisites unless explicitly marked as coordination.

## Financial correctness and trustworthy state

## [F01] Correct standard interest-tax settlement and monetary rounding

**Category:** Financial correctness  
**Priority:** Critical  
**Type:** Bug  
**Scope:** L

**Status:** Completed (20 September 2026). The shared settlement policy retains high-precision accrual and rounds the standard taxable base and 19% tax upward to grosze at coupon/redemption settlement. IKE remains exempt and IKZE retains its separately modeled withdrawal policy. Single and recurring paths use the same policy, including a pinned 0.33 PLN → 0.07 PLN standard-tax fixture.

### Current state

features/bond-core/utils/engine/tax-settlement.ts rounds the taxable base and tax to whole PLN when useOfficialRounding is true. Single periodic/final settlements use that branch; regular monthly withholding uses unrounded tax. Accrual carries Decimal values but does not define all issuer settlement rounding stages. calculations.precision.test.ts allows a difference below five PLN in a test labeled official rounding.

### Problem or opportunity

The standard interest-tax rule conflicts with the grosz exception cited in Section 1. An executable call for STANDARD tax on 0.33 PLN returns zero. This is especially material for small holdings and frequent coupon payments. Separate wrapper tax rules rather than changing all strategies with one rounding switch.

### Why it matters

Incorrect net payouts affect the flagship calculator, comparisons, recurring plans, notebook projections and goal calculations.

### Proposed implementation

Introduce explicit settlement policies under engine/: interest rounding, taxable-base rounding, tax rounding, and applicable settlement unit. Pin each policy to primary rule fixtures; do not assume that per-bond interest rounding implies per-bond tax settlement. Route single/regular accounting and exports through the same policy. Keep high precision for accrual, then round at actual settlement events. Update explanatory copy, versioned fixtures and MODEL_VERSION with documented before/after changes.

### Acceptance criteria

- Small and large standard-account settlements match independently derived official examples to the grosz.
- Coupon, maturity and early-redemption paths use the documented fee/base/tax order.
- A 0.33 PLN taxable amount produces the appropriate nonzero grosz tax under the pinned standard rule.
- IKE/IKZE behavior remains separately specified; no wholesale fixture regeneration without explained deltas.
- Totals, events, tables and exports reconcile.

### Testing expectations

Boundary values around fractional grosze, multiple bond quantities, monthly/yearly coupons, fee-exhausted interest, capitalized maturity and repeated rollover. Replace the permissive precision assertion with independent exact fixtures.

### Dependencies

None. Coordinate rule identity with F02 and F11.

## [F02] Version issued-series terms and implement period-specific redemption rules

**Category:** Bond domain and data modeling  
**Priority:** High  
**Type:** Bug  
**Scope:** XL

**Status:** Completed (20 September 2026). Resolved issued-series terms now carry fee amount and cap basis through offer resolution into both engines. Interest-capped fees and evidenced principal-basis fees are distinct, OTS forfeits interest, and unresolved series remain visibly non-verified rather than inheriting an issuer claim from a current family offer.

24 September follow-up: the engine also supports the issuer's first-period interest cap followed by full later-period ROR/DOR fees when that policy is present on a resolved series. Coupon-bond exit fees use only unpaid current-period interest as an interest cap; already paid coupons cannot fund that cap. Standard tax on residual current-period interest and separate paid-coupon versus final-redemption cash events are now covered by a source-linked ROR fixture. The subsequent per-side comparison cash-horizon correction advances the model version to `3.2.0-comparison-cash-horizon`; prior committed result envelopes require recalculation.

### Current state

ResolvedBondOfferTerms contains rates/margin but no issued fee policy. resolved-inputs.ts takes earlyWithdrawalFee and rebuyDiscount from the current definition. BOND_DEFINITIONS has TOS/COI fees of 0.70 PLN. redemption.ts caps every non-OTS fee at cumulative interest. single-bond-accounting.ts explicitly assumes coupon principal is preserved.

### Problem or opportunity

Fees vary by issuance era and period. The September 2024 issuer announcement gives new TOS/COI fees of 1/2 PLN. ROR issuer examples distinguish first-period caps from full later-period charges, potentially reducing principal. Historical holdings cannot use today's family fee indiscriminately.

### Why it matters

Early-exit decisions depend on the correct issue and coupon period, not just the bond symbol.

### Proposed implementation

Add versioned series/rule terms through db/schema.ts and additive migrations, offer repositories, HandlerData and a resolved engine input. Represent cap basis, fee amount, effective dates, coupon period and source reference explicitly. Backfill only supported, evidenced eras; mark unknown terms unresolved. Separate already paid coupons from current accrued interest and final principal. Make single and regular settlement consume the same redemption policy. Include known/assumed policy state in UI and exports.

### Acceptance criteria

- Pre/post-September-2024 holdings retain their appropriate verified fees.
- First and later ROR/DOR coupon periods follow pinned issue rules.
- Current-coupon tax and fee settlement never recharges a paid coupon or omits taxable residual interest.
- Unknown historical policy is visibly unresolved, not silently described as issuer verified.
- Notebook saved series remains historical fact across new monthly offers.

### Testing expectations

Official examples, first-period exit, later-period principal reduction, annual payout boundaries, fees equal to/exceeding accrued interest, OTS loss of interest, all supported issuance eras and migrations.

### Dependencies

F01; coordinate F12. Do not generalize ROR rules to every family without evidence.

## [F03] Make calculation periods and maturity dates calendar-stable

**Category:** Date correctness  
**Priority:** High  
**Type:** Bug  
**Scope:** L

**Status:** Completed (20 September 2026). Cycle periods are generated from the original purchase anchor instead of advancing from a clipped month-end date. Regular lots and notebook maturity projections use term months rather than day multiplication; January-31, leap-day and terminal partial-period cases are pinned by regression tests.

### Current state

Inputs use IsoCalendarDateSchema, but engines parse local midnight and serialize timestamps. generateCyclePeriods advances from the previous clipped date. A January 31, 2026 ROR cycle produces February 28, March 28 through January 28, then an extra January 31 checkpoint. Notebook maturity uses duration multiplied by 365 days.

### Problem or opportunity

Month-end drift can change the number/rate of coupon periods. Leap years and timezones can shift displayed financial dates. Notebook maturity can disagree with the engine by days.

### Why it matters

Users need accurate payment dates and comparable exact-date results regardless of server timezone.

### Proposed implementation

Create a shared domain calendar module using date-only values, original purchase anchors and term months. Generate each anniversary from the original anchor under the applicable issue convention, with a separately specified business-day adjustment where needed. Migrate timeline/event date output to canonical calendar dates with a model-version boundary. Replace notebook day multiplication and check ladder/comparison/chart/export consumers. Specify same-day valuation separately from executable redemption.

### Acceptance criteria

- A one-year monthly bond has the issuer-prescribed monthly periods without clipping-induced extra coupons.
- UTC, Europe/Warsaw and America/New_York produce identical financial date strings and amounts.
- Notebook and engine maturity agree for OTS and multi-year families.
- Leap-day, year-end and partial-period behavior is explicit and stable.

### Testing expectations

January 29–31, February 28/29, DST transitions, year-spanning partial periods, maturity ±1 day, same-day inputs, and dates rendered in both locales.

### Dependencies

None; coordinate F02 for legal settlement-date conventions.

## [F04] Define correct real-value inflation semantics

**Category:** Financial correctness  
**Priority:** High  
**Type:** Bug  
**Scope:** L

**Status:** Completed (16 September 2026). A central date-based price-index path now serves single, recurring, portfolio and display calculations; the model version was intentionally advanced with the calendar/inflation work.

### Original audit state

inflation.ts compounds annualInflation times days/year each month. Twelve months at a stated 12% annual inflation gives 1.1268244976553364824 rather than 1.12. Single checkpoints pass differenceInMonths, discarding partial-month purchasing-power change. regular-investment-schedule.ts duplicates the monthly factor.

### Problem or opportunity

An annual effective CPI assumption is treated like a nominal interest rate. Historical CPI used for rate resets is a different concept from the price index needed for realized purchasing power.

### Why it matters

Real-value headlines, inflation comparisons and future real-goal planning all depend on a consistent denominator.

### Proposed implementation

Centralize a price-index path service with explicit annual-effective projection semantics and date interpolation. Annual anchors must multiply by 1 + annual CPI; define partial-year interpolation. Keep bond reset CPI lag separate. If historical month-on-month index data is unavailable, label the derived price path as an approximation rather than claiming exact historical deflation. Deflate recurring contributions at their actual dates when calculating real profit/return.

### Acceptance criteria

- A full projected year at 12% yields exactly a 1.12 price-index factor under the stated convention.
- Partial months affect real value, including exits before the first full month.
- Single/regular/portfolio display consumers use the same price-path semantics.
- Deflation, changing annual paths and missing historical data have explicit treatment.
- Financial-model version and affected golden results change intentionally.

### Testing expectations

Zero/positive/negative CPI, annual anchors, partial months, leap years, two-year custom paths, contribution-date deflation and cross-calculator equality.

### Dependencies

F03.

## [F05] Conserve cash and complete terminal settlement in recurring plans

**Category:** Recurring investment accounting  
**Priority:** Critical  
**Type:** Bug  
**Scope:** XL

**Status:** Completed (16 September 2026). Recurring plans now retain source-aware cash, settle matured lots once, execute exact-date withdrawals, and expose cash and active holdings separately.

### Original audit state

regular-investment-engine.ts creates integer lots but does not retain purchase residual cash. Matured liquidity is consumed only at contribution steps; matured lots remain in the aggregate. The schema drops rollover even though the engine reads it. Exact-date iteration stops on the monthly grid. summarizeRegularInvestmentLots omits paid interest from noncapitalized nominal value.

### Problem or opportunity

The current model can lose uninvested cash, double count matured capital, ignore a requested policy, and never execute the selected terminal withdrawal. A direct two-contribution 150 PLN case records 300 PLN invested but only 200 PLN nominal holdings, with no cash account; an off-grid March 15 exit ends at March 1 without a WITHDRAWAL event. Existing ROR golden tests expect rollover true and false to agree.

### Why it matters

These errors affect both recurring and ladder product surfaces and invalidate strategy expansion without a stronger cash model.

### Proposed implementation

Introduce a simulation cash account with external contributions, residuals, coupon receipts, maturity proceeds, purchases and withdrawals. Settled lots leave the active balance but retain immutable simulation history. Carry cash across non-contribution dates. Add an exact terminal event regardless of cadence. Make rollover an explicit validated intent and define cash-after-maturity behavior. Return invested contributions, holdings, cash, paid-out money, total wealth and terminal net settlement separately.

### Acceptance criteria

- Every contribution and settlement is conserved; residual cash never disappears.
- Matured capital is represented once whether held as cash or reinvested.
- Rollover policies produce the intended different results.
- The selected withdrawal date is the final row/event for arbitrary valid dates.
- Summary, lot table, chart, CSV and ladder consumers reconcile to the new accounting identities.

### Testing expectations

150 PLN contributions, discount-price residuals, quarterly/yearly plans with intervening maturity, last-day maturity, no final contribution, rollover on/off, coupon cash and off-grid exits.

### Dependencies

F01, F02, F03; coordinate F06 as one model migration.

## [F06] Reuse issuer period rules for every recurring lot

**Category:** Calculation architecture  
**Priority:** High  
**Type:** Refactor  
**Scope:** XL

**Status:** Completed (17 September 2026). The single and recurring engines now share a date-aware issuer-period evaluator. Recurring lots settle only newly completed issuer periods, retain an incremental audit state, and use the same rate reset and accrual rules for annual, monthly, and partial periods.

### Original audit state

regular-investment-lots.ts increases capitalized gross value every month using annualRate/12 and resolves inflation-linked rates monthly. RegularInvestmentHandler resolves one initial offer for all future purchases. A one-lot, one-year TOS probe at 4.4% gives 104.48982685184559 PLN gross in regular investment versus 104.4 in the single engine.

### Problem or opportunity

Capitalization cadence and locked annual rate periods must be issuer rules, independent of the UI's monthly aggregation. Later lots and rollover purchases also need an explicit issued/projected offer policy.

### Why it matters

Recurring investment should be a purchase schedule composed with bond rules, not a separate approximation of those rules.

### Proposed implementation

Extract a sufficiently deep reusable lot-period evaluator from the single engine. Let contribution orchestration schedule lots/cash; let the evaluator own rate reset, accrual, capitalization and settlement. Resolve known historical series per purchase; future terms use an explicitly named projection policy. Avoid recalculating each lot's entire history at every month. Use an event schedule or incremental lot state with parity fixtures.

### Acceptance criteria

- One recurring lot equals the matching single scenario at equivalent dates and policy settings.
- TOS/EDO/ROS/ROD capitalize at the correct annual points; COI pays annually; ROR/DOR pay monthly.
- An inflation reset remains fixed throughout its applicable annual interest period.
- Future offer assumptions and historical-series resolution are visible per lot.
- All existing regular/ladder outputs migrate together and remain computationally bounded.

### Testing expectations

Every family, staggered anniversaries, custom CPI/NBP paths, historical resets, leap/partial periods, coupon/tax cadence and long recurring plans.

### Dependencies

F01–F03, F05; coordinate F12.

## [F07] Bind result views and actions to the committed calculation

**Category:** State correctness and UX  
**Priority:** High  
**Type:** Bug  
**Scope:** L

**Status:** Completed (17 September 2026). Single-calculator report panels, actions and the collapsed scenario receipt consume committed inputs. Draft identity remains dirty through failed, cancelled and in-flight requests; successful calculations clear it only when the visible draft matches the completed request. Display-only preferences do not stale a report, while refreshed offer/default terms do.

### Original audit state

useBondCalculator retains lastCommittedInputs, but BondCalculatorContainer passes mutable inputs to summary, chart, details and PDF actions. addToNotebook and saveScenario also use the draft. Only shareScenario uses committed inputs. Dirty state is cleared at request start, including a request that later fails.

### Problem or opportunity

After calculating EDO, changing the draft to COI can relabel/export/save old numbers as the new bond. Reverse calculations retain the solved inputs separately but do not consistently present them. Failed recalculation can leave a stale result without the correct dirty indication.

### Why it matters

A result must identify the scenario that produced it. This is a core trust invariant, not a cosmetic stale badge.

### Proposed implementation

Create a committed report context containing normalized/resolved inputs, envelope and identity. All result-derived views/actions consume it; display-only preferences remain separate. Reuse CalculatorSessionWorkflow/session state transitions so failure/cancellation preserve committed state and correctly compare draft identity. Distinguish any intentional Save draft action from Save result. Notebook creation uses committed quantity/series and explains that a simulated scenario becomes a user-confirmed holding record.

### Acceptance criteria

- Editing family, quantity, date, tax or paths changes only the draft until successful recalculation.
- Summary, receipt, chart overlays, PDF, saved scenario and notebook lot refer to one committed scenario.
- Failure, cancellation and edits during an in-flight request retain correct status.
- Reverse mode displays the solved purchase amount/quantity.

### Testing expectations

Calculate/edit/export and calculate/edit/save journeys, reverse mode, failed recalculate, overlapping requests, unmount, restore, display-only switches and offer refresh.

### Dependencies

None. F26 subsequently enriches report metadata.

## [F08] Make portfolio backup and import a lossless, versioned round trip

**Category:** Persistence and portability  
**Priority:** High  
**Type:** Bug  
**Scope:** L

**Status:** Completed (17 September 2026). Versioned portfolio packages now round-trip through the strict import envelope, including database numeric formatting and null values. Export carries portable series codes alongside non-authoritative source IDs; import prefers the code when a source UUID is foreign. Import is preflighted with a client confirmation and remains one atomic server transaction.

### Original audit state

exportOwnerPortfolio emits version/export metadata, assumptions, IDs, nullable notes and amount. ImportPayloadSchema is strict at root, portfolio and lot levels and accepts a smaller shape. useNotebookWorkspaceActions passes the parsed exported file directly to it. The export-shaped payload fails schema validation. Import re-resolves series from date and accepts fractional quantities.

### Problem or opportunity

The application's own backup cannot be restored through its import workflow, and source series identity can be lost.

### Why it matters

Reliable local backup is particularly valuable for a private portfolio utility and requires no external service.

### Proposed implementation

Define a shared versioned portfolio-package codec distinct from the mutation DTO and report export. Decode known old formats explicitly; preserve stable series code/emission identity without trusting foreign database IDs. Validate integer quantities, nullable notes, dates, limits and duplicate intent. Add a client preview with row errors and resolved/unresolved series status before one atomic create command. Keep portfolio packages free of authentication/ownership identifiers.

### Acceptance criteria

- Every supported exported package imports successfully and preserves user-entered holding meaning.
- Unknown versions and invalid rows fail with actionable feedback before writes.
- Exported calculated summaries are never imported as authoritative balances.
- Empty portfolios have a deliberate supported backup/restore behavior.
- Repeated identical holdings can be distinguished from accidental duplicated rows; no unexplained data loss.

### Testing expectations

Export→decode→import→export semantic equality; legacy amount format; null notes; historical/missing series; fractional quantities; size limits; duplicate review; transaction rollback.

### Dependencies

None for codec/round trip; F02/F12 for richer series policy identity.

## [F09] Reconcile portfolio terminal values, taxes and projection context

**Category:** Portfolio calculation correctness  
**Priority:** High  
**Type:** Bug  
**Scope:** L

**Status:** Completed (17 September 2026). Portfolio timelines now include every lot checkpoint and the exact requested terminal date. Aggregates use cumulative taxes and fees, and the terminal row reconciles directly to each lot’s settled result.

### Original audit state

PortfolioSimulationHandler aggregates on an earliest-purchase monthly grid, carries checkpoints, sums point.taxDeducted, and only adds final fees when a grid row exactly equals withdrawalDate. Terminal capitalized tax is represented in events/settlement, not that period field. Query services return envelope.result and drop provenance.

### Problem or opportunity

A January 1, 2026 TOS lot projected to January 15, 2027 ends the portfolio grid on January 1. The probe returns 10,299.70 PLN portfolio value versus the single terminal 10,313.619287671232 PLN; portfolio tax/fees are zero despite single total tax of 74 PLN under the current model.

### Why it matters

Summary-equals-last-row tests can pass even when both omit the requested terminal settlement.

### Proposed implementation

Build an aggregate date union including every required terminal/payment event and the exact requested endpoint. Separate cumulative deductions from per-period deductions. Derive terminal summary from settled per-lot values plus cash, then prove agreement with the final aggregate row. Carry lot IDs, resolved series, projection start/end, assumptions and envelope metadata through queries/client/UI. Preserve explicitly labeled carry-forward behavior between sparse checkpoints.

### Acceptance criteria

- Off-grid terminal dates reconcile with sum of per-lot terminal values.
- Cumulative taxes and fees reconcile with settlement history across rollovers.
- Projection assumptions and effective as-of date are visible and export-identical.
- Future lots do not contribute before purchase; same-date lots remain individually traceable.

### Testing expectations

Single-lot equality, staggered dates, terminal ±1 day, monthly versus annual coupons, capitalized tax, multiple cycles and varying projection dates.

### Dependencies

F01–F03; coordinate F12/F26 for context.

## [F10] Turn reverse mode into a verified minimum-purchase solver

**Category:** Goal calculation  
**Priority:** High  
**Type:** Feature  
**Scope:** L

**Status:** Completed (17 September 2026). Reverse mode now brackets and binary-searches integer bond quantities against simulated payouts, verifying that the selected quantity meets the target while the immediately lower quantity does not.

### Original audit state

runSingleBondCalculation scales a 10,000 PLN test result via applyReverseSavingsGoal and rounds the estimated required bond count upward. It does not verify that the result reaches the target or that one fewer bond fails.

### Problem or opportunity

Integer purchases, tax rounding, rollover residuals and wrapper splits make a single linear scaling insufficient. The useful existing target mode should have a complete mathematical contract.

### Why it matters

Users asking how much to invest need an achievable amount, not an unchecked estimate.

### Proposed implementation

Move the solver into a bounded server application operation over one resolved context. Search integer bond counts with bracketing and verification; account for nonmonotonic threshold behavior rather than assuming it away. Return minimum feasible quantity, purchase cost, predicted payout, target surplus, iterations and failure reason. Support nominal goal first; add explicitly based real goals after F04.

### Acceptance criteria

- Returned payout meets the target under the chosen scenario.
- Minimality is verified under the supported settlement policy.
- Impossible/out-of-range/zero targets produce clear states.
- One request owns one result; internal solver steps do not consume separate public user requests.
- UI, saved state and exports display the solved values.

### Testing expectations

Targets near denomination/tax thresholds, discounted exchange, multi-cycle rollover, early exit, tiny/maximum goals, wrapper split and bounded convergence.

### Dependencies

F01, F02, F07; F11 for wrapper-aware solving; F04 for real goals.

## [F11] Make tax-wrapper scenarios explicit and fix split aggregation

**Category:** Tax modeling and product scope  
**Priority:** High  
**Type:** Bug  
**Scope:** L

**Status:** Completed (17 September 2026). Wrapper-limit splits now aggregate returns by invested amount rather than averaging percentages, and unavailable purchase-year limits fall back explicitly to standard taxation with a warning.

### Original audit state

STANDARD/IKE/IKZE are accepted broadly. SingleBondHandler optionally splits an annual-limit overflow but averages the two annualized returns equally, regardless of amounts. Tax rule lookup can substitute the latest year when the requested year is missing. IKZE settlement is tied to bond cycles, and the engine also has relief-related fields not present in the intent schema.

### Problem or opportunity

An assumed qualifying wrapper withdrawal is not the same as any early bond exit. Wrapper limits, eligibility, annual fees and contributions are not fully modeled. The split result's unweighted return is mathematically invalid.

### Why it matters

The product can otherwise make a wrapper appear more precise or universally available than its modeled scope supports.

### Proposed implementation

Separate account wrapper, bond redemption and account withdrawal assumptions. Provide an explicit qualifying-withdrawal illustration with limitations; reject unsupported wrapper/family combinations based on verified rules. Compute aggregate annualized returns from aggregate start/end cash flows, not mean percentages. Preserve residual cash when a limit is not a denomination multiple. Surface missing-year limits instead of silently using another year. Define internal maturity reinvestment versus taxable account withdrawal. Account-fee modeling may use versioned local tables or explicit user assumptions.

### Acceptance criteria

- Wrapper assumptions are visible before calculation and retained in results/exports.
- Unequal split allocations yield correct aggregate amounts and returns.
- Limits, rounding, cash residuals and unsupported years are explicit.
- Internal rollover does not accidentally become a qualifying account withdrawal.
- No retirement-advice or eligibility certification is implied.

### Testing expectations

Unequal 10/90 splits, limit±one bond, absent year, IKE/IKZE internal maturity, supported family matrix, qualifying versus unsupported withdrawal and no-limit mode.

### Dependencies

F01, F02, F07.

## [F12] Resolve complete offer snapshots and truthful per-series provenance

**Category:** Authoritative data and resilience  
**Priority:** High  
**Type:** Architecture  
**Scope:** XL

**Status:** Completed (17 September 2026). Resolution enforces issued sale windows, preserves explicit-series failures as unresolved rather than silently substituting a current offer, and exposes resolved-series provenance through assumptions and warnings.

### Original audit state

findActiveBondSeriesForDate selects latest emissionMonth ≤ purchaseDate, without sellEndDate. Explicit-series lookup does not check sale-window compatibility. resolveBondOfferTerms can return generic definition state after a database failure, even for an explicit series. Context revisions omit exact resolved-series values and historical inputs loaded later. Sync writes definitions and individual series sequentially; official-source success is not a full-family coverage check.

### Problem or opportunity

A missing historical month can resolve to an older issue as if purchased in its sale window. A globally fresh sync does not prove every scenario input is resolved. Cache identity and output provenance should describe the data actually used.

### Why it matters

New scenarios, saved holdings and comparisons all need dependable historical identity and honest future-offer assumptions.

### Proposed implementation

Create a typed resolution result: verified issue, declared projected offer, unavailable issue, or fallback estimate. Validate family/series/date compatibility and sale windows; never silently replace an explicit historical ID on failure. Resolve and version exact rules/rates/history/tax context before cache lookup. Batch reads and use a consistent publication revision rather than claiming independently loaded values are atomic. Validate sync completeness against the expected family set and publish accepted snapshots transactionally. Quarantine incomplete source records without overwriting a known-good complete snapshot.

### Acceptance criteria

- Missing sale months and database failures retain accurate resolution status.
- Each result names exact issue/rule/data revisions actually used.
- A changed historical issue or historical observation invalidates its affected cached results.
- Partial official-source responses are not labeled complete successful offers.
- Future purchases have an explicit projection policy.

### Testing expectations

Sale-window edges, wrong family/UUID, expired series, missing month, explicit-series lookup failure, partial sync, interrupted writes, warm/cold caches and changed historic rates.

### Dependencies

Coordinate with F02; may start independently with the resolution contract.

## [F13] Separate ladder horizon values from future maturity proceeds

**Category:** Ladder correctness and interpretation  
**Priority:** High  
**Type:** Bug  
**Scope:** L

**Status:** Completed (17 September 2026). Ladder maturity buckets now show and label nominal principal scheduled at each lot's maturity rather than reusing a selected-horizon liquidation value. Horizon liquidation remains in the regular-plan result, while the ladder explicitly excludes unprojected future coupons.

### Current state

buildLadderMaturityBuckets groups lots by maturityDate but sums lot.netValue from the regular simulation's selected horizon. Many lots mature after that horizon. The UI labels these groups as maturity values and calculates average/peak maturity amounts.

### Problem or opportunity

A young EDO lot's early-exit value at the plan horizon is not its eventual ten-year maturity payout. Changing only the chart label would leave the calendar and summary incomplete.

### Why it matters

The ladder's purpose is understanding when money becomes available.

### Proposed implementation

Keep contribution end, valuation date and payout schedule end as separate concepts. Project each lot through its maturity using explicit future assumptions, or expose nominal principal-only maturity scheduling when complete projection is unavailable. Return horizon liquidation and future maturity cash flows as distinct projections. Label tax, coupon handling and future unknown offers. Preserve monthly/yearly grouping and filters.

### Acceptance criteria

- Every displayed maturity payout is valued at that maturity, or explicitly labeled principal-only.
- Horizon liquidation is separately available.
- Future coupon/maturity sums reconcile with projected lots and their policy.
- Plans with maturities beyond the contribution period remain understandable.

### Testing expectations

EDO purchases near contribution end, OTS/ROR maturities within plan, annual coupon families, horizon changes, grouped totals and final-date preservation.

### Dependencies

F03, F05, F06.

## Complete scenario and portfolio workflows

## [F14] Complete notebook holding management and recoverable request states

**Category:** Portfolio UX and resilience  
**Priority:** High  
**Type:** Feature  
**Scope:** L

**Status:** Completed (19 September 2026). The notebook now has accessible holding add/edit/delete dialogs with quantity, purchase date, notes, issued-series and owned-portfolio move controls, plus owner-scoped portfolio metadata editing. Detail reads and simulations are guarded by portfolio/mutation epochs, preserve the last good data on failure and expose retryable errors; demo creation uses one atomic import command.

### Current state

Notebook offers default/demo creation, imports, deletions, sharing and read-only lot tables. updateOwnerLot and portfolioClient.updateLot already exist, but PortfolioLotsTabSections does not provide a complete editing workflow. usePortfolioDetailsWorkspace logs list/simulate/share/export errors, sometimes substitutes an empty list, and has no request epoch protection. Simulation refresh depends on lots.length rather than lot content.

### Problem or opportunity

Users need to correct holdings without rebuilding a portfolio. Failed reads should not look like an empty portfolio, and a late response for another selection must not replace the current selection.

### Why it matters

This completes existing backend investment rather than introducing another storage system.

### Proposed implementation

Add accessible add/edit/move holding dialogs using the canonical schemas and existing commands. Allow notes, quantity, purchase date and evidenced series selection. Add portfolio rename/description editing through an owned command. Use abortable or epoch-owned detail requests keyed by portfolio ID and mutation revision; invalidate simulations after any relevant edit. Surface errors with retry, retain last good data with stale status, and report share/export/copy failures. Use atomic demo creation through the import command.

### Acceptance criteria

- A user can create, correct, move and delete holdings and edit portfolio metadata.
- No failed read is represented as a successful empty portfolio.
- Switching portfolios during requests cannot show another portfolio's data.
- Editing quantity with unchanged lot count refreshes the projection.
- Guest/ownership restrictions remain enforced server-side.

### Testing expectations

Component interactions and authenticated browser journeys; delayed response ordering, failed writes, same-count edits, series changes, concurrent deletion and owned-target enforcement.

### Dependencies

F08 and F09 for trustworthy import/projection behavior; CRUD can begin independently.

## [F15] Expose a local saved-scenario library

**Category:** New product capability  
**Priority:** High  
**Type:** Feature  
**Scope:** L

**Status:** Completed (17 September 2026). The single calculator now exposes a local scenario library with search, rename/notes/tags, duplicate, delete, guarded restore-as-draft, record validation/migration, storage-error feedback and explicit capacity handling. Stored inputs are versioned single-bond intents and intentionally require recalculation after restore.

### Current state

scenario-storage.ts writes up to 12 SavedScenarioRecords with names, tags and timestamps. Its loader is private and only used when saving; no product UI lists/restores/manages these saved records. Last-session persistence and ScenarioDraftStatus are separate facilities.

### Problem or opportunity

The existing Save scenario action has no complete retrieval journey. Expand it into a small local library, not a second authenticated notebook.

### Why it matters

Repeated personal decisions benefit from named, revisitable assumptions without an account or external service.

### Proposed implementation

Add a feature-owned scenario-library view reachable from calculator actions and navigation. Provide list/search, rename, notes/tags, duplicate, restore-as-draft and delete. Persist discriminated scenario intents with schema/model metadata, not unvalidated BondInputs assertions. Migrate the existing 12 records, validate each separately and explain storage failures. Let users explicitly choose eviction or capacity handling instead of silently deleting older records. Extend to comparison/regular scenarios after the codec in F16.

### Acceptance criteria

- Every saved scenario can be found and reopened.
- Restore previews its assumptions and never silently recalculates or overwrites a dirty draft.
- Existing records migrate or are reported individually as unsupported.
- Local-only storage and backup limitations are stated concisely.
- Previous model results remain unavailable for current financial claims until recalculated.

### Testing expectations

Save/reload/rename/duplicate/delete/restore, malformed records mixed with valid ones, quota denial, capacity limit, migrations and multi-tab storage changes.

### Dependencies

F07; F16 for multi-calculator portability.

## [F16] Preserve complete scenarios through URLs and local packages

**Category:** Scenario portability  
**Priority:** High  
**Type:** Feature  
**Scope:** L

**Status:** Completed (19 September 2026). A versioned discriminated scenario codec now validates portable single and independent-comparison intents for compact URLs, local JSON packages, saved records and shared-input construction. Comparison links preserve custom paths and same-family variants; oversized inline state is never truncated and can be exported as a package, while single scenarios retain the expiring server-share fallback. Restores deliberately contain inputs only and require recalculation.

### Current state

Single URLs carry bond family or use a database share record. Comparison URLs preserve many scalar fields but omit custom CPI/NBP paths and several overrides. parseComparisonBondPair rejects equal bond families even though the independent comparison model can compare two strategies for one family. URL horizon limits differ from API limits.

### Problem or opportunity

A copied comparison link can reopen a materially different scenario. There is no complete account-free export/import format for calculator intents.

### Why it matters

Reliable sharing and local scenario backup make the application useful across sessions and devices.

### Proposed implementation

Introduce one versioned discriminated scenario codec reused by library, URL, file import and server share adapters. Encode compact scenarios into bounded URL state and offer a local JSON package for longer paths. Preserve same-family comparisons, all assumption arrays, cash policies and dates. Decode through canonical intent validation; reject unknown schema versions with recovery guidance. Define precedence among URL, restored session and defaults. Keep server share links as expiring input shares and show their expiry; opening uses current authority.

### Acceptance criteria

- Supported scenario intent survives encode/decode exactly.
- Two EDO scenarios with different tax or cash policies reopen correctly.
- Oversized URLs switch to file export or existing server sharing, with no truncation.
- No secret, portfolio ownership identifier or historical output is trusted from a URL.
- Browser Back/Forward and dirty-draft conflicts have deterministic behavior.

### Testing expectations

Complete advanced paths, same-family strategies, malformed/oversized payloads, unsupported versions, scalar legacy URLs, locale switching and round-trip browser navigation.

### Dependencies

F07, F27; coordinate with F15.

## [F17] Compare explicit reinvestment and cash-handling strategies

**Category:** New strategy capability  
**Priority:** High  
**Type:** Feature  
**Scope:** XL

**Status:** Completed (19 September 2026). Comparison scenarios now use an explicit strategy policy for native maturity, reinvest-to-horizon or zero-rate cash after maturity, plus an independent coupon disposition. Policies are validated, portable through the scenario codec, shown in the committed receipt and passed to the engine. Non-capitalized coupons selected as cash are retained outside rollover capital; legacy maturityMode remains compatibility-only.

24 September correction: maturity and coupon policies are now overridable independently on scenario A/B, including same-family comparisons. The zero-rate cash policy retains proceeds to the chosen horizon as a separate cash checkpoint (rather than ending at native maturity), with horizon-date real value and annualized return; native hold still ends at maturity. Policy changes now dirty the committed result even when bond inputs otherwise match. The correction is versioned as `3.2.0-comparison-cash-horizon` and has URL, handler and cash-timeline regression coverage.

### Current state

Comparison uses the single engine and defaults to inferred rollover. schemas.ts accepts maturityMode, reinvest, rollover and isRebought variants that comparison.ts does not consistently apply. Single rollover reuses starting terms. There is no complete comparison of coupons spent versus retained versus reinvested or maturity proceeds held as cash.

### Problem or opportunity

The meaningful question is often how two strategies behave under the same budget and horizon, not which family has the largest terminal number.

### Why it matters

Users can distinguish income availability, capital lock-up and reinvestment dependence.

### Proposed implementation

Introduce explicit strategy policies for native maturity, reinvest-to-horizon and hold-cash-after-maturity; coupon disposition is separate from principal rollover. Start with cash earning zero and label it; an optional assumed cash rate is supported by F20. Use the cash account from F05 and resolved future-offer policy from F12. Show a committed side-by-side policy receipt, terminal wealth, cumulative withdrawn income, taxes/fees and cash-availability timeline. Preserve neutral wording and same-family comparisons.

### Acceptance criteria

- Every selectable policy is honored through request, engine, result, URL and export.
- Both strategies share declared contribution/horizon assumptions; differences are clearly listed.
- Payout spending versus cash retention versus eligible reinvestment conserve total flows.
- Unknown future offers never appear as promised current rates.
- Existing legacy policy fields have explicit migration/rejection behavior.

### Testing expectations

COI coupons versus EDO capitalization, ROR rollover versus cash, same-family variants, discount eligibility, terminal partial cycle and complete accounting reconciliation.

### Dependencies

F01–F07, F12, F16.

## [F18] Add bounded sensitivity and break-even analysis

**Category:** New result analysis  
**Priority:** High  
**Type:** Feature  
**Scope:** L

**Status:** Completed (19 September 2026). The single-calculator result panel now runs cancellable, bounded CPI, NBP-rate and exit-horizon sweeps (at most 13 points). The server resolves issuer terms, definitions and historical data once per sweep and evaluates every point from that shared snapshot. Results retain per-point failures, render an accessible table with a visual companion, identify all observed profit-sign brackets without claiming a unique root, and let a point prepare—never silently commit—a recalculation draft.

### Current state

SingleBondHandler can calculate low/high inflation timelines; market-assumption controls support presets and custom paths. Comparison presents one committed setup. No reusable sensitivity grid or crossover calculation was found.

### Problem or opportunity

Users cannot easily see how a comparison changes when inflation, NBP assumptions or exit date changes. Existing low/high paths are deterministic illustrations, not probabilities.

### Why it matters

This directly explains assumption risk without external forecasts.

### Proposed implementation

Add a result-side What changes the outcome panel with one selected variable and a bounded range/step. Run a server-side batch against a single resolved context, reusing cached scenarios. Show differences, sign changes and any approximate break-even brackets. Discontinuous tax/quantity/fee effects mean a continuous unique root must not be assumed. Offer an accessible table and a chart; clicking a point prepares a draft and requires explicit recalculation.

### Acceptance criteria

- CPI, NBP and exit-horizon sweeps are supported where relevant.
- All points use one authority snapshot and state the varied/held-fixed inputs.
- No crossover, multiple crossings and threshold jumps are honestly represented.
- Cancellation, capacity limits and partial failure states work.
- Scenarios are not described as probability intervals or recommendations.

### Testing expectations

Constant-rate invariance, CPI/NBP-sensitive families, discontinuous fees, no/multiple crossover cases, batch-versus-direct parity, bounded workload and keyboard table access.

### Dependencies

F04, F07, F12, F17, F30.

## [F19] Model realistic contribution schedules

**Category:** New investment scenarios  
**Priority:** High  
**Type:** Feature  
**Scope:** L

**Status:** Completed (19 September 2026). Recurring plans now normalize initial capital, cadence contributions, nominal annual increases, dated skips, replacements and top-ups into one deterministic cash-flow schedule before simulation. The form includes an optional schedule editor and preview; duplicate-date additions are combined, contribution residual cash remains available for whole-bond purchases, and committed results remain draft-stable while the plan is edited.

### Current state

RegularInvestmentInputs accepts one contribution amount and monthly/quarterly/yearly frequency. A separate starting lump sum, contribution increases, pauses and one-off top-ups are not represented.

### Problem or opportunity

A saver with existing capital and changing contributions cannot express a common plan.

### Why it matters

This makes the recurring calculator useful for practical long-term plans while staying entirely deterministic.

### Proposed implementation

Add a contribution-plan model with initial lump sum, base cadence, dated overrides, pauses and annual increase policy. Normalize it to explicit dated external cash flows before engine execution. Provide a simple base setup with an optional schedule editor and preview table; avoid making every user edit hundreds of rows. Specify same-day ordering, plan end and whether nominal or inflation-adjusted increases are intended.

### Acceptance criteria

- Initial capital, base contributions, annual increases, skipped intervals and one-off top-ups can coexist.
- Preview, simulation, saved scenario and export share exactly the same schedule.
- Cash below one bond's cost accumulates safely.
- Editing the contribution schedule does not mutate committed results.

### Testing expectations

Zero starting capital, pauses/resume, duplicate dates, month ends, leap years, overlapping overrides, maximum horizon and contribution totals.

### Dependencies

F03–F07, F16.

## [F20] Add mixed-bond allocation and a transparent cash benchmark

**Category:** New strategy capability  
**Priority:** Medium  
**Type:** Feature  
**Scope:** XL

**Status:** Completed (19 September 2026). Recurring plans can opt into a validated two- or three-family percentage allocation. The server applies every normalized F19 contribution flow to each family’s target share, preserves whole-bond residual cash, does not sell/rebalance existing holdings, and reports actual versus target weights. An optional monthly-capitalized, user-entered cash-rate comparison is clearly labeled hypothetical and taxed using the declared rate; it is never presented as a bank offer.

### Current state

Regular plans choose one family. Portfolio simulation aggregates existing lots, but there is no allocation policy for new contributions. Savings comparison exists only in the experimental historical tool with a fixed NBP-margin model.

### Problem or opportunity

A user cannot model, for example, an explicitly chosen COI/EDO split against one-family saving or a user-assumed savings account.

### Why it matters

It supports practical trade-off analysis without stock/crypto feeds or advisory optimization.

### Proposed implementation

Build an opt-in allocation strategy over the contribution/cash model: target percentages or fixed amounts per family, whole-bond allocation with deterministic residual handling, and contribution-only rebalancing. Start with no forced sales. Add a clearly hypothetical cash/savings benchmark with user-entered rate path, capitalization and tax assumptions. Explain minimum denomination effects and show actual versus target weights. Reuse comparison result projections and one shared budget.

### Acceptance criteria

- Two or more chosen families share one contribution schedule and cash account.
- Allocations total correctly; residuals are visible and carried forward.
- No hidden early redemption or rebalance fees.
- Benchmark assumptions are explicit, editable and unrelated to advertised bank offers.
- Outcomes include wealth, income, maturity concentration and actual allocations.

### Testing expectations

100/0 and 50/50 cases, very small contributions, three-family residual ties, zero rates, identical strategies, coupon/maturity cash and deterministic replay.

### Dependencies

F05, F06, F17, F19, F30.

## [F21] Build a reconciled cash-flow and calculation-explanation view

**Category:** Results UX and new analysis  
**Priority:** Medium  
**Type:** Feature  
**Scope:** L

**Status:** Completed (20 September 2026). Single-calculator details now expose the engine event stream as an accessible cash-flow reconciliation table, retaining separate coupon, tax, fee, purchase, maturity and withdrawal rows. The shared display model makes discrepancies visible rather than netting them away. Recurring results now carry a dated money-weighted annual return when a root is bracketed; undefined cases remain undefined rather than being displayed as zero.

### Current state

The engine emits purchase, accrual, tax, payout, maturity and withdrawal events. CalculationAuditTrace and MathDeepDive explain selected checkpoints; timeline and ChartDataTable already exist. Event generation currently ties some payout events to tax being positive. Regular result assembly also annualizes aggregate contributions as though all were invested at the beginning, which is not a cash-flow-adjusted investment return.

### Problem or opportunity

Users still cannot clearly distinguish money paid earlier, money retained in bonds, uninvested cash and the final transfer. A generic net payout label can describe lifetime wealth rather than one bank payment.

### Why it matters

This makes financial results understandable and gives future engineering an observable accounting contract.

### Proposed implementation

Add a shared cash-flow display model with date, lot/series, event kind, gross, fee, taxable amount, tax, net cash and remaining holdings. Correct event completeness as part of the work: a zero-tax coupon still generates a payout. Present a compact reconciliation bridge and expandable period detail with actual formula inputs, day counts, rate source and rule reference. Reuse it for CSV and report output. For dated contributions, add a defined money-weighted annualized return using external cash flows and terminal wealth; keep simple profit/contribution ratios separately labeled. Specify solver tolerance, date basis, real-flow deflation and no/multiple-root behavior rather than returning an arbitrary percentage.

### Acceptance criteria

- Initial capital plus external additions plus earnings minus deductions/withdrawals reconciles to holdings plus cash.
- Paid coupons and final redemption are separate.
- Every settlement is inspectable and traceable to the summary.
- Recurring annualized return respects contribution dates; undefined or ambiguous solutions are explained, and are not shown as zero or as a simple CAGR.
- Tables, charts and exports tell the same story in PL/EN.
- Mobile and screen-reader users can access all data without a tooltip.

### Testing expectations

Zero-tax payouts, coupon families, capitalized maturity, discounted exchange, multiple rollovers, cash-only intervals and event-to-summary reconciliation. Independently checked dated-cash-flow return fixtures must cover lump-sum equivalence, late contributions, same-day flows and undefined/multiple-root cases.

### Dependencies

F01–F07, F09, F26.

## [F22] Add a local maturity calendar and early-exit planner

**Category:** New portfolio utility  
**Priority:** Medium  
**Type:** Feature  
**Scope:** L

**Status:** Completed (20 September 2026). Notebook liquidity now exposes read-only maturity events as a local all-day ICS download with stable lot IDs and escaped content. The local exit panel distinguishes planning from an instruction, shows the selected principal and a next-business-day settlement estimate, and explicitly defers interest, fee and tax figures to the authoritative scenario engine.

### Current state

Notebook shows 30/90/180-day maturity windows; ladder groups maturity months. Single calculator accepts a withdrawal date but does not model a redemption instruction and settlement window.

### Problem or opportunity

Users need to understand when cash may arrive and how an early-exit request differs from a hypothetical valuation date.

### Why it matters

Calendar planning is a useful extension of existing dates and holdings, with no reminders service required.

### Proposed implementation

Create a read-only upcoming-events calendar/list for maturities, coupons and relevant request windows. Offer local ICS export with stable event IDs and no background calendar access. Add an exit-planning panel for selected holdings/quantities, distinguishing instruction date, estimated settlement date and hypothetical liquidation value. Use verified issue constraints and a tested Polish business-calendar module; show limitations where exchange/operator conventions are not modeled. Never submit financial instructions.

### Acceptance criteria

- Calendar events use corrected per-lot dates and amount semantics.
- ICS imports with correct all-day/date semantics and escaped notes.
- Partial quantities and unavailable redemption windows are handled explicitly.
- User sees principal, earned interest, fee, tax and expected settlement separately.
- No account credentials, external calendar provisioning or notification service is needed.

### Testing expectations

Weekends/holidays, purchase lockout, pre-maturity cutoff, coupon boundary, partial holdings, duplicate ICS export, DST and unsupported policy.

### Dependencies

F02, F03, F09, F13, F14, F21.

## [F23] Extend goal planning to recurring savings

**Category:** New goal capability  
**Priority:** Medium  
**Type:** Feature  
**Scope:** L

**Status:** Completed (20 September 2026). The recurring calculator now provides a bounded, authoritative endpoint-backed solver for the minimum base contribution needed to reach a nominal target at the selected date. It verifies the solved outcome, reports bound-limited targets honestly, and applies a result only as an editable draft requiring normal recalculation.

### Current state

Only the single calculator has user-facing reverse target mode. Regular inputs carry savingsGoal but do not implement a full contribution solver.

### Problem or opportunity

Users commonly ask how much to save each month by a date, or when their present plan might reach a stated target.

### Why it matters

It turns a forward-only recurring calculator into an actionable planning tool without recommending a bond.

### Proposed implementation

Add two bounded questions: required base contribution for a target/date, and earliest modeled target date for a fixed plan. Reuse F10 solver infrastructure, F19 dated contributions and F04 real-goal basis. Respect whole-bond residuals, taxes and cash policies. Present achieved amount, surplus, contributions versus earnings and assumptions. Optional sensitivity variants come from F18.

### Acceptance criteria

- Nominal and explicitly based real targets are supported.
- Required contribution produces a verified target-reaching scenario.
- Unreachable target or search bounds produce an honest explanation.
- The solved plan opens as a normal editable/committable scenario and exports fully.

### Testing expectations

Near-threshold targets, zero/negative real return, initial lump sums, pauses, same-date targets, solver limits and minimum contribution proof.

### Dependencies

F04–F07, F10, F19.

## Interaction, explanation and engineering foundations

## [F24] Fix expanded-form accessibility and calculation focus transitions

**Category:** Accessibility  
**Priority:** High  
**Type:** Accessibility  
**Scope:** L

**Status:** Completed (28 September 2026). Expanded CPI/NBP paths have distinct visible-name-compatible field and group names with associated help, and reverse target remains explicitly labelled. Enter shortcuts now apply only to editable value inputs, so mode, timing, preset and dialog buttons retain native keyboard behavior without starting duplicate calculations. Shared and comparison result workspaces preserve focus when controls or the fixed action disappear, restore it on edit/close and keep a newer dirty draft open when an older request finishes. The page header owns concise calculation announcements; decorative loading skeletons and the fixed action no longer duplicate live status. Component tests cover labels, help, Enter routing, stale-result transitions and focus restoration. The populated PL/EN desktop/mobile Chromium accessibility matrix passes (70 passed, 10 intentional project skips), including axe, invalid submission, successful calculation, edit/close focus, 320px reflow, zoom and reduced motion. Notebook chart projections retain a semantic data table next to the visual chart.

### Current state

The app has skip links, Radix dialogs, captions, chart tables and axe tests. ProjectedRatePathEditor renders Label/Input pairs without IDs or htmlFor and with identical Y prefixes across CPI/NBP. The reverse target label is not linked to savingsGoal. CalculatorWorkspace conditionally removes controls after results; edit/close transitions do not explicitly manage focus. Result live regions are nested.

### Problem or opportunity

Expanded and post-submit states have gaps hidden by entry-page axe scans. Mode buttons inside BondInputsForm also omit type=button, allowing accidental form submission.

### Why it matters

Keyboard and assistive-technology users need unambiguous rate-field names and a stable place to continue after calculation.

### Proposed implementation

Give each path field a stable unique ID and accessible name including variable and year/date; associate errors and help. Fix target labels and non-submit button types across the relevant form. Implement focus restoration when opening/closing plan controls and on successful calculation without stealing focus from an actively edited newer draft. Announce a concise result/status rather than entire nested result trees. Test chart table equivalence, including notebook charts currently hidden from accessibility navigation.

### Acceptance criteria

- Expanded CPI/NBP and reverse fields have distinct visible-name-compatible accessible names.
- Mode/timing/preset changes do not submit accidentally.
- Focus never drops to body because controls disappear.
- Result/error announcements are concise and nonduplicated.
- Expanded, populated, invalid and dialog states pass axe and keyboard workflows.

### Testing expectations

PL/EN, keyboard-only reverse mode, all advanced paths, successful/failed submit, edit receipt, mobile sheets, 320 CSS-pixel reflow and reduced motion.

### Dependencies

F07 for request-state transitions; label fixes are independent.

## [F25] Unify calculator setup, committed receipts and mobile result navigation

**Category:** UI/UX evolution  
**Priority:** Medium  
**Type:** UX  
**Scope:** L

**Status:** Completed (28 September 2026). Single, regular, ladder and comparison now keep the committed result separate from edits and show compact receipts with amount, dates, tax and cash policy. Regular and ladder receipts display the actual committed rollover setting rather than claiming automatic rollover; comparison receipt facts link to named shared/scenario controls and its mobile view jumps directly to results. Changing a recurring or ladder bond family requires an explicit choice between preserving the plan horizon and using native maturity, with focus restored around the choice. Existing progressive disclosures, responsive design tokens and fixed-action behavior remain intact. Component tests cover both horizon choices and receipt navigation; production-build mobile Chromium journeys cover named editing, focus and result navigation, with desktop Chromium focus checks and the broader accessibility matrix validating the surrounding routes.

### Current state

Single/regular/ladder use CalculatorWorkspace; comparison has a dedicated plan workspace. Shared assumptions are progressively disclosed, but the inspected comparison mobile baseline is a long sequence of shared base, two override cards, instructional sections and macro controls. Defaults preserve a long prior horizon when switching to short bonds.

### Problem or opportunity

The user must retain too much configuration context while scrolling. Current versus draft assumptions, implicit rollover and mode differences can be difficult to locate.

### Why it matters

Better information hierarchy can improve all existing tools without a visual-system rewrite.

### Proposed implementation

Use a consistent setup order: question and budget, timing, instrument/strategy, optional assumptions; then one committed receipt and results. Add a compact mobile summary with direct Edit links to named sections and a jump-to-results control after success. Explain whether changing family preserves horizon or chooses native maturity, and provide explicit choices. Place rare overrides behind a concise differences disclosure. Remove repeated explanatory blocks only when their information remains available contextually.

### Acceptance criteria

- Users can identify amount, dates, tax, cash policy and changed fields from one receipt.
- Mobile users can edit a named section and return to results without searching the full page.
- Family changes do not silently imply an unexpected strategy.
- Primary actions remain reachable without covering content/focus targets.
- Existing design tokens, themes and desktop information density are preserved.

### Testing expectations

Full first-run and returning-user journeys, dirty/failed/restored scenarios, 320px layouts, zoom/reflow, large text, keyboard section navigation and targeted visual baselines.

### Dependencies

F07, F24; coordinate with F17/F19 new controls.

## [F26] Use typed calculation evidence and complete localized reports

**Category:** Result contracts, localization and exports  
**Priority:** Medium  
**Type:** Refactor  
**Scope:** L

**Status:** Completed (28 September 2026). Calculation envelopes carry typed diagnostic codes with severity, parameters and optional source references; the result panel and PDF share one PL/EN localization adapter, retaining a clearly separated compatibility path for older prose-only results. The audit panel never invents a model version, and exports use committed inputs plus one shared provenance record for model, tax rules, issuer offer, data source and coverage. The lazy-loaded PDF embeds a Polish-capable font, wraps long notes and rate paths across pages, and identifies modeled scenario artifacts separately from historical performance; the structured CSV preserves numeric columns and appends the same provenance fields. Tests cover all known diagnostic translations in both languages, unknown-code fallback, older model restoration, metadata and CSV parity, Unicode extraction, negative amounts and multipage PDF output.

### Current state

BaseHandler builds English string assumptions. CalculationMetaPanel and pdf-utils translate them via separate string/regex matches. CalculationMetaPanel defaults the version to v1.2.0 while MODEL_VERSION is 2.9.0-issuer-terms-authoritative; single details does not pass envelope.calculationVersion. PDF receives results/inputs, not the full envelope, uses standard Helvetica and lacks actual source revisions and complete paths.

### Problem or opportunity

Reports can show a wrong version, untranslated notes, incomplete provenance and unsupported Polish glyphs. Adding more financial rules will amplify brittle string parsing.

### Why it matters

An exported decision record should be understandable without the app and should identify the exact calculation.

### Proposed implementation

Introduce typed evidence/diagnostic codes with parameters, severity and source references. Render them through one PL/EN adapter shared by result panels, audit detail and PDF. Build a report DTO from committed context including model/data/rule version, dates, tax/cash policy, paths and limitations. Embed a locally bundled font supporting Polish characters; keep PDF loaded on demand. Preserve structured CSV, and add a human-readable HTML print view if needed for accessible reading.

### Acceptance criteria

- No default/fabricated model version appears in a report.
- Known diagnostics have complete PL/EN translations without parsing English sentences.
- PDF renders Polish diacritics, negative amounts, long notes and multipage content correctly.
- CSV/PDF/report metadata matches the committed result and its provenance.
- Reports distinguish input shares from historical result artifacts.

### Testing expectations

Representative Polish text extraction/rendering, complete assumptions, old model restoration, unknown diagnostic fallback, long paths, multi-page layout and numeric parity.

### Dependencies

F07, F12; coordinate F21.

## [F27] Make all scenario boundaries enforce the same typed intent

**Category:** Validation, TypeScript and security  
**Priority:** High  
**Type:** Architecture  
**Scope:** L

**Status:** Completed (28 September 2026). Effective calendar horizons, independent comparison overrides, optimizer date pairs and portfolio lot-month budgets are checked before context/database work. The handler registry and exhaustive service dispatch preserve each scenario kind's input/result pairing. Normalized and independent comparison policies, portfolio lots, optimizer and retirement payloads reject unknown fields; unsupported single/regular coupon strategy keys reject instead of disappearing. The legacy single rollover marker and normalized `reinvest: true` are explicitly compatibility-only; effective horizon and independent strategy policy remain authoritative. URL, API, local package and persisted single intents share a boundary matrix for date, horizon, rate, unsupported policy and corruption cases; comparison API/package/URL cases cover 360-month, overlong, fractional and unknown-policy inputs. Focused tests, typecheck and the production build pass.

### Current state

Strict schemas exist, but effective horizon validation is inconsistent. Single exact dates can bypass investmentHorizonMonths limits; independent overrides are not validated as a fully resolved date pair; optimizer dates lack a corresponding order refinement. Comparison URL accepts horizons up to 600, including fractions, while API caps at 360 integers. Regular intent drops rollover. Handler registration erases request/result relationships with unknown assertions.

### Problem or opportunity

The app can accept an intent that is silently changed, rejected later, or causes excessive computation. TypeScript currently cannot prove that every handler gets the matching resolved input.

### Why it matters

Future autonomous changes need one executable contract instead of several slightly different interpretations.

### Proposed implementation

Separate legacy decoding, draft validation, canonical intent, resolved engine input and output DTO. Derive effective dates/horizon before semantic validation; enforce consistent date and work limits regardless of input mode. Audit every accepted field: implement it, migrate it or explicitly reject it. Replace broad handler casts with a scenario-kind mapped registry or narrow exhaustive dispatch. Validate persisted/URL/API values using shared schemas. Prefer rejection to silent clamping of already accepted financial assumptions.

### Acceptance criteria

- Equivalent URL, API and stored intents have identical valid ranges and semantics.
- Every accepted policy field affects behavior or is explicitly marked display-only.
- Invalid effective date ranges and oversized computations fail before DB/engine work.
- Scenario kind, input and result types remain linked at compile time.
- Existing supported input formats have deliberate compatibility tests.

### Testing expectations

Boundary maxima, exact-date bypass, independent conflicting overrides, fractional URL horizons, unknown fields, corrupt persistence, missing paths and negative-rate validation/clamping parity.

### Dependencies

None; coordinate F05, F12 and F16.

## Quality, resilience and advanced capabilities

## [F28] Establish independent financial and cross-boundary regression evidence

**Category:** Financial assurance and integration testing  
**Priority:** High  
**Type:** Test  
**Scope:** L

**Status:** Completed (28 September 2026). The F01–F13 witness matrix below pins the financial rule examples, dates, cash conservation, minimum solver and committed/persistence boundaries to independent expectations, cross-engine checks and the cited issuer/statutory references. The default unit suite clears inherited live `DATABASE_URL` values and passes 1,243 tests (13 intentional skips); the separate Node server suite passes 288 tests and contract suite 86. An isolated local PostgreSQL 16 instance exposed a stale migration-readiness count, missing runtime columns/tables and two adapter-shape/timezone assumptions; additive reviewed migrations, a full runtime-column coverage test and UTC-stable rate-limit timestamps now pass 13 database tests. The default authenticated integration command rebuilds with the integration-only PostgreSQL adapter and passes ownership, notebook edit/delete/export/import and anonymous public-share cases under production CSP (3/3). The setup seeds only a disposable COI family fixture, and no live credentials or preview database were used.

Independent and cross-boundary witnesses for the corrected findings:

| Finding | Pinned external rule or independent expectation                                                                                                                  | Boundary/conservation witness                                                                            |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| F01     | `production.test.ts` pins 0.33 PLN standard interest tax to 0.07 PLN under the Article 63 §1a grosz rule linked above.                                           | `single-bond-engine.test.ts` separately settles a paid ROR coupon and fee.                               |
| F02     | `single-bond-engine.test.ts` hand-computes the ROR first/later redemption periods from the linked ROR1225 issuer explanation.                                    | `regular-investment-golden.test.ts` compares the same dated lot across engines.                          |
| F03     | `calendar-inflation.test.ts` pins all twelve January-31 calendar anniversaries; `calculations.test.ts` covers leap day.                                          | `regular-investment-golden.test.ts` checks lot maturity spacing and off-grid terminal settlement.        |
| F04     | `calendar-inflation.test.ts` pins 12% annual CPI to factor 1.12; `price-index.test.ts` checks leap-year and partial-month factors.                               | `portfolio-simulation-aggregation.test.ts` checks aggregate deflation exactly once.                      |
| F05     | `regular-investment-golden.test.ts` pins a 150 PLN contribution to one bond plus 50 PLN residual cash.                                                           | The same suite asserts one terminal withdrawal and no remaining terminal wealth.                         |
| F06     | The issuer period counts are 12 for monthly ROR/DOR and one for annual families in `regular-investment-golden.test.ts`.                                          | Eight one-lot regular cases match the same single-engine issuer outcome.                                 |
| F07     | `calculator-session.test.ts` pins draft/committed separation through failed and cancelled requests.                                                              | `accessibility.spec.ts` exercises result focus and edit/close behavior in populated browser states.      |
| F08     | `portfolio-repository.integration.test.ts` pins atomic import rollback against a real disposable database.                                                       | `portfolio-mutations.spec.ts` exports, deletes, imports and re-reads an owned lot under Auth.js and CSP. |
| F09     | `portfolio-simulation-aggregation.test.ts` pins the exact 15 January terminal row, its lot tax and fee components.                                               | `cross-calculator-consistency.test.ts` matches a one-lot portfolio to direct single.                     |
| F10     | `single-calculator-actions.test.ts` verifies the selected integer purchase quantity meets the target and its predecessor does not.                               | The same suite preserves non-reverse inputs unchanged.                                                   |
| F11     | `calculator-truth-qa.test.ts` now pins an unequal 3,000/7,000 PLN IKE/standard split to principal-weighted returns and verifies missing-limit standard fallback. | The handler's overflow, tax and payout agree with the two separately evaluated parts.                    |
| F12     | `offer-terms.test.ts` pins invalid sale-window and failed explicit-series lookups as unresolved.                                                                 | `comparison-selected-series.test.ts` and report provenance tests retain exact issue identity/source.     |
| F13     | `ladder-display.test.ts` uses unequal horizon values and invested principals, pinning 2037 maturity principal to 700 PLN rather than the 750 PLN horizon value.  | `calculator-truth-qa.test.ts` checks sequential maturity bucket spacing.                                 |

### Current state

The default suite is extensive and green, and separate contract, trusted-scope and browser suites already exist. Nevertheless, recurring-engine tests preserve monthly capitalization and ignored policy behavior; aggregate tests can validate internal consistency without checking the issuer outcome. Server tests run under a broadly shared jsdom environment, producing Neon browser warnings, and some service mocks still reach database fallback paths. Authenticated Playwright integration has a separate configuration but is not part of the inspected normal browser CI jobs.

### Problem or opportunity

Add independent rule fixtures and end-to-end contract checks at the specific seams exposed by this audit. More test count or stronger snapshots of current behavior would not establish correctness.

### Why it matters

Future engine changes must distinguish genuine regressions from corrections to previously encoded mistakes.

### Proposed implementation

Build a small, source-linked reference matrix by issued rule version: tax pennies, completed/partial coupon, annual capitalization, first/later redemption period, maturity, exchange and family constraints. Hand-calculate expected results separately from production helpers. Add conservation/property checks and metamorphic checks: a one-lot regular scenario matches single under equivalent cash policy; portfolio aggregation matches independently aligned lot events; export/import preserves records. Separate Node server tests from DOM tests and make unexpected external fallback fail in isolated unit tests. Extend existing CI using local fixtures and isolated database services; do not introduce external credentials. Record supported scope and exceptions alongside model changes.

### Acceptance criteria

- Financial corrections have independent expectations, source/rule identifiers and changed golden fixtures with explanations.
- Regression coverage includes all confirmed F01–F13 defects, not only successful nominal paths.
- Committed-result consumers, scenario restoration and portfolio round trips are tested across boundaries.
- Server unit tests cannot silently contact a live database; integration prerequisites and skips are explicit.
- A repeatable authenticated local integration workflow covers ownership, edit/delete/import and result context.
- Support classifications are updated only from relevant passing evidence.

### Testing expectations

PLN rounding thresholds, fee exceeding interest, month-end/leap-year dates, partial final dates, 0/1/many lots, all-cash residuals, failed and overlapping requests, stale snapshots and schema migrations. Run separately configured contract suites as well as default Vitest.

### Dependencies

Start independently with failing witnesses; corrected acceptance fixtures depend on the corresponding F01–F13 implementation. Coordinate F29.

## [F29] Verify real calculator interactions under the production CSP

**Category:** Security and browser compatibility  
**Priority:** High  
**Type:** Security  
**Scope:** L

**Status:** Completed (29 September 2026). Production-build, CSP-enforced populated single and narrow comparison journeys now pass in Chromium, Firefox and WebKit. The checks exercise chart rendering and resize, tooltip, date picker, theme and locale changes, the keyboard-focused mobile navigation dialog, and a negative untrusted-inline-script assertion; the Chromium chart has a reviewed visual baseline. An isolated authenticated Chromium integration run also passes notebook ownership, edit/delete/export/import and anonymous public sharing under the production policy. The WebKit run passed 2/2 interaction tests plus 11/11 route, notebook and issue-explorer checks using a persistent user-local Ubuntu library runtime; its host dependency preflight was skipped only because the unprivileged runtime is not registered in the system package database, while the real WebKit browser launched and completed the tests. The populated tests passed again after moving that runtime to its persistent location. CI installs native WebKit dependencies and runs the strict-CSP project. The documented style-attribute allowance remains presentation-scoped; script and style-element nonce enforcement was not relaxed.

### Current state

proxy.ts generates a nonce-based restrictive policy, including style-src-attr 'none'. ChartContainer has inline sizing and Recharts/Radix may apply runtime styles. playwright.config.ts normally sets bypassCSP: true; a separate Firefox CSP project checks a narrow initial smoke. The fresh Chromium smoke passed with the default bypass.

Implementation checkpoint (23 September 2026): populated single and narrow-viewport comparison calculations pass Chromium and Firefox with CSP enforced. The test first exposed Zod's blocked JIT capability probe; the client now configures jitless validation before route hydration. It then exposed dynamic style attributes from Recharts, Radix, and Next's route announcer. Application-owned chart sizing moved to classes. The policy now permits only style attributes (`style-src-attr 'unsafe-inline'`) while style elements remain nonce-protected and scripts remain nonce-only without eval. This is a deliberate, presentation-scoped relaxation: CSS injection would be more capable if an attacker could inject HTML/style attributes, so HTML escaping and input validation remain necessary. The expanded test also covers chart rendering/resize, hover tooltips, date selection, theme/locale, and a focus-trapped mobile navigation sheet. The sheet exposed an un-nonced scroll-lock style element; the request nonce now reaches that library without relaxing `style-src-elem`. The tests still reject unexplained CSP violations and verify that an untrusted inline script does not execute. WebKit, authenticated notebook and representative visual coverage remain to be evidenced before closing F29.

28–29 September continuation: the authenticated notebook and anonymous public-share paths pass an isolated production-build Chromium/CSP integration run (3/3), including focused lot dialog, owner-scoped edit/delete and export/import. Populated single/comparison strict-CSP interactions pass Chromium and Firefox (4/4); Chromium also compares the rendered populated chart against a reviewed visual baseline. After supplying the missing Ubuntu libraries in an unprivileged local runtime, the same populated tests pass in real WebKit (2/2), and WebKit's strict-CSP route/notebook/issue-explorer checks pass (11/11). No passing CI run of these uncommitted local changes is claimed.

### Problem or opportunity

There is an evidence gap at precisely the interaction where dynamic charts, overlays and sizing appear. This audit does not claim a reproduced production rendering failure: the code and test configuration establish a compatibility risk that the current passing smoke cannot resolve.

### Why it matters

A visually correct bypassed test can miss a production-only broken chart or dialog. Conversely, broadening CSP without evidence would weaken a useful defense.

### Proposed implementation

Add strict-CSP browser scenarios against built output with successful calculations, resized charts, tooltips, date popovers, sheets, dialogs, theme switching and both locales. Collect securitypolicyviolation events and assert intentional policy behavior. Move application-owned inline styles to classes/CSS variables through a policy-compatible mechanism; assess library-generated styles separately. If a narrow policy adjustment is demonstrably necessary, document its threat tradeoff and test it. Cover API security/ownership through the existing authenticated integration harness, without making external preview access a requirement.

### Acceptance criteria

- Populated single, comparison and notebook interactions work with CSP enforced in supported browser engines.
- No unexplained style/script violations are hidden by a test-wide bypass.
- Nonces and public/cache response behavior remain correct; unrelated security directives are not relaxed.
- Existing keyboard and visual checks also run for representative strict-CSP populated states.

### Testing expectations

Fresh navigation and client navigation, narrow viewport, theme/locale switch, chart resize, tooltip, focus-trapped dialog, date selection and authenticated notebook. Include negative checks that untrusted inline scripts remain blocked.

### Dependencies

None for the compatibility investigation; coordinate F24 and F28 for interaction coverage.

## [F30] Bound and streamline expensive portfolio calculations

**Category:** Performance and resilience  
**Priority:** High  
**Type:** Performance  
**Scope:** L

**Status:** Completed (28 September 2026). The common scenario boundary rejects over-360-month lot horizons and more than 12,000 lot-months before engine execution. The portfolio handler shares one history fetch, reuses offer resolution by series/date identity, deduplicates identical immutable calculations, advances sorted event cursors and deflates aggregate wealth through a shared price-index path. Summary transport omits per-lot detail, while owned detail remains available through the separate simulation flow. The 100-lot/108-month local fixture took 838 ms and serialized 13,619,637 detail bytes versus 25,238 overview bytes for the same result; these are diagnostic measurements, not an SLA. Aggregate terminal reconciliation and sparse/off-grid events have focused financial tests. Worker error, messageerror, abort and missing-reply timeout paths reject pending requests; focused validation, aggregation and worker tests pass. No background architecture or broader work limit was introduced.

### Current state

PortfolioSimulationHandler resolves and calculates each lot independently, then scans sparse lot timelines for aggregate dates. Full per-lot timelines are returned together with aggregate data. Inflation factors repeatedly traverse prefixes. The import/input surface permits large lot collections, and exact dates are not consistently constrained by effective horizon.

A local mocked-data probe of 100 identical ROR lots over 20 years produced 29,327,581 bytes of JSON, 241 aggregate rows and 100 offer resolutions, taking approximately 48 seconds. A build was running concurrently, so this is a diagnostic workload observation, not an isolated performance SLA or a production measurement.

Implementation checkpoint (23 September 2026): the bounded 100-lot/108-month mocked fixture completes in approximately 0.5–1.0 seconds locally and serializes a 25,238-byte overview after per-lot detail was removed from that transport. The earlier 20-year probe and this 9-year fixture are not directly comparable timing workloads. Both are diagnostic observations, not a performance SLA; the 12,000 lot-month admission budget and exact-date limit are tested separately.

### Problem or opportunity

Bound total work and payload size, reuse identical resolved contexts, and stop making a portfolio overview transport every detail of every lot.

### Why it matters

This is a demonstrated large-workload/payload issue with both responsiveness and server resource consequences, particularly before adding scenario grids.

### Proposed implementation

Measure representative lot/horizon/event workloads in an isolated benchmark. Batch series/history resolution, deduplicate pure calculations by complete immutable input/context key, use sorted cursor/event aggregation and precomputed inflation prefixes, and separate overview DTOs from on-demand lot detail. Introduce an explicit estimated-work budget before calculation, consistent across authenticated and guest entry points. Bound chart projections without discarding accounting events. Ensure cancellation/timeouts have an observable client outcome; inspect worker error/messageerror handling and teardown. Consider background computation only if measured remaining work requires it, not as an automatic architecture migration.

### Acceptance criteria

- Defined maximum work is rejected before expensive execution, including exact-date and many-lot combinations.
- Identical lot contexts do not repeat data resolution unnecessarily.
- Overview payload growth is bounded and documented; detail is fetched only when needed.
- Optimized results reconcile exactly with the corrected reference engine.
- Benchmarks record wall time, serialized size and workload parameters before/after.
- Failed, timed-out or terminated worker requests clear loading state and reject pending promises.

### Testing expectations

1/100/maximum supported lots, identical/distinct series, staggered dates, extreme valid horizon, cancellation, missing worker reply, oversized input, payload-size regression and exact financial parity.

### Dependencies

F27 for canonical work limits; coordinate F09 for aggregate correctness. Benchmark first and avoid optimizing defective results into a permanent contract.

## [F31] Correct historical replay units, coverage and macro-data isolation

**Category:** Experimental model correctness  
**Priority:** High  
**Type:** Bug  
**Scope:** L

**Status:** Completed (28 September 2026). Replay now reads a separately stored GUS previous-month CPI series (`pl-cpi-mom`) from the same [official monthly archive](https://stat.gov.pl/obszary-tematyczne/ceny-handel/wskazniki-cen/wskazniki-cen-towarow-i-uslug-konsumpcyjnych-pot-inflacja-/miesieczne-wskazniki-cen-towarow-i-uslug-konsumpcyjnych-od-1982-roku/); the existing year-over-year `pl-cpi` series remains exclusive to annual macro defaults. Both seed and ongoing macro synchronization label and persist the monthly unit separately, and observed replay becomes available only after the monthly series and aligned PLN asset/FX data are present. The replay path validates finite observations and contiguous selected months, reports actual gaps, rejects missing FX or unsupported windows instead of filling zero returns, and labels illustrative mixed-currency fallback as non-comparable. Bond reset rates compound twelve monthly CPI changes and remain locked for the issuer year; drawdown uses contribution-independent returns. Tests pin independently checked GUS 2026 monthly indexes, source selection, annual-CPI rejection, missing/gapped months, FX/nonoverlap, locked resets and contribution-independent drawdown. No historical database sync was run without a configured local database.

### Current state

lib/api-clients/gus-cpi.ts parses the year-over-year CPI presentation (index relative to the corresponding month of the preceding year) into an annual percentage. lib/data/multi-asset-history-projection.ts places it into a MonthlyReturn inflation field; asset-calculations applies that as a monthly price change. Missing asset/NBP values can become zero, while availability checks count series independently rather than proving aligned coverage. Market references include USD-denominated indices/commodities without an explicit PLN currency conversion. Historical averages used by calculator assumptions depend on this composite history and can fall back when unrelated asset data is absent.

### Problem or opportunity

Keep year-over-year CPI, monthly price relatives, annual policy rates and asset returns as different typed measures. Experimental replay must not contaminate the core calculator's annual macro defaults.

### Why it matters

An annual inflation observation repeatedly compounded as monthly inflation materially distorts purchasing power. Missing observations and mixed currencies can create false comparisons.

### Proposed implementation

Decouple macro averages from equity/gold availability. Introduce frequency/unit metadata and validators at ingestion/projection boundaries. Use a genuinely available monthly price-index series for monthly real returns; otherwise explicitly mark the projection unavailable or label a user-approved modeled approximation. Do not infer monthly inflation exactly from year-over-year observations. Align supported date intersections, represent gaps explicitly, and disclose currency basis; hide PLN-comparative claims when FX is unavailable rather than requiring new credentials. Calculate drawdown from unitized returns or time-weighted wealth so contributions do not hide losses.

### Acceptance criteria

- Annual CPI cannot enter a monthly-return slot without an explicit documented transformation.
- Core macro defaults are unchanged by absence of equity/gold rows.
- Coverage UI reports actual common usable periods and gaps.
- Currency, nominal/real basis and modeled versus observed data are visible.
- Unsupported comparisons fail informatively instead of substituting zero returns.
- Contribution-independent risk metrics and corrected fixture units are used.

### Testing expectations

12% annual CPI fixture, constant price index, missing middle month, nonoverlapping assets, absent FX, missing gold with intact CPI/NBP, contributions during drawdown and historical fallback parity.

### Dependencies

F04 for shared real-value semantics; coordinate F12 for provenance. Remain experimental until independent evidence exists.

## [F32] Repair retirement withdrawal accounting and support boundaries

**Category:** Retirement planner correctness and UX  
**Priority:** Medium  
**Type:** Bug  
**Scope:** M

**Status:** Completed (24 September 2026). The bounded steady-rate model starts at an unaccrued month-zero balance, records only paid withdrawals, reconciles the terminal month and retains it in chart sampling. The shared input schema now rejects unsupported families and missing tax policy before calculation. A localized, semantic monthly table exposes every modeled balance and paid withdrawal, including exhaustion. Unit, API and desktop/mobile browser tests cover first-month, exact and partial depletion, zero return, wrapper treatment, nonannual terminal months and the visible table; this remains explicitly an approximation, not issuer-exact liquidation.

### Current state

features/bond-core/handlers/retirement-planner.ts accrues interest at month zero and can report a full withdrawal in a timeline row after only a partial remaining balance was withdrawn. A probe with PLN 100 capital and PLN 90 monthly withdrawals produced approximately PLN 100.4047 total withdrawals, but the two timeline withdrawal rows summed to PLN 180. Rate/tax defaults and family support are not consistently enforced server-side. Retirement chart sampling every 12 rows can omit the exhaustion endpoint.

### Problem or opportunity

Make this clearly bounded decumulation approximation internally correct before expanding its functionality.

### Why it matters

The key user question is when funds run out and what can actually be withdrawn. Contradictory terminal rows undermine that answer.

### Proposed implementation

Define time-zero balance, accrual timing and withdrawal timing explicitly. Record the actual amount paid before mutating state; derive totals from these events. Enforce supported families and explicit tax policy in the handler, including documented margin treatment. Preserve exhaustion/final points in chart projections. Explain that this is not issuer-exact rolling bond liquidation unless later replaced by a validated event-based withdrawal strategy.

### Acceptance criteria

- Initial row has no elapsed-period interest or withdrawal.
- Withdrawals never exceed available balance and rows reconcile to totals.
- Terminal/exhaustion month is always visible in chart and table.
- Unsupported families/policies fail at the API boundary, not only in UI.
- Approximation and timing assumptions are visible in PL/EN.

### Testing expectations

Zero balance, first-month depletion, exact depletion, partial final withdrawal, zero return, omitted tax mode, unsupported family and nonannual terminal month.

### Dependencies

F01, F03 and F27; this bounded correction does not require a full retirement product redesign.

## [F33] Centralize route indexability and metadata policy

**Category:** Code-level SEO and maintainability  
**Priority:** Low  
**Type:** Architecture  
**Scope:** M

**Status:** Completed (24 September 2026). One route policy drives canonical paths, navigation eligibility and the explicit sitemap allowlist. Preview remains noindex with an empty sitemap; private/experimental routes remain excluded in indexable mode. Shared scenario/portfolio pages now use generic noindex metadata without loading or publishing user-entered titles/descriptions. Contract and localized tests cover both locales, safe base-URL fallback, private-page behavior and unique canonical routes; no deployment/indexability switch was changed.

### Current state

The private-preview default correctly disables indexing and produces restrictive robots/empty sitemap behavior. In indexable configuration app/sitemap.ts enumerates tools, including routes with different support/private-use characteristics. Page metadata and navigation encode overlapping route knowledge.

### Problem or opportunity

Prevent the public/indexable branch of code from advertising unsuitable routes or inconsistent canonical/locale metadata, without changing the product's private-preview posture.

### Why it matters

One route policy makes future tools easier to add safely and keeps private/user-specific pages out of discovery surfaces.

### Proposed implementation

Define a small route metadata registry with canonical path, localized title/description, navigation visibility and indexability eligibility. Derive sitemap entries and relevant metadata through shared helpers. Preserve noindex for private/shared-user surfaces as appropriate, independent of global indexable mode. Test configured base URL handling, locale metadata and robots/sitemap agreement. Do not introduce public acquisition pages or require domain/infrastructure changes.

### Acceptance criteria

- Preview remains noindex by default.
- Sitemap contains only explicitly eligible canonical routes.
- Private and experimental-route policies are deliberate and tested.
- Metadata, canonical URLs and navigation remain valid under both locales/configurations.
- No user-specific search parameters or sensitive content enters metadata/structured data.

### Testing expectations

Preview/indexable matrices, missing/invalid base URL, both locales, shared/private pages, duplicate canonical detection and new route registration.

### Dependencies

None; coordinate F25 only when navigation changes.

## [F34] Turn available offer data into an issue-aware bond explorer

**Category:** Product discovery and decision support  
**Priority:** Medium  
**Type:** Feature  
**Scope:** L

**Status:** Completed (28 September 2026). The existing education page now includes a filterable issued-series explorer, retaining its original family table. Stored issue identity, sale and maturity dates, issued opening rate/reset margin, early-exit fee/cap, eligibility, source revision and explicitly unknown freshness appear in equivalent mobile cards and a semantic desktop table. Current, historical, upcoming, unavailable and no-record/fallback states are distinct; calculation and comparison links carry the exact stored series ID and dates through the validated portable scenario codec. A compact checkpoint preview uses the shared issuer-period schedule and stored maturity, while the UI explicitly labels today's family payout cadence and checkpoints illustrative because the series schema does not evidence historical cadence. Unknown fees, missing margins, absent documents and unsupported families are not presented as verified issuer terms. Component tests and production-build desktop/mobile Chromium plus Chromium/Firefox strict-CSP browser tests cover filtering, historical badges, fee/source uncertainty and exact-identity handoff.

### Current state

Education already contains a current-family comparison table and links that preselect two families. The calculator has an issued-series selector, and the database stores series and source metadata. Users still have to connect family descriptions, selected issue rules, payout cadence and the scenario result themselves.

### Problem or opportunity

Extend the existing education/offer flow into an issue-aware decision surface, not a duplicate static article or another disconnected calculator.

### Why it matters

Users choosing between regular income, capitalization and a planned exit need to see practical rule differences before entering amounts.

### Proposed implementation

Reuse authoritative read models from F12 to show available issue identity, applicable dates, initial/reset rate formula, payout frequency, maturity, early-exit rule, eligibility and source freshness. Add filters for duration and cash-flow preference and direct actions to configure/compare the chosen issue. Permit inspection of stored historical issues with a clearly historical badge; do not imply unavailable records exist. Provide a compact illustrative timeline derived from domain schedules, with editable amount/date delegated to the existing calculator. Preserve the current education table and navigation rather than replacing useful content wholesale.

### Acceptance criteria

- A user can inspect a stored issue and carry its exact identity into calculation/comparison.
- Current, historical, fallback and unavailable states are distinguishable.
- Filters reflect real supported product properties, including family eligibility.
- Displayed rules and illustrative schedules come from shared resolved terms.
- Mobile cards and semantic table alternative expose equivalent information.
- No external content campaign, new account or live credential is required.

### Testing expectations

Current/historical issue, missing family, fallback source, expired sale window, family eligibility, deep-link round trip and keyboard/mobile filtering.

### Dependencies

F02, F12 and F16; coordinate F24/F25.

## Implementation checkpoint — 24 September 2026

F24–F34 have local implementation work, but this checkpoint does **not** close the findings. The current evidence and remaining work are:

- **F24–F25:** Expanded controls, keyboard submission/focus, committed receipts, section edit links and explicit family-change choice are implemented. The Chromium/mobile-Chromium accessibility matrix passes (62 passed, 10 intentional project skips), including axe, zoom/reflow, reduced motion and invalid-submission focus. Confirmation and lot-editor dialogs trap and restore keyboard focus in component tests. The full mobile-action matrix and cross-calculator receipt review remain open.
- **F26:** The single-bond report embeds a Polish-capable font, paginates notes and long paths, and shares a committed-provenance builder with CSV. Every calculation handler attaches typed diagnostics; the single engine also emits typed calculation notes. Legacy string interpretation is isolated to one compatibility adapter for restored results. Focused tests cover translation parity, old-model metadata, long paths and CSV numeric/provenance output. Independent PDF glyph extraction/rendering and full cross-tool report parity remain open.
- **F27–F28:** Effective-date and work-budget validation, linked handler dispatch, isolated server tests and a CI authenticated-integration path are added. Independent comparison overrides and optimizer date/horizon conflicts now reject inputs that were silently rewritten; API/package/URL over-limit single intents have a shared regression test. The legacy comparison URL decoder now rejects malformed supplied fields and derives exact horizons, while absent fields retain defaults. A table-driven URL/API/stored-input boundary matrix now covers single-intent date, rate and horizon limits. A browser-authenticated notebook dialog/CSP assertion is added to the integration path, but cannot be run locally without the isolated database. The cross-kind URL/API/stored-input matrix, independent F01–F13 evidence and a passing local authenticated portfolio round trip remain open.
- **F29:** Populated single/comparison interactions pass enforced CSP in Chromium and Firefox, including chart resize, tooltips, a focus-trapped navigation sheet, date selection, theme/locale and blocked inline-script checks. WebKit could not launch locally because host libraries are missing; CI now installs them. The authenticated notebook dialog/CSP case is in the database integration suite but not yet evidenced by a passing run; representative visual coverage remains open.
- **F30:** Portfolio work admission, shared resolution, reduced overview payload and worker failure cleanup have focused tests and a bounded benchmark. A directly comparable before/after benchmark and full reference-engine reconciliation matrix remain open.
- **F31–F34:** Historical replay unit/coverage guards, retirement accounting, centralized route policy and the issue explorer are implemented with focused tests. The explorer no longer calls an issue with missing sale/maturity dates current or offers a calculation link without exact identity. Desktop/mobile Chromium and enforced-CSP Chromium/Firefox now verify keyboard eligibility filtering and calculator handoff for a stored historical issue. Broader browser and boundary evidence remains necessary before marking every acceptance criterion complete.

24 September continuation: F34 explorer reads now use the shared SWR GET cache instead of an ad hoc request effect. Its comparison action carries the exact selected series ID through URL validation, offer resolution and per-side result provenance; URL/component/browser fixtures pin that round trip. Explorer cards and table now distinguish an evidenced issued fee/cap rule from an unresolved fee, rather than silently displaying the family default as an issue fact. F27 comparison overrides now reject unknown and formerly silently ignored policy fields. F17 also gained per-side maturity/coupon overrides and an actual zero-rate cash checkpoint to the chosen horizon; URL, handler and timeline fixtures cover the distinction from native maturity. F02/F28 gained an issuer-source-linked ROR first/later redemption fixture and one-lot cross-engine parity; periodic coupon tax and cash-flow events now settle the final unpaid coupon separately. Rate-only offer synchronization preserves reviewed fee/policy/source columns instead of clearing them. F26 now uses an independent PDF text parser in tests to verify Polish diacritics, negative values and committed model metadata survive export; full cross-tool report parity remains open. These are local implementation and test improvements, not closure of the remaining F24–F34 browser, database-integration and independent-reference acceptance work.

Further 24 September continuation: a desktop/mobile comparison browser check exposed an ICU variable-contract collision between bond and multi-asset chart summaries. Bond charts now use a distinct translated key, with English/Polish formatting tests; the same-family per-side policy receipt passes desktop and mobile Chromium. The issue explorer passes desktop/mobile Chromium and enforced-CSP Firefox with its issued-fee and exact-series handoff fixture. F31's illustrative fallback previously fed month-on-month CPI changes directly to an annual macro-default slot; it now compounds contiguous twelve-month windows, rejects annual-CPI rows and gaps, and carries a model-version bump. This corrects an offline-default unit mismatch but does not establish independent historical replay evidence or close F31.

Later 24 September F34 continuation: issue cards and the desktop table now present the same explicit payout cadence and source-freshness uncertainty, use the stored issued maturity for exact-series calculation/comparison links, avoid implying a reset margin on fixed-rate bonds or turning a missing margin into zero, and surface unknown-family records as unavailable instead of silently omitting them. Focused component tests cover rate/margin boundaries, the stored-maturity schedule, unavailable family and deep-link dates; rebuilt-production desktop/mobile Chromium tests cover keyboard filtering, historical badges, displayed cadence and exact-maturity handoff. The production webpack build, typecheck, lint and focused tests pass. This does not close F34: the stored series schema has no per-series payout-cadence or independently checked freshness timestamp, so historical cadence remains explicitly illustrative from current family definitions; broader issuer-term boundary evidence is still required. The default Turbopack build hit a local process/port permission panic during CSS processing, while the webpack production build succeeded.

F33 follow-up: metadata now rejects an unregistered route before requesting its translation namespace. Contract tests cover missing/unsafe canonical base URLs, an empty preview sitemap, unique public canonical routes and private/experimental exclusions; localized metadata tests verify Polish social locale and private-page noindex. The full release suite (461 tests) and separately configured contract suite (86 tests), typecheck and lint pass. No public discovery policy was broadened.

The production webpack build, typecheck, lint, full Vitest suite (224 files passed, 3 skipped; 1,190 tests passed, 12 skipped), isolated server suite (285 tests), release suite (447 tests), contract suite (82 tests), desktop/mobile Chromium browser CI matrix (77 passed, 7 intentionally skipped), Chromium/Firefox strict-CSP interactions (4 tests), Chromium/mobile-Chromium accessibility matrix (62 passed, 10 skipped), and issue-explorer desktop/mobile plus enforced-CSP Chromium/Firefox checks (4 tests) passed locally at this checkpoint. The browser matrix exposed a hidden-desktop-selector failure in the mobile preferences test; it now opens the mobile navigation and targets the visible settings control. The previously stalled full Vitest run exposed a floating-point non-progress loop in the recurring goal solver; cent-integer search and its regression tests now pass. The local WebKit run failed before application launch due to missing host dependencies. Docker and local PostgreSQL were unavailable, so authenticated database integration remains CI-only evidence until that job passes. Preserve these distinctions in any support classification or release claim.

# 5. New feature opportunities

These are deliberate product additions, not release-blocker camouflage. Detailed scope and acceptance live in Section 4.

## High-value additions recommended for implementation

- **A usable local scenario library (F15–F16):** save, name, restore, duplicate and transport complete scenarios without signing in. This completes an existing but hidden capability.
- **Explicit strategy comparison (F17):** compare taking coupons as cash with reinvestment and rolling maturity proceeds. Support same-family scenarios with different policies rather than requiring different products.
- **Sensitivity and break-even analysis (F18):** show how the answer changes with inflation, policy rates and exit time, making forecast dependence visible.
- **Realistic contributions and recurring goals (F19, F23):** model pauses, increases and top-ups, then solve a defined savings target.
- **A reconciled cash-flow explanation (F21):** make paid income, accrued interest, retained cash, fees, tax and real purchasing power understandable without reverse-engineering a chart.
- **Maturity/exit planning (F22):** inspect forthcoming events, model a requested early exit and export a local calendar file.

## Useful enhancements in the recommended backlog

- Minimum-purchase reverse calculation with verified target fulfillment (F10).
- Complete portfolio holding management and recoverable operations (F14).
- Mixed-bond allocation with a simple, explicitly assumed cash benchmark (F20).
- Complete localized result reports (F26).
- Issue-aware exploration connected to existing education and calculators (F34).

## Optional or experimental directions

Historical multi-asset replay and retirement planning already exist; F31/F32 correct and contain them, not promote them automatically. Probabilistic forecasting, optimization across uncertain paths and a full personal transaction ledger are deferred in Section 11. Deterministic scenario ranges should come first.

# 6. UI/UX development roadmap

The target journey is **choose a product or saved scenario → configure → calculate → understand → compare → save or plan an action**.

First stabilize trust in what is on screen. A result is an immutable receipt for one successful calculation: date, issue, amount, assumptions and policy remain attached while the user edits a new draft. Show a clear “changes not calculated” state. Failed recalculation must leave the previous receipt usable and the draft recoverable (F07).

Next unify progressive disclosure across tools (F24–F25). Keep essential amount/date/product controls prominent and put advanced tax/path/policy inputs behind clearly labeled disclosure. Do not hide or unmount focused controls on submission. On mobile, offer a compact setup receipt and direct navigation between summary, cash flows, chart and assumptions; avoid requiring users to scroll through every advanced panel to reach results. Comparison should distinguish shared assumptions from A/B overrides and explain what differs.

Then replace isolated totals with decision information. F21 provides the common meaning of every number and a semantic table behind each chart. F17/F18 add policy alternatives and bounded uncertainty ranges using those same definitions. Color is secondary to labels and patterns; values that include paid cash must not be confused with the current redeemable holding.

Persistence completes the loop. F15/F16 make local saving visible, reliable and portable. F14 lets notebook users maintain real holding records without delete-and-recreate workarounds. F22 adds a local calendar, while F34 feeds exact issue identity into configuration. Reports in F26 use the same committed receipt and explanations.

Success should be judged through concrete workflows: restore an old scenario without silently changing it; edit assumptions without relabeling old results; compare cash versus reinvestment; find the tax/fee behind a terminal payout; recover from an import/calculation failure; complete these tasks using a narrow viewport and keyboard. This is a connected UX program, not a blanket visual redesign.

# 7. Technical improvement roadmap

## Correctness and domain boundaries

F01–F06 establish explicit rounding, issued rules, calendar anchors, price-level semantics and cash conservation. Retain the single engine's natural-period decomposition. Extract reusable rule application where recurring calculations diverge; do not replace Decimal with floating point or introduce a second authoritative engine in the browser.

F09/F11/F13 align aggregate outputs with these rules. Aggregators must consume events with explicit cumulative versus period semantics. A terminal value is evaluated at the requested date, not inferred from the nearest monthly row. Portfolio wrappers and weighted returns require their own mathematical definitions.

## Application contracts and data authority

F07/F16/F27 separate draft, canonical intent, resolved inputs, immutable result and display projection. F12 makes exact terms and source context part of result/cache identity, with visible fallback. F08 defines a genuine portable holding schema; local/UI/database identifiers are not blindly reimported.

## Assurance and resilience

F28 starts before fixes with independent failing witnesses and develops alongside them. F29 closes the CSP evidence gap in populated states. F30 caps total computational work and reduces duplicate resolution/payloads based on measured workloads. Existing owner checks, migration discipline and security headers stay in place.

## Maintainability without cosmetic rewrites

Typed evidence in F26 removes string-based interpretation at user/report boundaries. A typed handler registry in F27 prevents wrong input/output pairings. Route policy in F33 removes duplicated eligibility decisions. Tests should move to appropriate Node/DOM environments where the current setup causes false external fallback paths, not be rewritten merely to change testing style.

F31 isolates experimental time-series semantics from ordinary macro defaults; F32 repairs the narrow retirement model while preserving honest support labels.

# 8. Recommended implementation phases

Phases describe dependency order, not a requirement to finish all engineering work before any user benefit. F07/F08/F24 can deliver value while engine work proceeds.

| Phase                                      | Intended outcome                                       | Workstreams and ordering                                                                                        |
| ------------------------------------------ | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| A. Capture evidence and protect boundaries | Reproducible failures, honest receipts, bounded inputs | Start F28; implement F27, F07 and F08. Investigate F29. Establish F30 baseline benchmark.                       |
| B. Financial foundations                   | Correct issued rules, dates and money                  | F01 and F03; coordinated F02/F12 terms contract; F04; F05 then F06 integration.                                 |
| C. Reconcile existing tools                | Existing results and operations agree                  | F09, F11, F10, F13; finish F14. F31 and F32 can use separate owners once their shared prerequisites are stable. |
| D. Safe reusable product state             | Portable scenarios, consistent UI and reports          | F24, F16, F15, F25 and F26. Complete F29/F30; ratchet F28 evidence.                                             |
| E. Core product expansion                  | Understand alternatives and realistic plans            | F17, F19 and F21; then F18, F22, F23 and F34.                                                                   |
| F. Broader planning and polish             | Mixed allocations and consistent discovery             | F20 and F33; final cross-tool assurance and documentation/support-matrix review.                                |

F02/F12 need one agreed resolved-terms contract before either lands incompatible changes. F05/F06 may be delivered as coordinated milestones in one dedicated effort: first cash/event invariants, then replace divergent accrual scheduling. They are not circular prerequisites. F28 is continuous; its backlog position means “begin now,” not “declare assurance complete before fixes.”

# 9. Master implementation backlog

All 34 recommended findings are included. Scope is relative complexity, not a time estimate: S localized; M several related modules; L cross-layer workstream; XL substantial domain/product program. Priority expresses impact, while order also accounts for dependencies. “Coord.” means collaborate on the boundary, not a hard prerequisite.

| Order | ID  | Title                                                        | Priority | Scope | Dependencies                                                 |
| ----- | --- | ------------------------------------------------------------ | -------- | ----- | ------------------------------------------------------------ |
| 1     | F28 | Independent financial and cross-boundary regression evidence | High     | L     | Begin independently; finish with relevant corrected findings |
| 2     | F27 | Consistent typed intent at all scenario boundaries           | High     | L     | None; coord. F05/F12/F16                                     |
| 3     | F07 | Committed calculation owns result views/actions              | High     | L     | None                                                         |
| 4     | F08 | Lossless versioned portfolio backup/import                   | High     | L     | None for round trip; F02/F12 for richer terms                |
| 5     | F01 | Correct standard interest-tax rounding                       | Critical | L     | None                                                         |
| 6     | F03 | Calendar-stable periods and maturity                         | High     | L     | None; coord. F02                                             |
| 7     | F02 | Issued-series terms and redemption rules                     | High     | XL    | F01; coord. F12                                              |
| 8     | F12 | Complete offer snapshots and truthful provenance             | High     | XL    | Coord. F02                                                   |
| 9     | F04 | Correct real-value inflation semantics                       | High     | L     | F03                                                          |
| 10    | F05 | Recurring cash conservation and terminal settlement          | Critical | XL    | F01/F02/F03; coord. F06                                      |
| 11    | F06 | Shared issuer-period rules for recurring lots                | High     | XL    | F01/F02/F03/F05; coord. F12                                  |
| 12    | F09 | Portfolio terminal values, taxes and context                 | High     | L     | F01/F02/F03; coord. F12/F26                                  |
| 13    | F11 | Explicit wrapper scope and split aggregation                 | High     | L     | F01/F02/F07                                                  |
| 14    | F10 | Verified minimum-purchase reverse solver                     | High     | L     | F01/F02/F07; F11 wrappers, F04 real targets                  |
| 15    | F13 | Honest ladder horizon/maturity values                        | High     | L     | F03/F05/F06                                                  |
| 16    | F24 | Expanded-form accessibility and focus                        | High     | L     | F07 for workflow; labeling can start independently           |
| 17    | F29 | Production-CSP browser compatibility                         | High     | L     | None; coord. F24/F28                                         |
| 18    | F30 | Bounded, streamlined portfolio calculation                   | High     | L     | F27; coord. F09                                              |
| 19    | F14 | Complete notebook management/recovery                        | High     | L     | F08/F09; CRUD can start independently                        |
| 20    | F16 | Complete scenario URLs and local packages                    | High     | L     | F07/F27; coord. F15                                          |
| 21    | F15 | Local saved-scenario library                                 | High     | L     | F07; F16 for multi-tool state                                |
| 22    | F25 | Consistent setup, receipts and mobile navigation             | Medium   | L     | F07/F24; coord. F17/F19                                      |
| 23    | F26 | Typed evidence and localized reports                         | Medium   | L     | F07/F12; coord. F21                                          |
| 24    | F31 | Historical replay units, coverage and isolation              | High     | L     | F04; coord. F12                                              |
| 25    | F32 | Retirement accounting/support boundaries                     | Medium   | M     | F01/F03/F27                                                  |
| 26    | F17 | Explicit reinvestment/cash strategy comparison               | High     | XL    | F01–F07/F12/F16                                              |
| 27    | F19 | Realistic contribution schedules                             | High     | L     | F03–F07/F16                                                  |
| 28    | F21 | Reconciled cash-flow/explanation view                        | Medium   | L     | F01–F07/F09/F26                                              |
| 29    | F18 | Bounded sensitivity/break-even analysis                      | High     | L     | F04/F07/F12/F17/F30                                          |
| 30    | F22 | Local maturity calendar and exit planner                     | Medium   | L     | F02/F03/F09/F13/F14/F21                                      |
| 31    | F23 | Recurring savings goal planner                               | Medium   | L     | F04–F07/F10/F19                                              |
| 32    | F34 | Issue-aware bond explorer                                    | Medium   | L     | F02/F12/F16; coord. F24/F25                                  |
| 33    | F20 | Mixed-bond allocation and cash benchmark                     | Medium   | XL    | F05/F06/F17/F19/F30                                          |
| 34    | F33 | Route indexability and metadata policy                       | Low      | M     | None; coord. F25                                             |

# 10. Highest-value next tasks

These 16 are the immediate shortlist, not a substitute for the full backlog:

1. F28: preserve independent failing witnesses before engine behavior changes.
2. F07: stop pairing successful results/actions with mutable inputs.
3. F01: fix and verify the tax settlement unit and rounding.
4. F03: repair month-end and terminal date invariants.
5. F02: attach redemption rules and fees to the correct issued terms.
6. F12: make resolved issue provenance and cache identity complete.
7. F05: account for every recurring contribution, residual and terminal amount.
8. F06: eliminate recurring versus single natural-period divergence.
9. F08: make the application's own backup importable.
10. F09: reconcile portfolio terminal value and tax.
11. F27: close effective-date/work-limit and intent interpretation gaps.
12. F24: fix concrete labels, accidental form submission and focus transitions.
13. F30: stop sending oversized portfolio detail for an overview.
14. F15/F16: deliver visible, portable local scenario saving as one coordinated product outcome.
15. F17: make reinvestment versus cash a first-class comparison.
16. F18: explain forecast sensitivity once the corrected strategy model is stable.

F29 should run alongside this sequence because its investigation may reveal a browser compatibility blocker. F31's macro-data isolation can also be brought forward independently of polishing historical replay.

# 11. Deferred / optional ideas

These are not additional required backlog findings and must not displace the defined acceptance criteria.

- **Monte Carlo forecasts:** defer until deterministic path semantics, sensitivity bounds and return metrics are validated. Probability language would require a defensible calibration model, not random values around defaults.
- **Automatic “best bond” optimization:** begin with transparent scenario comparisons. Do not present a universal optimum without defining horizon, cash needs, eligibility and uncertainty.
- **Full transaction ledger:** explicitly outside the current holding-record ADR. Buys, sells, coupons and account balances would be a new accounting product with migrations, reconciliation and tax scope; calendar/projection improvements do not authorize it.
- **Offline calculation/PWA:** local saving is valuable now; a second offline authoritative engine and data-freshness protocol are not justified by current evidence.
- **External notifications, bank/broker sync or account integrations:** excluded from the implementation program because they add credentials/operations. F22's local ICS export supplies useful reminders without them.
- **Expanded market assets or FX ingestion:** correct existing units and unsupported states first. No need to add more unvalidated historical series.
- **Public SEO expansion or educational publishing campaign:** preserve the private utility stance. F33/F34 are repository-level consistency and data presentation work, not a launch or content campaign.
- **Wholesale design-system, state-library, ORM or Next.js replacement:** no evidence supports these migrations.
- **User analytics services and speculative micro-optimizations:** not prerequisites. Use local benchmarks and existing browser/vitals tooling to identify actual bottlenecks.

# 12. Things that should NOT be changed

- **App Router with thin route handlers:** the server/client and composition boundaries are deliberate and broadly useful. Do not move financial authority into page components.
- **Decimal-based monetary arithmetic:** observed bugs concern rules, timing and rounding policy, not a reason to revert to JavaScript number arithmetic.
- **Natural-period decomposition in the single engine:** improve identified rules and reuse the seam; avoid a global monthly approximation rewrite.
- **Explicit calculate/committed-result workflow:** this is appropriate for expensive, assumption-sensitive financial tools. Repair incomplete consumers rather than replacing it with automatic recalculation on every keystroke.
- **Separate display projections:** nominal/real and presentation choices must not mutate authoritative stored results.
- **Issuer-controlled term resolution:** client edits must not silently override authoritative rates/fees. Exploratory assumptions need explicit separate policy.
- **Model-versioned caches and saved envelopes:** extend identity/provenance instead of removing invalidation safeguards.
- **Strict ISO calendar-date parsing:** extend its invariant through generation and serialization rather than relaxing it to arbitrary Date parsing.
- **Authenticated ownership checks, same-origin writes and parameterized repositories:** preserve them during CRUD/import work. This audit found no basis for claiming missing ownership enforcement.
- **Migration-only production schema changes:** do not add runtime DDL or bootstrap mutations.
- **Restrictive CSP and index-disabled preview defaults:** verify compatibility and explicit route policy; do not disable protections to make tests green.
- **Accessible chart data tables and existing comparison commit model:** these are assets to reuse, not missing foundations.
- **Holding-record notebook semantics:** a forecast is not a completed transaction ledger.
- **Metadata-only public portfolio sharing:** omission of holdings is a privacy choice, not automatically an incomplete feature.
- **Existing education/current-offer table and comparison links:** enhance their issue context; do not rebuild a duplicate table.
- **PL/EN localization, shared primitives, existing CI/security/bundle checks:** targeted improvements belong inside these systems.

# 13. Handoff context for future Codex sessions

## Required reading and ownership

Start with this report's finding, its dependencies and acceptance criteria, then CONTEXT.md and the architecture/calculation-stability documents listed in Section 2. Read docs/adr/0001-holding-record-not-ledger.md before notebook changes. Inspect current git status: this audit baseline is not a promise that another session has not since changed the code.

Work from the feature to its real call chain. app routes are adapters. features/bond-core/application-service.ts owns intent/context orchestration; lib/server/calculation/composition.ts wires data dependencies; handlers adapt scenario kinds; precision-engine modules own financial behavior. Shared gateways own browser transport. Feature containers own draft/committed UI state. lib/server/portfolio contains owner-aware persistence operations. lib/data and lib/sync have separate read/ingestion responsibilities.

## Sensitive modules and rules

| Boundary           | Files/modules to inspect before changing it                                                       | Invariant                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Tax and redemption | features/bond-core/utils/engine/tax-settlement.ts; redemption.ts; cycle/period settlement callers | Rounding unit, taxable event, fee ordering and per-issue rules must be explicit                                           |
| Dates and cycles   | timeline-builder.ts; single-bond-engine.ts; notebook maturity helpers                             | Anchor to intended calendar dates; do not accumulate clipping drift or timezone conversion                                |
| Contributions      | regular-investment-engine.ts; regular handler; ladder projection                                  | Contributions = deployed principal + retained/paid cash flows after accounting; every lot uses applicable natural periods |
| Inflation          | engine inflation utilities; result assembly; display projections                                  | An annual expectation, year-over-year observation and monthly price relative are different measures                       |
| Aggregation        | handlers/portfolio-simulation.ts; split wrapper handling; lib/server/portfolio/simulation.ts      | Align event dates and distinguish cumulative/period values before summing                                                 |
| Authority          | offer resolver; bond-definition/series data; BondOfferSyncService; calculation context/cache      | Resolved terms and source/rule version must describe the same immutable issue                                             |
| UI receipt         | BondCalculatorContainer; useBondCalculator; calculator-session-workflow; result/export actions    | All consumers reference the successful committed context, not the current draft                                           |
| Portable state     | scenario-storage; URL codecs; portfolio import/export schemas                                     | Version, validate, migrate deliberately; never silently reinterpret old financial assumptions                             |
| Evidence           | calculation-evidence.ts; assumption renderers; PDF adapters                                       | Support labels and provenance describe actual computation, not fabricated versions/default claims                         |

Current engine model identifier observed: 2.9.0-issuer-terms-authoritative. A financial output change requires the repository-prescribed model-version and fixture/evidence updates. Do not retain an old version merely to avoid touching saved-state tests.

Bond families are OTS, ROR, DOR, TOS, COI, ROS, EDO and ROD. Their durations and payout/reset/capitalization rules differ. Tax wrappers are scenarios, not proof of a user's legal qualification. ROS/ROD eligibility must stay visible. PLN 100 denomination and discounted exchange purchase price are distinct concepts. Do not derive units with amount/100 when an applicable purchase price differs.

Current offer database contents were not inspected. Static fallback fees and resolver behavior establish the documented risks; do not describe every deployed series as carrying those fallback terms. F12 must distinguish live, stored historical, unavailable and fallback authority.

Dates represent civil dates in the financial model. JavaScript Date instants and UTC serialization must not change their day. The requested horizon can end within a natural period. Early-redemption request date, valuation/accrual date and payment date may differ; use issue-specific documents before implementing precise calendars.

Keep these quantities separate in naming, types and UI: cash contributed, purchase cost, nominal principal, accrued unpaid interest, paid coupons, withheld tax, redemption fee, retained cash, current liquidation value and cumulative wealth. Do not sum a cumulative tax column as if it were period tax. Do not apply a simple CAGR to a sequence of differently dated contributions as if all money arrived at time zero; any cash-flow-adjusted return must define its equation, dates and no/multiple-root handling.

## Compatibility and implementation discipline

- Schemas at URL, localStorage, API and database import boundaries are all untrusted input boundaries.
- A schema accepting a field does not prove the handler honors it; audit the resolved input and engine effect.
- Older scenario links should either migrate with an explicit warning or reject informatively. Old result artifacts must not be mislabeled as current recalculations.
- Existing owner checks must wrap new edit/delete/import operations. Public share tokens must not reveal unrelated holdings.
- Complete PL/EN messages, chart table alternatives, mobile states, loading/error feedback and exports belong in the scope of user-facing additions.
- Preserve existing user changes and avoid broad format-only churn. Changes to domain outputs need dedicated evidence, not blanket snapshot regeneration.
- Test source-of-truth behavior independently of the helper being tested. If official examples and rounding rules appear inconsistent, resolve the settlement basis before selecting a fixture.

## Verification baseline and reproduction

At audit time:

- pnpm check:types and pnpm lint passed.
- pnpm test:ci --reporter=dot passed 1,088 tests in 202 files, with 12 tests/3 files skipped.
- PLAYWRIGHT_SMOKE=1 NEXT_PUBLIC_PLAYWRIGHT_SMOKE=1 pnpm exec next build --webpack passed as a diagnostic smoke-mode build.
- pnpm exec playwright test tests/browser/app-smoke.spec.ts --project=chromium --workers=1 --grep 'single calculator' passed one test.
- The default Turbopack build failed in the execution environment with a CSS-worker local-port EPERM. This remains an unverified build path here; webpack success is not a reason to change the production build command.

The numeric probes are investigative witnesses described in findings, not committed regression tests. Recreate them inside the relevant test suite before fixes. No new fixture/test file was added by the audit, because the only authorized repository change was this document. The 100-lot probe was not a controlled benchmark. Browser smoke is not a full visual, keyboard, CSP or authenticated validation. Database tests require the existing isolated harness; never point destructive integration fixtures at user data. Do not run sync/seed/deploy operations as incidental verification.

Future sessions should run the affected unit suites, type/lint checks, relevant separately configured contracts, and applicable browser/integration checks. Engine sessions should also run the project's release/trusted-scope evidence commands after inspecting package.json and current stability rules.

# 14. Suggested execution strategy

Give each future session one finding ID or an explicitly coordinated bundle, together with this document path. Ask it to complete the entire finding, including all acceptance criteria, tests, compatibility, localization and model/evidence changes. Require it to read current implementation rather than treating this dated audit as immutable truth.

Recommended session boundaries:

- **Dedicated financial sessions:** F01; F03; coordinated F02/F12 with agreed contract milestones; F05/F06 as a staged domain program; F09; F11. These have broad output risk and should not be buried inside UI work.
- **Safe bounded bundles:** F07 with the focus-transition portion of F24; F08 with import/recovery portions of F14; F15/F16; F25 with remaining F24; F26/F21 after the event contract is stable.
- **Dedicated expansion sessions:** F17, F18, F19, F20, F22 and F23. A session must not satisfy these by adding only a toggle or static chart; the full scenario semantics, persistence and analysis behavior are required.
- **Independent hardening sessions:** F27; F29; F30 after its baseline; F31; F32; F33. F34 follows authoritative terms and portable issue links.
- **Continuous assurance:** F28 supplies witnesses and integration gates throughout. Its completion requires the specified cross-boundary matrix, not a single additional test.

Within a large finding, agree internal milestones that preserve a working product: define types/invariants and failing tests; implement the domain/application seam; connect all consumers and migrations; verify UI/export behavior; update support/evidence documentation. Do not treat the first milestone as completion of the finding.

Before parallel implementation, identify shared-file ownership. Engine settlement/date changes, result DTO changes, schema migrations and shared codecs need sequencing or a single integrator. Independent UI/read-model work can proceed against an agreed contract, but speculative duplicate DTOs should not be merged.

Each implementation handoff should state:

1. Finding IDs and completed acceptance criteria.
2. Changed financial/product behavior and deliberate limitations.
3. Model/schema/portable-format version changes and migration behavior.
4. Tests and commands actually run, including failures/skips and environment limits.
5. Remaining dependencies, without claiming an incomplete broad workstream is done.

Keep all work inside the repository and its existing local test capabilities. None of the 34 findings requires a new SaaS account, paid service, business relationship, marketing campaign, external credentials or infrastructure provisioning. External primary documents may be consulted to verify financial rules, but runtime features should use existing/stored data or explicit locally calculated assumptions.

# 37. Codebase Design and Domain Model Audit

**Audit date:** 2026-09-11  
**Status:** Decisions accepted and repository implementation completed
2026-09-11. No deployment state was changed by this work.

**Implementation update (2026-09-11):** Repository implementation and focused
proof are complete. Existing database columns and legacy request keys remain
only as explicitly decoded compatibility representations.

| Finding | Status   | Implemented outcome                                                                                                           |
| ------- | -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| A1      | Complete | HTTP calculation decoders expose caller-owned intents and strip issuer-controlled legacy terms before handlers resolve them.  |
| A2      | Complete | Browser/API holding records use `bondQuantity`; the persisted `amount` column is a compatibility detail, not domain language. |
| A3      | Complete | Stored series IDs flow into portfolio simulation; unknown explicitly selected series produce an unresolved-offer warning.     |
| A4      | Verified | The original optimizer call uses the project's start/end helper correctly.                                                    |
| A5      | Complete | Retirement projections declare a start date before cache identity and display calculation.                                    |
| A6      | Complete | `MULTI_ASSET` no longer appears in the calculation scenario registry.                                                         |
| A7      | Complete | Domain documentation describes the current bond-first model and conditional cross-asset scope.                                |

## Scope and method

This audit traced the paths that determine financial meaning rather than
counting files or applying Atomic Design mechanically:

```text
calculator form → HTTP request → calculation application module → handler
→ offer/data resolution → financial engine → envelope/display model

notebook form → portfolio command → holding storage → portfolio simulation
→ financial engine → portfolio projection
```

It also inspected the current ubiquitous language in `CONTEXT.md`, financial
guides, schema, server portfolio modules, calculation handlers, engines, and
the existing architecture audit/implementation ledger. Findings below concern
the current source, not a historical audit snapshot. Existing R01–R14 work in
the implementation ledger is therefore not repeated.

## Proposed context map

The application has one cohesive product, but five concepts with different
sources of truth and change rates. They should not be flattened into one
generic `FinancialInstrument` model.

| Context           | Owns                                         | Authoritative concepts                                                     | Main relationship                                                               |
| ----------------- | -------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Bond catalogue    | statutory family rules and dated offers      | Bond family, issued bond series, offer terms                               | Resolves terms for a calculation intent or holding lot.                         |
| Calculation       | deterministic financial projection           | Calculation intent, resolved calculation, projection, calculation evidence | Consumes a catalogue/data snapshot; it does not select database rows itself.    |
| Reference data    | observed macro series and provenance         | Observation, coverage, freshness, fallback                                 | Supplies declared assumptions and historical rate references.                   |
| Portfolio records | a user's recorded holdings and ownership     | Portfolio, holding lot, portfolio transaction, shared view                 | References a bond family/issued series by identity; it does not own bond rules. |
| Product journeys  | forms, committed drafts, display and exports | Draft, committed calculation, display projection                           | Translates interaction state to a calculation intent and renders outcomes.      |

This is a context map, not a package plan. The current feature folders can
remain. The important seams are the interfaces between these meanings.

## Findings

## Accepted modeling decisions

| Area                      | Decision                                                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Portfolio                 | Keep a holding-record workspace, not a transaction ledger. `bondQuantity` is the canonical term; nominal value is derived.                                         |
| Missing historical series | Return an explicit `unresolved-offer` state. Never substitute current/generic terms while claiming historical series terms.                                        |
| Calculation compatibility | Introduce the narrow internal intent/resolved-calculation seam first. Continue decoding current HTTP payloads and shared snapshots during a documented transition. |
| Retirement timing         | Add an explicit projection as-of/start date, include it in cache identity, and disclose it in the result.                                                          |
| Multi-asset registry      | Remove `MULTI_ASSET` from the calculation scenario registry; its historical comparison workflow is not a calculation-engine scenario.                              |

The holding-record choice is recorded in [ADR 0001](../../adr/0001-holding-record-not-ledger.md).

### A1 — Calculation requests conflate intent with resolved issuer terms

**Priority:** P0 for trusted calculation surfaces.

`BondInputs` is simultaneously the browser request, schema, handler input,
and engine input. Its public schema requires `firstYearRate`, `margin`,
`duration`, `earlyWithdrawalFee`, `isCapitalized`, `payoutFrequency`,
`rebuyDiscount`, and `taxRate`. Those are issuer/rule facts, yet
`resolveScenarioInputs()` later resolves and overwrites several of them.

This gives callers a large interface that they should neither own nor need to
understand. It also leaves inconsistent responsibility: some fields are
overwritten, some are trusted, and handler-specific paths construct their own
defaults. `as` casts around the application module and handlers hide this
mismatch from TypeScript.

**Better seam**

```text
CalculationIntent (caller owns)
  + CatalogueSnapshot + ReferenceDataSnapshot + TaxRuleSnapshot
  → ResolvedCalculation (resolver owns)
  → Projection (engine owns)
```

`CalculationIntent` should contain only the selected family/issued-series
reference, dates or horizon, bond quantity/PLN contribution, rollover choice,
wrapper choice, and declared market assumptions. `ResolvedCalculation` should
contain all issuer-controlled terms and data provenance. The single-bond,
comparison, regular-investment, optimizer, and portfolio handlers can then
share one resolver and pass one strongly typed engine input.

**Migration order**

1. Characterize the present HTTP inputs and exact outputs for the trusted
   single-calculator path.
2. Add internal intent/resolved types beside the engine; do not alter the wire
   payload yet.
3. Make the resolver produce every engine-required term and make the engine
   accept only the resolved type.
4. Narrow the HTTP schema only after compatibility clients and share snapshots
   have a migration path. Remove the old casts and add a contract that request
   data cannot alter issuer terms.

This is a deep module: its small interface lets callers ask a financial
question while hiding offer selection, fallback provenance, and structural
rules. Its dependencies are local-substitutable reads, so tests can use an
in-memory catalogue snapshot without adding a production port.

### A2 — Portfolio `amount` is an ambiguous quantity, and transaction meaning is incomplete

**Priority:** P0 for notebook trust; P1 if the notebook remains preview-only.

The schema, UI, detail projection, and simulation all treat
`user_investment_lots.amount` as a **bond quantity**: displayed nominal value
and portfolio simulation multiply it by 100 PLN. The word `amount`, however,
is also used for PLN monetary values in calculation requests and transaction
records. That makes a 50 ambiguous: 50 bonds, 50 PLN, or 5,000 PLN.

There is a second mismatch. `user_transactions` describes an event ledger, but
the normal `portfolioApplication.createLot` path stores only a lot. The
transactional create path exists separately and is not used by the normal
route. Imports likewise create lots without purchase transactions. Therefore a
reader cannot treat `user_transactions` as a complete historical ledger.

**Accepted direction**

The notebook is a **holding-record workspace**. Rename the domain property to
`bondQuantity`, derive nominal purchase value, and do not use
`user_transactions` for balance or audit claims. A future transaction ledger
would require a separately accepted model and migration; it is not an
incremental extension of a holding record.

### A3 — A recorded issued series is not carried into portfolio simulation

**Priority:** P0 for notebook projection correctness.

Holding lots store `bondSeriesId`, and create/update commands resolve that
identity. `buildPortfolioSimulationPayload()` then drops it. The
`PortfolioSimulationPayload` contains only `bondType`, amount, and purchase
date; `PortfolioSimulationHandler` uses the family definition directly rather
than the recorded series' terms. A historical holding can consequently be
projected using a generic/current offer instead of the offer actually bought.

This contradicts the distinction between an issued bond series and a bond
family. It is also a concrete example of A1: offer resolution occurs in some
handlers but not at the portfolio-calculation seam.

**Better seam**

Make `HoldingLot` reference `issuedSeriesId` (nullable only for explicitly
legacy/unresolved records). The portfolio simulation intent carries that
reference. The same catalogue resolver used by A1 resolves each holding to a
`ResolvedCalculation`; a missing historical series produces the accepted
visible `unresolved-offer` state rather than silently substituting current
terms.

Required proof: a portfolio containing a historical ROR/DOR or EDO lot must
produce the same result as a single calculation explicitly pinned to that
issued series. A missing series must never claim series-derived terms.

### A4 — Optimizer horizon reasoning verified

**Status:** Verified during implementation; no change required.

`OptimizerHandler` uses the project's `differenceInMonths(start, end)` helper,
whose interface is intentionally the opposite of the similarly named
`date-fns` function. Its existing `purchaseDate, withdrawalDate` call is
correct. The support-matrix regression now protects the positive five-year
ranking assumption. The earlier audit finding was withdrawn rather than
implemented as an incorrect operand swap.

### A5 — The retirement projection leaks clock time into a cached calculation

**Priority:** P1; keep the surface experimental until corrected.

`RetirementPlannerHandler` chooses `new Date()` as its purchase/start date,
although the request has no start date. The application cache key contains the
request and reference revisions, not the clock-derived date. Thus identical
requests can mean different projections on different days but reuse a cached
result within an unchanged cache context.

Add an explicit `projectionStartDate` to the calculation intent and expose it
in the resolved calculation/result. Tests should inject time and assert cache
identity changes when the declared as-of date changes. Do not silently make
this a full issued-bond simulation:
the current `steady-rate` depletion model is a different model and should keep
that explicit label.

### A6 — The scenario registry promises a kind that the application cannot calculate

**Priority:** P2 cleanup.

`ScenarioKind.MULTI_ASSET` exists in the enum but is absent from the request
union, validation schema, handler factory, envelope mapping, and calculation
routes. The multi-asset experience appears to use a separate historical-data
workflow. Keeping it in the calculation registry implies a supported engine
seam that does not exist.

Remove it from `ScenarioKind`. If its historical comparison workflow later
needs a formal contract, give it its own named intent and interface; do not add
a calculation handler merely to make the enum exhaustive.

### A7 — Historical domain documents describe a broader, incompatible model

**Priority:** P1 documentation-truth issue.

`technical/domain/05_financial_instrument_model.md` proposes a universal
instrument model and `technical/domain/07_calculation_scenarios.md` presents a
bond-versus-alternatives workflow as a core scenario. That conflicts with the
current `CONTEXT.md` and roadmap, which defer a long-term-instruments workspace
and treat cross-asset comparison as informational/conditional.

Mark these documents historical or rewrite them around the current context
map. The current glossary should be the vocabulary authority; technical
documents should link to it rather than define competing meanings.

## Non-findings and deliberate non-recommendations

- Do not impose one TSX file per React module. `OptimizerSections.tsx` has one
  feature-local caller and hides a private metric renderer; it is a coherent
  presentation slice. Split it only if an independently behaving presentation
  module or prepared model appears.
- Do not introduce `atoms/`, `molecules/`, or a global `types/` directory.
  These are location taxonomies, not domain seams. Keep stable contracts in
  the context that owns them and private types beside their implementation.
- Do not extract a generic financial-instrument package. Polish retail-bond
  rules, issued-series resolution, tax wrappers, and trust labels are exactly
  the application-specific knowledge that should remain local.
- Do not turn every database repository into a public port. A seam is earned
  when production and test adapters genuinely vary; pure resolver/engine tests
  can use local snapshot data without new indirection.

## Recommended execution sequence

1. Add A3's characterization test. If it fails as source inspection predicts,
   repair it together with the narrow issued-series resolver extraction.
2. Rename the portfolio domain property to `bondQuantity` through an explicit
   compatibility decoder; retain old storage names only during migration.
3. Use that decision to introduce A1's `CalculationIntent` and
   `ResolvedCalculation` first for single-bond and portfolio paths. Extend to
   comparison and recurring investment only after their equivalence tests pass.
4. Fix A5 before changing the retirement support class. Remove A6 and repair
   A7 in the same documentation-truth tranche.

For every migration, preserve saved payloads and share links through an
explicit compatibility decoder, test the old and new representations at the
same public interface, and remove legacy fields only after the decoder's
retirement date is documented.

# Obligacje Calculator

This context defines the product language for a trust-first Polish treasury-bond calculator and education product.

## Language

### Bond terms and calculation

**Bond family**:
The enduring statutory class of a Polish retail Treasury bond, identified by a
symbol such as EDO or ROR. It defines structural rules that apply across
issues, but not a particular month's offered rate.
_Avoid_: bond issue, current offer

**Issued bond series**:
One dated issuance of a bond family, with its own sale window, maturity, and
offer terms. A holding purchased in a series retains that series as historical
fact even after a newer offer becomes current.
_Avoid_: bond type, current bond definition

**Calculation intent**:
The user-supplied decision question: selected bond family or series, purchase
and withdrawal dates, contribution, and declared assumptions. It never
supplies issuer-controlled structural or offer terms.
_Avoid_: engine input, resolved calculation

**Resolved calculation**:
A calculation intent combined with the applicable issued-series terms, bond
family rules, tax rules, and data-provenance snapshot. It is the authoritative
input to a financial engine.
_Avoid_: form state, client payload

**Unresolved offer**:
A calculation or holding whose applicable issued-series terms cannot be
verified. Its result must show that limitation and must not be presented as
using current or historical offer terms.
_Avoid_: current-offer fallback, series-derived estimate

**Projection as-of date**:
The explicit date from which a time-dependent projection begins. It is part of
the projection's meaning and cache identity.
_Avoid_: implicit server today, execution time

### Portfolio records

**Holding lot**:
A user-recorded position in one issued bond series, defined by its bond
quantity, purchase date, and optional notes. Its nominal purchase value is
derived from quantity and that series' denomination.
_Avoid_: investment amount, transaction

**Portfolio transaction**:
An immutable financial event affecting a holding lot, such as purchase, sale,
interest payout, or tax withholding. A transaction record is not created by
merely storing a holding lot unless the command explicitly records that event.
_Avoid_: lot, current holding

**Committed calculation**:
The last successfully calculated scenario a user has explicitly accepted by submitting a calculation. It remains the decision reference while later input changes form a draft, until the user recalculates.
_Avoid_: live result, automatically refreshed result

**Shared scenario**:
A fully specified scenario opened from a share link. Opening it is an explicit calculation request because its inputs are already fixed by the shared snapshot.
_Avoid_: partially filled draft, implicit background recalculation

**Previous-offer reference**:
A committed calculation whose bond offer is no longer current. It remains visible as a decision reference, while the app marks it as previous-offer and requires explicit recalculation for a current-offer calculation.
_Avoid_: silently refreshed result, current-offer calculation

**Trusted-core release**:
The first production-style Cloud Run release, limited to product surfaces whose calculation behaviour, data transparency, and user-facing claims meet the project's release gates. It is a release scope, not a claim that every visible route is production-certified.
_Avoid_: full-platform launch, feature-complete release

**Release admission**:
The decision to include an individual product surface in the trusted-core release after it has passed its applicable evidence gates. Conditional surfaces are excluded until admitted.
_Avoid_: default inclusion, provisional shipping

**Pre-release visibility**:
The current availability of a route before the public launch decision. It does not grant release admission or establish the route as part of the public product promise.
_Avoid_: shipping status, production scope

**Exception-driven calculation assurance**:
The maintenance stance in which the existing calculation regression suite is the baseline, and new calculation work begins only from a concrete failing scenario, changed rule, or contradiction in release evidence.
_Avoid_: reopening broad calculation validation, speculative math work

**Private-preview operational readiness**:
The evidence-backed state in which the private Cloud Run preview can synchronize authoritative data, expose its source and freshness status, and pass its defined deployment and smoke checks. It is a pre-public-launch milestone.
_Avoid_: public launch readiness, feature completion

**Authenticated private preview**:
A private-preview state in which Google OAuth is configured and a signed-in user can exercise the workspace access path as part of operational evidence.
_Avoid_: anonymous-only preview, OAuth-optional readiness

**Private-preview sync cadence**:
The documented monthly operator run that refreshes active bond offers and macro data for the private preview. Automation is intentionally deferred until public-launch preparation.
_Avoid_: scheduled production sync, ad-hoc data refresh

**Private portfolio utility**:
The intended long-term posture of the application: a personally operated tool
and portfolio artifact, used by its maintainer and selected preview users, not
a product pursuing public launch or broad production admission. Work should
prioritize trusted personal decisions, current data, and demonstrable code
quality; public-launch operational controls remain deferred unless this posture
changes.
_Avoid_: production SaaS, public-launch candidate

**Investment strategy comparison**:
A decision workflow that contrasts explicitly stated long-term investment
strategies under the same contribution, horizon, tax, cost, and data-freshness
assumptions. It explains trade-offs and projected outcomes; it does not issue a
personalized buy, sell, or allocation instruction.
_Avoid_: return ranking, investment recommendation

**Cross-asset strategy comparison**:
An informative comparison of explicitly chosen bond, equity/index, and
cryptocurrency strategies over a stated horizon. It preserves each asset
class's distinct return basis, volatility, drawdown risk, fees, taxes, data
provenance, and limitations; an apparent winner is never presented as a
recommended allocation.
_Avoid_: apples-to-apples return table, portfolio advice

**Historical contribution replay**:
An informative reconstruction of what a fixed, recurring contribution—such as
100 PLN each week—would have bought and become worth over a selected completed
period. It reports historical outcomes under declared price, FX, fee, tax, and
reinvestment assumptions; it is not a forecast or an implied future return.
_Avoid_: expected return calculator, investment forecast

**Long-term instruments workspace**:
The future private workspace that may organize Polish treasury bonds, equities,
and cryptocurrencies into distinct research and strategy-comparison sections.
Each instrument class retains its own assumptions, risk language, data sources,
and evidence rather than being treated as interchangeable. It is deferred until
the Polish-bond strategy workflow is coherent and useful for the maintainer's
own decisions.
_Avoid_: generic trading dashboard, unified asset calculator

**Normal sync evidence**:
The private-preview readiness record produced by a successful monthly sync using the official `gov.pl` current-offer source, with the resulting source and freshness state visible in the app. Fallback sourcing is a separately tested degraded mode and does not establish normal readiness.
_Avoid_: fallback-only readiness, hidden fallback data

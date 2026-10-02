# 05. Desktop Visual and UX Audit

Audit date: 29 September 2026. Implementation status (1 October 2026): **V01–V15 completed locally**. This is a review of six user-supplied, full-page desktop screenshots in dark mode, cross-checked against the current UI components. The implementation follow-up includes browser checks in both themes and at narrow effective desktop widths, but is not a mobile, screen-reader, performance, or live financial-data certification.

## Evidence and reading rules

| Screenshot                        | Route / visible state                                       | Image size  |
| --------------------------------- | ----------------------------------------------------------- | ----------- |
| `11-15-28 Strona główna`          | Home, fallback-offer notice                                 | 1903 × 1878 |
| `11-15-45 Kalkulator pojedynczy`  | Single calculator, 12 saved scenarios, before calculation   | 1903 × 5619 |
| `11-15-53 Dane ekonomiczne`       | Economic data, CPI, 10-year readable scale, fallback series | 1903 × 1906 |
| `11-16-02 Edukacja`               | Education, no saved issue data, fallback offer              | 1903 × 4950 |
| `11-16-21 Porównanie`             | Comparison, independent EDO/ROR draft, before calculation   | 1903 × 2613 |
| `11-16-36 Regularne inwestowanie` | Recurring investment, EDO draft, before calculation         | 1903 × 3332 |

The full filenames are in the user-supplied `C:/Users/Asus/Desktop/desk` folder. Positions and states below refer to these captures, not all possible states. The small square/“Insight” controls at the bottom-left of some screenshots appear to be development or browser overlays; they are excluded from application findings. A screenshot cannot prove keyboard behavior, actual contrast ratio, responsiveness, or whether a button works. Where a finding implies such behavior, its acceptance criteria require a real browser check.

The product's existing [quiet instrument-panel direction](./01_ui_design_direction.md), [UI rules](./02_ui_rules.md), and [financial workflow accessibility contract](./04_accessibility_financial_workflow_contract.md) remain constraints. The goal is better hierarchy and task flow, **not** a new visual identity. The [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md) and the local UI/UX guidance informed the review; the concrete evidence is the screenshots and source locations below.

Priority means user impact and risk, not development order alone: **P1** blocks or materially delays the primary task or obscures financial meaning; **P2** creates repeated comprehension or scanning friction; **P3** is consistency/polish. Findings are **Open** unless a completion note says otherwise. The audit itself made no UI changes; implementation evidence is recorded below.

## Overall assessment

The app has a coherent, restrained dark palette, clear page titles, persistent route navigation, visible provenance, explicit calculation rather than silent recomputation, and useful progressive-disclosure primitives. Its main weakness is hierarchy, not styling: preparatory copy and secondary tools repeatedly occupy the space where users expect the primary decision. A second pattern is that similar information is presented more than once (amount plus slider value, ready-state instructions, fallback explanations), while some consequential context (whether a rate is verified, what a clipped chart omits, what an override changes) remains visually quiet.

### P1 — primary workflow and trustworthy interpretation

#### V01 — Saved scenarios bury the single-calculator form

- **Evidence:** In `Kalkulator pojedynczy`, the 12/12 saved-scenario list occupies roughly the first third of a 5619px page; the actual “Symulacja Inwestycji” form begins only after the list. Most rows have the same name and payout, so users cannot quickly distinguish them.
- **Code:** `features/single-calculator/components/BondCalculatorContainer.tsx:160-163`; `features/single-calculator/components/SavedScenarioLibrary.tsx:89-173`, `:188-223`.
- **Impact:** Returning users must scroll through a library before the primary task; new users with populated storage may mistake the library for the calculator. Five icon actions per row add visual density.
- **Change:** Keep the draft status near the header, move the saved library below the calculator or into a clearly labeled disclosure/drawer. Show a compact count and the most recent 2–3 distinct scenarios, with “View all” and an explicit restore action. Preserve search/import/export and storage behavior.
- **Done when:** With 12 saved scenarios at 1903px and 1366px widths, the first core form field appears in the initial viewport (or immediately after the page header); the full library remains discoverable and keyboard-operable; duplicate-looking scenarios show distinguishing metadata.
- **Status — Completed (29 September 2026):** The library sits below the calculator workspace, with a keyboard-focusable destination linked near the draft status. It shows a two-scenario preview, count, metadata (position, bond, amount, horizon, update time), and an explicit Restore action; the full searchable/importable library opens on demand. A component test covers all 12 records, keyboard expansion, and dirty-draft confirmation. A browser regression seeds 12 identical-looking scenarios, verifies that the first setup control remains in the initial viewport at both 1903×900 and 1366×768, then checks shortcut focus, keyboard expansion, the full list, and absence of horizontal overflow.

#### V02 — Floating Calculate dock obscures content and competes with in-flow actions

- **Evidence:** The dock overlays saved-scenario rows in `Kalkulator pojedynczy`, scenario B in `Porównanie`, and account/contribution controls in `Regularne inwestowanie`. Comparison also shows an in-flow “Oblicz” button and a note instructing use of the dock.
- **Code:** `shared/components/feedback/RecalculateButton.tsx:39-86`; `features/comparison-engine/components/ComparisonContainerPanels.tsx:67-82`; `app/globals.css:633-636`.
- **Impact:** Fixed content hides information and creates two apparent primary actions with unclear precedence. This is observable at a wide desktop viewport, so it is not only a mobile safe-area problem.
- **Change:** Choose one primary calculate action per state. At desktop, prefer a non-overlapping sticky action in a reserved rail/column, or a compact bottom bar with explicit content clearance; keep an in-flow action near the final required input. Avoid floating over active fields or scenario cards. The status dot should not use success green for “ready to calculate.”
- **Done when:** No visible/focused control is obscured at 1366px and 1903px desktop widths, browser zoom 200%, and representative scroll positions; there is one clearly dominant Calculate action; focus and scroll-to-error remain visible.
- **Status — Completed for the three audited routes (1 October 2026):** Single and recurring calculation actions now sit in the form flow on desktop; comparison has one desktop in-flow action after its assumptions, while its separate dock is mobile-only. The misleading green “ready” dot and a redundant hidden single-form submit control were removed. Comparison guidance no longer points to a nonexistent fixed desktop control. Chromium regression checks at 1903px, 1366px, and a 683px effective CSS viewport verify one accessible primary action, no fixed desktop dock or horizontal overflow, and that a focused setup control stays unobscured at the viewport edge. A separate headless Firefox run with browser-level 200% pixel scaling turns a 1366×768 window into a 683px CSS viewport and checks the same three actions/focus targets at the resulting shorter viewport. A 390px mobile check confirms the existing fixed action remains. Each audited route still calculated successfully. The shared component retains its original floating default for other, unaudited routes.

#### V03 — Comparison can be run before its shared assumptions are seen

- **Evidence:** In `Porównanie`, the shared base and A/B cards are followed by a fairness panel with “Oblicz”, then a second ready-state explainer. The CPI/NBP/tax assumption controls appear _below_ those areas, after a long scroll.
- **Code:** `features/comparison-engine/components/ComparisonPlanWorkspace.tsx:60-114`; `features/comparison-engine/components/ComparisonContainerPanels.tsx:49-117`; `features/comparison-engine/components/ComparisonSharedBaseCard.tsx:47-75`.
- **Impact:** Users may accept consequential defaults without noticing them; the page feels like several separate workflows rather than one shared-base → scenarios → assumptions → result sequence.
- **Change:** Put a compact, readable assumptions receipt next to or above Calculate, linking to the full controls. Keep the advanced CPI/NBP controls disclosed if appropriate, but show the active numeric values, source/freshness, and tax policy before the run. Collapse the repeated ready-state instructions to one short next-step cue.
- **Done when:** Before calculation, a user can identify the selected bond families, common amount/horizon, rollover policy, CPI/NBP assumptions, and tax wrapper without scrolling past a Calculate action; one deliberate run yields an unambiguous result state.
- **Status — Completed (29 September 2026):** The detailed controls remain before Calculate, and a compact receipt immediately above the action now names both bond families, shared amount/horizon, maturity and coupon policies, active CPI/NBP assumptions, and tax wrapper. A/B overrides appear where present. Reference-default provenance and CPI/NBP as-of dates are identified separately from the scenario's active values, with a link back to the controls. The repeated ready-state explainer was removed. Unit tests cover default and overridden drafts; a Chromium journey verifies the receipt precedes Calculate and one run yields a committed result.

#### V04 — CPI chart intentionally clips the peak but visually reads like a broken series

- **Evidence:** `Dane ekonomiczne` shows the blue line leaving the top of the plotting area for a large interval. A warning says the visible historical peak exceeds 14.4%, but the missing segment is not marked on the plot; “Czytelna skala” is selected.
- **Code:** `features/economic-data/components/InflationChart.tsx:51-55`, `:71-93`, `:98-105`; `features/economic-data/components/EconomicDashboardSections.tsx:125-145`.
- **Impact:** A deliberate readable-scale decision can be interpreted as missing data or an inaccurate graph. In a financial reference view, the outlier should remain legible as an outlier even when its exact height is suppressed.
- **Change:** Add a conspicuous in-chart break/overflow marker at clipped spans, show the true peak value and date beside the chart, and make “Full scale” the obvious recovery action from the warning. Alternatively default to full scale and offer a zoomed readable view. Do not silently alter the underlying data.
- **Done when:** At least one non-tooltip cue on the plot identifies clipping; the true peak and date are visible; full-scale mode renders the entire series; chart/table access to exact values remains intact.
- **Status — Completed (29 September 2026):** Readable mode now plots capped values with visible boundary markers while keeping the raw rates intact for tooltips. The true peak and month are shown beside the chart, and the clipping notice has a direct Full scale action. Full scale restores the uncapped plot; sampling retains the true peak. Model and tooltip tests protect exact-value behavior, and a Chromium journey verifies the marker, peak, scale switch, and narrow viewport.

#### V05 — Fallback/offer freshness is present but the next safe action is weak

- **Evidence:** Home and `Edukacja` show “Zapasowy zestaw danych” and an August 21 last-checked date, while nearby bond cards show precise rates and terms. `Dane ekonomiczne` also uses fallback CPI. The caveats are small relative to the numerical content.
- **Code:** `shared/components/data/OfferProvenance.tsx` (home and education); `shared/components/charts/ReferenceChartFrame.tsx:39-95`; `features/education/components/BondEducationCard.tsx:49-101`.
- **Impact:** Readers may remember the rates but not their provenance. This is a visual trust issue, not a claim that the rates are currently wrong; live offer freshness was not verified in this audit.
- **Change:** Create one compact provenance treatment beside each decision-relevant rate/offer group: “verified/current” versus “fallback/reference,” as-of date, and a direct verification action. Keep the global warning, but do not rely on it alone when rates are far below the fold. Distinguish a generic family definition from a confirmed issued series.
- **Done when:** Each rate-bearing offer section exposes source class and as-of date at the point of use; fallback figures cannot be mistaken visually for issuer-confirmed current terms; wording and colors are consistent across home, education, and economic data.
- **Status — Completed (1 October 2026):** Home and each Education card show source class, last offer-check attempt when available, and a direct official-offer link; CPI/NBP charts retain their separate source/as-of metadata and verification link. The bond-definition boundary carries opening-rate provenance: an active issued series has its sale-window start and series code, a usable database reference has its record date, and curated/static fallback is dated to the start of the September 2026 sale window. Every curated opening rate and margin matches the [Ministry of Finance's dated September retail-offer table](https://www.gov.pl/web/finanse/podaz-skarbowych-papierow-wartosciowych-we-wrzesniu-2026); the card links directly to that historical source and still says it is **not a confirmed current offer**. A historical as-of date earlier than September does not inherit this future provenance. The global CPI/NBP `coverageAsOf` is never reused as an offer-rate date. Expired/invalid series and future-dated or invalid database rates cannot be labeled current issued terms. Unit and Chromium tests cover the source/date distinction. This dated fallback is historical reference evidence, not live October offer certification; verify the issuer before relying on a rate.

#### V06 — Recurring-contribution schedule exposes ambiguous edit controls

- **Evidence:** In `Regularne inwestowanie`, the one-off date/amount row appears as `mm/dd/yyyy` plus an unlabeled-looking amount field beside three actions (“Dodaj dopłatę”, “Pomiń bazę”, “Zastąp bazę”), while the page is otherwise Polish. The preview below uses raw ISO dates and unformatted amounts.
- **Code:** `features/regular-investment/components/inputs/ContributionPlanSection.tsx:140-185`, `:186-270`.
- **Impact:** It is not immediately clear which actions use the date alone, which use both inputs, or how “skip” differs from “replace.” The date format mismatch raises entry-error risk. The inputs do have ARIA labels in code, so this is a _visible-label and comprehension_ issue, not a claim of missing accessible names.
- **Change:** Give date and amount persistent visible labels and units, separate the three mutations into distinct controls or a selected operation with contextual help, show inline validation, and localize the visible preview dates/numbers. If retaining the native date input, add a visible Polish date-format hint because its placeholder follows the browser locale.
- **Done when:** A Polish desktop user can state what each action will do before clicking; date and amount labels remain visible when populated; preview dates and PLN amounts use the selected locale; invalid/missing values get adjacent guidance.
- **Status — Completed (29 September 2026):** Date and PLN amount have persistent visible labels; a Polish date-format hint clarifies the browser-controlled native field. Each action now has its own explanation and the required-input rule is enforced with adjacent errors. Skip needs only a date; add needs a positive amount; replace accepts zero but requires an explicit amount. Edited entries and the schedule preview use locale-formatted dates and PLN. Component tests cover semantics and validation; a Polish Chromium journey covers labels, errors, mutations, and localized preview.

### P2 — scanning, density, and information architecture

#### V07 — Homepage repeats the same destination without a clear handoff

- **Evidence:** `Strona główna` offers “Zasymuluj obligację”, a default “Otwórz kalkulator” in the right decision slip, and a large “Kalkulator pojedynczy” card below, all leading to the same task. The hero and first card are separated by a substantial empty band.
- **Code:** `features/home/components/LandingDashboardClient.tsx:50-104`; `features/home/components/HomeDecisionSlip.tsx:17-75`; `features/home/components/HomeRouteSections.tsx:14-50`.
- **Impact:** The landing page uses valuable first-screen space to repeat navigation rather than clarify the choice. The decision slip initially confirms an option without the user taking an action.
- **Change:** Keep one dominant calculator CTA. Recast the slip as a genuine branching aid for uncertain visitors (e.g. question → route, with each destination different), or remove its default selected/result block. Tighten the hero-to-first-task spacing while retaining a calm editorial feel.
- **Done when:** The first viewport has one unambiguous primary action and no second prominent CTA to the same route; the decision aid adds a distinct choice; the calculator entry is visible without a long blank interval.
- **Status — Completed (29 September 2026):** The hero is the only in-content calculator entry. The duplicate large calculator card and preselected decision result are gone; the compact decision aid now links directly to the two distinct education and economic-context routes. The hero-to-supporting-task spacing is shorter. Chromium checks at 1366px and 1903px confirm one calculator link in main content, a visible first-viewport action, distinct decision destinations, and no horizontal overflow. Existing desktop and mobile Home journeys pass.

#### V08 — Recurring plan repeats quantity and amount before revealing the schedule

- **Evidence:** The recurring form shows a bond-count heading, PLN equivalent, numeric quantity input, another quantity slider/readout, then a second heading for quantity. The schedule is rendered as a dense raw table inside the same setup region.
- **Code:** `features/regular-investment/components/inputs/ContributionPlanSection.tsx:90-140`, `:252-270`; `features/regular-investment/components/RegularInvestmentInputsForm.tsx:120-135`.
- **Impact:** Users must parse multiple representations of one value and detailed schedule data while trying to answer the simpler question: “How much, how often, for how long?”
- **Change:** Present a single primary editable quantity/PLN pair and an optional fine-tune slider. Move advanced top-ups and the full schedule behind a disclosure; show a concise plan summary (monthly contribution, projected count, first/last date) in the default state.
- **Done when:** Default view contains one clearly editable contribution value, one equivalent value, frequency and horizon; the schedule is accessible on demand; editing either precision input or slider stays synchronized.
- **Status — Completed (29 September 2026):** The default form shows one editable bond quantity, its live PLN equivalent, frequency, and a plan summary with horizon, scheduled cash-flow count, and first/last dates. The summary deliberately says “per contribution” rather than “monthly” because the plan also supports quarterly and yearly cadence. The fine-tune slider is optional; advanced mutations and the full locale-formatted schedule are in a keyboard-accessible disclosure, with the full table rendered only when opened. The slider now has a meaningful accessible name. Unit tests cover the quantity/PLN pair and schedule controls; a Chromium journey checks quantity-to-slider and slider-to-quantity synchronization, the full schedule, and no horizontal overflow. The prior V06 schedule-edit journey still passes.

#### V09 — Comparison has too many competing explanatory layers

- **Evidence:** A top notice, page subtitle, shared-base explanatory paragraphs, A/B card descriptions, fairness panel, ready-state section, and another assumptions introduction appear before results in `Porównanie`.
- **Code:** `features/comparison-engine/components/ComparisonPlanWorkspace.tsx:60-114`; `features/comparison-engine/components/ComparisonSharedBaseCard.tsx:47-55`; `features/comparison-engine/components/ComparisonContainerPanels.tsx:49-117`.
- **Impact:** Guidance is valuable but repeated at equal visual weight; this makes the actionable fields harder to locate and the three-column form more intimidating.
- **Change:** Establish one sentence per step, then reveal detailed rationale via contextual help. Put common base and A/B choices into a clear sequence with a short summary strip; reduce nested borders and repeated prose. Preserve the financial fairness explanation near the result where it matters.
- **Done when:** A first-time user can scan the setup order in under one viewport at 1903px width; each explanatory sentence has a distinct purpose; the result remains accompanied by the fairness caveat.
- **Status — Completed (30 September 2026):** A three-step shared-base → scenarios → assumptions strip is visible in the first 1903px viewport. Repeated base/scenario descriptions and the pre-run fairness panel were reduced to one run cue; the detailed fairness caveat now sits with the committed verdict. Chromium verifies the strip, one run, and result caveat.

#### V10 — Education page is a long catalog with weak within-page wayfinding

- **Evidence:** `Edukacja` runs almost 5000px: starting-point cards, current-offer warning, issue explorer, four bond-family groups, concepts, then FAQ. The four top cards only jump to broad groups; they do not summarize the trade-off or show current availability.
- **Code:** `features/education/components/EducationClient.tsx:87-161`, `:163-225`; `features/education/components/EducationDecisionRail.tsx:14-51`.
- **Impact:** Readers can enter a topic but have little persistent orientation or short path back to comparing options. The empty issue-data state increases the amount of generic catalog copy before the user reaches a concrete next step.
- **Change:** Add a compact section index/jump rail for desktop and a “back to choices” link after each family. Make the starting cards explain horizon, liquidity, inflation exposure, and eligibility in ordinary language; treat product codes as secondary. Let users compare selected families without traversing the full catalog.
- **Done when:** From any bond family, the user can reach the choice summary or comparison in one action; the four decision cards communicate trade-offs without relying on tooltips or code acronyms; empty issue-data state still leads to a useful next step.
- **Status — Completed (30 September 2026):** The decision cards show horizon, inflation exposure, exit costs, eligibility, and stored-sale-window availability in visible copy, with explicit issuer verification for stale/unknown status. A compact section index links to each family and the comparison table. Every family has one-action links back to choices and into comparison; an empty issue explorer links back to choices. Chromium covers the card trade-offs, index, family exits, and empty-data path.

#### V11 — Small text carries important meaning, not just metadata

- **Evidence:** Screenshots use 11–12px text for scenario descriptions, provenance, warning support, form constraints, comparison notes, and chart axes. On the 1903px captures these are materially harder to scan than body copy.
- **Code:** `app/globals.css:263-292`, `:339-343`; `features/home/components/HomeDecisionSlip.tsx:41-65`; `features/single-calculator/components/SavedScenarioLibrary.tsx:190-192`; `shared/components/charts/ReferenceChartFrame.tsx:44-85`.
- **Impact:** The shared design rules already require 16px for financial explanations and allow 12px only for compact metadata. Several pieces of decision guidance look like metadata. No contrast-failure claim is made without measurement.
- **Change:** Audit each use of `text-xs`/`ui-kicker`: keep timestamps and terse labels small, but promote actionable instructions, warnings, assumptions, and scenario distinctions to 14–16px with adequate line-height. Check contrast in both themes before changing token colors.
- **Done when:** Core input guidance and financial caveats meet the repo's 16px rule or have a documented exception; automated contrast checks and 200% zoom review pass for both themes.
- **Status — Completed (1 October 2026):** Field guidance/errors, decision-aid descriptions, saved-scenario distinctions, offer caveats, the comparison cash-policy note, chart fallback explanations, education rate rows and early-exit warnings, and the comparison assumptions receipt use 16px body text. Terse labels, timestamps, tags, formulas, and chart ticks remain compact metadata; chart ticks now use the semantic muted-text token instead of Recharts' default dark-theme gray. Chromium measures muted and chart-axis text contrast in both themes and checks 16px guidance in the affected routes. Firefox browser-level 200% scaling checks the education rate/warning text and no horizontal overflow in both themes.

#### V12 — Sidebar truncates a primary route label

- **Evidence:** The desktop sidebar displays “Regularne inwestow...” in multiple screenshots despite unused space elsewhere in the page.
- **Code:** `app/globals.css:116`; `shared/components/chrome/SidebarNavigation.tsx:80-110`.
- **Impact:** A primary route is not fully named in persistent navigation. The arrow and icon consume width while the 15rem sidebar forces `truncate`.
- **Change:** Prefer a slightly wider sidebar or two-line label for long translated names; do not rely solely on hover tooltips. Re-test Polish and English strings at standard and 200% zoom.
- **Done when:** Every primary route name is legible without hover at the audited width and 200% zoom, with active state and content width still usable.
- **Status — Completed (1 October 2026):** Route names wrap instead of truncating. Chromium checks the full Polish “Regularne inwestowanie” label without overflow in the 1366px desktop sidebar and in the navigation sheet at 683px effective width; active state remains visible. The Firefox 200% browser-scaling check also verifies the complete Polish label in the navigation sheet.

#### V13 — Economic chart toolbar is a single dense control strip

- **Evidence:** In `Dane ekonomiczne`, CPI/NBP, data range, five range choices, scale mode, and an info icon share one horizontal band; the selected states are clear but the grouping is weak.
- **Code:** `features/economic-data/components/EconomicDataPageClient.tsx:124-143`; `features/economic-data/components/EconomicDashboardSections.tsx:74-147`.
- **Impact:** Users can mistake scale mode for another date range or overlook that it applies only to CPI. This is particularly relevant given the clipping in V04.
- **Change:** Group as “Series,” “Period,” and “Scale” with visible labels; place scale beside the chart title/warning or on a second line when necessary. Preserve URL-backed view state.
- **Done when:** Each control group has a visible label and one selected state; scale's CPI-only scope is evident; no group overlaps or becomes horizontally cramped at 1366px desktop width.
- **Status — Completed (30 September 2026):** Series, period, and CPI-only scale have distinct visible labels and grouped controls. Scale shows “Only for CPI” on NBP, while responsive wrapping prevents overlap. Chromium checks grouping, 1366px and 683px layouts, and preservation of series/range/scale URL state when switching controls.

### P3 — polish and consistency

#### V14 — Saved-scenario actions depend on a row of unlabeled icons

- **Evidence:** Each library row in `Kalkulator pojedynczy` ends with restore, edit, duplicate, export, and delete icons of equal visual weight.
- **Code:** `features/single-calculator/components/SavedScenarioLibrary.tsx:188-223` (and the following delete action). Accessible `aria-label`s are already present; this finding is about visual discoverability and prioritization.
- **Change:** Make “Restore” a text action; put secondary actions in an overflow menu or reveal them on row selection, while keeping keyboard access and confirmation for destructive actions.
- **Done when:** The primary row action is identifiable without hover, keyboard users can reach all actions, and delete still requires its existing confirmation.
- **Status — Completed (30 September 2026):** Restore is a visible text button; edit, duplicate, export, and delete are text actions in a keyboard-operable “More actions” disclosure. The prior row deletion was immediate despite the finding's “existing confirmation” premise; this implementation adds an explicit inline confirmation and cancel path. Unit and Chromium tests cover disclosure and the non-destructive cancel path.

#### V15 — Dark-only visual density should be checked against the documented light-first system

- **Evidence:** All supplied captures are dark. The screenshots show strong route consistency, but multiple dark panels differ by only small luminance steps, while input/report areas rely heavily on dividers. The current design-direction document describes a paper-like light canvas; the dark treatment may be an intentional user preference.
- **Code:** `app/globals.css:74-179`, `:345-355`; `docs/ui/01_ui_design_direction.md`.
- **Change:** Keep dark mode, but test a side-by-side light/dark set of the same states. Refine only the semantic token and surface hierarchy that fails to distinguish controls, grouped assumptions, and results; avoid one-off colors or decorative shadows.
- **Done when:** Each page has a clear three-level hierarchy (page, working surface, result/notice) in both themes, verified in paired screenshots; token changes are centralized and do not change the financial color meanings.
- **Status — Completed (30 September 2026):** A Chromium capture test generates paired full-page light/dark images of the same pre-calculation states on all six audited routes at 1366×768 and 1903×900. Visual review found the page/working-surface/notice hierarchy legible in both themes, so no decorative one-off surface colors were added. The only theme refinement was the centralized semantic chart-axis text color. Muted body and chart-axis contrast are measured in both themes; no financial status-color meanings changed.

## Recommended implementation sequence

1. **Unblock the tasks:** V01, V02, V03, V06. These are local component/workflow changes with the biggest immediate usability effect.
2. **Protect interpretation:** V04, V05. Chart clipping and fallback provenance need stronger cues before visual polish.
3. **Reduce repetition:** V07–V10, V14. Consolidate duplicated guidance and move optional detail behind intentional disclosure.
4. **System pass:** V11–V13, V15. Apply typography, navigation, toolbar, and theme adjustments across the affected routes rather than one-off fixes.

## Verification record and scope

- The six user-supplied 1903px dark full-page captures are the before evidence. `tests/browser/visual-audit-v09-v15.spec.ts` generates paired current light/dark full-page screenshots at 1366×768 and 1903×900 in Playwright test artifacts. The current six-route pairs were visually reviewed. V01 separately seeds twelve scenarios at both widths; V03 checks a committed comparison; V04 checks readable and full CPI scales.
- Chromium route journeys cover the 683px effective CSS viewport (the reflow equivalent of 1366px at 200% zoom), Polish and English copy, keyboard-reachable disclosures, unobscured focus, localized dates, no horizontal overflow, and exact chart values via tooltip. A separate Firefox browser-level 200% pixel-scaling run covers the three audited actions, navigation label, and education text in both themes at the physically smaller viewport. It does not exercise the browser's zoom-menu control; this is not a screen-reader, comprehensive mobile, or performance certification.
- The product boundaries remain: explicit calculate/commit state, qualified financial sources, warning semantics, and answer → summary → evidence ordering. Visual acceptance is not validation of live bond rates or calculation results.
- **1 October 2026 close-out:** The dated V05 fallback source was verified against the Ministry's September 2026 offer table; the static values remain labeled historical reference, not a current-offer sync. The V11 education rates, early-exit/source caveats, and comparison receipt were promoted to body text. Focused audit unit tests (27), all 18 Chromium audit journeys, the Firefox 200% browser-scaling journey, the full Vitest suite (1,266 passed; 13 skipped), typecheck, lint, formatting, and a production Webpack build passed. The 683px reflow and Firefox scaling runs are not a claim of using a browser's zoom-menu control.

## Close-out rule

An item moves from **Open** to **Completed** only after its stated “Done when” checks and route-specific browser evidence pass. If implementation rejects a recommendation for product reasons, record the alternative and evidence here rather than silently marking it done.

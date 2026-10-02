# Rendering and Performance Contract

## Public route boundary

- Public education and landing pages are eligible for cache/revalidation.
- Authenticated workspace pages are private and no-store.
- Request-specific cookies must not make unrelated public routes dynamic.
- CSP remains at least as strict when a route becomes cacheable.
- Metadata uses canonical configured URLs.
- Preview pages retain noindex behavior.

## Provider placement

- Keep locale and theme presentation providers at the shared shell boundary.
- Put chart synchronization below the first chart consumer.
- Put calculator definitions below calculator routes.
- Do not hydrate portfolio state for an education page.
- Do not hydrate PDF export code before export intent.
- Do not hydrate chart controls before chart interaction is possible.

## Data loading

- Start independent server reads in parallel.
- Fetch only serializable values needed by the client island.
- Keep large raw datasets server-side until an interaction needs them.
- Use a focused route adapter rather than a root-wide client fetch.
- Avoid request-scoped module mutation.
- Record context acquisition latency without user payloads.

## Bundle rules

- Use direct imports instead of broad barrels for heavy dependencies.
- `radix-ui` is the reviewed, tree-shakeable primitive facade; do not add a
  second Radix package family without a measured bundle reason.
- Dynamically import charts below the initial input/result viewport.
- Dynamically import PDF generation after an export click.
- Keep one icon system unless a documented semantic gap requires another.
- Remove unused exports before introducing a duplicate helper.
- Capture per-route bundle report artifacts in CI.

`pnpm analyze:bundles` reads the completed Next build manifest and writes
`artifacts/route-bundle-report.json`. It is a deterministic ownership inventory
(emitted, uncompressed bytes); Lighthouse remains the source of transfer and
user-facing performance budgets.

## Font and asset rules

- Load one primary variable sans family globally.
- Load monospace only at a code or tabular consumer boundary.
- Verify Polish glyph coverage before removing a font.
- Give every content image dimensions or a fixed aspect ratio.
- Prioritize only the true LCP image.
- Never lazy-load above-the-fold LCP media.
- Keep social-preview asset validation separate from page budgets.

## Interaction rules

- Use transitions for non-urgent heavy result updates.
- Preserve current committed results during recalculation.
- Defer detail tables rather than delaying the result verdict.
- Profile before adding memoization.
- Do not virtualize small financial tables.
- Use content visibility only for long, non-critical result sections.

## Verification

- Build asserts public/private route cache policy.
- CSP/header tests run with each rendering change.
- Bundle report compares critical route JS.
- Three Lighthouse runs establish a median route budget.
- `pnpm test:lighthouse` enforces per-route median regression ceilings from
  `scripts/check-lighthouse-route-budgets.ts`; the 2.5-second LCP warning
  remains the desired user-experience target, not a claim that these initial
  regression ceilings meet it.
- The summary reads only reports listed in the latest Lighthouse manifest,
  never older local artifacts left in `.lighthouseci`.
- Web Vitals test fails when required LCP is absent.
- Browser diagnostics retain failed request and console evidence.
- Repeat navigation checks bfcache eligibility where supported.

## External evidence

- Cloud Run cold-start and concurrency measurements.
- Privacy-safe field LCP, INP, and CLS aggregates.
- Production route cache header observation.
- Load-test saturation and database connection evidence.

No repository-only change can substitute for these external measurements.

## 1 October 2026 local baseline and first-paint tranche

Three mobile Lighthouse runs per route on production builds, before and after
server-seeding current bond definitions for the single, comparison, regular,
and education setup routes, produced these median LCP values. These are local lab results,
not field Core Web Vitals or deployed-preview evidence.

| Route                 |   Before |    After |
| --------------------- | -------: | -------: |
| `/`                   | 2,865 ms | 2,660 ms |
| `/education`          | 4,669 ms | 3,266 ms |
| `/single-calculator`  | 4,907 ms | 3,574 ms |
| `/economic-data`      | 3,257 ms | 3,374 ms |
| `/compare`            | 3,712 ms | 3,808 ms |
| `/regular-investment` | 4,862 ms | 3,279 ms |

The calculator and education routes now paint setup from a request-scoped server offer snapshot
while SWR revalidates on the client. No static September reference is silently
promoted to a current offer. The economic-data and comparison changes are within
lab variation; they were not optimization targets in this tranche. Initial median ceilings
have headroom for runner variance and are not release-admission targets. The
2.5-second target and deployed field evidence remain open.

## Budget ownership

| Route class     | Primary budget                              | Owner              |
| --------------- | ------------------------------------------- | ------------------ |
| Landing         | LCP and initial JS                          | public-shell owner |
| Calculator      | input responsiveness and chart deferral     | calculator owner   |
| Data dashboard  | main-thread work and request count          | data-feature owner |
| Workspace       | private cache boundary and mutation latency | portfolio owner    |
| Shared scenario | safe metadata and public payload size       | sharing owner      |

When a budget regresses, capture the before/after report, identify the loading
boundary that changed, and either restore the budget or record a reviewed
exception. A performance exception cannot weaken CSP, private caching, input
validation, or the data freshness display. The owner of a new dependency is
also responsible for its route impact and removal when superseded.

## Review checklist

- Is the dependency loaded only after a real consumer needs it?
- Is an independent fetch accidentally serialized behind another fetch?
- Does a client component receive data it never renders?
- Does a fallback preserve usable committed financial output?
- Does a new image have a concrete size and LCP decision?
- Does the change preserve localized metadata and canonical URLs?
- Does the change preserve reduced motion and keyboard operation?

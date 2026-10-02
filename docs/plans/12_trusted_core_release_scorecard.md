# Trusted-Core Release Scorecard

## Scope

The trusted core is limited to education, the single-bond calculator, and
economic reference data. It excludes private-preview calculators and does not
claim that a deployed environment has been independently verified.

## Admission checks

| Area              | Required repository evidence                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| Calculation truth | Supported bond definitions and golden scenarios pass.                                              |
| Input recovery    | Invalid persisted drafts are rejected and valid drafts remain compatible with current definitions. |
| Data honesty      | Source, coverage, as-of, fallback, and degraded states are visible.                                |
| Education         | Every supported bond appears once in an offer group and links to its calculator journey.           |
| Accessibility     | Trusted routes retain semantic landmarks, keyboard controls, and mobile overflow protection.       |
| Performance       | Production bundle and Lighthouse gates pass their committed budgets.                               |

## Command

`pnpm test:trusted-core` is the focused repository gate. `pnpm
test:trusted-core:browser` runs the Chromium desktop and mobile journeys.
A release still requires the broader `pnpm check:release` and externally
recorded deployment evidence before any production-readiness claim.

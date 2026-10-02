# Developer Architecture Guide

Use this document as the entrypoint for a new feature or a cross-cutting refactor. It summarizes the repository's architecture; the linked documents remain the authoritative detail.

## Start a feature in the owning layer

```text
app/                         route and page composition only
features/<capability>/       product workflow, feature UI, feature-local pure models
shared/                      proven cross-feature browser/UI modules
lib/server/<capability>/     server application commands, queries, errors, HTTP policy
lib/data/                    database/provider adapters and disclosed fallback read models
db/                          schema, migrations, seed data
tests/                       behavior, route contracts, browser and accessibility evidence
```

Create a feature under `features/<capability>` when it owns a user journey or business vocabulary. Keep its render components in `components`, stateful user-journey controllers in `hooks`, and pure normalization/projection/view-model code in `lib`.

Promote code to `shared` only after two independent consumers demonstrate the same invariant. Do not create a generic abstraction because two files merely look similar.

## Dependency rules

- `app/` composes pages and routes; it does not own financial truth or browser transport logic.
- Feature UI calls browser gateways in `shared/lib`; it never calls portfolio or calculation endpoints with raw `fetch`.
- API routes decode untrusted input, resolve policy/ownership, delegate to a command/query/application module, and return through `lib/server/http/responses`.
- `shared` UI and `features` must not import `db` or `lib/server`. Only server/data modules cross persistence or provider seams.
- A pure projector accepts the time, randomness, and source data that affect its decision. It returns a value and performs no I/O.

## Standard seams

| Need                 | Use                                                                                                |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| Browser JSON request | `shared/lib/api-client.ts` and an explicit envelope/raw decoder                                    |
| Calculation request  | `shared/lib/calculation-client.ts` or calculation worker                                           |
| API policy           | `apiHandler` plus a narrow capability helper such as `withPortfolioRead` or `withPortfolioCommand` |
| User journey         | A feature controller hook with domain-named actions                                                |
| Server mutation/read | Capability-local command/query modules                                                             |
| Data shaping         | Feature-local or data-local pure projection                                                        |
| User-facing text     | `useAppI18n`, `next-intl/server`, or `translateMessage` at the appropriate runtime                 |

## Definition of done

1. Add or change behavior at its owning seam, not at every caller.
2. Add behavioral coverage at that seam; reserve source-reading tests for architectural policy.
3. Run focused tests, `pnpm check:types`, `pnpm lint`, and formatting checks.
4. Update the relevant architecture or product document when ownership or an interface changes.

See [System Architecture](./19_system_architecture.md), [Engineering and Coding Rules](./26_engineering_and_coding_rules.md), [HTTP Boundary Contract](./33_http_boundary_contract.md), and the [Modularity Refactoring Audit](./34_modularity_refactoring_audit.md) for the rationale and concrete examples.

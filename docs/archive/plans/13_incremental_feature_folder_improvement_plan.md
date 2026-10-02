# 13. Incremental Feature Folder Improvement Plan

## Goal

Improve browsing and search in the existing architecture without changing the
layer model, URLs, public interfaces, or feature ownership. This is a local
organization plan, not a repository remake.

## Status

| Item | Status   | Evidence                                                                                                     |
| ---- | -------- | ------------------------------------------------------------------------------------------------------------ |
| F01  | Complete | Project map states the subfeature rule; architecture contract protects the notebook and timeline entries.    |
| F02  | Complete | Portfolio detail entry and all detail renderers live in `components/portfolio-details/`.                     |
| F03  | Complete | Timeline renderers live in `components/timeline/`; the stable type interface remains in `types/timeline.ts`. |
| F04  | Complete | Existing comparison-table grouping already satisfies the rule; no cosmetic move was needed.                  |
| F05  | Complete | Focused feature tests remain in their existing feature test roots; no shallow test relocation was justified. |

The current top-level model remains authoritative:

```text
app/       Next.js entry composition and API controllers
features/  product workflows
shared/    browser-safe cross-feature modules
lib/       server, data, security, sync, and infrastructure modules
db/        schema, migrations, and connection construction
tests/     cross-feature contract and browser proof
```

## Rules

1. Keep a feature's entry container at `features/<feature>/components/`.
2. Add `components/<subfeature>/` only when that subfeature owns an independent
   prepared model, controller, or interaction contract.
3. Keep pure feature logic in `lib/`; do not put models, policies, or network
   calls under visual component folders.
4. Mirror a new subfeature under `tests/components/<subfeature>/` or
   `tests/lib/<subfeature>/` only when it has focused behavioral proof.
5. Move one complete vertical slice per commit. Do not create barrels solely
   to shorten import paths, and do not rename files for cosmetic consistency.
6. Preserve existing filenames unless the new path would otherwise be
   ambiguous in search results.

## Candidate improvements

| Feature              | Existing seam                                                                                  | Incremental folder              | Keep at feature root                                              | Proof before move                                      |
| -------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------ |
| `single-calculator`  | Timeline has desktop/mobile row renderers and a prepared row model                             | `components/timeline/`          | `BondCalculatorContainer`, `BondInputsForm`, `BondResultsSummary` | Timeline semantic and visual tests                     |
| `comparison-engine`  | Comparison table already has pagination and scenario cell parts                                | `components/comparison-table/`  | `ComparisonContainer`, plan/results panels                        | Table model, pagination, and comparison semantic tests |
| `notebook`           | Detail workflow has its own controller, projection, lots, import/export, and mutation behavior | `components/portfolio-details/` | `NotebookContainer`, workspace cards/states                       | Detail projection plus authenticated browser journey   |
| `regular-investment` | Inputs already form one focused interaction area                                               | `components/inputs/`            | Calculator container, chart, result sections                      | Input-state and strategy-result tests                  |
| `admin/status`       | Already separated as a nested feature under admin                                              | no move                         | Existing structure                                                | Keep as reference pattern                              |

These are improvements to patterns already present in the repository. Do not
force the same folders into small features such as `home`, `recovery-lab`, or
`education` until they have independent behavior.

## Execution order

### F01 — Document and enforce the existing folder vocabulary

Update the project map with the rules above and add one architecture contract
that prevents feature entry containers from importing a subfeature's internal
model when its controller already exposes the prepared interface.

**Completion:** The project map is the search guide; the contract protects one
real ownership rule without introducing directory-count linting.

### F02 — Complete the notebook detail subfeature

`features/notebook/components/portfolio-details/` already exists. Move only
the remaining detail-only visual modules there after confirming their imports
are not used by workspace views. Keep `PortfolioDetails` as the detail entry
interface and keep workspace components at `components/`.

**Completion:** A developer can find all lot/detail rendering below one folder;
workspace code does not import detail internals.

### F03 — Normalize calculator timeline ownership

Move `BondTimeline`, desktop/mobile rows, row composition, and timeline-only
render values into `features/single-calculator/components/timeline/`. Keep the
stable feature type contract in `features/single-calculator/types/timeline.ts`,
and keep the container and result/inputs sibling modules at the existing
component root.

Extract a timeline model only when a current component duplicates a decision;
do not add a forwarding barrel.

**Completion:** Search for `timeline` yields the model, renderers, types, and
focused tests in one feature-local area.

### F04 — Finish existing comparison-table grouping

Keep `components/comparison-table/` for table-specific parts. Move only table
pagination, scenario cells, and table-local presentational pieces into it;
leave `ComparisonTable.tsx` as the public composition entry. Keep pure table
projection/model modules in `lib/`.

**Completion:** Table behavior is discoverable without moving comparison plan,
chart, or calculation workflow modules.

### F05 — Keep tests near their ownership

For each completed F02–F04 move, colocate or mirror tests by behavior:

```text
features/<feature>/
├── components/<subfeature>/
├── lib/
└── tests/
    ├── components/<subfeature>/
    └── lib/
```

Do not move cross-feature browser tests from `tests/browser/`, architecture
contracts from `tests/contracts/`, or financial golden tests away from
`features/bond-core/tests/`.

**Completion:** A changed subfeature has an obvious focused-test location.

## Safe commit pattern

For every subfeature move:

1. Run its focused tests before the move.
2. Move one cohesive path and update direct imports.
3. Update source-based contracts that intentionally name the ownership path.
4. Run focused tests, `pnpm check:types`, `pnpm lint`, and `pnpm format:check`.
5. Run `pnpm test:architecture` and `pnpm scan:unused` after import changes.
6. Run the relevant browser/visual/a11y command only when rendered behavior
   changed or existing browser tests cover that subfeature.

## Do not do

- Do not create `atoms`, `molecules`, or `organisms` outside `shared/components`.
- Do not create a universal `ui/`, `core/`, `common/`, or `helpers/` folder.
- Do not move server commands, queries, repositories, HTTP policy, or data
  adapters into feature component folders.
- Do not add index barrels that hide ownership or create circular imports.
- Do not move files only because they exceed a line-count threshold.
- Do not change imports across unrelated features in one cleanup commit.

## Review questions

Before each move, answer:

1. What behavior does this subfeature own independently?
2. What is its entry interface for feature callers?
3. Which knowledge becomes more local after the move?
4. Which focused test proves the path is still correct?
5. Would a developer search by the subfeature name to find this code?

If any answer is unclear, retain the current folder structure.

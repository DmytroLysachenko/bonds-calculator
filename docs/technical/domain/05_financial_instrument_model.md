# 05. Financial Instrument Model

The current product model is Polish retail Treasury bonds first. It does not
use a universal instrument abstraction: bond families, issued series, tax
rules, and offer resolution have distinct financial invariants.

## Current model

- A **bond family** defines enduring statutory structure.
- An **issued bond series** defines dated offer terms and maturity.
- A **calculation intent** contains the user's question and assumptions.
- A **resolved calculation** combines that intent with verified catalogue,
  tax, and reference-data facts before entering an engine.
- A **holding lot** records bond quantity and an issued-series reference.

[`CONTEXT.md`](../../../CONTEXT.md) is the vocabulary authority. Persistence
details live in the database model; each calculation engine exposes its own
projection result rather than a forced universal time-series contract.

## Deferred expansion

Equities, commodities, and cryptocurrencies may later have separate research
or historical-comparison workflows. They must not share a calculation interface
until they share the same financial invariants, provenance requirements, and
result semantics as the bond workflow.

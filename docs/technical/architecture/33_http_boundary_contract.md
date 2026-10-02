# HTTP Boundary Contract

## Purpose

Every API route has one public responsibility: decode an untrusted request,
apply its named policy, delegate to a server service, and return a stable,
correlated response. Routes must not expose provider exceptions, database error
messages, authorization configuration, or raw request bodies.

## Correlation and failures

`apiHandler` attaches a validated caller request id or generates a new one. The
same id is sent in the response header and included in problem details so an
operator can find the server-side log without asking a user for a secret,
payload, cookie, or full URL.

An authorization failure is deliberately handled at the route boundary and
returns only its public status. Unexpected failures are mapped to the shared
problem-details format. Server logs retain the original exception through the
redacted logger; browser responses do not.

## Rate-limit identity

Client identity is not inferred from arbitrary forwarded headers. A deployment
must explicitly declare `TRUSTED_PROXY=1` and `TRUSTED_PROXY_HOPS` before
`x-forwarded-for` is accepted. The limiter selects the address immediately
before trusted proxy hops; ingress must append those hops and strip
caller-supplied copies. Without that contract the limiter uses the anonymous
bucket. This prevents callers from choosing quota buckets through spoofed
headers.

Named policies reflect capability cost:

- public catalogue, definition, default, and issued-series reads use `public-data-read`;
- chart-history reads use the separate `public-chart-read` budget;
- calculator execution uses the lower `calculation-execute` budget;
- public share creation uses a low hourly write budget;
- telemetry uses a separate bounded ingestion budget;
- session-backed administration uses the smallest write budget.

Configured production runtime uses the PostgreSQL atomic counter adapter. Local
development and unit tests use the bounded in-memory adapter intentionally; it
is not a distributed correctness mechanism.

## Administrative routes

Browser administration is authenticated by the server session/allowlist. A
successful status read and sync request create a redacted audit event containing
only action, correlation id, normalized actor when available, and safe mode
detail. Credentials, headers, input bodies, and provider payloads are never
stored in audit events.

Administrative sync requests enqueue durable Inngest work and return `202`.
They never keep an HTTP request open while contacting external providers.

## Telemetry routes

Web-vital reporting honors DNT/GPC before network work; the route validates and
samples accepted reports before writing. The aggregate repository keys only on
metric name, bounded pathname, rating, and UTC hour bucket, then retains count,
sum, min, and max for 30 days. Query parameters, account identifiers, scenario
inputs, raw user-agent strings, navigation payloads, and individual events are
not retained. A content-length guard rejects an oversized body before JSON
decoding. Persistence failure is logged with safe aggregate fields and does not
turn a browser metric into an application error.

## Verification

- Unit-test policy values and shared-store adapter decisions.
- Test spoofed forwarded headers with and without trusted proxy mode.
- Test authorization failures and successful audit events.
- Test telemetry rejection for malformed, query-bearing, and oversized input.
- Exercise the shared wrapper for success, validation failure, unexpected failure,
  and rate-limit headers. Endpoint tests must assert a public correlated problem,
  never an implementation error string.
- Verify production readiness after migrations so rate-limit and audit tables
  exist before traffic is served.

## Portfolio imports

The authenticated import endpoint accepts one bounded JSON document (256 KiB),
strictly validates a real ISO calendar date and supported bond code for every
lot, and rejects duplicate lots. Bond/series resolution completes before the
owner-scoped repository transaction begins. That transaction creates the import
portfolio and all lots together; any failed lot rolls back the portfolio metadata
and every prior lot. The route never accepts a partial import.

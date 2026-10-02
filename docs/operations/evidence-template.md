# Redacted operational evidence template

Use one copy per release or quarterly control review. Do not include secret
values, OAuth tokens, session cookies, database URLs, full customer records, or
unredacted provider responses.

## Release identity

- Date and UTC time:
- Commit SHA and immutable image digest:
- Cloud Run service/revision (redacted project identifier allowed):
- Operator and reviewer:

## Required checks

| Control            | Evidence to attach                                                              | Result      |
| ------------------ | ------------------------------------------------------------------------------- | ----------- |
| Workload identity  | Service-account name, bound repository/environment, least-privilege role review | pass / fail |
| Runtime secrets    | Secret Manager reference names only; no plaintext env-file values               | pass / fail |
| Database migration | Migration identity execution; runtime role DDL-denial query result              | pass / fail |
| Inngest schedule   | Function identifier, schedule, signed delivery/retry observation                | pass / fail |
| Readiness/smoke    | Redacted endpoint status, revision/image match, authenticated smoke result      | pass / fail |
| Backup/PITR        | Retention configuration and isolated restore-drill timestamp                    | pass / fail |
| Load test          | Scenario, concurrency, p95/error rate, Cloud Run/Neon saturation                | pass / fail |
| RUM receipt        | Aggregate route-template LCP/INP/CLS receipt without identifiers                | pass / fail |

## Exceptions

Record an owner, precise missing access, and due date for every failed or
unavailable control. The completion ledger must call the affected audit item
`Blocked`, not `Completed`, until this record contains successful evidence.

## Release verification transcript

Record commands and status only. Put full CI links or artifact identifiers in
the evidence store when they are available.

```text
pnpm check:types:
pnpm lint:
pnpm test:ci:
pnpm test:release:
pnpm build:
pnpm audit --prod --audit-level=high:
container/SBOM scan:
```

## Data and privacy review

- OAuth provider scopes reviewed against the minimum required product flow:
- Token-retention and revocation runbook reviewed:
- Shared scenario expiry/cleanup observation:
- Telemetry sampling excludes query values and account identifiers:
- Production logs reviewed for secret/header redaction:

## Sign-off

- Engineering owner:
- Operations owner:
- Security/privacy reviewer:
- Next scheduled review:

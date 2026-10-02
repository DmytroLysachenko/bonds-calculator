-- Issued-series terms are historical facts. Nullable fields deliberately keep
-- older rows unresolved until an evidenced issue document is attached.
ALTER TABLE "bond_series"
  ADD COLUMN IF NOT EXISTS "early_withdrawal_fee" numeric(8, 2),
  ADD COLUMN IF NOT EXISTS "redemption_fee_cap" text,
  ADD COLUMN IF NOT EXISTS "terms_source_url" text,
  ADD COLUMN IF NOT EXISTS "terms_revision" text;

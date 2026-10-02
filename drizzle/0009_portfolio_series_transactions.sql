-- Add the persisted offer identity and buy ledger already described by db/schema.ts.
-- Historical lots remain nullable; this migration deliberately does not infer their series.
CREATE TABLE IF NOT EXISTS "bond_series" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "bond_type_id" uuid NOT NULL REFERENCES "polish_bonds"("id") ON DELETE cascade,
  "series_code" text NOT NULL UNIQUE,
  "emission_month" date NOT NULL,
  "sell_start_date" date NOT NULL,
  "sell_end_date" date NOT NULL,
  "maturity_date" date NOT NULL,
  "first_year_rate" numeric(5, 2) NOT NULL,
  "base_margin" numeric(5, 2),
  "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "user_investment_lots"
  ADD COLUMN IF NOT EXISTS "bond_type_id" uuid REFERENCES "polish_bonds"("id"),
  ADD COLUMN IF NOT EXISTS "bond_series_id" uuid REFERENCES "bond_series"("id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lot_id" uuid NOT NULL REFERENCES "user_investment_lots"("id") ON DELETE cascade,
  "transaction_type" text NOT NULL,
  "date" date NOT NULL,
  "amount" numeric(15, 2) NOT NULL,
  "created_at" timestamp DEFAULT now()
);

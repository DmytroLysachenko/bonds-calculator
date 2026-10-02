-- Reconcile nullable/reference columns and supporting tables present in the
-- runtime schema but absent from the reviewed migration journal. All additions
-- are additive so databases previously maintained with db:push remain usable.
ALTER TABLE "polish_bonds"
  ADD COLUMN IF NOT EXISTS "description" text;
--> statement-breakpoint
ALTER TABLE "data_series"
  ADD COLUMN IF NOT EXISTS "display_precision" integer DEFAULT 2,
  ADD COLUMN IF NOT EXISTS "display_step_default" text DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS "timezone" text DEFAULT 'Europe/Warsaw',
  ADD COLUMN IF NOT EXISTS "source_priority" integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "freshness_policy" text,
  ADD COLUMN IF NOT EXISTS "last_sync_status" text,
  ADD COLUMN IF NOT EXISTS "last_sync_error" text,
  ADD COLUMN IF NOT EXISTS "last_data_point_date" date;
--> statement-breakpoint
ALTER TABLE "data_points"
  ADD COLUMN IF NOT EXISTS "open" numeric(20, 8),
  ADD COLUMN IF NOT EXISTS "high" numeric(20, 8),
  ADD COLUMN IF NOT EXISTS "low" numeric(20, 8),
  ADD COLUMN IF NOT EXISTS "close" numeric(20, 8),
  ADD COLUMN IF NOT EXISTS "adjusted_close" numeric(20, 8),
  ADD COLUMN IF NOT EXISTS "volume" numeric(20, 0),
  ADD COLUMN IF NOT EXISTS "quality_flag" text,
  ADD COLUMN IF NOT EXISTS "source_metadata" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tax_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "year" integer NOT NULL,
  "ike_limit" numeric(12, 2) NOT NULL,
  "ikze_limit" numeric(12, 2) NOT NULL,
  "standard_tax_rate" numeric(5, 2) DEFAULT '19.00',
  "ikze_payout_tax_rate" numeric(5, 2) DEFAULT '5.00',
  "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tax_year_idx" ON "tax_rules" ("year");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_insights" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "bond_type" text NOT NULL,
  "popularity_score" integer NOT NULL DEFAULT 0,
  "sentiment_score" numeric(3, 2) NOT NULL DEFAULT '0.00',
  "total_volume" numeric(20, 2) NOT NULL DEFAULT '0.00',
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "insight_bond_type_idx" ON "community_insights" ("bond_type");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL UNIQUE REFERENCES "user"("id") ON DELETE cascade,
  "currency" text NOT NULL DEFAULT 'PLN',
  "theme" text NOT NULL DEFAULT 'system',
  "default_inflation_scenario" text NOT NULL DEFAULT 'base',
  "chart_type" text NOT NULL DEFAULT 'area',
  "updated_at" timestamp NOT NULL DEFAULT now()
);

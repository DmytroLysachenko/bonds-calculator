-- Runtime offer resolution selects these reviewed family fields. Older
-- databases created from the journal must gain them before notebook imports.
ALTER TABLE "polish_bonds"
  ADD COLUMN IF NOT EXISTS "full_name_en" text,
  ADD COLUMN IF NOT EXISTS "description_en" text,
  ADD COLUMN IF NOT EXISTS "first_year_rate" numeric(5, 2);

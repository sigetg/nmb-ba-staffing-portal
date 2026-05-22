-- Add address fields to ba_profiles to support city/state search/sort
-- and full address capture for new BAs.

ALTER TABLE ba_profiles
  ADD COLUMN IF NOT EXISTS street_address1 TEXT,
  ADD COLUMN IF NOT EXISTS street_address2 TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT;

CREATE INDEX IF NOT EXISTS idx_ba_profiles_state ON ba_profiles(state);
CREATE INDEX IF NOT EXISTS idx_ba_profiles_city ON ba_profiles(city);

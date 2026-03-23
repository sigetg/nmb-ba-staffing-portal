-- Add additional_info and admin_notes columns to ba_profiles
ALTER TABLE ba_profiles
  ADD COLUMN IF NOT EXISTS additional_info TEXT,
  ADD COLUMN IF NOT EXISTS admin_notes TEXT;

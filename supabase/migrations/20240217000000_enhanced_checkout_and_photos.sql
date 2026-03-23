-- Add structured checkout columns to check_ins
ALTER TABLE public.check_ins
  ADD COLUMN IF NOT EXISTS kpi_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS schedule_deviation BOOLEAN,
  ADD COLUMN IF NOT EXISTS schedule_deviation_explanation TEXT,
  ADD COLUMN IF NOT EXISTS materials JSONB,
  ADD COLUMN IF NOT EXISTS scope_of_work JSONB;

-- Expand photo_type CHECK constraint on job_photos
ALTER TABLE public.job_photos DROP CONSTRAINT IF EXISTS job_photos_photo_type_check;
ALTER TABLE public.job_photos ADD CONSTRAINT job_photos_photo_type_check
  CHECK (photo_type IN ('check_in','on_the_job','setup','engagement','storefront_signage','team_uniform','check_out'));

-- Simplify job statuses: remove in_progress/completed from stored status
-- Add timezone column for computing display status from date/time

-- 1. Add timezone column (nullable initially)
ALTER TABLE public.jobs ADD COLUMN timezone TEXT;

-- 2. Backfill existing jobs based on location
UPDATE public.jobs SET timezone = 'America/Los_Angeles' WHERE location ILIKE '%Los Angeles%' OR location ILIKE '%San Francisco%' OR location ILIKE '%Portland%' OR location ILIKE '%San Diego%' OR location ILIKE '%Santa Monica%' OR location ILIKE '%Scottsdale%' OR location ILIKE '%Phoenix%' OR location ILIKE '%Indio%';
UPDATE public.jobs SET timezone = 'America/New_York' WHERE location ILIKE '%New York%' OR location ILIKE '%Miami%' OR location ILIKE '%Boston%' OR location ILIKE '%Atlanta%' OR location ILIKE '%Gainesville%';
UPDATE public.jobs SET timezone = 'America/Denver' WHERE location ILIKE '%Denver%';
UPDATE public.jobs SET timezone = 'America/Chicago' WHERE location ILIKE '%Chicago%' OR location ILIKE '%Nashville%' OR location ILIKE '%New Orleans%' OR location ILIKE '%Dallas%' OR location ILIKE '%Austin%';
UPDATE public.jobs SET timezone = 'America/Los_Angeles' WHERE location ILIKE '%Seattle%';
UPDATE public.jobs SET timezone = 'America/Chicago' WHERE timezone IS NULL;

-- 3. Make NOT NULL
ALTER TABLE public.jobs ALTER COLUMN timezone SET NOT NULL;

-- 4. Migrate statuses BEFORE changing constraint
UPDATE public.jobs SET status = 'published' WHERE status = 'in_progress';
UPDATE public.jobs SET status = 'published' WHERE status = 'completed';

-- 5. Drop old CHECK, add new one
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_status_check
  CHECK (status IN ('draft', 'published', 'cancelled'));

-- 6. Update RLS policy for BA visibility
DROP POLICY IF EXISTS "Anyone can view published jobs" ON public.jobs;
CREATE POLICY "Anyone can view published jobs" ON public.jobs
    FOR SELECT USING (status = 'published');

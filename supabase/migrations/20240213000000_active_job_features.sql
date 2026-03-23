-- ============================================
-- Active Job Features: photo_type, checkout summary, job-photos bucket
-- ============================================

-- 1. Add photo_type column to job_photos
ALTER TABLE public.job_photos
ADD COLUMN photo_type TEXT NOT NULL DEFAULT 'on_the_job'
CHECK (photo_type IN ('check_in', 'on_the_job', 'check_out'));

-- 2. Add checkout summary columns to check_ins
ALTER TABLE public.check_ins
ADD COLUMN checkout_notes TEXT,
ADD COLUMN checkout_issues TEXT,
ADD COLUMN checkout_customer_feedback TEXT,
ADD COLUMN checkout_foot_traffic TEXT;

-- 3. Create job-photos storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'job-photos',
    'job-photos',
    true,
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- 4. Storage RLS policies for job-photos bucket
CREATE POLICY "Anyone can view job-photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'job-photos');

CREATE POLICY "Users can upload own job-photos"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'job-photos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own job-photos"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'job-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own job-photos"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'job-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. Add indexes
CREATE INDEX idx_job_photos_photo_type ON public.job_photos(photo_type);
CREATE INDEX idx_job_photos_job_ba ON public.job_photos(job_id, ba_id);

-- ============================================
-- FIX 1: Fix RLS policies that cause infinite recursion
-- The issue is policies on public.users that query public.users
-- ============================================

-- Drop the problematic recursive policies
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;

-- Also drop and recreate other policies that reference users table recursively
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;

-- Create non-recursive policies for users table
-- Users can only see their own row (using auth.uid() directly, no subquery)
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

-- For admin access to users table, we check the role from auth.jwt() instead
-- This avoids querying the users table recursively
CREATE POLICY "Admins can view all users" ON public.users
    FOR SELECT USING (
        auth.uid() = id
        OR
        (auth.jwt() ->> 'role' = 'admin')
        OR
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.role = 'admin'
        )
    );

-- Add INSERT policy for users table (needed when trigger creates user record)
DROP POLICY IF EXISTS "Service role can insert users" ON public.users;
CREATE POLICY "Allow insert for authenticated" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Add UPDATE policy for users table
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- ============================================
-- FIX 2: Create storage bucket for BA photos
-- ============================================

-- Create the ba-photos bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'ba-photos',
    'ba-photos',
    true,
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- Storage policies for ba-photos bucket
-- Anyone can view photos (public bucket)
CREATE POLICY "Anyone can view ba-photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'ba-photos');

-- Authenticated users can upload photos to their own folder
CREATE POLICY "Users can upload own ba-photos"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'ba-photos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can update their own photos
CREATE POLICY "Users can update own ba-photos"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'ba-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own photos
CREATE POLICY "Users can delete own ba-photos"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'ba-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================
-- FIX 3: Fix other RLS policies that may have recursion issues
-- Replace subqueries on users table with direct auth.uid() checks where possible
-- ============================================

-- Fix BA Profiles admin policy
DROP POLICY IF EXISTS "Admins can view all BA profiles" ON public.ba_profiles;
CREATE POLICY "Admins can manage all BA profiles" ON public.ba_profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Fix Jobs admin policy
DROP POLICY IF EXISTS "Admins can manage all jobs" ON public.jobs;
CREATE POLICY "Admins can manage all jobs" ON public.jobs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Fix Job Applications admin policy
DROP POLICY IF EXISTS "Admins can manage all applications" ON public.job_applications;
CREATE POLICY "Admins can manage all applications" ON public.job_applications
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Fix Check-ins admin policy
DROP POLICY IF EXISTS "Admins can view all check-ins" ON public.check_ins;
CREATE POLICY "Admins can view all check-ins" ON public.check_ins
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Add policies for ba_photos table
DROP POLICY IF EXISTS "BAs can view own photos" ON public.ba_photos;
DROP POLICY IF EXISTS "BAs can insert own photos" ON public.ba_photos;
DROP POLICY IF EXISTS "Admins can view all photos" ON public.ba_photos;

CREATE POLICY "BAs can view own photos" ON public.ba_photos
    FOR SELECT USING (
        ba_id IN (
            SELECT id FROM public.ba_profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "BAs can insert own photos" ON public.ba_photos
    FOR INSERT WITH CHECK (
        ba_id IN (
            SELECT id FROM public.ba_profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage all photos" ON public.ba_photos
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Add policies for job_photos table
DROP POLICY IF EXISTS "BAs can view own job photos" ON public.job_photos;
DROP POLICY IF EXISTS "BAs can insert own job photos" ON public.job_photos;
DROP POLICY IF EXISTS "Admins can view all job photos" ON public.job_photos;

CREATE POLICY "BAs can manage own job photos" ON public.job_photos
    FOR ALL USING (
        ba_id IN (
            SELECT id FROM public.ba_profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage all job photos" ON public.job_photos
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Add policies for payments table
DROP POLICY IF EXISTS "BAs can view own payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can manage all payments" ON public.payments;

CREATE POLICY "BAs can view own payments" ON public.payments
    FOR SELECT USING (
        ba_id IN (
            SELECT id FROM public.ba_profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage all payments" ON public.payments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

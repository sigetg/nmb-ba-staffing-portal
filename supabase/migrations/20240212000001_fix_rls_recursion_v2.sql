-- ============================================
-- FIX: Create a security definer function to check admin status
-- This function bypasses RLS, preventing infinite recursion
-- ============================================

-- Create function to check if current user is admin (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role
    FROM public.users
    WHERE id = auth.uid();

    RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create function to get current user's role (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role
    FROM public.users
    WHERE id = auth.uid();

    RETURN COALESCE(user_role, 'ba');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- Drop ALL existing policies on users table
-- ============================================
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Allow insert for authenticated" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

-- ============================================
-- Create new non-recursive policies for users table
-- ============================================

-- Users can see their own row
CREATE POLICY "Users can view own row" ON public.users
    FOR SELECT USING (auth.uid() = id);

-- Admins can see all users (using security definer function)
CREATE POLICY "Admins can view all users" ON public.users
    FOR SELECT USING (public.is_admin());

-- Allow insert (for the trigger that creates user records)
CREATE POLICY "Allow user creation" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can update their own row
CREATE POLICY "Users can update own row" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- ============================================
-- Update other tables to use the is_admin() function
-- ============================================

-- BA Profiles
DROP POLICY IF EXISTS "Admins can manage all BA profiles" ON public.ba_profiles;
DROP POLICY IF EXISTS "Admins can view all BA profiles" ON public.ba_profiles;
CREATE POLICY "Admins can manage all BA profiles" ON public.ba_profiles
    FOR ALL USING (public.is_admin());

-- Jobs
DROP POLICY IF EXISTS "Admins can manage all jobs" ON public.jobs;
CREATE POLICY "Admins can manage all jobs" ON public.jobs
    FOR ALL USING (public.is_admin());

-- Job Applications
DROP POLICY IF EXISTS "Admins can manage all applications" ON public.job_applications;
CREATE POLICY "Admins can manage all applications" ON public.job_applications
    FOR ALL USING (public.is_admin());

-- Check-ins
DROP POLICY IF EXISTS "Admins can view all check-ins" ON public.check_ins;
CREATE POLICY "Admins can view all check-ins" ON public.check_ins
    FOR SELECT USING (public.is_admin());

-- BA Photos
DROP POLICY IF EXISTS "Admins can manage all photos" ON public.ba_photos;
CREATE POLICY "Admins can manage all photos" ON public.ba_photos
    FOR ALL USING (public.is_admin());

-- Job Photos
DROP POLICY IF EXISTS "Admins can manage all job photos" ON public.job_photos;
CREATE POLICY "Admins can manage all job photos" ON public.job_photos
    FOR ALL USING (public.is_admin());

-- Payments
DROP POLICY IF EXISTS "Admins can manage all payments" ON public.payments;
CREATE POLICY "Admins can manage all payments" ON public.payments
    FOR ALL USING (public.is_admin());

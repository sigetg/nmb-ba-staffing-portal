-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'ba' CHECK (role IN ('ba', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- BA Profiles table
CREATE TABLE public.ba_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    zip_code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
    availability JSONB NOT NULL DEFAULT '{}',
    stripe_account_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- BA Photos table
CREATE TABLE public.ba_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ba_id UUID NOT NULL REFERENCES public.ba_profiles(id) ON DELETE CASCADE,
    photo_type TEXT NOT NULL, -- 'headshot', 'full_body', etc.
    url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Jobs table
CREATE TABLE public.jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    brand TEXT NOT NULL,
    description TEXT NOT NULL,
    location TEXT NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    pay_rate DECIMAL(10, 2) NOT NULL,
    slots INTEGER NOT NULL DEFAULT 1,
    slots_filled INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'in_progress', 'completed', 'cancelled')),
    worksheet_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Job Applications table
CREATE TABLE public.job_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    ba_id UUID NOT NULL REFERENCES public.ba_profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES public.users(id),
    notes TEXT,
    UNIQUE(job_id, ba_id)
);

-- Check-ins table
CREATE TABLE public.check_ins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    ba_id UUID NOT NULL REFERENCES public.ba_profiles(id) ON DELETE CASCADE,
    check_in_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    check_out_time TIMESTAMPTZ,
    check_in_latitude DECIMAL(10, 8) NOT NULL,
    check_in_longitude DECIMAL(11, 8) NOT NULL,
    check_out_latitude DECIMAL(10, 8),
    check_out_longitude DECIMAL(11, 8),
    UNIQUE(job_id, ba_id)
);

-- Job Photos table
CREATE TABLE public.job_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    ba_id UUID NOT NULL REFERENCES public.ba_profiles(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    caption TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payments table
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    ba_id UUID NOT NULL REFERENCES public.ba_profiles(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    stripe_transfer_id TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- Create indexes for common queries
CREATE INDEX idx_ba_profiles_status ON public.ba_profiles(status);
CREATE INDEX idx_ba_profiles_zip_code ON public.ba_profiles(zip_code);
CREATE INDEX idx_jobs_status ON public.jobs(status);
CREATE INDEX idx_jobs_date ON public.jobs(date);
CREATE INDEX idx_jobs_brand ON public.jobs(brand);
CREATE INDEX idx_job_applications_job_id ON public.job_applications(job_id);
CREATE INDEX idx_job_applications_ba_id ON public.job_applications(ba_id);
CREATE INDEX idx_job_applications_status ON public.job_applications(status);
CREATE INDEX idx_check_ins_job_id ON public.check_ins(job_id);
CREATE INDEX idx_check_ins_ba_id ON public.check_ins(ba_id);
CREATE INDEX idx_payments_job_id ON public.payments(job_id);
CREATE INDEX idx_payments_ba_id ON public.payments(ba_id);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ba_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ba_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users: users can read their own data, admins can read all
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all users" ON public.users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- BA Profiles: BAs can manage their own, admins can view all
CREATE POLICY "BAs can view own profile" ON public.ba_profiles
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "BAs can update own profile" ON public.ba_profiles
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "BAs can insert own profile" ON public.ba_profiles
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all BA profiles" ON public.ba_profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Jobs: anyone can view published jobs, admins can manage all
CREATE POLICY "Anyone can view published jobs" ON public.jobs
    FOR SELECT USING (status = 'published' OR status = 'in_progress');

CREATE POLICY "Admins can manage all jobs" ON public.jobs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Job Applications: BAs can manage their own, admins can manage all
CREATE POLICY "BAs can view own applications" ON public.job_applications
    FOR SELECT USING (
        ba_id IN (
            SELECT id FROM public.ba_profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "BAs can insert own applications" ON public.job_applications
    FOR INSERT WITH CHECK (
        ba_id IN (
            SELECT id FROM public.ba_profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage all applications" ON public.job_applications
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Check-ins: BAs can manage their own, admins can view all
CREATE POLICY "BAs can manage own check-ins" ON public.check_ins
    FOR ALL USING (
        ba_id IN (
            SELECT id FROM public.ba_profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view all check-ins" ON public.check_ins
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ba_profiles_updated_at
    BEFORE UPDATE ON public.ba_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at
    BEFORE UPDATE ON public.jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create user record after auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, role)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'role', 'ba'));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

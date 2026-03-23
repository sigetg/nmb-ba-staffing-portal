-- Set admin role for admin@nmb.com
UPDATE public.users
SET role = 'admin', updated_at = NOW()
WHERE email = 'admin@nmb.com';

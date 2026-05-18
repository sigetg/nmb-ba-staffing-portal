-- App-wide settings (single row).
-- Currently holds the support contact phone number that is shown to BAs in the
-- worker flow and on public pages, and is editable by admins from /admin/settings.

CREATE TABLE public.app_settings (
    id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    contact_phone text,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES public.users(id)
);

INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon visitors on the landing page) can read the contact info.
CREATE POLICY "Anyone can read app settings" ON public.app_settings
    FOR SELECT USING (true);

-- Only admins can update the row.
CREATE POLICY "Admins can update app settings" ON public.app_settings
    FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

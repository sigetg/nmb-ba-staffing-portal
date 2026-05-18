import { createClient } from '@/lib/supabase/server'

/** Server-side fetch of the global contact phone number. */
export async function getContactPhone(): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('app_settings')
    .select('contact_phone')
    .eq('id', 1)
    .maybeSingle()
  return data?.contact_phone ?? null
}

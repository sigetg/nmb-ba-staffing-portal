'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/** Fetch the global contact phone number from app_settings. */
export function useContactPhone(): string | null {
  const [phone, setPhone] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    supabase
      .from('app_settings')
      .select('contact_phone')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setPhone(data?.contact_phone ?? null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return phone
}

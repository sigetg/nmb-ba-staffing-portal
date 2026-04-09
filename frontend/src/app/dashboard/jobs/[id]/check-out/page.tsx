'use client'

import { useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getImpersonatedBAId } from '@/lib/impersonation'

export default function CheckOutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const errorRef = useRef<string | null>(null)
  const loadedRef = useRef(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const redirect = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const impersonatedId = getImpersonatedBAId()
      const { data: profile } = await (impersonatedId
        ? supabase.from('ba_profiles').select('id').eq('id', impersonatedId).single()
        : supabase.from('ba_profiles').select('id').eq('user_id', user.id).single())

      if (!profile) { errorRef.current = 'Profile not found'; loadedRef.current = true; return }

      const { data: jobData } = await supabase
        .from('jobs')
        .select('*, job_days(*, job_day_locations(*))')
        .eq('id', id)
        .single()

      if (!jobData) { errorRef.current = 'Job not found'; loadedRef.current = true; return }

      const jobDays = jobData.job_days || []
      const allLocationIds = jobDays.flatMap((d: { job_day_locations: { id: string }[] }) =>
        (d.job_day_locations || []).map((l: { id: string }) => l.id)
      )

      if (allLocationIds.length === 0) {
        errorRef.current = 'No locations configured for this job'
        loadedRef.current = true
        return
      }

      // Find active location check-in (no check_out_time)
      const { data: activeCi } = await supabase
        .from('location_check_ins')
        .select('*, job_day_locations!inner(id, job_day_id)')
        .eq('ba_id', profile.id)
        .is('check_out_time', null)
        .eq('skipped', false)
        .in('job_day_location_id', allLocationIds)
        .limit(1)
        .single()

      if (activeCi) {
        const dayId = (activeCi as { job_day_locations: { job_day_id: string } }).job_day_locations.job_day_id
        router.push(`/dashboard/jobs/${id}/day/${dayId}/checkout?locationId=${activeCi.job_day_location_id}`)
      } else {
        router.push(`/dashboard/jobs/${id}/check-in`)
      }
    }
    redirect()
  }, [id, router, supabase])

  if (errorRef.current) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">{errorRef.current}</h2>
        <Link href="/dashboard/my-jobs" className="text-primary-400 hover:text-primary-500 mt-2 inline-block">
          Back to my jobs
        </Link>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400" />
    </div>
  )
}

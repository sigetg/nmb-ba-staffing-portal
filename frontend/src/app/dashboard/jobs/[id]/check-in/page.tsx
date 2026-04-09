'use client'

import { useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { JobWithDays } from '@/types'
import { getLocalToday, getMultiDayDisplayStatus } from '@/lib/utils'

export default function CheckInPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const isRedirecting = useRef(false)
  const router = useRouter()
  const supabase = createClient()
  const errorRef = useRef<string | null>(null)
  const loadedRef = useRef(false)

  useEffect(() => {
    const redirect = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: jobData } = await supabase
        .from('jobs')
        .select('*, job_days(*, job_day_locations(*))')
        .eq('id', id)
        .single()

      if (!jobData) { errorRef.current = 'Job not found'; loadedRef.current = true; return }

      const jobDays = jobData.job_days || []
      if (jobDays.length === 0) {
        errorRef.current = 'No days configured for this job'
        loadedRef.current = true
        return
      }

      if (getMultiDayDisplayStatus(jobData as JobWithDays) === 'completed') {
        router.push(`/dashboard/jobs/${id}`)
        return
      }

      const today = getLocalToday()
      const todayDay = jobDays.find((d: { date: string }) => d.date === today)
      if (!todayDay) {
        router.push(`/dashboard/jobs/${id}`)
        return
      }

      const locs = (todayDay.job_day_locations || []).sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
      if (locs.length === 0) {
        router.push(`/dashboard/jobs/${id}`)
        return
      }

      isRedirecting.current = true
      router.push(`/dashboard/jobs/${id}/day/${todayDay.id}/location/${locs[0].id}/check-in`)
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

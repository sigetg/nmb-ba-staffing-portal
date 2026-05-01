import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { requireOnboardedBA } from '@/lib/supabase/onboarding-guard'
import Link from 'next/link'
import { Card, CardContent, Badge } from '@/components/ui'
import { Calendar, Clock, MapPin, Briefcase, AlertTriangle, Navigation } from 'lucide-react'
import { parseLocalDate, getLocalToday, getTimezoneAbbr, getMinJobDistance } from '@/lib/utils'
import type { JobWithDays } from '@/types'

async function getAvailableJobs(userId: string, impersonatedBAId?: string) {
  const supabase = await createClient()

  // Get BA profile (include lat/lng for distance sorting)
  const profileQuery = impersonatedBAId
    ? supabase.from('ba_profiles').select('id, status, latitude, longitude').eq('id', impersonatedBAId).single()
    : supabase.from('ba_profiles').select('id, status, latitude, longitude').eq('user_id', userId).single()
  const { data: profile } = await profileQuery

  // Get published jobs with their days/locations
  const { data: jobs } = await supabase
    .from('jobs')
    .select('*, job_days(*, job_day_locations(*))')
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  // Filter in JS: keep jobs where at least one job_day.date >= today
  const today = getLocalToday()
  const filteredJobs = (jobs || []).filter((job: JobWithDays) => {
    const days = job.job_days || []
    if (days.length === 0) return false // No days = not visible
    const lastDate = [...days].sort((a, b) => a.date.localeCompare(b.date)).pop()!.date
    return lastDate >= today
  })

  // Compute distances and sort
  const userLat = profile?.latitude as number | null
  const userLng = profile?.longitude as number | null
  const distanceMap: Record<string, number | null> = {}

  if (userLat != null && userLng != null) {
    for (const job of filteredJobs) {
      distanceMap[job.id] = getMinJobDistance(job as JobWithDays, userLat, userLng)
    }
    // Sort by distance ascending (jobs without distance go to end)
    filteredJobs.sort((a: JobWithDays, b: JobWithDays) => {
      const da = distanceMap[a.id]
      const db = distanceMap[b.id]
      if (da != null && db != null) return da - db
      if (da != null) return -1
      if (db != null) return 1
      // Both null: fall back to date
      const aFirst = [...(a.job_days || [])].sort((x, y) => x.date.localeCompare(y.date))[0]?.date || ''
      const bFirst = [...(b.job_days || [])].sort((x, y) => x.date.localeCompare(y.date))[0]?.date || ''
      return aFirst.localeCompare(bFirst)
    })
  } else {
    // No user location: sort by first day date ascending
    filteredJobs.sort((a: JobWithDays, b: JobWithDays) => {
      const aFirst = [...(a.job_days || [])].sort((x, y) => x.date.localeCompare(y.date))[0]?.date || ''
      const bFirst = [...(b.job_days || [])].sort((x, y) => x.date.localeCompare(y.date))[0]?.date || ''
      return aFirst.localeCompare(bFirst)
    })
  }

  // Get user's applications
  const { data: applications } = await supabase
    .from('job_applications')
    .select('job_id, status')
    .eq('ba_id', profile?.id || '')

  const appliedJobIds = new Set(applications?.map(a => a.job_id) || [])
  const applicationStatuses = Object.fromEntries(
    applications?.map(a => [a.job_id, a.status]) || []
  )

  return {
    profile,
    jobs: filteredJobs as JobWithDays[],
    appliedJobIds,
    applicationStatuses,
    distanceMap,
  }
}

export default async function JobsPage() {
  // Gate: must be approved and have W-9 + payout method on file. Otherwise → /dashboard/welcome.
  await requireOnboardedBA()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const cookieStore = await cookies()
  const impersonatedBAId = cookieStore.get('impersonate_ba_id')?.value

  const { profile, jobs, appliedJobIds, applicationStatuses, distanceMap } = await getAvailableJobs(user.id, impersonatedBAId)

  const canApply = profile?.status === 'approved'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-heading">Find Jobs</h1>
        <p className="text-primary-400">
          Browse available job opportunities
        </p>
      </div>

      {!canApply && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800">Profile Pending Approval</p>
              <p className="text-sm text-yellow-700">
                Your profile is currently under review. Once approved, you&apos;ll be able to apply for jobs.
              </p>
            </div>
          </div>
        </div>
      )}

      {jobs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Briefcase className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-primary-400">No jobs available at the moment</p>
            <p className="text-sm text-primary-400 mt-1">Check back later for new opportunities</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobs.map((job) => {
            const isApplied = appliedJobIds.has(job.id)
            const applicationStatus = applicationStatuses[job.id]
            const slotsAvailable = job.slots - job.slots_filled
            const days = [...(job.job_days || [])].sort((a, b) => a.date.localeCompare(b.date))
            const distance = distanceMap[job.id]

            return (
              <Card key={job.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {job.title}
                      </h3>
                      <p className="text-sm text-primary-400">{job.brand}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 justify-end">
                      {distance != null && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                          <Navigation className="w-3 h-3" />
                          {Math.round(distance)} mi
                        </span>
                      )}
                      {days.length > 1 && (
                        <Badge variant="info">{days.length} days</Badge>
                      )}
                      {isApplied && (
                        <Badge
                          variant={
                            applicationStatus === 'approved'
                              ? 'success'
                              : applicationStatus === 'rejected'
                              ? 'error'
                              : 'warning'
                          }
                        >
                          {applicationStatus === 'approved'
                            ? 'Approved'
                            : applicationStatus === 'rejected'
                            ? 'Rejected'
                            : 'Applied'}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Day list */}
                  <div className="space-y-2 text-sm text-primary-400 mb-4 max-h-40 overflow-y-auto">
                    {days.map((day) => {
                      const locs = [...(day.job_day_locations || [])].sort((a, b) => a.sort_order - b.sort_order)
                      return (
                        <div key={day.id} className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 flex-shrink-0" />
                            <span className="font-medium">
                              {parseLocalDate(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                          {locs.map((loc) => (
                            <div key={loc.id} className="ml-6 flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="truncate">{loc.location}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                                <span>{loc.start_time} - {loc.end_time} {getTimezoneAbbr(job.timezone)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div>
                      <span className="text-lg font-semibold text-gray-900">
                        ${job.pay_rate}
                      </span>
                      <span className="text-sm text-primary-400">/hr</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm ${slotsAvailable > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {slotsAvailable} {slotsAvailable === 1 ? 'slot' : 'slots'} left
                      </span>
                      <Link
                        href={`/dashboard/jobs/${job.id}`}
                        className="px-3 py-1.5 text-sm bg-primary-400 text-white rounded-lg hover:bg-primary-500 transition-colors"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

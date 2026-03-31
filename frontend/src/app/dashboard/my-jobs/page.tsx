import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Card, CardContent, Badge } from '@/components/ui'
import { Calendar, Clock, MapPin, CheckCircle2, XCircle, ChevronRight } from 'lucide-react'
import { parseLocalDate, getLocalToday, getTimezoneAbbr, getMultiDayDisplayStatus, getJobDateDisplay, getJobLocationDisplay } from '@/lib/utils'
import type { JobWithDays } from '@/types'

type Application = {
  id: string
  status: string
  applied_at: string
  jobs: JobWithDays
}

function getDayProgress(job: JobWithDays): { current: number; total: number } | null {
  const days = (job.job_days || []).sort((a, b) => a.date.localeCompare(b.date))
  if (days.length <= 1) return null

  const today = getLocalToday()
  const currentIdx = days.findIndex(d => d.date >= today)
  if (currentIdx === -1) return { current: days.length, total: days.length }
  return { current: currentIdx + 1, total: days.length }
}

async function getMyJobs(userId: string) {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('ba_profiles')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (!profile) {
    return { applications: [] as Application[], activeJobId: null as string | null, activeCheckInTime: null as string | null, isMultiDayActive: false }
  }

  // Get all applications with job details including days/locations
  const { data: applications } = await supabase
    .from('job_applications')
    .select('*, jobs(*, job_days(*, job_day_locations(*)))')
    .eq('ba_id', profile.id)
    .order('applied_at', { ascending: false })

  // Check for active legacy check-in
  const { data: legacyCheckIns } = await supabase
    .from('check_ins')
    .select('job_id, check_in_time, check_out_time')
    .eq('ba_id', profile.id)

  let activeJobId: string | null = null
  let activeCheckInTime: string | null = null
  let isMultiDayActive = false

  const activeCheckIn = (legacyCheckIns || []).find(c => c.check_in_time && !c.check_out_time)
  if (activeCheckIn) {
    activeJobId = activeCheckIn.job_id
    activeCheckInTime = activeCheckIn.check_in_time
  }

  // Check for active location_check_in (multi-day)
  const { data: activeLocationCi } = await supabase
    .from('location_check_ins')
    .select('*, job_day_locations!inner(job_id)')
    .eq('ba_id', profile.id)
    .is('check_out_time', null)
    .eq('skipped', false)
    .limit(1)
    .single()

  if (activeLocationCi && !activeJobId) {
    activeJobId = (activeLocationCi as { job_day_locations: { job_id: string } }).job_day_locations.job_id
    activeCheckInTime = activeLocationCi.check_in_time
    isMultiDayActive = true
  }

  return {
    applications: (applications || []) as Application[],
    activeJobId,
    activeCheckInTime,
    isMultiDayActive,
  }
}

export default async function MyJobsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { applications, activeJobId, activeCheckInTime, isMultiDayActive } = await getMyJobs(user.id)

  const activeJobApp = activeJobId
    ? applications.find(app => app.jobs.id === activeJobId)
    : null

  // Categorize jobs
  const upcoming = applications.filter(app => {
    if (app.status !== 'approved') return false
    const displayStatus = getMultiDayDisplayStatus(app.jobs)
    return displayStatus === 'upcoming' || displayStatus === 'in_progress'
  })
  const pending = applications.filter(app => app.status === 'pending')
  const completed = applications.filter(app => {
    if (app.status !== 'approved') return false
    const displayStatus = getMultiDayDisplayStatus(app.jobs)
    return displayStatus === 'completed'
  })
  const rejected = applications.filter(app => app.status === 'rejected')

  const renderJobCard = (app: Application, showActions: boolean = false) => {
    const isActive = app.jobs.id === activeJobId
    const dayProgress = getDayProgress(app.jobs)
    const today = getLocalToday()
    const days = (app.jobs.job_days || []).sort((a, b) => a.date.localeCompare(b.date))
    const isToday = days.length > 0
      ? days.some(d => d.date === today)
      : app.jobs.date === today

    // Find next day info for multi-day jobs between days
    let nextDayInfo: string | null = null
    if (days.length > 1 && !isActive) {
      const nextDay = days.find(d => d.date >= today)
      if (nextDay) {
        const locs = (nextDay.job_day_locations || []).sort((a, b) => a.sort_order - b.sort_order)
        const firstLoc = locs[0]
        if (firstLoc) {
          nextDayInfo = `${parseLocalDate(nextDay.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} - ${firstLoc.location} at ${firstLoc.start_time}`
        }
      }
    }

    return (
      <div
        key={app.id}
        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 rounded-lg gap-4"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className="font-medium text-gray-900">
              {app.jobs.title}
            </h4>
            {isToday && <Badge variant="info">Today</Badge>}
            {dayProgress && (
              <Badge variant="default">Day {dayProgress.current} of {dayProgress.total}</Badge>
            )}
          </div>
          <p className="text-sm text-primary-400">
            {app.jobs.brand}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-primary-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {getJobDateDisplay(app.jobs)}
            </span>
            {app.jobs.start_time && app.jobs.end_time && (
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {app.jobs.start_time} - {app.jobs.end_time} {app.jobs.timezone ? getTimezoneAbbr(app.jobs.timezone) : ''}
              </span>
            )}
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {getJobLocationDisplay(app.jobs)}
            </span>
          </div>
          {nextDayInfo && (
            <p className="mt-2 text-xs text-primary-500 font-medium">
              Next: {nextDayInfo}
            </p>
          )}
          <p className="mt-2 text-sm font-medium text-gray-900">
            ${app.jobs.pay_rate}/hr
          </p>
        </div>

        {showActions && (
          <div className="flex gap-2">
            {isToday && !isActive && app.status === 'approved' && (
              <Link
                href={`/dashboard/jobs/${app.jobs.id}/check-in`}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                Check In
              </Link>
            )}
            {isActive && (
              <Link
                href={`/dashboard/jobs/${app.jobs.id}/active`}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                View Active
              </Link>
            )}
            {!isToday && app.status === 'approved' && (
              <Link
                href={`/dashboard/jobs/${app.jobs.id}`}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 text-sm"
              >
                View
              </Link>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-heading">My Jobs</h1>
        <p className="text-primary-400">
          Track your job applications and assignments
        </p>
      </div>

      {/* Active Job */}
      {activeJobApp && activeCheckInTime && (
        <Link href={`/dashboard/jobs/${activeJobId}/active`} className="block mb-2">
          <Card className="border-green-300 bg-green-50 hover:bg-green-100 transition-colors cursor-pointer">
            <div className="px-6 py-4 border-b border-green-200">
              <h2 className="text-lg font-semibold text-green-900 flex items-center gap-2">
                <div className="relative">
                  <Clock className="w-5 h-5 text-green-600" />
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                </div>
                Active Job
                <Badge variant="success">In Progress</Badge>
              </h2>
            </div>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-green-100/50 rounded-lg">
                <div>
                  <h4 className="font-medium text-green-900">
                    {activeJobApp.jobs.title}
                  </h4>
                  <p className="text-sm text-green-800">
                    {activeJobApp.jobs.brand}
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    Checked in at {new Date(activeCheckInTime).toLocaleTimeString()}
                  </p>
                  {getDayProgress(activeJobApp.jobs) && (
                    <p className="text-xs text-green-700 mt-0.5">
                      Day {getDayProgress(activeJobApp.jobs)!.current} of {getDayProgress(activeJobApp.jobs)!.total}
                    </p>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Upcoming Jobs */}
      <Card>
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-green-600" />
            Upcoming Jobs
            <Badge variant="success">{upcoming.length}</Badge>
          </h2>
        </div>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-center py-8 text-primary-400">
              No upcoming jobs. <Link href="/dashboard/jobs" className="text-primary-400">Find jobs to apply</Link>
            </p>
          ) : (
            <div className="space-y-3">
              {upcoming.map((app) => renderJobCard(app, true))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Applications */}
      <Card>
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-yellow-600" />
            Pending Applications
            <Badge variant="warning">{pending.length}</Badge>
          </h2>
        </div>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-center py-8 text-primary-400">
              No pending applications
            </p>
          ) : (
            <div className="space-y-3">
              {pending.map((app) => (
                <div
                  key={app.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {app.jobs.title}
                    </h4>
                    <p className="text-sm text-primary-400">
                      {app.jobs.brand} - {getJobDateDisplay(app.jobs)}
                    </p>
                    <p className="text-xs text-primary-400 mt-1">
                      Applied {new Date(app.applied_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="warning">Pending</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Completed Jobs */}
      {completed.length > 0 && (
        <Card>
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary-400" />
              Completed Jobs
              <Badge variant="default">{completed.length}</Badge>
            </h2>
          </div>
          <CardContent>
            <div className="space-y-3">
              {completed.slice(0, 5).map((app) => (
                <div
                  key={app.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {app.jobs.title}
                    </h4>
                    <p className="text-sm text-primary-400">
                      {app.jobs.brand} - {getJobDateDisplay(app.jobs)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      ${app.jobs.pay_rate}/hr
                    </p>
                    <Badge variant="success">Completed</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rejected Applications */}
      {rejected.length > 0 && (
        <Card>
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              Rejected Applications
              <Badge variant="error">{rejected.length}</Badge>
            </h2>
          </div>
          <CardContent>
            <div className="space-y-3">
              {rejected.map((app) => (
                <div
                  key={app.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg opacity-75"
                >
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {app.jobs.title}
                    </h4>
                    <p className="text-sm text-primary-400">
                      {app.jobs.brand} - {getJobDateDisplay(app.jobs)}
                    </p>
                  </div>
                  <Badge variant="error">Rejected</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

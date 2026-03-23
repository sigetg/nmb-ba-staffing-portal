import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Card, CardContent, Badge } from '@/components/ui'
import { Calendar, Clock, MapPin, CheckCircle2, XCircle, ChevronRight } from 'lucide-react'
import { parseLocalDate, getLocalToday, getJobDisplayStatus, getTimezoneAbbr } from '@/lib/utils'

async function getMyJobs(userId: string) {
  const supabase = await createClient()

  // Get BA profile
  const { data: profile } = await supabase
    .from('ba_profiles')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (!profile) {
    return { applications: [], checkIns: {} as Record<string, { check_in_time: string; check_out_time?: string; job_id: string }> }
  }

  // Get all applications with job details
  const { data: applications } = await supabase
    .from('job_applications')
    .select('*, jobs(*)')
    .eq('ba_id', profile.id)
    .order('applied_at', { ascending: false })

  // Get check-ins for all jobs
  const { data: checkIns } = await supabase
    .from('check_ins')
    .select('*')
    .eq('ba_id', profile.id)

  const checkInMap: Record<string, { check_in_time: string; check_out_time?: string; job_id: string }> = Object.fromEntries(
    (checkIns || []).map(c => [c.job_id, c])
  )

  return {
    applications: applications || [],
    checkIns: checkInMap,
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

  const { applications, checkIns } = await getMyJobs(user.id)

  const today = getLocalToday()

  // Find active job (checked in but not checked out)
  const activeJobEntry = Object.entries(checkIns).find(
    ([, checkIn]) => checkIn.check_in_time && !checkIn.check_out_time
  )
  const activeJobId = activeJobEntry ? activeJobEntry[0] : null
  const activeCheckIn = activeJobEntry ? activeJobEntry[1] : null
  const activeJobApp = activeJobId
    ? applications.find((app: { jobs: { id: string } }) => app.jobs.id === activeJobId)
    : null

  // Categorize jobs using computed display status
  const upcoming = applications.filter(
    (app: { status: string; jobs: { date: string; start_time: string; end_time: string; status: string; timezone: string } }) => {
      if (app.status !== 'approved') return false
      const displayStatus = getJobDisplayStatus(app.jobs)
      return displayStatus === 'upcoming' || displayStatus === 'in_progress'
    }
  )
  const pending = applications.filter(
    (app: { status: string }) => app.status === 'pending'
  )
  const completed = applications.filter(
    (app: { status: string; jobs: { date: string; start_time: string; end_time: string; status: string; timezone: string } }) => {
      if (app.status !== 'approved') return false
      const displayStatus = getJobDisplayStatus(app.jobs)
      return displayStatus === 'completed'
    }
  )
  const rejected = applications.filter(
    (app: { status: string }) => app.status === 'rejected'
  )

  type Application = {
    id: string
    status: string
    applied_at: string
    jobs: {
      id: string
      title: string
      brand: string
      date: string
      start_time: string
      end_time: string
      location: string
      pay_rate: number
      status: string
      timezone: string
    }
  }

  const renderJobCard = (app: Application, showActions: boolean = false) => {
    const checkIn = checkIns[app.jobs.id]
    const isToday = app.jobs.date === today
    const canCheckIn = isToday && !checkIn && app.status === 'approved'
    const isActive = isToday && checkIn && !checkIn.check_out_time

    return (
      <div
        key={app.id}
        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 rounded-lg gap-4"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-gray-900">
              {app.jobs.title}
            </h4>
            {isToday && (
              <Badge variant="info">Today</Badge>
            )}
          </div>
          <p className="text-sm text-primary-400">
            {app.jobs.brand}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-primary-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {parseLocalDate(app.jobs.date).toLocaleDateString()}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {app.jobs.start_time} - {app.jobs.end_time} {app.jobs.timezone ? getTimezoneAbbr(app.jobs.timezone) : ''}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {app.jobs.location}
            </span>
          </div>
          <p className="mt-2 text-sm font-medium text-gray-900">
            ${app.jobs.pay_rate}/hr
          </p>
        </div>

        {showActions && (
          <div className="flex gap-2">
            {canCheckIn && (
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
            {checkIn?.check_out_time && (
              <Badge variant="success">Completed</Badge>
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
      {activeJobApp && activeCheckIn && (
        <Link href={`/dashboard/jobs/${activeJobId}/active`}>
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
                    {(activeJobApp as Application).jobs.title}
                  </h4>
                  <p className="text-sm text-green-800">
                    {(activeJobApp as Application).jobs.brand}
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    Checked in at {new Date(activeCheckIn.check_in_time).toLocaleTimeString()}
                  </p>
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
              {upcoming.map((app: Application) => renderJobCard(app, true))}
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
              {pending.map((app: Application) => (
                <div
                  key={app.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {app.jobs.title}
                    </h4>
                    <p className="text-sm text-primary-400">
                      {app.jobs.brand} - {parseLocalDate(app.jobs.date).toLocaleDateString()}
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
              {completed.slice(0, 5).map((app: Application) => (
                <div
                  key={app.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {app.jobs.title}
                    </h4>
                    <p className="text-sm text-primary-400">
                      {app.jobs.brand} - {parseLocalDate(app.jobs.date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      ${app.jobs.pay_rate}/hr
                    </p>
                    {checkIns[app.jobs.id]?.check_out_time && (
                      <Badge variant="success">Completed</Badge>
                    )}
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
              {rejected.map((app: Application) => (
                <div
                  key={app.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg opacity-75"
                >
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {app.jobs.title}
                    </h4>
                    <p className="text-sm text-primary-400">
                      {app.jobs.brand} - {parseLocalDate(app.jobs.date).toLocaleDateString()}
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

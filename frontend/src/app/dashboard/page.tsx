import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui'
import { Calendar, Clock, CheckCircle2, Briefcase, AlertTriangle, ChevronRight } from 'lucide-react'
import { parseLocalDate, getLocalToday } from '@/lib/utils'
import { getBAUserWithProfile } from '@/lib/supabase/auth-helpers'

async function getDashboardData(profileId: string) {
  const supabase = await createClient()

  const today = getLocalToday()

  // Run all queries in parallel
  const [
    { data: applications },
    { count: pendingCount },
    { count: approvedCount },
    { data: upcomingJobs },
    { data: activeCheckIn },
  ] = await Promise.all([
    supabase
      .from('job_applications')
      .select('*, jobs(*)')
      .eq('ba_id', profileId)
      .order('applied_at', { ascending: false })
      .limit(5),
    supabase
      .from('job_applications')
      .select('*', { count: 'exact', head: true })
      .eq('ba_id', profileId)
      .eq('status', 'pending'),
    supabase
      .from('job_applications')
      .select('*', { count: 'exact', head: true })
      .eq('ba_id', profileId)
      .eq('status', 'approved'),
    supabase
      .from('job_applications')
      .select('*, jobs!inner(*)')
      .eq('ba_id', profileId)
      .eq('status', 'approved')
      .gte('jobs.date', today)
      .order('jobs(date)', { ascending: true })
      .limit(3),
    supabase
      .from('check_ins')
      .select('*, jobs(*)')
      .eq('ba_id', profileId)
      .is('check_out_time', null)
      .limit(1)
      .single(),
  ])

  return {
    stats: {
      pending: pendingCount || 0,
      approved: approvedCount || 0,
      upcoming: upcomingJobs?.length || 0,
    },
    upcomingJobs: upcomingJobs || [],
    recentApplications: applications || [],
    activeJob: activeCheckIn || null,
  }
}

export default async function DashboardPage() {
  // Reuses cached auth data from layout — no extra DB calls
  const result = await getBAUserWithProfile()

  if (!result?.profile) {
    return null
  }

  const { profile } = result
  const { stats, upcomingJobs, recentApplications, activeJob } = await getDashboardData(profile.id)

  if (!profile) {
    return null
  }

  const statusMap = {
    pending: { variant: 'warning' as const, text: 'Pending Approval' },
    approved: { variant: 'success' as const, text: 'Approved' },
    rejected: { variant: 'error' as const, text: 'Rejected' },
    suspended: { variant: 'error' as const, text: 'Suspended' },
  }
  const statusBadge = statusMap[profile.status as keyof typeof statusMap] || statusMap.pending

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-heading">
            Welcome back, {profile.name.split(' ')[0]}!
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-primary-400">Account Status:</span>
            <Badge variant={statusBadge.variant}>{statusBadge.text}</Badge>
          </div>
        </div>
        <div className="flex gap-3">
          <Link
            href="/dashboard/jobs"
            className="px-4 py-2 bg-primary-400 text-white rounded-lg hover:bg-primary-500 transition-colors"
          >
            Find Jobs
          </Link>
        </div>
      </div>

      {/* Active Job Banner */}
      {activeJob && activeJob.jobs && (
        <Link href={`/dashboard/jobs/${activeJob.job_id}/active`}>
          <Card className="border-green-300 bg-green-50 hover:bg-green-100 transition-colors cursor-pointer">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Clock className="w-8 h-8 text-green-600" />
                    <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-green-900">Active Job</h3>
                      <Badge variant="success">In Progress</Badge>
                    </div>
                    <p className="text-sm text-green-800 font-medium">
                      {(activeJob.jobs as { title: string }).title}
                    </p>
                    <p className="text-xs text-green-700">
                      {(activeJob.jobs as { brand: string }).brand} &middot; Checked in at{' '}
                      {new Date(activeJob.check_in_time).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Status Alert */}
      {profile.status === 'pending' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800">Profile Under Review</p>
              <p className="text-sm text-yellow-700">
                Your profile is being reviewed by our team. Once approved, you&apos;ll be able to apply for jobs.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Calendar className="w-7 h-7 text-primary-400" />
              <div>
                <p className="text-sm text-primary-400">Upcoming Jobs</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.upcoming || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Clock className="w-7 h-7 text-primary-400" />
              <div>
                <p className="text-sm text-primary-400">Pending Applications</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.pending || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <CheckCircle2 className="w-7 h-7 text-primary-400" />
              <div>
                <p className="text-sm text-primary-400">Approved Jobs</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.approved || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Jobs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Upcoming Jobs</CardTitle>
            <Link href="/dashboard/my-jobs" className="text-sm text-primary-400 hover:text-primary-500">
              View all
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {upcomingJobs.length === 0 ? (
            <div className="text-center py-8 text-primary-400">
              <Briefcase className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No upcoming jobs</p>
              <Link href="/dashboard/jobs" className="text-primary-400 hover:text-primary-500 mt-2 inline-block">
                Browse available jobs
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingJobs.map((app: { id: string; jobs: { id: string; title: string; brand: string; date: string; location: string; start_time: string; end_time: string } }) => (
                <div
                  key={app.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {app.jobs.title}
                    </h4>
                    <p className="text-sm text-primary-400">
                      {app.jobs.brand} - {app.jobs.location}
                    </p>
                    <p className="text-sm text-primary-400">
                      {parseLocalDate(app.jobs.date).toLocaleDateString()} | {app.jobs.start_time} - {app.jobs.end_time}
                    </p>
                  </div>
                  <Link
                    href={`/dashboard/jobs/${app.jobs.id}/check-in`}
                    className="px-3 py-1.5 text-sm bg-primary-400 text-white rounded-lg hover:bg-primary-500"
                  >
                    Check In
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Applications */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Applications</CardTitle>
            <Link href="/dashboard/my-jobs" className="text-sm text-primary-400 hover:text-primary-500">
              View all
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentApplications.length === 0 ? (
            <div className="text-center py-8 text-primary-400">
              <p>No applications yet</p>
              <Link href="/dashboard/jobs" className="text-primary-400 hover:text-primary-500 mt-2 inline-block">
                Find jobs to apply
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentApplications.map((app: { id: string; status: string; applied_at: string; jobs: { title: string; brand: string; date: string } }) => {
                const appStatusBadge = {
                  pending: { variant: 'warning' as const, text: 'Pending' },
                  approved: { variant: 'success' as const, text: 'Approved' },
                  rejected: { variant: 'error' as const, text: 'Rejected' },
                  withdrawn: { variant: 'default' as const, text: 'Withdrawn' },
                }[app.status] || { variant: 'default' as const, text: app.status }

                return (
                  <div
                    key={app.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                  >
                    <div>
                      <h4 className="font-medium text-gray-900">
                        {app.jobs.title}
                      </h4>
                      <p className="text-sm text-primary-400">
                        {app.jobs.brand} - {parseLocalDate(app.jobs.date).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant={appStatusBadge.variant}>{appStatusBadge.text}</Badge>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

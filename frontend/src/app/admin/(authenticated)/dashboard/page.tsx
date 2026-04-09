import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui'
import { Users, Hourglass, UserCheck, Briefcase, Activity, ClipboardList, Plus } from 'lucide-react'
import { formatJobStatus, getJobStatusBadgeVariant, getMultiDayDisplayStatus, getJobDateDisplay } from '@/lib/utils'
import type { JobWithDays } from '@/types'

async function getAdminDashboardData() {
  const supabase = await createClient()

  // Get stats
  const [
    { count: totalBAs },
    { count: pendingBAs },
    { count: approvedBAs },
    { count: totalJobs },
    { count: activeJobs },
    { count: pendingApplications },
  ] = await Promise.all([
    supabase.from('ba_profiles').select('*', { count: 'exact', head: true }),
    supabase.from('ba_profiles').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('ba_profiles').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
    supabase.from('jobs').select('*', { count: 'exact', head: true }),
    supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('job_applications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ])

  // Get pending BAs
  const { data: pendingBAsList } = await supabase
    .from('ba_profiles')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(5)

  // Get published jobs with days/locations and type info
  const { data: activeJobsList } = await supabase
    .from('jobs')
    .select('*, job_types(name), job_days(*, job_day_locations(*))')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(20)

  // Get recent applications
  const { data: recentApplications } = await supabase
    .from('job_applications')
    .select('*, ba_profiles(name), jobs(title, brand)')
    .eq('status', 'pending')
    .order('applied_at', { ascending: false })
    .limit(5)

  // Split jobs into active and completed
  const allJobs = (activeJobsList || []) as (JobWithDays & { job_types?: { name: string } | null })[]
  const activeJobs2 = allJobs
    .map(job => ({ ...job, displayStatus: getMultiDayDisplayStatus(job) }))
    .filter(job => job.displayStatus === 'in_progress' || job.displayStatus === 'upcoming')
    .sort((a, b) => {
      if (a.displayStatus === 'in_progress' && b.displayStatus !== 'in_progress') return -1
      if (b.displayStatus === 'in_progress' && a.displayStatus !== 'in_progress') return 1
      const aDate = [...(a.job_days || [])].sort((x, y) => x.date.localeCompare(y.date))[0]?.date || ''
      const bDate = [...(b.job_days || [])].sort((x, y) => x.date.localeCompare(y.date))[0]?.date || ''
      return aDate.localeCompare(bDate)
    })
    .slice(0, 5)

  const completedJobs = allJobs
    .map(job => ({ ...job, displayStatus: getMultiDayDisplayStatus(job) }))
    .filter(job => job.displayStatus === 'completed')
    .slice(0, 5)

  return {
    stats: {
      totalBAs: totalBAs || 0,
      pendingBAs: pendingBAs || 0,
      approvedBAs: approvedBAs || 0,
      totalJobs: totalJobs || 0,
      activeJobs: activeJobs || 0,
      pendingApplications: pendingApplications || 0,
    },
    pendingBAsList: pendingBAsList || [],
    activeJobsList: activeJobs2,
    completedJobsList: completedJobs,
    recentApplications: recentApplications || [],
  }
}

export default async function AdminDashboardPage() {
  const { stats, pendingBAsList, activeJobsList, completedJobsList, recentApplications } = await getAdminDashboardData()

  const sortedActiveJobs = activeJobsList

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-heading">Admin Dashboard</h1>
          <p className="text-primary-400">Manage your staffing operations</p>
        </div>
        <Link
          href="/admin/jobs/new"
          className="px-4 py-2 bg-primary-400 text-white rounded-lg hover:bg-primary-500 transition-colors inline-flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Create Job
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Users className="w-7 h-7 text-primary-400" />
              <div>
                <p className="text-sm text-primary-400">Total BAs</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalBAs}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Hourglass className="w-7 h-7 text-primary-400" />
              <div>
                <p className="text-sm text-primary-400">Pending Approvals</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pendingBAs}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <UserCheck className="w-7 h-7 text-primary-400" />
              <div>
                <p className="text-sm text-primary-400">Approved BAs</p>
                <p className="text-2xl font-bold text-gray-900">{stats.approvedBAs}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Briefcase className="w-7 h-7 text-primary-400" />
              <div>
                <p className="text-sm text-primary-400">Total Jobs</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalJobs}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Activity className="w-7 h-7 text-primary-400" />
              <div>
                <p className="text-sm text-primary-400">Active Jobs</p>
                <p className="text-2xl font-bold text-gray-900">{stats.activeJobs}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <ClipboardList className="w-7 h-7 text-primary-400" />
              <div>
                <p className="text-sm text-primary-400">Pending Applications</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pendingApplications}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2x2 Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Jobs (top-left) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Active Jobs</CardTitle>
              <Link href="/admin/jobs" className="text-sm text-primary-400 hover:text-primary-500">View all</Link>
            </div>
          </CardHeader>
          <CardContent>
            {sortedActiveJobs.length === 0 ? (
              <div className="text-center py-8 text-primary-400">No active jobs</div>
            ) : (
              <div className="space-y-3">
                {sortedActiveJobs.map((job) => (
                  <Link key={job.id} href={`/admin/jobs/${job.id}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div>
                      <p className="font-medium text-gray-900">{job.title}</p>
                      <p className="text-sm text-primary-400">{job.brand} - {getJobDateDisplay(job)}</p>
                      <p className="text-sm text-primary-400">{job.slots_filled}/{job.slots} slots filled</p>
                    </div>
                    <Badge variant={getJobStatusBadgeVariant(job.displayStatus)}>{formatJobStatus(job.displayStatus)}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recently Completed Jobs (top-right) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recently Completed</CardTitle>
              <Link href="/admin/jobs" className="text-sm text-primary-400 hover:text-primary-500">View all</Link>
            </div>
          </CardHeader>
          <CardContent>
            {completedJobsList.length === 0 ? (
              <div className="text-center py-8 text-primary-400">No completed jobs yet</div>
            ) : (
              <div className="space-y-3">
                {completedJobsList.map((job) => (
                  <Link key={job.id} href={`/admin/jobs/${job.id}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div>
                      <p className="font-medium text-gray-900">{job.title}</p>
                      <p className="text-sm text-primary-400">
                        {job.brand}
                        {(job as typeof job & { job_types?: { name: string } | null }).job_types?.name && ` - ${(job as typeof job & { job_types?: { name: string } | null }).job_types!.name}`}
                      </p>
                      <p className="text-sm text-primary-400">{getJobDateDisplay(job)} - {job.slots_filled} BAs</p>
                    </div>
                    <Badge variant="default">Completed</Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Job Applications (bottom-left) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Applications</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {recentApplications.length === 0 ? (
              <div className="text-center py-8 text-primary-400">No pending applications</div>
            ) : (
              <div className="space-y-3">
                {recentApplications.map((app: { id: string; applied_at: string; status: string; ba_profiles: { name: string }; jobs: { title: string; brand: string } }) => (
                  <div key={app.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{app.ba_profiles?.name}</p>
                      <p className="text-sm text-primary-400">{app.jobs?.title} ({app.jobs?.brand})</p>
                      <p className="text-xs text-gray-400">{new Date(app.applied_at).toLocaleDateString()}</p>
                    </div>
                    <Link href={`/admin/applications/${app.id}`} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100">
                      Review
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending BA Approvals (bottom-right) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Pending BA Approvals</CardTitle>
              <Link href="/admin/bas/pending" className="text-sm text-primary-400 hover:text-primary-500">View all</Link>
            </div>
          </CardHeader>
          <CardContent>
            {pendingBAsList.length === 0 ? (
              <div className="text-center py-8 text-primary-400">No pending approvals</div>
            ) : (
              <div className="space-y-3">
                {pendingBAsList.map((ba: { id: string; name: string; zip_code: string; created_at: string }) => (
                  <div key={ba.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{ba.name}</p>
                      <p className="text-sm text-primary-400">ZIP: {ba.zip_code} - Applied {new Date(ba.created_at).toLocaleDateString()}</p>
                    </div>
                    <Link href={`/admin/bas/${ba.id}`} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100">
                      Review
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

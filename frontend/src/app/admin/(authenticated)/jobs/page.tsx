import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'
import { JobsTable } from '@/components/admin/jobs-table'
import { JobsPageClient } from '@/components/admin/jobs-page-client'

async function getJobs(archivedOnly: boolean) {
  const supabase = await createClient()

  const query = supabase
    .from('jobs')
    .select('*, job_types(id, name), job_days(*, job_day_locations(*))')
    .order('created_at', { ascending: false })

  const { data } = archivedOnly
    ? await query.eq('status', 'archived')
    : await query.neq('status', 'archived')

  return data || []
}

async function getJobTypes() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('job_types')
    .select('id, name')
    .eq('is_archived', false)
    .order('sort_order')
  return data || []
}

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login')
  }

  const { view } = await searchParams
  const archivedView = view === 'archived'

  const [jobs, jobTypes] = await Promise.all([getJobs(archivedView), getJobTypes()])

  const tabClass = (active: boolean) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      active
        ? 'border-primary-400 text-primary-500'
        : 'border-transparent text-gray-500 hover:text-gray-700'
    }`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-heading">Jobs</h1>
          <p className="text-primary-400">
            {archivedView ? 'Archived jobs (hidden from default views)' : 'Manage your job listings'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <JobsPageClient />
          {!archivedView && (
            <Link
              href="/admin/jobs/new"
              className="px-4 py-2 bg-primary-400 text-white rounded-lg hover:bg-primary-500 transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Create Job
            </Link>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 flex gap-2">
        <Link href="/admin/jobs" className={tabClass(!archivedView)}>
          Active
        </Link>
        <Link href="/admin/jobs?view=archived" className={tabClass(archivedView)}>
          Archived
        </Link>
      </div>

      <JobsTable jobs={jobs} jobTypes={jobTypes} />
    </div>
  )
}

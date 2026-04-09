import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'
import { JobsTable } from '@/components/admin/jobs-table'
import { JobsPageClient } from '@/components/admin/jobs-page-client'

async function getJobs() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('jobs')
    .select('*, job_types(id, name), job_days(*, job_day_locations(*))')
    .neq('status', 'archived')
    .order('created_at', { ascending: false })

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

export default async function AdminJobsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login')
  }

  const [jobs, jobTypes] = await Promise.all([getJobs(), getJobTypes()])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-heading">Jobs</h1>
          <p className="text-primary-400">Manage your job listings</p>
        </div>
        <div className="flex items-center gap-2">
          <JobsPageClient />
          <Link
            href="/admin/jobs/new"
            className="px-4 py-2 bg-primary-400 text-white rounded-lg hover:bg-primary-500 transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create Job
          </Link>
        </div>
      </div>

      <JobsTable jobs={jobs} jobTypes={jobTypes} />
    </div>
  )
}

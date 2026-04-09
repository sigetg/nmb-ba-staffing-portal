import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'
import { JobsTable } from '@/components/admin/jobs-table'

async function getJobs() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('jobs')
    .select('*, job_days(*, job_day_locations(*))')
    .neq('status', 'archived')
    .order('created_at', { ascending: false })

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

  const jobs = await getJobs()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-heading">Jobs</h1>
          <p className="text-primary-400">Manage your job listings</p>
        </div>
        <Link
          href="/admin/jobs/new"
          className="px-4 py-2 bg-primary-400 text-white rounded-lg hover:bg-primary-500 transition-colors inline-flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Create Job
        </Link>
      </div>

      <JobsTable jobs={jobs} />
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from '@/components/ui'
import { Plus, Briefcase, Eye, Pencil } from 'lucide-react'
import { formatJobStatus, parseLocalDate } from '@/lib/utils'

async function getJobs(searchParams: { status?: string; brand?: string }) {
  const supabase = await createClient()

  let query = supabase.from('jobs').select('*', { count: 'exact' })

  if (searchParams.status) {
    query = query.eq('status', searchParams.status)
  }
  if (searchParams.brand) {
    query = query.ilike('brand', `%${searchParams.brand}%`)
  }

  const { data, count } = await query.order('date', { ascending: false })

  return { jobs: data || [], total: count || 0 }
}

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; brand?: string }>
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login')
  }

  const params = await searchParams
  const { jobs, total } = await getJobs(params)

  const statusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
      draft: 'default',
      published: 'info',
      in_progress: 'success',
      completed: 'default',
      cancelled: 'error',
    }
    return variants[status] || 'default'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-heading">Jobs</h1>
          <p className="text-primary-400">Manage your job listings ({total} total)</p>
        </div>
        <Link
          href="/admin/jobs/new"
          className="px-4 py-2 bg-primary-400 text-white rounded-lg hover:bg-primary-500 transition-colors inline-flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Create Job
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <form className="flex flex-wrap gap-4">
            <select
              name="status"
              defaultValue={params.status || ''}
              className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm"
            >
              <option value="">All Statuses</option>
              <option value="draft">DRAFT</option>
              <option value="published">PUBLISHED</option>
              <option value="in_progress">IN PROGRESS</option>
              <option value="completed">COMPLETED</option>
              <option value="cancelled">CANCELLED</option>
            </select>
            <input
              type="text"
              name="brand"
              placeholder="Search by brand..."
              defaultValue={params.brand || ''}
              className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200"
            >
              Filter
            </button>
          </form>
        </CardContent>
      </Card>

      {/* Jobs List */}
      <Card>
        <CardContent className="p-0">
          {jobs.length === 0 ? (
            <div className="text-center py-12 text-primary-400">
              <Briefcase className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No jobs found</p>
              <Link href="/admin/jobs/new" className="text-primary-400 hover:text-primary-500 mt-2 inline-block">
                Create your first job
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 text-sm font-medium text-primary-400">Job</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-primary-400">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-primary-400">Location</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-primary-400">Slots</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-primary-400">Pay Rate</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-primary-400 w-40">Status</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-primary-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job: { id: string; title: string; brand: string; date: string; start_time: string; end_time: string; location: string; slots: number; slots_filled: number; pay_rate: number; status: string }) => (
                    <tr key={job.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-gray-900">{job.title}</p>
                          <p className="text-sm text-primary-400">{job.brand}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-sm text-gray-900">
                            {parseLocalDate(job.date).toLocaleDateString()}
                          </p>
                          <p className="text-sm text-primary-400">
                            {job.start_time} - {job.end_time}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {job.location}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {job.slots_filled}/{job.slots}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900">
                        ${job.pay_rate}/hr
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={statusBadge(job.status)}>{formatJobStatus(job.status)}</Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/jobs/${job.id}`}
                            className="p-2 text-primary-400 hover:text-gray-700"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <Link
                            href={`/admin/jobs/${job.id}/edit`}
                            className="p-2 text-primary-400 hover:text-gray-700"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

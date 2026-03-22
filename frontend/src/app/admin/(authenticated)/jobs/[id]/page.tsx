import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui'
import { ChevronLeft, Calendar, Clock, MapPin, FileText, Pencil } from 'lucide-react'
import type { Job, JobApplication, CheckIn } from '@/types'
import { formatJobStatus, parseLocalDate } from '@/lib/utils'

interface ApplicationWithBA extends JobApplication {
  ba_profiles: { id: string; name: string; phone: string }
}

export default async function AdminJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .single()

  if (jobError || !job) {
    notFound()
  }

  const { data: applications } = await supabase
    .from('job_applications')
    .select('*, ba_profiles(id, name, phone)')
    .eq('job_id', id)
    .order('applied_at', { ascending: false })

  const { data: checkIns } = await supabase
    .from('check_ins')
    .select('*')
    .eq('job_id', id)

  const typedJob = job as Job
  const typedApplications = (applications || []) as ApplicationWithBA[]
  const typedCheckIns = (checkIns || []) as CheckIn[]
  const approvedApplications = typedApplications.filter(a => a.status === 'approved')

  const statusVariant = (status: string) => {
    const variants: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
      draft: 'default',
      published: 'info',
      in_progress: 'success',
      completed: 'default',
      cancelled: 'error',
    }
    return variants[status] || 'default'
  }

  const appStatusVariant = (status: string) => {
    const variants: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
      pending: 'warning',
      approved: 'success',
      rejected: 'error',
      withdrawn: 'default',
    }
    return variants[status] || 'default'
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/jobs" className="p-2 rounded-lg hover:bg-gray-100">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-heading">Job Details</h1>
        </div>
        <Link
          href={`/admin/jobs/${id}/edit`}
          className="px-4 py-2 bg-primary-400 text-white rounded-lg hover:bg-primary-500 transition-colors inline-flex items-center gap-2"
        >
          <Pencil className="w-4 h-4" />
          Edit
        </Link>
      </div>

      {/* Job Header Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{typedJob.title}</h2>
              <p className="text-primary-400">{typedJob.brand}</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-lg font-semibold text-gray-900">${typedJob.pay_rate}/hr</span>
              <Badge variant={statusVariant(typedJob.status)}>{formatJobStatus(typedJob.status)}</Badge>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-primary-400">
              Slots: {typedJob.slots_filled}/{typedJob.slots} filled
            </p>
            <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary-400 h-2 rounded-full"
                style={{ width: `${Math.min((typedJob.slots_filled / typedJob.slots) * 100, 100)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-primary-400 flex-shrink-0" />
              <div>
                <p className="text-sm text-primary-400">Date</p>
                <p className="font-medium text-gray-900">
                  {parseLocalDate(typedJob.date).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-primary-400 flex-shrink-0" />
              <div>
                <p className="text-sm text-primary-400">Time</p>
                <p className="font-medium text-gray-900">
                  {typedJob.start_time} - {typedJob.end_time}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-primary-400 flex-shrink-0" />
              <div>
                <p className="text-sm text-primary-400">Location</p>
                <p className="font-medium text-gray-900">{typedJob.location}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Description Card */}
      {typedJob.description && (
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 whitespace-pre-wrap">{typedJob.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Resources Card */}
      {typedJob.worksheet_url && (
        <Card>
          <CardHeader>
            <CardTitle>Resources</CardTitle>
          </CardHeader>
          <CardContent>
            <a
              href={typedJob.worksheet_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary-400 hover:text-primary-500"
            >
              <FileText className="w-4 h-4" />
              View Worksheet
            </a>
          </CardContent>
        </Card>
      )}

      {/* Applications Card */}
      <Card>
        <CardHeader>
          <CardTitle>Applications ({typedApplications.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {typedApplications.length === 0 ? (
            <div className="text-center py-8 text-primary-400">
              No applications yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 text-sm font-medium text-primary-400">BA Name</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-primary-400">Phone</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-primary-400">Applied</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-primary-400">Status</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-primary-400">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {typedApplications.map((app) => (
                    <tr key={app.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {app.ba_profiles?.name}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {app.ba_profiles?.phone}
                      </td>
                      <td className="py-3 px-4 text-sm text-primary-400">
                        {new Date(app.applied_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={appStatusVariant(app.status)}>{app.status}</Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/admin/applications/${app.id}`}
                          className="text-sm text-primary-400 hover:text-primary-500"
                        >
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assigned BAs Card */}
      <Card>
        <CardHeader>
          <CardTitle>Assigned BAs ({approvedApplications.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {approvedApplications.length === 0 ? (
            <div className="text-center py-8 text-primary-400">
              No BAs assigned yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 text-sm font-medium text-primary-400">BA Name</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-primary-400">Check-in</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-primary-400">Check-out</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-primary-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {approvedApplications.map((app) => {
                    const checkIn = typedCheckIns.find(c => c.ba_id === app.ba_id)
                    return (
                      <tr key={app.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm">
                          <Link
                            href={`/admin/bas/${app.ba_id}`}
                            className="text-primary-400 hover:text-primary-500"
                          >
                            {app.ba_profiles?.name}
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {checkIn?.check_in_time
                            ? new Date(checkIn.check_in_time).toLocaleTimeString()
                            : '—'}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {checkIn?.check_out_time
                            ? new Date(checkIn.check_out_time).toLocaleTimeString()
                            : '—'}
                        </td>
                        <td className="py-3 px-4">
                          {checkIn?.check_out_time ? (
                            <Badge variant="default">Completed</Badge>
                          ) : checkIn?.check_in_time ? (
                            <Badge variant="success">Checked In</Badge>
                          ) : (
                            <Badge variant="warning">Not Checked In</Badge>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

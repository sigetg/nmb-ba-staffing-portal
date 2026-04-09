import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui'
import { ChevronLeft, Calendar, Clock, MapPin, FileText, Pencil } from 'lucide-react'
import type { Job, JobApplication, CheckIn, JobDay, JobDayLocation, LocationCheckIn } from '@/types'
import { ExportCSVButton } from '@/components/ui/export-csv-button'
import { JobActions } from '@/components/admin/job-actions'
import { formatJobStatus, getJobDisplayStatus, getMultiDayDisplayStatus, getJobStatusBadgeVariant, getTimezoneAbbr, parseLocalDate } from '@/lib/utils'

interface ApplicationWithBA extends JobApplication {
  ba_profiles: { id: string; name: string; phone: string; users: { email: string } | null }
}

function formatTime(time: string) {
  const [h, m] = time.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${h12}:${m} ${ampm}`
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function AdminJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('*, job_days(*, job_day_locations(*))')
    .eq('id', id)
    .single()

  if (jobError || !job) {
    notFound()
  }

  const { data: applications } = await supabase
    .from('job_applications')
    .select('*, ba_profiles(id, name, phone, users(email))')
    .eq('job_id', id)
    .order('applied_at', { ascending: false })

  const { data: checkIns } = await supabase
    .from('check_ins')
    .select('*')
    .eq('job_id', id)

  // Fetch location check-ins for multi-day jobs
  const locationIds = (job.job_days || []).flatMap(
    (d: JobDay) => (d.job_day_locations || []).map((l: JobDayLocation) => l.id)
  )

  let locationCheckIns: LocationCheckIn[] = []
  if (locationIds.length > 0) {
    const { data: locCIs } = await supabase
      .from('location_check_ins')
      .select('*')
      .in('job_day_location_id', locationIds)
    locationCheckIns = (locCIs || []) as LocationCheckIn[]
  }

  const { data: photos } = await supabase
    .from('job_photos')
    .select('*')
    .eq('job_id', id)

  const typedJob = job as Job
  const typedApplications = (applications || []) as ApplicationWithBA[]
  const typedCheckIns = (checkIns || []) as CheckIn[]
  const approvedApplications = typedApplications.filter(a => a.status === 'approved')

  const isMultiDay = (typedJob.job_days || []).length > 0
  const displayStatus = isMultiDay
    ? getMultiDayDisplayStatus(job as import('@/types').JobWithDays)
    : typedJob.date && typedJob.start_time && typedJob.end_time
      ? getJobDisplayStatus({ status: typedJob.status, date: typedJob.date, start_time: typedJob.start_time, end_time: typedJob.end_time, timezone: typedJob.timezone })
      : typedJob.status === 'draft' ? 'draft' : typedJob.status === 'cancelled' ? 'cancelled' : typedJob.status === 'archived' ? 'archived' : 'in_progress'

  // Sort days and locations
  const sortedDays = [...(typedJob.job_days || [])].sort((a, b) => a.sort_order - b.sort_order)
  sortedDays.forEach(d => {
    if (d.job_day_locations) {
      d.job_day_locations.sort((a: JobDayLocation, b: JobDayLocation) => a.sort_order - b.sort_order)
    }
  })

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
        <div className="flex items-center gap-2">
          <JobActions
            jobId={id}
            jobStatus={typedJob.status}
            displayStatus={displayStatus}
            jobTitle={typedJob.title}
            variant="button"
          />
          <Link
            href={`/admin/jobs/${id}/edit`}
            className="px-4 py-2 bg-primary-400 text-white rounded-lg hover:bg-primary-500 transition-colors inline-flex items-center gap-2"
          >
            <Pencil className="w-4 h-4" />
            Edit
          </Link>
        </div>
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
              <Badge variant={getJobStatusBadgeVariant(displayStatus)}>{formatJobStatus(displayStatus)}</Badge>
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

      {/* Schedule Card - Multi-day or Single-day */}
      {isMultiDay ? (
        <Card>
          <CardHeader>
            <CardTitle>Schedule ({sortedDays.length} day{sortedDays.length !== 1 ? 's' : ''})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {sortedDays.map((day) => (
                <div key={day.id} className="border border-gray-100 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-4 h-4 text-primary-500" />
                    <span className="font-medium">{formatDate(day.date)}</span>
                  </div>
                  <div className="space-y-2 pl-6">
                    {(day.job_day_locations || []).map((loc: JobDayLocation, idx: number) => (
                      <div key={loc.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                        <span className="w-5 h-5 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-xs font-medium shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="w-3.5 h-3.5 text-gray-400" />
                            <span>{loc.location}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                            <Clock className="w-3 h-3" />
                            <span>{formatTime(loc.start_time)} - {formatTime(loc.end_time)}</span>
                          </div>
                        </div>
                        {/* Per-location attendance summary */}
                        <div className="text-xs text-gray-400">
                          {locationCheckIns.filter(ci => ci.job_day_location_id === loc.id && !ci.skipped).length} checked in
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
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
                    {typedJob.date ? parseLocalDate(typedJob.date).toLocaleDateString() : '—'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-primary-400 flex-shrink-0" />
                <div>
                  <p className="text-sm text-primary-400">Time</p>
                  <p className="font-medium text-gray-900">
                    {typedJob.start_time && typedJob.end_time
                      ? `${typedJob.start_time} - ${typedJob.end_time} ${getTimezoneAbbr(typedJob.timezone)}`
                      : '—'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-primary-400 flex-shrink-0" />
                <div>
                  <p className="text-sm text-primary-400">Location</p>
                  <p className="font-medium text-gray-900">{typedJob.location || '—'}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* Location Attendance (for multi-day jobs) */}
      {isMultiDay && locationCheckIns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Location Attendance</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 text-sm font-medium text-primary-400">BA Name</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-primary-400">Day</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-primary-400">Location</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-primary-400">Check-in</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-primary-400">Check-out</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-primary-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDays.flatMap(day =>
                    (day.job_day_locations || []).flatMap((loc: JobDayLocation) =>
                      approvedApplications.map(app => {
                        const ci = locationCheckIns.find(
                          c => c.job_day_location_id === loc.id && c.ba_id === app.ba_id
                        )
                        return (
                          <tr key={`${day.id}-${loc.id}-${app.ba_id}`} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-2 px-4 text-sm">{app.ba_profiles?.name}</td>
                            <td className="py-2 px-4 text-xs text-gray-500">{formatDate(day.date)}</td>
                            <td className="py-2 px-4 text-xs text-gray-500">{loc.location}</td>
                            <td className="py-2 px-4 text-xs">
                              {ci?.check_in_time ? new Date(ci.check_in_time).toLocaleTimeString() : '—'}
                              {ci?.check_in_gps_override && <span className="ml-1 text-amber-500">(GPS override)</span>}
                            </td>
                            <td className="py-2 px-4 text-xs">
                              {ci?.check_out_time ? new Date(ci.check_out_time).toLocaleTimeString() : '—'}
                            </td>
                            <td className="py-2 px-4">
                              {ci?.skipped ? (
                                <Badge variant="error">Skipped</Badge>
                              ) : ci?.check_out_time ? (
                                <Badge variant="default">Done</Badge>
                              ) : ci?.check_in_time ? (
                                <Badge variant="success">Active</Badge>
                              ) : (
                                <Badge variant="warning">Pending</Badge>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )
                  )}
                </tbody>
              </table>
            </div>
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
                      <td className="py-3 px-4 text-sm text-gray-900">{app.ba_profiles?.name}</td>
                      <td className="py-3 px-4 text-sm text-gray-900">{app.ba_profiles?.phone}</td>
                      <td className="py-3 px-4 text-sm text-primary-400">
                        {new Date(app.applied_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={appStatusVariant(app.status)}>{app.status}</Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/admin/applications/${app.id}`}
                          className={`text-sm ${app.status === 'approved' ? 'text-gray-400 hover:text-gray-500' : 'text-primary-400 hover:text-primary-500'}`}
                        >
                          {app.status === 'approved' ? 'View' : 'Review'}
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

      {/* Assigned BAs Card (legacy check-ins) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Assigned BAs ({approvedApplications.length})</CardTitle>
            <ExportCSVButton
              data={approvedApplications.map(a => ({
                name: a.ba_profiles?.name || '',
                phone: a.ba_profiles?.phone || '',
                email: a.ba_profiles?.users?.email || '',
              }))}
              filename={`assigned-bas-${typedJob.title.replace(/\s+/g, '-').toLowerCase()}`}
            />
          </div>
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
                          <Link href={`/admin/bas/${app.ba_id}`} className="text-primary-400 hover:text-primary-500">
                            {app.ba_profiles?.name}
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {checkIn?.check_in_time ? new Date(checkIn.check_in_time).toLocaleTimeString() : '—'}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {checkIn?.check_out_time ? new Date(checkIn.check_out_time).toLocaleTimeString() : '—'}
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

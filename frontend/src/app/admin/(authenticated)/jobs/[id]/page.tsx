import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui'
import { ChevronLeft, Calendar, Clock, MapPin, FileText, Pencil, FileBarChart } from 'lucide-react'
import type { Job, JobApplication, JobDay, JobDayLocation, LocationCheckIn, JobType, JobTypeKpi, JobTypeQuestion, JobTypeQuestionOption, CheckoutResponse, CheckoutResponseValue } from '@/types'
import { ExportCSVButton } from '@/components/ui/export-csv-button'
import { JobActions } from '@/components/admin/job-actions'
import { formatJobStatus, getMultiDayDisplayStatus, getJobStatusBadgeVariant, getTimezoneAbbr, parseLocalDate } from '@/lib/utils'

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

  // Fetch location check-ins
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

  // Fetch job type with KPIs and questions for reporting
  let jobType: JobType | null = null
  if (job.job_type_id) {
    const { data: jt } = await supabase
      .from('job_types')
      .select('*, job_type_kpis(*), job_type_questions(*, job_type_question_options(*))')
      .eq('id', job.job_type_id)
      .single()
    if (jt) {
      if (jt.job_type_kpis) jt.job_type_kpis.sort((a: JobTypeKpi, b: JobTypeKpi) => a.sort_order - b.sort_order)
      if (jt.job_type_questions) {
        jt.job_type_questions.sort((a: JobTypeQuestion, b: JobTypeQuestion) => a.sort_order - b.sort_order)
        for (const q of jt.job_type_questions) {
          if (q.job_type_question_options) q.job_type_question_options.sort((a: JobTypeQuestionOption, b: JobTypeQuestionOption) => a.sort_order - b.sort_order)
        }
      }
      jobType = jt as JobType
    }
  }

  // Fetch checkout responses with values
  const { data: checkoutResponses } = await supabase
    .from('checkout_responses')
    .select('*, checkout_response_values(*), ba_profiles(id, name)')
    .eq('job_id', id)

  const typedCheckoutResponses = (checkoutResponses || []) as (CheckoutResponse & { ba_profiles: { id: string; name: string } })[]

  const typedJob = job as Job
  const typedApplications = (applications || []) as ApplicationWithBA[]
  const approvedApplications = typedApplications.filter(a => a.status === 'approved')

  let displayStatus = getMultiDayDisplayStatus(job as import('@/types').JobWithDays)

  // Enhanced completion: if in_progress and all approved BAs have checked out of final day, mark as completed
  if (displayStatus === 'in_progress' && approvedApplications.length > 0) {
    const sortedJobDays = [...(typedJob.job_days || [])].sort((a, b) => a.date.localeCompare(b.date))
    const finalDay = sortedJobDays[sortedJobDays.length - 1]
    if (finalDay) {
      const finalDayLocationIds = new Set((finalDay.job_day_locations || []).map((l: JobDayLocation) => l.id))
      const allComplete = approvedApplications.every(app => {
        return Array.from(finalDayLocationIds).every(locId => {
          const ci = locationCheckIns.find(c => c.job_day_location_id === locId && c.ba_id === app.ba_id)
          return ci && ci.check_out_time
        })
      })
      if (allComplete) displayStatus = 'completed'
    }
  }

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
          {typedCheckoutResponses.length > 0 && (
            <Link
              href={`/admin/reports/preview?jobs=${id}`}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors inline-flex items-center gap-2"
            >
              <FileBarChart className="w-4 h-4" />
              Export Report
            </Link>
          )}
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

      {/* Schedule Card */}
      {sortedDays.length > 0 && (
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

      {/* Location Attendance */}
      {locationCheckIns.length > 0 && (
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

      {/* KPI Summary & Per-BA Responses */}
      {jobType && typedCheckoutResponses.length > 0 && (() => {
        const kpis = jobType.job_type_kpis || []
        const questions = jobType.job_type_questions || []
        const mcQuestions = questions.filter(q => q.question_type === 'multiple_choice')
        const textQuestions = questions.filter(q => q.question_type === 'free_text')

        // Build per-BA map: baId -> { name, values[] }
        const baMap = new Map<string, { name: string; values: CheckoutResponseValue[] }>()
        for (const resp of typedCheckoutResponses) {
          const existing = baMap.get(resp.ba_id)
          const vals = resp.checkout_response_values || []
          if (existing) {
            existing.values.push(...vals)
          } else {
            baMap.set(resp.ba_id, { name: resp.ba_profiles?.name || 'Unknown', values: vals })
          }
        }
        const baEntries = Array.from(baMap.entries())

        // Aggregate KPI data
        const kpiAggregates = kpis.map(kpi => {
          const allValues = typedCheckoutResponses.flatMap(r =>
            (r.checkout_response_values || []).filter(v => v.kpi_id === kpi.id && v.numeric_value != null)
          )
          const sum = allValues.reduce((acc, v) => acc + (v.numeric_value || 0), 0)
          const avg = allValues.length > 0 ? sum / allValues.length : 0
          return { kpi, sum, avg, count: allValues.length }
        })

        // Aggregate MC question data
        const mcAggregates = mcQuestions.map(q => {
          const allValues = typedCheckoutResponses.flatMap(r =>
            (r.checkout_response_values || []).filter(v => v.question_id === q.id && v.option_id)
          )
          const total = allValues.length
          const options = (q.job_type_question_options || []).map(opt => {
            const count = allValues.filter(v => v.option_id === opt.id).length
            return { label: opt.label, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 }
          })
          return { question: q, options, total }
        })

        return (
          <>
            {/* KPI Summary */}
            <Card>
              <CardHeader>
                <CardTitle>KPI Summary ({jobType.name})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Numeric KPIs */}
                  {kpiAggregates.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {kpiAggregates.map(({ kpi, sum, avg, count }) => (
                        <div key={kpi.id} className="bg-gray-50 rounded-lg p-4 text-center">
                          <p className="text-xs text-primary-400 uppercase tracking-wide mb-1">{kpi.label}</p>
                          <p className="text-2xl font-bold text-gray-900">
                            {kpi.aggregation === 'avg' ? avg.toFixed(1) : sum}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {kpi.aggregation === 'sum' ? `Total (avg ${avg.toFixed(1)}/BA)` : `Avg across ${count} responses`}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* MC Question Breakdowns */}
                  {mcAggregates.map(({ question, options, total }) => (
                    <div key={question.id}>
                      <p className="text-sm font-medium text-gray-700 mb-2">{question.question_text}</p>
                      <div className="space-y-1.5">
                        {options.map((opt) => (
                          <div key={opt.label} className="flex items-center gap-3">
                            <div className="flex-1">
                              <div className="flex justify-between text-xs mb-0.5">
                                <span className="text-gray-600">{opt.label}</span>
                                <span className="text-gray-400">{opt.count}/{total} ({opt.pct}%)</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div className="bg-primary-400 h-2 rounded-full" style={{ width: `${opt.pct}%` }} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Free-text responses */}
                  {textQuestions.map(q => {
                    const answers = baEntries
                      .map(([, ba]) => {
                        const val = ba.values.find(v => v.question_id === q.id && v.text_value)
                        return val ? { name: ba.name, text: val.text_value! } : null
                      })
                      .filter(Boolean) as { name: string; text: string }[]
                    if (answers.length === 0) return null
                    return (
                      <div key={q.id}>
                        <p className="text-sm font-medium text-gray-700 mb-2">{q.question_text}</p>
                        <div className="space-y-2">
                          {answers.map((a, i) => (
                            <div key={i} className="bg-gray-50 rounded-lg p-3">
                              <p className="text-xs font-medium text-primary-400 mb-1">{a.name}</p>
                              <p className="text-sm text-gray-700">{a.text}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Per-BA Response Table */}
            {(kpis.length > 0 || mcQuestions.length > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle>Per-BA Responses</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <th className="text-left py-3 px-4 text-sm font-medium text-primary-400">BA Name</th>
                          {kpis.map(kpi => (
                            <th key={kpi.id} className="text-left py-3 px-4 text-sm font-medium text-primary-400">{kpi.label}</th>
                          ))}
                          {mcQuestions.map(q => (
                            <th key={q.id} className="text-left py-3 px-4 text-sm font-medium text-primary-400">{q.question_text}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {baEntries.map(([baId, ba]) => (
                          <tr key={baId} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-2 px-4 text-sm font-medium text-gray-900">{ba.name}</td>
                            {kpis.map(kpi => {
                              const val = ba.values.find(v => v.kpi_id === kpi.id)
                              return (
                                <td key={kpi.id} className="py-2 px-4 text-sm text-gray-700">
                                  {val?.numeric_value != null ? val.numeric_value : '\u2014'}
                                </td>
                              )
                            })}
                            {mcQuestions.map(q => {
                              const val = ba.values.find(v => v.question_id === q.id && v.option_id)
                              const opt = val ? (q.job_type_question_options || []).find(o => o.id === val.option_id) : null
                              return (
                                <td key={q.id} className="py-2 px-4 text-sm text-gray-700">
                                  {opt?.label || '\u2014'}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )
      })()}

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
                    const baCheckIns = locationCheckIns.filter(c => c.ba_id === app.ba_id && !c.skipped)
                    const firstCheckIn = baCheckIns.length > 0 ? baCheckIns.reduce((a, b) => a.check_in_time < b.check_in_time ? a : b) : null
                    const hasCheckedOut = baCheckIns.some(c => c.check_out_time)
                    const lastCheckOut = baCheckIns.filter(c => c.check_out_time).reduce((a, b) => (a?.check_out_time || '') > (b?.check_out_time || '') ? a : b, null as LocationCheckIn | null)
                    return (
                      <tr key={app.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm">
                          <Link href={`/admin/bas/${app.ba_id}`} className="text-primary-400 hover:text-primary-500">
                            {app.ba_profiles?.name}
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {firstCheckIn ? new Date(firstCheckIn.check_in_time).toLocaleTimeString() : '—'}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {lastCheckOut?.check_out_time ? new Date(lastCheckOut.check_out_time).toLocaleTimeString() : '—'}
                        </td>
                        <td className="py-3 px-4">
                          {hasCheckedOut ? (
                            <Badge variant="default">Completed</Badge>
                          ) : firstCheckIn ? (
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

'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, Badge, Alert } from '@/components/ui'
import { Button } from '@/components/ui/button'
import { ChevronLeft, Download, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { generateReportPDF } from '@/lib/pdf-report'
import type { JobType, JobTypeKpi, JobTypeQuestion, JobTypeQuestionOption, CheckoutResponseValue } from '@/types'

interface ReportJob {
  id: string
  title: string
  brand: string
  date?: string | null
  job_type_id?: string | null
  job_types?: { id: string; name: string } | null
  job_days?: { id: string; date: string; job_day_locations?: { id: string; location: string }[] }[]
}

interface PerBAResponse {
  ba_id: string
  ba_name: string
  job_id: string
  values: CheckoutResponseValue[]
}

interface AttendanceRecord {
  job_id: string
  ba_id: string
  ba_name: string
  check_in_time: string
  check_out_time?: string | null
  location?: string | null
}

interface ReportData {
  jobs: ReportJob[]
  job_type: JobType | null
  kpi_aggregates: Record<string, { sum: number; avg: number; count: number; values: number[] }>
  mc_aggregates: Record<string, Record<string, { count: number; percentage: number }>>
  per_ba_responses: PerBAResponse[]
  attendance: AttendanceRecord[]
  photos: { id: string; url: string; ba_id: string; photo_type: string }[]
  ba_map: Record<string, string>
}

export default function ReportPreviewPage() {
  const searchParams = useSearchParams()
  const jobIds = searchParams.get('jobs')?.split(',').filter(Boolean) || []

  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set())
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set())
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    if (jobIds.length === 0) {
      setError('No job IDs provided')
      setIsLoading(false)
      return
    }
    fetchReportData()
  }, [])

  const fetchReportData = async () => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('Not authenticated')
        return
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const res = await fetch(`${apiUrl}/api/reports/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ job_ids: jobIds }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(body.detail || `Error ${res.status}`)
      }

      const data = await res.json()
      setReportData(data)

      // Pre-select all photos
      const allPhotoIds = new Set<string>((data.photos || []).map((p: { id: string }) => p.id))
      setSelectedPhotoIds(allPhotoIds)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report data')
    } finally {
      setIsLoading(false)
    }
  }

  const jobType = reportData?.job_type || null
  const kpis = useMemo(() => (jobType?.job_type_kpis || []).sort((a, b) => a.sort_order - b.sort_order), [jobType])
  const questions = useMemo(() => (jobType?.job_type_questions || []).sort((a, b) => a.sort_order - b.sort_order), [jobType])
  const mcQuestions = useMemo(() => questions.filter(q => q.question_type === 'multiple_choice'), [questions])
  const textQuestions = useMemo(() => questions.filter(q => q.question_type === 'free_text'), [questions])

  // Option lookup
  const optionLookup = useMemo(() => {
    const lookup: Record<string, string> = {}
    for (const q of mcQuestions) {
      for (const opt of (q.job_type_question_options || [])) {
        lookup[opt.id] = opt.label
      }
    }
    return lookup
  }, [mcQuestions])

  const toggleJob = (jobId: string) => {
    setExpandedJobs(prev => {
      const next = new Set(prev)
      if (next.has(jobId)) next.delete(jobId)
      else next.add(jobId)
      return next
    })
  }

  const togglePhoto = (photoId: string) => {
    setSelectedPhotoIds(prev => {
      const next = new Set(prev)
      if (next.has(photoId)) next.delete(photoId)
      else next.add(photoId)
      return next
    })
  }

  const handleDownloadPDF = async () => {
    if (!reportData) return
    setIsGenerating(true)
    try {
      const doc = generateReportPDF({
        ...reportData,
        selectedPhotoIds,
      })
      const typeName = jobType?.name?.replace(/\s+/g, '_') || 'report'
      doc.save(`${typeName}_report_${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (err) {
      setError('Failed to generate PDF')
    } finally {
      setIsGenerating(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400" />
      </div>
    )
  }

  if (error || !reportData) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/jobs" className="p-2 rounded-lg hover:bg-gray-100">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-heading">Report Preview</h1>
        </div>
        <Alert variant="error">{error || 'No report data available'}</Alert>
      </div>
    )
  }

  const baCount = new Set(reportData.per_ba_responses.map(r => r.ba_id)).size

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/jobs" className="p-2 rounded-lg hover:bg-gray-100">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-heading">Report Preview</h1>
            <p className="text-sm text-primary-400">{jobType?.name || 'General'} — {reportData.jobs.length} job{reportData.jobs.length !== 1 ? 's' : ''}, {baCount} BA{baCount !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <Button
          onClick={handleDownloadPDF}
          isLoading={isGenerating}
          leftIcon={<Download className="w-4 h-4" />}
        >
          Download PDF
        </Button>
      </div>

      {/* Jobs List */}
      <Card>
        <CardHeader>
          <CardTitle>Jobs Included</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {reportData.jobs.map(job => (
              <div key={job.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{job.title}</p>
                  <p className="text-sm text-primary-400">{job.brand}</p>
                </div>
                <Link href={`/admin/jobs/${job.id}`} className="text-sm text-primary-400 hover:text-primary-500">
                  View
                </Link>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* KPI Summary */}
      {kpis.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>KPI Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {kpis.map(kpi => {
                const agg = reportData.kpi_aggregates[kpi.id]
                return (
                  <div key={kpi.id} className="bg-gray-50 rounded-lg p-4 text-center">
                    <p className="text-xs text-primary-400 uppercase tracking-wide mb-1">{kpi.label}</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {agg ? (kpi.aggregation === 'avg' ? agg.avg.toFixed(1) : Math.round(agg.sum)) : 0}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {agg
                        ? kpi.aggregation === 'sum'
                          ? `Total (avg ${agg.avg}/BA)`
                          : `Avg across ${agg.count} responses`
                        : 'No data'}
                    </p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* MC Question Breakdowns */}
      {mcQuestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Question Breakdowns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {mcQuestions.map(q => {
                const options = (q.job_type_question_options || []).sort((a, b) => a.sort_order - b.sort_order)
                const mcData = reportData.mc_aggregates[q.id] || {}
                return (
                  <div key={q.id}>
                    <p className="text-sm font-medium text-gray-700 mb-2">{q.question_text}</p>
                    <div className="space-y-1.5">
                      {options.map(opt => {
                        const d = mcData[opt.id]
                        const pct = d?.percentage || 0
                        const count = d?.count || 0
                        const total = Object.values(mcData).reduce((acc, v) => acc + v.count, 0)
                        return (
                          <div key={opt.id} className="flex items-center gap-3">
                            <div className="flex-1">
                              <div className="flex justify-between text-xs mb-0.5">
                                <span className="text-gray-600">{opt.label}</span>
                                <span className="text-gray-400">{count}/{total} ({pct}%)</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div className="bg-primary-400 h-2 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-Job Breakdown (collapsible) */}
      {reportData.jobs.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Per-Job Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {reportData.jobs.map(job => {
                const isExpanded = expandedJobs.has(job.id)
                const jobResponses = reportData.per_ba_responses.filter(r => r.job_id === job.id)
                return (
                  <div key={job.id} className="border border-gray-200 rounded-lg">
                    <button
                      onClick={() => toggleJob(job.id)}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="text-left">
                        <p className="font-medium text-gray-900">{job.title}</p>
                        <p className="text-sm text-primary-400">{job.brand} — {jobResponses.length} responses</p>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </button>
                    {isExpanded && jobResponses.length > 0 && (
                      <div className="border-t border-gray-200 p-4 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100">
                              <th className="text-left py-2 px-2 font-medium text-primary-400">BA Name</th>
                              {kpis.map(kpi => (
                                <th key={kpi.id} className="text-left py-2 px-2 font-medium text-primary-400">{kpi.label}</th>
                              ))}
                              {mcQuestions.map(q => (
                                <th key={q.id} className="text-left py-2 px-2 font-medium text-primary-400">
                                  {q.question_text.length > 20 ? q.question_text.slice(0, 20) + '...' : q.question_text}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {jobResponses.map(r => (
                              <tr key={r.ba_id} className="border-b border-gray-50">
                                <td className="py-2 px-2 font-medium text-gray-900">{r.ba_name}</td>
                                {kpis.map(kpi => {
                                  const v = r.values.find(v => v.kpi_id === kpi.id)
                                  return <td key={kpi.id} className="py-2 px-2 text-gray-700">{v?.numeric_value ?? '\u2014'}</td>
                                })}
                                {mcQuestions.map(q => {
                                  const v = r.values.find(v => v.question_id === q.id && v.option_id)
                                  return <td key={q.id} className="py-2 px-2 text-gray-700">{v?.option_id ? (optionLookup[v.option_id] || '\u2014') : '\u2014'}</td>
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Free Text Responses */}
      {textQuestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Free Text Responses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {textQuestions.map(q => {
                const answers = reportData.per_ba_responses
                  .map(r => {
                    const v = r.values.find(v => v.question_id === q.id && v.text_value)
                    return v ? { name: r.ba_name, text: v.text_value!, jobTitle: reportData.jobs.find(j => j.id === r.job_id)?.title } : null
                  })
                  .filter(Boolean) as { name: string; text: string; jobTitle?: string }[]

                if (answers.length === 0) return null
                return (
                  <div key={q.id}>
                    <p className="text-sm font-medium text-gray-700 mb-2">{q.question_text}</p>
                    <div className="space-y-2">
                      {answers.map((a, i) => (
                        <div key={i} className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs font-medium text-primary-400 mb-1">
                            {a.name}
                            {reportData.jobs.length > 1 && a.jobTitle && <span className="text-gray-400"> — {a.jobTitle}</span>}
                          </p>
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
      )}

      {/* Attendance */}
      {reportData.attendance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Attendance</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 font-medium text-primary-400">BA Name</th>
                    {reportData.jobs.length > 1 && (
                      <th className="text-left py-3 px-4 font-medium text-primary-400">Job</th>
                    )}
                    <th className="text-left py-3 px-4 font-medium text-primary-400">Location</th>
                    <th className="text-left py-3 px-4 font-medium text-primary-400">Check-in</th>
                    <th className="text-left py-3 px-4 font-medium text-primary-400">Check-out</th>
                    <th className="text-left py-3 px-4 font-medium text-primary-400">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.attendance.map((a, i) => {
                    const ci = a.check_in_time ? new Date(a.check_in_time) : null
                    const co = a.check_out_time ? new Date(a.check_out_time) : null
                    let hours = '\u2014'
                    if (ci && co) {
                      const diff = (co.getTime() - ci.getTime()) / (1000 * 60 * 60)
                      hours = diff.toFixed(2) + 'h'
                    }
                    const jobTitle = reportData.jobs.find(j => j.id === a.job_id)?.title
                    return (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-4 font-medium text-gray-900">{a.ba_name}</td>
                        {reportData.jobs.length > 1 && (
                          <td className="py-2 px-4 text-gray-600">{jobTitle}</td>
                        )}
                        <td className="py-2 px-4 text-gray-600">{a.location || '\u2014'}</td>
                        <td className="py-2 px-4 text-gray-600">{ci ? ci.toLocaleString() : '\u2014'}</td>
                        <td className="py-2 px-4 text-gray-600">{co ? co.toLocaleString() : '\u2014'}</td>
                        <td className="py-2 px-4 text-gray-700 font-medium">{hours}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Photos */}
      {reportData.photos.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Photos ({selectedPhotoIds.size}/{reportData.photos.length} selected for PDF)</CardTitle>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedPhotoIds(new Set(reportData.photos.map(p => p.id)))}
                  className="text-xs text-primary-400 hover:text-primary-500"
                >
                  Select All
                </button>
                <button
                  onClick={() => setSelectedPhotoIds(new Set())}
                  className="text-xs text-gray-400 hover:text-gray-500"
                >
                  Clear
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {reportData.photos.map(photo => {
                const isSelected = selectedPhotoIds.has(photo.id)
                const baName = reportData.ba_map[photo.ba_id] || 'Unknown'
                return (
                  <div
                    key={photo.id}
                    onClick={() => togglePhoto(photo.id)}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                      isSelected ? 'border-primary-400 ring-2 ring-primary-200' : 'border-gray-200 opacity-50'
                    }`}
                  >
                    <Image src={photo.url} alt={`${baName} - ${photo.photo_type}`} fill className="object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate">
                      {baName}
                    </div>
                    {isSelected && (
                      <div className="absolute top-1 right-1 w-5 h-5 bg-primary-400 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sticky Download Bar */}
      <div className="sticky bottom-4 flex justify-center">
        <Button
          onClick={handleDownloadPDF}
          isLoading={isGenerating}
          leftIcon={<Download className="w-4 h-4" />}
          className="shadow-2xl"
          size="lg"
        >
          Download PDF Report
        </Button>
      </div>
    </div>
  )
}

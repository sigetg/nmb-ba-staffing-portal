'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, Badge } from '@/components/ui'
import { Button } from '@/components/ui/button'
import { Briefcase, Eye, Pencil, ChevronUp, ChevronDown, ArrowUpDown, FileBarChart } from 'lucide-react'
import { formatJobStatus, getJobStatusBadgeVariant, getMultiDayDisplayStatus, getJobDateDisplay, getJobLocationDisplay } from '@/lib/utils'
import { JobActions } from '@/components/admin/job-actions'
import type { JobWithDays, DisplayJobStatus, JobStatus } from '@/types'

type SortColumn = 'title' | 'date' | 'location' | 'slots' | 'pay_rate' | 'status'
type SortDirection = 'asc' | 'desc'

interface JobsTableProps {
  jobs: (JobWithDays & { job_type_id?: string | null; job_types?: { id: string; name: string } | null })[]
  jobTypes: { id: string; name: string }[]
}

function getEarliestDate(job: JobWithDays): string {
  if (job.job_days?.length > 0) {
    const dates = job.job_days.map(d => d.date).sort()
    return dates[0] || ''
  }
  return job.date || ''
}

const STATUS_ORDER: Record<string, number> = {
  in_progress: 0,
  upcoming: 1,
  published: 2,
  draft: 3,
  completed: 4,
  cancelled: 5,
  archived: 6,
}

function compareJobs(a: JobWithDays, b: JobWithDays, column: SortColumn, direction: SortDirection): number {
  let cmp = 0
  switch (column) {
    case 'title':
      cmp = a.title.localeCompare(b.title)
      break
    case 'date':
      cmp = getEarliestDate(a).localeCompare(getEarliestDate(b))
      break
    case 'location':
      cmp = getJobLocationDisplay(a).localeCompare(getJobLocationDisplay(b))
      break
    case 'slots':
      cmp = a.slots_filled / a.slots - b.slots_filled / b.slots
      break
    case 'pay_rate':
      cmp = a.pay_rate - b.pay_rate
      break
    case 'status': {
      const sa = getMultiDayDisplayStatus(a)
      const sb = getMultiDayDisplayStatus(b)
      cmp = (STATUS_ORDER[sa] ?? 99) - (STATUS_ORDER[sb] ?? 99)
      break
    }
  }
  return direction === 'asc' ? cmp : -cmp
}

function SortIcon({ column, activeColumn, direction }: { column: SortColumn; activeColumn: SortColumn | null; direction: SortDirection }) {
  if (activeColumn !== column) {
    return <ArrowUpDown className="w-3.5 h-3.5 ml-1 inline opacity-40" />
  }
  return direction === 'asc'
    ? <ChevronUp className="w-3.5 h-3.5 ml-1 inline" />
    : <ChevronDown className="w-3.5 h-3.5 ml-1 inline" />
}

export function JobsTable({ jobs, jobTypes }: JobsTableProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const router = useRouter()

  // Determine the type of first selected job (for same-type enforcement)
  const selectedTypeId = useMemo(() => {
    if (selectedIds.size === 0) return null
    const firstId = Array.from(selectedIds)[0]
    const job = jobs.find(j => j.id === firstId)
    return job?.job_type_id || null
  }, [selectedIds, jobs])

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else {
        setSortColumn(null)
        setSortDirection('asc')
      }
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const toggleSelect = (jobId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(jobId)) {
        next.delete(jobId)
      } else {
        next.add(jobId)
      }
      return next
    })
  }

  const filteredJobs = useMemo(() => {
    let result = jobs

    if (statusFilter) {
      result = result.filter(job => getMultiDayDisplayStatus(job) === statusFilter)
    }

    if (typeFilter) {
      result = result.filter(job => job.job_type_id === typeFilter)
    }

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(job =>
        job.title.toLowerCase().includes(q) || job.brand.toLowerCase().includes(q)
      )
    }

    if (sortColumn) {
      result = [...result].sort((a, b) => compareJobs(a, b, sortColumn, sortDirection))
    }

    return result
  }, [jobs, statusFilter, typeFilter, search, sortColumn, sortDirection])

  const generateReport = () => {
    const ids = Array.from(selectedIds).join(',')
    router.push(`/admin/reports/preview?jobs=${ids}`)
  }

  const headerClass = 'text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-white whitespace-nowrap cursor-pointer select-none hover:text-primary-100 transition-colors'

  return (
    <>
      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4">
            <input
              type="text"
              placeholder="Search jobs or brands..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm flex-1 min-w-[200px]"
            />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="upcoming">Upcoming</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="archived">Archived</option>
            </select>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm"
            >
              <option value="">All Types</option>
              {jobTypes.map(jt => (
                <option key={jt.id} value={jt.id}>{jt.name}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Jobs Table */}
      <Card>
        <CardContent className="p-0">
          {filteredJobs.length === 0 ? (
            <div className="text-center py-12 text-primary-400">
              <Briefcase className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              {jobs.length === 0 ? (
                <>
                  <p>No jobs found</p>
                  <Link href="/admin/jobs/new" className="text-primary-400 hover:text-primary-500 mt-2 inline-block">
                    Create your first job
                  </Link>
                </>
              ) : (
                <p>No jobs match your filters</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-t-xl">
              <table className="w-full">
                <thead>
                  <tr className="bg-primary-400">
                    <th className="py-3 px-3 w-10">
                      {/* Checkbox header - no select all to keep it simple */}
                    </th>
                    <th className={headerClass} onClick={() => handleSort('title')}>
                      Job <SortIcon column="title" activeColumn={sortColumn} direction={sortDirection} />
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-white whitespace-nowrap">Type</th>
                    <th className={headerClass} onClick={() => handleSort('date')}>
                      Date <SortIcon column="date" activeColumn={sortColumn} direction={sortDirection} />
                    </th>
                    <th className={headerClass} onClick={() => handleSort('location')}>
                      Location <SortIcon column="location" activeColumn={sortColumn} direction={sortDirection} />
                    </th>
                    <th className={headerClass} onClick={() => handleSort('slots')}>
                      Slots <SortIcon column="slots" activeColumn={sortColumn} direction={sortDirection} />
                    </th>
                    <th className={headerClass} onClick={() => handleSort('pay_rate')}>
                      Pay Rate <SortIcon column="pay_rate" activeColumn={sortColumn} direction={sortDirection} />
                    </th>
                    <th className={`${headerClass} w-40`} onClick={() => handleSort('status')}>
                      Status <SortIcon column="status" activeColumn={sortColumn} direction={sortDirection} />
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider text-white whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.map((job) => {
                    const displayStatus = getMultiDayDisplayStatus(job)
                    const isSelected = selectedIds.has(job.id)
                    const isDisabled = selectedTypeId !== null && job.job_type_id !== selectedTypeId && !isSelected
                    return (
                      <tr key={job.id} className={`border-b border-gray-100 hover:bg-gray-50 ${isSelected ? 'bg-primary-50' : ''}`}>
                        <td className="py-3 px-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isDisabled}
                            onChange={() => toggleSelect(job.id)}
                            className="w-4 h-4 rounded border-gray-300 text-primary-400 focus:ring-primary-400 disabled:opacity-30"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-gray-900">{job.title}</p>
                            <p className="text-sm text-primary-400">{job.brand}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {job.job_types?.name || '\u2014'}
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-sm text-gray-900">{getJobDateDisplay(job)}</p>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {getJobLocationDisplay(job) || '\u2014'}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {job.slots_filled}/{job.slots}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          ${job.pay_rate}/hr
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={getJobStatusBadgeVariant(displayStatus)}>{formatJobStatus(displayStatus)}</Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link href={`/admin/jobs/${job.id}`} className="p-2 text-primary-400 hover:text-gray-700" title="View">
                              <Eye className="w-4 h-4" />
                            </Link>
                            <Link href={`/admin/jobs/${job.id}/edit`} className="p-2 text-primary-400 hover:text-gray-700" title="Edit">
                              <Pencil className="w-4 h-4" />
                            </Link>
                            <JobActions
                              jobId={job.id}
                              jobStatus={job.status as JobStatus}
                              displayStatus={displayStatus}
                              jobTitle={job.title}
                              variant="icon"
                              onSuccess={() => router.refresh()}
                            />
                          </div>
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

      {/* Floating action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white rounded-xl shadow-2xl px-6 py-3 flex items-center gap-4 z-40">
          <span className="text-sm font-medium">{selectedIds.size} job{selectedIds.size !== 1 ? 's' : ''} selected</span>
          <Button
            size="sm"
            onClick={generateReport}
            leftIcon={<FileBarChart className="w-4 h-4" />}
            className="bg-primary-400 hover:bg-primary-500"
          >
            Generate Report
          </Button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-gray-400 hover:text-white ml-2"
          >
            Clear
          </button>
        </div>
      )}
    </>
  )
}

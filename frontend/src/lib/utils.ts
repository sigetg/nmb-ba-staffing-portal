import type { DisplayJobStatus } from '@/types'

export function formatJobStatus(status: string): string {
  const labels: Record<string, string> = {
    draft: 'DRAFT',
    upcoming: 'UPCOMING',
    in_progress: 'IN PROGRESS',
    completed: 'COMPLETED',
    cancelled: 'CANCELLED',
  }
  return labels[status] || status.toUpperCase().replace(/_/g, ' ')
}

export function getJobStatusBadgeVariant(status: string): 'default' | 'info' | 'success' | 'warning' | 'error' {
  const variants: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
    draft: 'default',
    upcoming: 'info',
    in_progress: 'success',
    completed: 'default',
    cancelled: 'error',
  }
  return variants[status] || 'default'
}

/** Parse a YYYY-MM-DD string as a local date (not UTC) */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** Get today's date as YYYY-MM-DD in local timezone */
export function getLocalToday(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** Get current date and time in a specific IANA timezone */
export function getNowInTimezone(timezone: string): { date: string; time: string } {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)

  const get = (type: string) => parts.find(p => p.type === type)?.value || ''
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  }
}

/** Compute display status for a published job based on current time in job's timezone */
export function getJobDisplayStatus(job: {
  status: string
  date: string
  start_time: string
  end_time: string
  timezone: string
}): DisplayJobStatus {
  if (job.status === 'draft') return 'draft'
  if (job.status === 'cancelled') return 'cancelled'

  // job.status === 'published' — compute from time
  const { date: nowDate, time: nowTime } = getNowInTimezone(job.timezone)

  if (job.date > nowDate) return 'upcoming'
  if (job.date < nowDate) return 'completed'

  // Same day: compare times (HH:MM strings are lexicographically sortable)
  if (nowTime < job.start_time) return 'upcoming'
  if (nowTime > job.end_time) return 'completed'
  return 'in_progress'
}

/** Get short timezone abbreviation (e.g., "CST", "EST") */
export function getTimezoneAbbr(timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'short',
  }).formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value || ''
}

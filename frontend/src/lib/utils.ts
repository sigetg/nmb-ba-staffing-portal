import type { DisplayJobStatus, JobWithDays } from '@/types'

export function formatJobStatus(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Draft',
    upcoming: 'Upcoming',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
    archived: 'Archived',
  }
  return labels[status] || status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function getJobStatusBadgeVariant(status: string): 'default' | 'info' | 'success' | 'warning' | 'error' {
  const variants: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
    draft: 'default',
    upcoming: 'info',
    in_progress: 'success',
    completed: 'info',
    cancelled: 'error',
    archived: 'default',
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

/** Compute display status for a job based on job_days date range */
export function getMultiDayDisplayStatus(job: JobWithDays): DisplayJobStatus {
  if (job.status === 'draft') return 'draft'
  if (job.status === 'cancelled') return 'cancelled'
  if (job.status === 'archived') return 'archived'

  const days = (job.job_days || []).sort((a, b) => a.date.localeCompare(b.date))
  if (days.length === 0) return 'upcoming'

  const today = getLocalToday()
  const firstDate = days[0].date
  const lastDate = days[days.length - 1].date

  if (today > lastDate) return 'completed'
  if (today < firstDate) return 'upcoming'
  return 'in_progress'
}

/** Get formatted date display for a job (single date or range) */
export function getJobDateDisplay(job: JobWithDays): string {
  const days = (job.job_days || []).sort((a, b) => a.date.localeCompare(b.date))
  if (days.length === 0) return 'No date'
  if (days.length === 1) {
    return parseLocalDate(days[0].date).toLocaleDateString()
  }
  return `${parseLocalDate(days[0].date).toLocaleDateString()} - ${parseLocalDate(days[days.length - 1].date).toLocaleDateString()}`
}

/** Get location display for a job (single or "Location +N more") */
export function getJobLocationDisplay(job: JobWithDays): string {
  const days = job.job_days || []
  const locations = new Set<string>()
  for (const day of days) {
    for (const loc of (day.job_day_locations || [])) {
      locations.add(loc.location)
    }
  }
  if (locations.size === 0) return ''
  if (locations.size === 1) return [...locations][0]
  return `${[...locations][0]} +${locations.size - 1} more`
}

/** Get short timezone abbreviation (e.g., "CST", "EST") */
export function getTimezoneAbbr(timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'short',
  }).formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value || ''
}

/** Haversine distance between two lat/lng points in miles */
export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8 // Earth radius in miles
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Get minimum distance from a user's location to any of a job's locations (miles), or null */
export function getMinJobDistance(
  job: JobWithDays,
  userLat: number,
  userLng: number
): number | null {
  let min: number | null = null
  for (const day of job.job_days || []) {
    for (const loc of day.job_day_locations || []) {
      if (loc.latitude != null && loc.longitude != null) {
        const d = haversineDistance(userLat, userLng, loc.latitude, loc.longitude)
        if (min === null || d < min) min = d
      }
    }
  }
  return min
}

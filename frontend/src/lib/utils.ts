export function formatJobStatus(status: string): string {
  return status.toUpperCase().replace(/_/g, ' ')
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

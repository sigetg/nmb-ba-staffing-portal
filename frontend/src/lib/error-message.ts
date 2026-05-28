import * as Sentry from '@sentry/nextjs'

export type ErrorContext = 'upload' | 'submit' | 'auth' | 'payout' | 'generic'

const SAFE_4XX_HINT_KEYS = [
  'required',
  'not found',
  'already',
  'invalid',
  'must be',
  'expired',
  'unsupported',
  'too large',
  'too short',
  'too long',
]

function extractMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return ''
}

function statusFromMessage(msg: string): number | null {
  const m = msg.match(/API error (\d{3})/)
  return m ? Number(m[1]) : null
}

function isLikelyUserSafe(detail: string): boolean {
  if (!detail || detail.length > 140) return false
  const lower = detail.toLowerCase()
  return SAFE_4XX_HINT_KEYS.some(k => lower.includes(k))
}

function mapToFriendly(err: unknown, context: ErrorContext): string {
  const msg = extractMessage(err)
  const lower = msg.toLowerCase()
  const status = statusFromMessage(msg)

  if (lower.includes('too large') || status === 413) {
    return 'That file is too large. Try a smaller one.'
  }
  if (lower.includes('invalid image type') || lower.includes('invalid file type') || lower.includes('unsupported')) {
    return "That file format isn't supported. Try a JPG or PNG."
  }
  if (status === 401 || lower.includes('not authenticated') || lower.includes('unauthorized')) {
    return 'Your session expired. Please sign in again.'
  }
  if (status === 408 || lower.includes('timed out') || lower.includes('timeout')) {
    return 'That took too long. Try again on a stronger connection.'
  }
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed') ||
    lower.includes("couldn't reach")
  ) {
    return "Couldn't reach the server. Check your connection and try again."
  }

  if (status && status >= 400 && status < 500 && isLikelyUserSafe(msg)) {
    return msg
  }

  switch (context) {
    case 'upload':
      return "We couldn't upload that file. Please try again."
    case 'auth':
      return "We couldn't complete that request. Please try again."
    case 'payout':
      return "Something went wrong connecting your payout method. Please try again."
    case 'submit':
      return "We couldn't submit your information. Please try again."
    default:
      return "Something went wrong on our end \u2014 we've been notified. Please try again."
  }
}

/**
 * Maps any thrown value to a friendly user-facing message and reports the
 * real exception to Sentry with the originating context attached. Always
 * call this from a catch block instead of showing err.message directly.
 */
export function friendlyError(err: unknown, context: ErrorContext = 'generic'): string {
  try {
    Sentry.captureException(err, { tags: { context } })
  } catch {
    // Sentry not initialized in dev or DSN missing — never block the UI.
  }
  if (typeof console !== 'undefined' && console.error) {
    console.error(`[${context}]`, err)
  }
  return mapToFriendly(err, context)
}

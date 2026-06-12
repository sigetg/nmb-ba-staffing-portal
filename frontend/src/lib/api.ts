import type {
  OnboardingStatus,
  PayoutMethod,
  PayoutMethodStatus,
  W9Status,
} from '@/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// Mobile networks frequently accept a request and then go silent (cellular
// handoff, screen lock on iOS, weak signal indoors). Without a timeout the
// fetch promise never settles and the UI spinner spins forever. AbortController
// converts that into a rejection we can show or retry.
const JSON_TIMEOUT_MS = 30_000
const UPLOAD_TIMEOUT_MS = 60_000

// If an abort fires within this window the request body almost certainly hadn't
// been transmitted yet, so retrying a POST/PUT/PATCH/DELETE is safe (no risk of
// double-applying the mutation server-side).
const SAFE_RETRY_BEFORE_MS = 3_000

const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD'])

function isTransientNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const msg = err.message
  return (
    err.name === 'AbortError' ||
    msg.includes('Failed to fetch') ||
    msg.includes('Load failed') ||
    msg.includes('NetworkError')
  )
}

async function apiRequest(
  path: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase()
  const isUpload = options.body instanceof FormData
  const timeoutMs = isUpload ? UPLOAD_TIMEOUT_MS : JSON_TIMEOUT_MS
  const idempotent = IDEMPOTENT_METHODS.has(method)
  const maxRetries = idempotent ? 2 : 1

  let attempt = 0
  // Single retry budget on early aborts for non-idempotent verbs. Tracked
  // outside the loop so a slow second attempt doesn't get a second free retry.
  let nonIdempotentRetryUsed = false

  while (true) {
    const controller = new AbortController()
    const startedAt = Date.now()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const res = await fetch(`${API_URL}${path}`, {
        ...options,
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...options.headers,
        },
        signal: controller.signal,
      })
      clearTimeout(timer)

      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(body.detail || `API error ${res.status}`)
      }
      return res
    } catch (err) {
      clearTimeout(timer)
      const elapsed = Date.now() - startedAt
      const transient = isTransientNetworkError(err)

      if (transient && attempt < maxRetries) {
        const safeToRetry =
          idempotent || (!nonIdempotentRetryUsed && elapsed < SAFE_RETRY_BEFORE_MS)
        if (safeToRetry) {
          if (!idempotent) nonIdempotentRetryUsed = true
          attempt += 1
          // 400ms * 2^attempt + jitter
          const backoff = 400 * 2 ** (attempt - 1) + Math.random() * 200
          await new Promise(resolve => setTimeout(resolve, backoff))
          continue
        }
      }

      // Surface AbortError as a timeout-flavored message so friendlyError()
      // maps it to "That took too long. Try again on a stronger connection."
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Request timeout')
      }
      throw err
    }
  }
}

export async function uploadJobPhoto(
  accessToken: string,
  file: File,
  jobId: string,
  photoType: string,
  jobDayLocationId?: string,
  baId?: string
): Promise<{ id: string; url: string }> {
  const form = new FormData()
  form.append('file', file)
  form.append('job_id', jobId)
  form.append('photo_type', photoType)
  if (jobDayLocationId) form.append('job_day_location_id', jobDayLocationId)
  if (baId) form.append('ba_id', baId)

  const res = await apiRequest('/api/files/upload/job-photo', accessToken, {
    method: 'POST',
    body: form,
  })
  return res.json()
}

export async function deleteJobPhoto(
  accessToken: string,
  photoId: string
): Promise<void> {
  await apiRequest(`/api/files/job-photo/${photoId}`, accessToken, {
    method: 'DELETE',
  })
}

export async function undoLocationCheckout(
  accessToken: string,
  jobId: string,
  locationId: string
): Promise<{ message: string; check_in_id: string }> {
  const res = await apiRequest(
    `/api/jobs/${jobId}/locations/${locationId}/undo-checkout`,
    accessToken,
    { method: 'POST' }
  )
  return res.json()
}

export async function uploadBAPhoto(
  accessToken: string,
  file: File,
  photoType: string
): Promise<{ url: string }> {
  const form = new FormData()
  form.append('file', file)
  form.append('photo_type', photoType)

  const res = await apiRequest('/api/files/upload/ba-photo', accessToken, {
    method: 'POST',
    body: form,
  })
  return res.json()
}

export async function downloadProxiedFile(
  accessToken: string,
  url: string,
  filename: string
): Promise<void> {
  const res = await apiRequest(
    `/api/files/proxy-download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`,
    accessToken
  )
  const blob = await res.blob()
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(blobUrl)
}

export async function uploadBAResume(
  accessToken: string,
  file: File
): Promise<{ url: string }> {
  const form = new FormData()
  form.append('file', file)

  const res = await apiRequest('/api/files/upload/ba-resume', accessToken, {
    method: 'POST',
    body: form,
  })
  return res.json()
}

export async function uploadJobWorksheet(
  accessToken: string,
  file: File,
  jobId: string
): Promise<{ url: string }> {
  const form = new FormData()
  form.append('file', file)
  form.append('job_id', jobId)

  const res = await apiRequest('/api/files/upload/job-worksheet', accessToken, {
    method: 'POST',
    body: form,
  })
  return res.json()
}

export async function deleteJobWorksheet(
  accessToken: string,
  jobId: string
): Promise<void> {
  await apiRequest(`/api/files/job-worksheet/${jobId}`, accessToken, {
    method: 'DELETE',
  })
}

// --- Profile (W-9 + payout method) ---

export interface W9SubmitInput {
  legal_name: string
  business_name?: string | null
  entity_type: string
  address_line1: string
  address_line2?: string | null
  city: string
  state: string
  zip_code: string
  tin: string
  tin_type: 'ssn' | 'ein'
  signature_name: string
  signature_date: string // ISO yyyy-mm-dd
  electronic_consent: boolean
}

export async function submitW9(
  accessToken: string,
  input: W9SubmitInput
): Promise<W9Status> {
  const res = await apiRequest('/api/profile/w9', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return res.json()
}

export async function getW9Status(accessToken: string): Promise<W9Status> {
  const res = await apiRequest('/api/profile/w9', accessToken)
  return res.json()
}

export async function getPayoutMethod(
  accessToken: string
): Promise<PayoutMethodStatus> {
  const res = await apiRequest('/api/profile/payout-method', accessToken)
  return res.json()
}

export async function getOnboardingStatus(
  accessToken: string
): Promise<OnboardingStatus> {
  const res = await apiRequest('/api/profile/onboarding-status', accessToken)
  return res.json()
}

// --- Driver's license ---

export interface DriversLicenseStatus {
  front_uploaded: boolean
  back_uploaded: boolean
  uploaded_at: string | null
}

export async function getDriversLicenseStatus(
  accessToken: string
): Promise<DriversLicenseStatus> {
  const res = await apiRequest('/api/profile/drivers-license', accessToken)
  return res.json()
}

export async function uploadDriversLicense(
  accessToken: string,
  side: 'front' | 'back',
  file: File
): Promise<DriversLicenseStatus> {
  const form = new FormData()
  form.append('side', side)
  form.append('file', file)
  const res = await apiRequest('/api/profile/drivers-license/upload', accessToken, {
    method: 'POST',
    body: form,
  })
  return res.json()
}

// --- PayPal Log In OAuth ---

export async function getPaypalConnectUrl(
  accessToken: string,
  returnTo?: string
): Promise<{ url: string; state: string }> {
  const qs = returnTo ? `?return_to=${encodeURIComponent(returnTo)}` : ''
  const res = await apiRequest(`/api/profile/paypal/connect${qs}`, accessToken)
  return res.json()
}

export async function disconnectPaypal(
  accessToken: string
): Promise<void> {
  await apiRequest('/api/profile/paypal/disconnect', accessToken, { method: 'POST' })
}

// --- Admin: Login As ---

export async function loginAsBA(
  accessToken: string,
  baId: string
): Promise<{ confirm_url: string }> {
  const res = await apiRequest(`/api/admin/bas/${baId}/login-as`, accessToken, {
    method: 'POST',
  })
  return res.json()
}

// --- QBO admin ---

export interface QboStatus {
  connected: boolean
  realm_id?: string
  connected_at?: string
  expense_account_id?: string | null
  queue_pending?: number
  queue_manual_review?: number
}

export async function getQboStatus(accessToken: string): Promise<QboStatus> {
  const res = await apiRequest('/api/admin/qbo/status', accessToken)
  return res.json()
}

export async function getQboConnectUrl(accessToken: string): Promise<{ url: string }> {
  const res = await apiRequest('/api/admin/qbo/connect', accessToken)
  return res.json()
}

export async function disconnectQbo(accessToken: string): Promise<void> {
  await apiRequest('/api/admin/qbo/disconnect', accessToken, { method: 'POST' })
}

export interface QboAccount {
  id: string
  name: string
  subtype: string | null
}

export async function getQboAccounts(accessToken: string): Promise<{ accounts: QboAccount[] }> {
  const res = await apiRequest('/api/admin/qbo/accounts', accessToken)
  return res.json()
}

export async function saveQboSettings(
  accessToken: string,
  expenseAccountId: string
): Promise<void> {
  await apiRequest('/api/admin/qbo/settings', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expense_account_id: expenseAccountId }),
  })
}

export interface QboQueueItem {
  id: string
  kind: 'vendor' | 'payment'
  ba_id: string | null
  payment_id: string | null
  attempts: number
  status: 'pending' | 'succeeded' | 'failed' | 'manual_review'
  last_error: string | null
  last_attempt_at: string | null
  next_attempt_at: string | null
  created_at: string
  ba_profiles?: { name: string } | null
  payments?: { amount: number; jobs?: { title: string } | null } | null
}

export async function getQboQueue(
  accessToken: string,
  status?: string
): Promise<{ items: QboQueueItem[] }> {
  const qs = status ? `?status=${status}` : ''
  const res = await apiRequest(`/api/admin/qbo/queue${qs}`, accessToken)
  return res.json()
}

export async function retryQboQueueItem(accessToken: string, id: string): Promise<void> {
  await apiRequest(`/api/admin/qbo/queue/${id}/retry`, accessToken, { method: 'POST' })
}

export async function resolveQboQueueItem(accessToken: string, id: string): Promise<void> {
  await apiRequest(`/api/admin/qbo/queue/${id}/resolve`, accessToken, { method: 'POST' })
}

export async function triggerQboBackfill(
  accessToken: string
): Promise<{ vendor_enqueued: number; payment_enqueued: number }> {
  const res = await apiRequest('/api/admin/qbo/backfill', accessToken, { method: 'POST' })
  return res.json()
}

export async function processQboQueue(
  accessToken: string
): Promise<{ processed: number; succeeded: number; failed: number; manual_review: number }> {
  const res = await apiRequest('/api/admin/qbo/process-queue', accessToken, { method: 'POST' })
  return res.json()
}

// --- Admin payouts ---

export interface PayoutSummaryRow {
  ba_id: string
  ba_name: string | null
  payout_method: 'paypal' | null
  payout_paypal_email: string | null
  onboarding_complete: boolean
  hours_worked: string
  suggested_base_amount: string
  payments: Array<{
    id: string
    amount: number
    base_amount: number | null
    bonus_amount: number
    reimbursement_amount: number
    fee_amount: number
    hours_worked: number | null
    status: string
    payment_method: string | null
    payment_reference: string | null
    batch_id: string | null
    paypal_item_id: string | null
    processed_at: string | null
    created_at: string
  }>
}

export interface JobPayoutSummary {
  job_id: string
  job_title: string
  pay_rate: string
  rows: PayoutSummaryRow[]
}

export async function getJobPayoutSummary(
  accessToken: string,
  jobId: string
): Promise<JobPayoutSummary> {
  const res = await apiRequest(`/api/admin/jobs/${jobId}/payout-summary`, accessToken)
  return res.json()
}

export interface PaymentCreateInput {
  job_id: string
  ba_id: string
  base_amount: number
  bonus_amount?: number
  reimbursement_amount?: number
  hours_worked?: number
  notes?: string
}

export async function createPayment(
  accessToken: string,
  input: PaymentCreateInput
): Promise<{ payment: { id: string; status: string } }> {
  const res = await apiRequest('/api/admin/payments', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return res.json()
}

export async function sendPaypalPayouts(
  accessToken: string,
  paymentIds: string[]
): Promise<{ paypal_batch_id: string | null; item_count: number }> {
  const res = await apiRequest('/api/admin/payments/paypal/send', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment_ids: paymentIds }),
  })
  return res.json()
}

export async function getPaymentsQueue(
  accessToken: string
): Promise<{
  ach: Array<Record<string, unknown>>
  paypal: Array<Record<string, unknown>>
  total: number
}> {
  const res = await apiRequest('/api/admin/payments/queue', accessToken)
  return res.json()
}

export async function getPendingPayoutsJobs(
  accessToken: string
): Promise<{ jobs: Array<Record<string, unknown>> }> {
  const res = await apiRequest('/api/admin/payouts/pending-jobs', accessToken)
  return res.json()
}

export async function listPayments(
  accessToken: string,
  params: { job_id?: string; ba_id?: string; status?: string; limit?: number; offset?: number } = {}
): Promise<{ payments: Array<Record<string, unknown>>; total: number }> {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) qs.set(k, String(v))
  })
  const res = await apiRequest(`/api/admin/payments?${qs.toString()}`, accessToken)
  return res.json()
}


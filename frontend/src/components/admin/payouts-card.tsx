'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Mail, AlertTriangle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
} from '@/components/ui'
import {
  createPayment,
  getJobPayoutSummary,
  sendPaypalPayouts,
  type JobPayoutSummary,
  type PayoutSummaryRow,
} from '@/lib/api'

interface DraftAmounts {
  base: string
  bonus: string
  reimbursement: string
}

function emptyDraft(suggestedBase: string): DraftAmounts {
  return { base: suggestedBase, bonus: '0', reimbursement: '0' }
}

function total(d: DraftAmounts): number {
  const n = (s: string) => Number.parseFloat(s) || 0
  return Math.round((n(d.base) + n(d.bonus) + n(d.reimbursement)) * 100) / 100
}

function statusBadge(status: string) {
  switch (status) {
    case 'queued':
      return <Badge variant="warning">Queued</Badge>
    case 'processing':
      return <Badge variant="info">Sending</Badge>
    case 'completed':
      return <Badge variant="success">Paid</Badge>
    case 'failed':
      return <Badge variant="error">Failed</Badge>
    case 'cancelled':
      return <Badge variant="default">Cancelled</Badge>
    default:
      return <Badge variant="default">{status}</Badge>
  }
}

export function PayoutsCard({ jobId }: { jobId: string }) {
  const supabase = createClient()

  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [summary, setSummary] = useState<JobPayoutSummary | null>(null)
  const [drafts, setDrafts] = useState<Record<string, DraftAmounts>>({})
  const [busyBaId, setBusyBaId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [batchBusy, setBatchBusy] = useState(false)
  const [info, setInfo] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      if (cancelled) return
      setAccessToken(session.access_token)
      try {
        const data = await getJobPayoutSummary(session.access_token, jobId)
        if (cancelled) return
        setSummary(data)
        const initial: Record<string, DraftAmounts> = {}
        for (const r of data.rows) {
          initial[r.ba_id] = emptyDraft(r.suggested_base_amount)
        }
        setDrafts(initial)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load payouts')
      }
    }
    init()
    return () => {
      cancelled = true
    }
  }, [supabase, jobId])

  function activePayment(row: PayoutSummaryRow) {
    return row.payments.find(
      p => p.status === 'queued' || p.status === 'processing' || p.status === 'completed',
    )
  }

  async function refresh() {
    if (!accessToken) return
    const data = await getJobPayoutSummary(accessToken, jobId)
    setSummary(data)
  }

  async function handlePayInstantly(row: PayoutSummaryRow) {
    if (!accessToken || !summary) return
    setBusyBaId(row.ba_id)
    setError(null)
    setInfo(null)
    try {
      const draft = drafts[row.ba_id] || emptyDraft(row.suggested_base_amount)
      const created = await createPayment(accessToken, {
        job_id: summary.job_id,
        ba_id: row.ba_id,
        base_amount: Number.parseFloat(draft.base) || 0,
        bonus_amount: Number.parseFloat(draft.bonus) || 0,
        reimbursement_amount: Number.parseFloat(draft.reimbursement) || 0,
        hours_worked: Number.parseFloat(row.hours_worked) || 0,
      })
      await sendPaypalPayouts(accessToken, [created.payment.id])
      setInfo(`Sent $${total(draft).toFixed(2)} to ${row.ba_name} via PayPal.`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setBusyBaId(null)
    }
  }

  async function handlePayAll() {
    if (!accessToken || !summary) return
    setBatchBusy(true)
    setError(null)
    setInfo(null)
    try {
      const targets = summary.rows.filter(
        r => r.payout_method === 'paypal' && r.onboarding_complete && !activePayment(r),
      )
      if (targets.length === 0) {
        setError('No BAs available for instant pay (all already paid or missing PayPal).')
        return
      }
      const ids: string[] = []
      for (const r of targets) {
        const draft = drafts[r.ba_id] || emptyDraft(r.suggested_base_amount)
        const created = await createPayment(accessToken, {
          job_id: summary.job_id,
          ba_id: r.ba_id,
          base_amount: Number.parseFloat(draft.base) || 0,
          bonus_amount: Number.parseFloat(draft.bonus) || 0,
          reimbursement_amount: Number.parseFloat(draft.reimbursement) || 0,
          hours_worked: Number.parseFloat(r.hours_worked) || 0,
        })
        ids.push(created.payment.id)
      }
      await sendPaypalPayouts(accessToken, ids)
      setInfo(`Sent ${ids.length} instant PayPal payments.`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pay all failed')
    } finally {
      setBatchBusy(false)
    }
  }

  if (!summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payouts</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <Alert variant="error" onClose={() => setError(null)}>{error}</Alert>
          ) : (
            <div className="flex items-center gap-2 text-primary-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading payouts…
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const unpaidCount = summary.rows.filter(
    r => r.payout_method === 'paypal' && r.onboarding_complete && !activePayment(r),
  ).length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle>Payouts ({summary.rows.length})</CardTitle>
          <div className="flex gap-2">
            {unpaidCount > 0 && (
              <Button onClick={handlePayAll} disabled={batchBusy}>
                Pay all ({unpaidCount})
              </Button>
            )}
            <Link
              href="/admin/payouts"
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm"
            >
              Payouts page →
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-primary-400 mb-4">
          Pay rate: ${summary.pay_rate}/hr. Hours auto-summed from check-ins. Edit base, add bonus / reimbursement as needed. Payments go via PayPal instantly.
        </p>
        {error && <Alert variant="error" className="mb-4">{error}</Alert>}
        {info && <Alert variant="success" className="mb-4">{info}</Alert>}
        {summary.rows.length === 0 ? (
          <p className="text-primary-400">No approved BAs on this job yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-2 px-3 font-medium text-primary-400">BA</th>
                  <th className="text-right py-2 px-3 font-medium text-primary-400">Hours</th>
                  <th className="text-right py-2 px-3 font-medium text-primary-400">Base $</th>
                  <th className="text-right py-2 px-3 font-medium text-primary-400">Bonus $</th>
                  <th className="text-right py-2 px-3 font-medium text-primary-400">Reimb $</th>
                  <th className="text-right py-2 px-3 font-medium text-primary-400">Total</th>
                  <th className="text-left py-2 px-3 font-medium text-primary-400">PayPal</th>
                  <th className="text-left py-2 px-3 font-medium text-primary-400">Status</th>
                  <th className="text-right py-2 px-3 font-medium text-primary-400">Action</th>
                </tr>
              </thead>
              <tbody>
                {summary.rows.map(row => {
                  const draft = drafts[row.ba_id] || emptyDraft(row.suggested_base_amount)
                  const ap = activePayment(row)
                  const noPaypal = row.payout_method !== 'paypal' || !row.payout_paypal_email
                  const disabled = !!ap || !row.onboarding_complete || noPaypal
                  const t = total(draft)
                  return (
                    <tr key={row.ba_id} className="border-b border-gray-100">
                      <td className="py-2 px-3">
                        <div className="font-medium">{row.ba_name}</div>
                        {!row.onboarding_complete && (
                          <div className="flex items-center gap-1 text-xs text-yellow-700 mt-0.5">
                            <AlertTriangle className="w-3 h-3" /> Onboarding incomplete
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right">{row.hours_worked}</td>
                      <td className="py-2 px-3 text-right">
                        <Input
                          value={draft.base}
                          onChange={e => setDrafts(d => ({ ...d, [row.ba_id]: { ...draft, base: e.target.value } }))}
                          disabled={disabled}
                          className="text-right w-24 ml-auto"
                          inputMode="decimal"
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <Input
                          value={draft.bonus}
                          onChange={e => setDrafts(d => ({ ...d, [row.ba_id]: { ...draft, bonus: e.target.value } }))}
                          disabled={disabled}
                          className="text-right w-20 ml-auto"
                          inputMode="decimal"
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <Input
                          value={draft.reimbursement}
                          onChange={e => setDrafts(d => ({ ...d, [row.ba_id]: { ...draft, reimbursement: e.target.value } }))}
                          disabled={disabled}
                          className="text-right w-20 ml-auto"
                          inputMode="decimal"
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-semibold">
                        ${ap ? Number(ap.amount).toFixed(2) : t.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-xs">
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-4 h-4 text-primary-400 shrink-0" />
                          {row.payout_paypal_email ? (
                            <span className="text-gray-700 truncate max-w-[18ch]">{row.payout_paypal_email}</span>
                          ) : (
                            <span className="text-gray-400 italic">not connected</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3">{ap ? statusBadge(ap.status) : <Badge variant="default">Unpaid</Badge>}</td>
                      <td className="py-2 px-3 text-right">
                        {ap ? (
                          <span className="text-xs text-gray-500">—</span>
                        ) : !row.onboarding_complete ? (
                          <span className="text-xs text-gray-500">Waiting on BA</span>
                        ) : noPaypal ? (
                          <span className="text-xs text-yellow-700">No PayPal</span>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handlePayInstantly(row)}
                            disabled={busyBaId === row.ba_id}
                          >
                            {busyBaId === row.ba_id ? '…' : 'Pay instantly'}
                          </Button>
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
  )
}

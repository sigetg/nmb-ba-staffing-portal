'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Mail, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui'
import {
  getPaymentsQueue,
  listPayments,
  sendPaypalPayouts,
} from '@/lib/api'

type Tab = 'pending' | 'history'

interface Row {
  id: string
  amount: number
  fee_amount: number
  status: string
  payment_method: string | null
  paypal_item_id: string | null
  payment_reference: string | null
  processed_at: string | null
  created_at: string
  ba_profiles?: { id: string; name: string } | null
  jobs?: { id: string; title: string } | null
}

function statusBadge(status: string) {
  switch (status) {
    case 'queued':
      return <Badge variant="warning">Queued</Badge>
    case 'processing':
      return <Badge variant="info">Sending</Badge>
    case 'completed':
      return <Badge variant="success">Completed</Badge>
    case 'failed':
      return <Badge variant="error">Failed</Badge>
    case 'cancelled':
      return <Badge variant="default">Cancelled</Badge>
    default:
      return <Badge variant="default">{status}</Badge>
  }
}

export default function AdminPayoutsPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('pending')
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [pending, setPending] = useState<Row[]>([])
  const [history, setHistory] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      if (cancelled) return
      setAccessToken(session.access_token)
      await refresh(session.access_token)
      if (!cancelled) setLoading(false)
    }
    init()
    return () => {
      cancelled = true
    }
  }, [supabase])

  async function refresh(token: string = accessToken!) {
    if (!token) return
    const [queue, hist] = await Promise.all([
      getPaymentsQueue(token),
      listPayments(token, { limit: 50, status: 'completed' }),
    ])
    const allPending = [
      ...((queue.paypal as unknown as Row[]) || []),
      ...((queue.ach as unknown as Row[]) || []), // ACH legacy rows, if any
    ]
    setPending(allPending)
    setHistory((hist.payments as unknown as Row[]) || [])
  }

  async function handleSendQueued() {
    if (!accessToken) return
    const queued = pending.filter(r => r.status === 'queued' && r.payment_method === 'paypal')
    if (queued.length === 0) {
      setError('No queued PayPal payments to send.')
      return
    }
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      await sendPaypalPayouts(accessToken, queued.map(r => r.id))
      setInfo(`Triggered ${queued.length} instant PayPal payments.`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PayPal send failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-primary-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading payouts…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-heading">Payouts</h1>
        <Link
          href="/admin/dashboard"
          className="text-sm text-primary-400 hover:text-primary-500"
        >
          ← Back to dashboard
        </Link>
      </div>

      <div className="border-b border-gray-200 flex gap-4">
        {(['pending', 'history'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-primary-400 text-primary-500'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'pending' ? `Pending (${pending.length})` : 'History'}
          </button>
        ))}
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {info && <Alert variant="success">{info}</Alert>}

      {tab === 'pending' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary-400" />
                <CardTitle>PayPal Payments ({pending.length})</CardTitle>
              </div>
              {pending.some(r => r.status === 'queued') && (
                <Button onClick={handleSendQueued} disabled={busy}>
                  Send all queued
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <p className="text-primary-400 text-sm">No pending payments.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-2 px-3">BA</th>
                    <th className="text-left py-2 px-3">Job</th>
                    <th className="text-right py-2 px-3">Amount</th>
                    <th className="text-right py-2 px-3">Fee</th>
                    <th className="text-left py-2 px-3">Status</th>
                    <th className="text-left py-2 px-3">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map(r => (
                    <tr key={r.id} className="border-b border-gray-100">
                      <td className="py-2 px-3">{r.ba_profiles?.name}</td>
                      <td className="py-2 px-3">
                        {r.jobs && (
                          <Link href={`/admin/jobs/${r.jobs.id}`} className="text-primary-400 hover:text-primary-500">
                            {r.jobs.title}
                          </Link>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-medium">${Number(r.amount).toFixed(2)}</td>
                      <td className="py-2 px-3 text-right text-gray-500">${Number(r.fee_amount).toFixed(2)}</td>
                      <td className="py-2 px-3">{statusBadge(r.status)}</td>
                      <td className="py-2 px-3 text-xs text-gray-500">{r.payment_reference || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'history' && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Completed Payments ({history.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-primary-400 text-sm">No completed payments yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-2 px-3">BA</th>
                    <th className="text-left py-2 px-3">Job</th>
                    <th className="text-right py-2 px-3">Amount</th>
                    <th className="text-left py-2 px-3">Processed</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(r => (
                    <tr key={r.id} className="border-b border-gray-100">
                      <td className="py-2 px-3">{r.ba_profiles?.name}</td>
                      <td className="py-2 px-3">
                        {r.jobs && (
                          <Link href={`/admin/jobs/${r.jobs.id}`} className="text-primary-400 hover:text-primary-500">
                            {r.jobs.title}
                          </Link>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-medium">${Number(r.amount).toFixed(2)}</td>
                      <td className="py-2 px-3 text-xs text-gray-500">
                        {r.processed_at ? new Date(r.processed_at).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

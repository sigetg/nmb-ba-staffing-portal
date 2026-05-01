'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, ExternalLink, Loader2, Plug, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
} from '@/components/ui'
import {
  disconnectQbo,
  getQboAccounts,
  getQboConnectUrl,
  getQboQueue,
  getQboStatus,
  processQboQueue,
  resolveQboQueueItem,
  retryQboQueueItem,
  saveQboSettings,
  triggerQboBackfill,
  type QboAccount,
  type QboQueueItem,
  type QboStatus,
} from '@/lib/api'

export default function QboIntegrationsPage() {
  const supabase = createClient()
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [status, setStatus] = useState<QboStatus | null>(null)
  const [accounts, setAccounts] = useState<QboAccount[]>([])
  const [accountId, setAccountId] = useState<string>('')
  const [queue, setQueue] = useState<QboQueueItem[]>([])
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
    const s = await getQboStatus(token)
    setStatus(s)
    if (s.connected) {
      try {
        const accts = await getQboAccounts(token)
        setAccounts(accts.accounts)
      } catch {
        setAccounts([])
      }
      setAccountId(s.expense_account_id || '')
      const q = await getQboQueue(token)
      setQueue(q.items)
    } else {
      setAccounts([])
      setQueue([])
    }
  }

  async function handleConnect() {
    if (!accessToken) return
    setBusy(true)
    setError(null)
    try {
      const { url } = await getQboConnectUrl(accessToken)
      window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start QBO connect')
      setBusy(false)
    }
  }

  async function handleDisconnect() {
    if (!accessToken) return
    if (!confirm('Disconnect QuickBooks? Future syncs will queue until re-connected.')) return
    setBusy(true)
    setError(null)
    try {
      await disconnectQbo(accessToken)
      setInfo('QuickBooks disconnected.')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Disconnect failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveSettings() {
    if (!accessToken || !accountId) return
    setBusy(true)
    setError(null)
    try {
      await saveQboSettings(accessToken, accountId)
      setInfo('Expense account saved.')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleBackfill() {
    if (!accessToken) return
    setBusy(true)
    setError(null)
    try {
      const result = await triggerQboBackfill(accessToken)
      setInfo(
        `Enqueued ${result.vendor_enqueued} vendor sync(s) and ${result.payment_enqueued} payment sync(s).`,
      )
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Backfill failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleProcessQueue() {
    if (!accessToken) return
    setBusy(true)
    setError(null)
    try {
      const r = await processQboQueue(accessToken)
      setInfo(
        `Processed ${r.processed}: ${r.succeeded} succeeded, ${r.failed} failed (will retry), ${r.manual_review} manual review.`,
      )
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Process failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleRetry(id: string) {
    if (!accessToken) return
    await retryQboQueueItem(accessToken, id)
    await refresh()
  }

  async function handleResolve(id: string) {
    if (!accessToken) return
    if (!confirm('Mark this queue item as resolved without syncing? Use only if you handled it manually in QBO.')) return
    await resolveQboQueueItem(accessToken, id)
    await refresh()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-primary-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading QuickBooks status…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-heading">QuickBooks Online</h1>
        <Link
          href="/admin/dashboard"
          className="text-sm text-primary-400 hover:text-primary-500"
        >
          ← Back to dashboard
        </Link>
      </div>

      {error && <Alert variant="error" onClose={() => setError(null)}>{error}</Alert>}
      {info && <Alert variant="success" onClose={() => setInfo(null)}>{info}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Connection</CardTitle>
        </CardHeader>
        <CardContent>
          {status?.connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Connected</p>
                  <p className="text-xs text-primary-400">
                    Realm {status.realm_id} • since {status.connected_at?.slice(0, 10)}
                  </p>
                </div>
                <Button variant="ghost" onClick={handleDisconnect} disabled={busy}>
                  Disconnect
                </Button>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[260px]">
                  <Select
                    label="Expense account for BA payments"
                    options={accounts.map(a => ({ value: a.id, label: a.name }))}
                    value={accountId}
                    onChange={e => setAccountId(e.target.value)}
                    placeholder={accounts.length === 0 ? 'No expense accounts found' : 'Choose an account'}
                  />
                </div>
                <Button onClick={handleSaveSettings} disabled={busy || !accountId}>
                  Save
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <StatCard label="Pending in queue" value={status.queue_pending ?? 0} />
                <StatCard label="Manual review" value={status.queue_manual_review ?? 0} variant={status.queue_manual_review ? 'warning' : 'default'} />
                <div className="flex items-end gap-2">
                  <Button variant="outline" onClick={handleProcessQueue} disabled={busy} leftIcon={<RefreshCw className="w-4 h-4" />}>
                    Run worker
                  </Button>
                  <Button variant="outline" onClick={handleBackfill} disabled={busy}>
                    Backfill
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-primary-400">
                Connect QuickBooks Online so the portal can sync vendors (BAs) and expenses (payments) automatically.
                The accountant can authorize this from accountant access.
              </p>
              <Button onClick={handleConnect} disabled={busy} leftIcon={<Plug className="w-4 h-4" />}>
                Connect QuickBooks
              </Button>
              <p className="text-xs text-gray-500">
                Opens Intuit&apos;s consent page. After authorizing, you&apos;ll return here.
                <ExternalLink className="w-3 h-3 inline ml-1" />
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {status?.connected && (
        <Card>
          <CardHeader>
            <CardTitle>Sync queue ({queue.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {queue.length === 0 ? (
              <p className="text-primary-400 text-sm">Queue is empty.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left py-2 px-3">Kind</th>
                      <th className="text-left py-2 px-3">BA</th>
                      <th className="text-left py-2 px-3">Job / Amount</th>
                      <th className="text-left py-2 px-3">Status</th>
                      <th className="text-left py-2 px-3">Attempts</th>
                      <th className="text-left py-2 px-3">Last error</th>
                      <th className="text-right py-2 px-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map(item => (
                      <tr key={item.id} className="border-b border-gray-100 align-top">
                        <td className="py-2 px-3 capitalize">{item.kind}</td>
                        <td className="py-2 px-3">{item.ba_profiles?.name || '—'}</td>
                        <td className="py-2 px-3">
                          {item.payments?.jobs?.title && <div>{item.payments.jobs.title}</div>}
                          {item.payments?.amount != null && (
                            <div className="text-gray-500 text-xs">${Number(item.payments.amount).toFixed(2)}</div>
                          )}
                        </td>
                        <td className="py-2 px-3">{queueStatusBadge(item.status)}</td>
                        <td className="py-2 px-3">{item.attempts}</td>
                        <td className="py-2 px-3 text-xs text-gray-500 max-w-[28ch] truncate" title={item.last_error || ''}>
                          {item.last_error || '—'}
                        </td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">
                          {(item.status === 'manual_review' || item.status === 'failed') && (
                            <>
                              <button onClick={() => handleRetry(item.id)} className="text-primary-400 hover:text-primary-500 text-xs underline mr-3">
                                Retry
                              </button>
                              <button onClick={() => handleResolve(item.id)} className="text-gray-500 hover:text-gray-700 text-xs underline">
                                Resolve
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  variant = 'default',
}: {
  label: string
  value: number
  variant?: 'default' | 'warning'
}) {
  return (
    <div
      className={`p-3 rounded-lg border ${
        variant === 'warning' ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'
      }`}
    >
      <p className="text-xs text-primary-400">{label}</p>
      <p className="text-xl font-semibold text-gray-900">{value}</p>
    </div>
  )
}

function queueStatusBadge(status: QboQueueItem['status']) {
  switch (status) {
    case 'pending':
      return <Badge variant="warning">Pending</Badge>
    case 'succeeded':
      return <Badge variant="success">Succeeded</Badge>
    case 'failed':
      return <Badge variant="warning">Failed (retrying)</Badge>
    case 'manual_review':
      return <Badge variant="error">Manual review</Badge>
  }
}

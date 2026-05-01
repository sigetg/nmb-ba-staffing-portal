'use client'

import { useEffect, useState } from 'react'
import { FileText, Download } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button, Card, CardContent, CardHeader, CardTitle, Alert } from '@/components/ui'
import { getW9Status } from '@/lib/api'
import type { W9Status } from '@/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export function TaxDocumentsCard() {
  const supabase = createClient()
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [w9, setW9] = useState<W9Status | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || cancelled) return
      setAccessToken(session.access_token)
      try {
        const status = await getW9Status(session.access_token)
        if (!cancelled) setW9(status)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load W-9 status')
      }
    }
    init()
    return () => {
      cancelled = true
    }
  }, [supabase])

  async function downloadFile(path: string, filename: string) {
    if (!accessToken) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}${path}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(body.detail || `Download failed (${res.status})`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary-400" />
          <CardTitle>Tax Documents</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="error" className="mb-3" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-gray-50 rounded-lg">
          <div>
            <p className="font-medium text-gray-900">Your W-9 (on file)</p>
            {w9?.submitted ? (
              <p className="text-xs text-primary-400">
                Submitted {w9.submitted_at?.slice(0, 10)} • TIN ••{w9.tin_last4}
              </p>
            ) : (
              <p className="text-xs text-yellow-700">Not yet submitted</p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={!w9?.submitted || busy}
            onClick={() => downloadFile('/api/profile/w9/pdf', 'W-9.pdf')}
            leftIcon={<Download className="w-4 h-4" />}
          >
            Download W-9
          </Button>
        </div>

        <p className="text-xs text-gray-500 mt-4">
          Year-end 1099-NECs are issued by NMB Media&apos;s accountant via QuickBooks Online — you&apos;ll receive yours by mail or electronically based on your preferences.
        </p>
      </CardContent>
    </Card>
  )
}

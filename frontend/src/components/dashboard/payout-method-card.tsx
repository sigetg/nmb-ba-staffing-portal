'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, ExternalLink, Loader2, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui'
import { disconnectPaypal, getPayoutMethod, getPaypalConnectUrl } from '@/lib/api'

export function PayoutMethodCard() {
  const supabase = createClient()
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || cancelled) return
      setAccessToken(session.access_token)
      try {
        const status = await getPayoutMethod(session.access_token)
        if (cancelled) return
        if (status.method === 'paypal' && status.paypal_email) {
          setConnectedEmail(status.paypal_email)
        }
      } catch {
        // Non-fatal
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    init()

    // Returning from PayPal OAuth lands here with ?paypal=connected|cancelled|error.
    const url = new URL(window.location.href)
    const paypalStatus = url.searchParams.get('paypal')
    if (paypalStatus) {
      url.searchParams.delete('paypal')
      window.history.replaceState({}, '', url.toString())
      if (paypalStatus === 'cancelled') {
        setError("You cancelled the PayPal connect. Try again when you're ready.")
      } else if (paypalStatus === 'error') {
        setError("Something went wrong connecting PayPal. Please try again.")
      }
    }

    return () => {
      cancelled = true
    }
  }, [supabase])

  async function handleConnect() {
    if (!accessToken) return
    setBusy(true)
    setError(null)
    try {
      const { url } = await getPaypalConnectUrl(accessToken, '/dashboard/profile#payout')
      window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start PayPal connect')
      setBusy(false)
    }
  }

  async function handleDisconnect() {
    if (!accessToken) return
    setBusy(true)
    setError(null)
    try {
      await disconnectPaypal(accessToken)
      setConnectedEmail(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card id="payout">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary-400" />
          <CardTitle>Payout Method</CardTitle>
        </div>
        <p className="text-sm text-primary-400">
          We pay through PayPal. Connect your PayPal account so we can send your earnings.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-primary-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Checking connection…
          </div>
        ) : connectedEmail ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
              <div>
                <p className="font-medium text-gray-900">Connected as {connectedEmail}</p>
                <p className="text-xs text-primary-400">
                  Payments for completed jobs will go to this PayPal account.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={busy}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Use a different PayPal account
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <Button
              onClick={handleConnect}
              disabled={busy || !accessToken}
              leftIcon={<ExternalLink className="w-4 h-4" />}
            >
              Connect PayPal
            </Button>
            <p className="text-xs text-gray-500">
              You&apos;ll be sent to PayPal to log in (or sign up). Once you grant permission, we&apos;ll bring you right back here.
            </p>
          </div>
        )}

        {error && <Alert variant="error" className="mt-4">{error}</Alert>}
      </CardContent>
    </Card>
  )
}

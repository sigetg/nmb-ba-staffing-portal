'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, ExternalLink, Loader2, Mail } from 'lucide-react'
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui'
import { disconnectPaypal, getPayoutMethod, getPaypalConnectUrl } from '@/lib/api'

interface Props {
  accessToken: string
  onBack: () => void
  onSubmitted: () => void
}

export function StepPayPal({ accessToken, onBack, onSubmitted }: Props) {
  const [loading, setLoading] = useState(true)
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        const status = await getPayoutMethod(accessToken)
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
    check()

    // If user just returned from PayPal OAuth, the URL has ?paypal=connected — refresh state.
    const url = new URL(window.location.href)
    if (url.searchParams.get('paypal') === 'connected') {
      // Strip the param; state will refresh via the check() above and via re-poll on focus
      url.searchParams.delete('paypal')
      window.history.replaceState({}, '', url.toString())
    }

    function onFocus() {
      check()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
    }
  }, [accessToken])

  async function handleConnect() {
    setBusy(true)
    setError(null)
    try {
      const { url } = await getPaypalConnectUrl(accessToken)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start PayPal connect')
    } finally {
      setBusy(false)
    }
  }

  async function handleDisconnect() {
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
    <Card className="max-w-2xl w-full mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary-400" />
          <CardTitle>Connect PayPal</CardTitle>
        </div>
        <p className="text-sm text-primary-400">
          We pay through PayPal. Connect your PayPal account so we can send funds to you securely. If you don&apos;t have an account yet, you&apos;ll be able to sign up during the connect flow.
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
          <div className="space-y-4">
            <Button
              onClick={handleConnect}
              disabled={busy}
              leftIcon={<ExternalLink className="w-4 h-4" />}
            >
              Connect PayPal
            </Button>
            <p className="text-xs text-gray-500">
              Opens PayPal in a new tab. After you log in (or sign up) and grant permission, return to this tab — we&apos;ll detect the connection automatically.
            </p>
          </div>
        )}

        {error && <Alert variant="error" className="mt-4">{error}</Alert>}

        <div className="flex justify-between pt-6">
          <Button type="button" variant="ghost" onClick={onBack} disabled={busy}>
            Back
          </Button>
          <Button type="button" disabled={!connectedEmail || busy} onClick={onSubmitted}>
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

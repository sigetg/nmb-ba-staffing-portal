'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, Alert } from '@/components/ui'
import { Undo2, Loader2 } from 'lucide-react'
import { undoLocationCheckout } from '@/lib/api'
import { friendlyError } from '@/lib/error-message'

interface Props {
  jobId: string
  jobTitle: string
  locationId: string
  locationLabel: string
  checkOutTime: string
}

export function RecentCheckoutBanner({
  jobId,
  jobTitle,
  locationId,
  locationLabel,
  checkOutTime,
}: Props) {
  const [isUndoing, setIsUndoing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleUndo = async () => {
    if (!confirm(`Undo your checkout from ${locationLabel}? You'll be returned to active.`)) return
    setIsUndoing(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('Not authenticated')
        return
      }
      await undoLocationCheckout(session.access_token, jobId, locationId)
      router.refresh()
    } catch (err) {
      setError(friendlyError(err, 'submit'))
    } finally {
      setIsUndoing(false)
    }
  }

  const checkedOutAt = new Date(checkOutTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

  return (
    <Card className="border-amber-300 bg-amber-50">
      <CardContent className="py-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-amber-900">
              Just checked out by mistake?
            </p>
            <p className="text-xs text-amber-800 mt-0.5">
              You checked out of <span className="font-medium">{locationLabel}</span> ({jobTitle}) at {checkedOutAt}.
            </p>
          </div>
          <button
            type="button"
            onClick={handleUndo}
            disabled={isUndoing}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-60 text-sm font-medium"
          >
            {isUndoing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
            {isUndoing ? 'Undoing…' : 'Undo Checkout'}
          </button>
        </div>
        {error && <Alert variant="error" onClose={() => setError(null)}>{error}</Alert>}
      </CardContent>
    </Card>
  )
}

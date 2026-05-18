'use client'

import { useEffect, useState } from 'react'
import { Phone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui'
import { formatPhoneNumber } from '@/lib/utils'

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

function isValidPhoneInput(value: string): boolean {
  if (!value.trim()) return true // empty = clear the value
  const d = digitsOnly(value)
  return d.length === 10 || (d.length === 11 && d.startsWith('1'))
}

export default function AdminSettingsPage() {
  const supabase = createClient()
  const [phone, setPhone] = useState('')
  const [originalPhone, setOriginalPhone] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('app_settings')
      .select('contact_phone')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setError(error.message)
        const value = data?.contact_phone ?? null
        setOriginalPhone(value)
        setPhone(value ?? '')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [supabase])

  const handleSave = async () => {
    setError(null)
    setSavedAt(null)

    if (!isValidPhoneInput(phone)) {
      setError('Please enter a valid 10-digit US phone number, or leave blank to clear it.')
      return
    }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const cleaned = phone.trim() ? digitsOnly(phone) : null

      const { error: updateError } = await supabase
        .from('app_settings')
        .update({
          contact_phone: cleaned,
          updated_at: new Date().toISOString(),
          updated_by: user?.id ?? null,
        })
        .eq('id', 1)

      if (updateError) {
        setError(updateError.message)
        return
      }

      setOriginalPhone(cleaned)
      setPhone(cleaned ?? '')
      setSavedAt(new Date().toLocaleTimeString())
    } finally {
      setSaving(false)
    }
  }

  const dirty = digitsOnly(phone) !== (originalPhone ?? '')

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-heading">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          App-wide settings that affect what Brand Ambassadors see in the portal.
        </p>
      </div>

      {error && <Alert variant="error" onClose={() => setError(null)}>{error}</Alert>}
      {savedAt && (
        <Alert variant="success" onClose={() => setSavedAt(null)}>
          Saved at {savedAt}.
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Support contact phone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Phone number"
            type="tel"
            placeholder="(555) 123-4567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={loading || saving}
            leftIcon={<Phone className="w-4 h-4" />}
            helperText="Shown to BAs prominently in the active job flow, in their dashboard sidebar, and on public pages. Leave blank to hide it everywhere."
          />

          {originalPhone && (
            <p className="text-xs text-gray-500">
              Currently saved: <span className="font-medium">{formatPhoneNumber(originalPhone)}</span>
            </p>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSave} isLoading={saving} disabled={loading || !dirty}>
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

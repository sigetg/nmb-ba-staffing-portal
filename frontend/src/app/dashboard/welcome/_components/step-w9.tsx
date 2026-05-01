'use client'

import { FormEvent, useState } from 'react'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select, Alert } from '@/components/ui'
import { submitW9, type W9SubmitInput } from '@/lib/api'
import type { EntityType, TinType } from '@/types'

interface Props {
  accessToken: string
  initial?: Partial<W9SubmitInput>
  onBack: () => void
  onSubmitted: () => void
}

const ENTITY_OPTIONS = [
  { value: 'individual', label: 'Individual / Sole Proprietor' },
  { value: 'sole_proprietor', label: 'Sole Proprietor' },
  { value: 'llc_single', label: 'LLC — Single-member (Disregarded Entity)' },
  { value: 'llc_partnership', label: 'LLC — Taxed as Partnership' },
  { value: 'llc_corp', label: 'LLC — Taxed as Corporation' },
  { value: 'c_corp', label: 'C Corporation' },
  { value: 's_corp', label: 'S Corporation' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'other', label: 'Other' },
]

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS',
  'KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY',
  'NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
].map(s => ({ value: s, label: s }))

function formatTin(value: string, type: TinType): string {
  const digits = value.replace(/\D/g, '').slice(0, 9)
  if (type === 'ssn') {
    if (digits.length <= 3) return digits
    if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
  }
  // EIN: XX-XXXXXXX
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}-${digits.slice(2)}`
}

export function StepW9({ accessToken, initial, onBack, onSubmitted }: Props) {
  const [legalName, setLegalName] = useState(initial?.legal_name || '')
  const [businessName, setBusinessName] = useState(initial?.business_name || '')
  const [entityType, setEntityType] = useState<EntityType>((initial?.entity_type as EntityType) || 'individual')
  const [addressLine1, setAddressLine1] = useState(initial?.address_line1 || '')
  const [addressLine2, setAddressLine2] = useState(initial?.address_line2 || '')
  const [city, setCity] = useState(initial?.city || '')
  const [stateCode, setStateCode] = useState(initial?.state || '')
  const [zip, setZip] = useState(initial?.zip_code || '')
  const [tinType, setTinType] = useState<TinType>(initial?.tin_type || 'ssn')
  const [tin, setTin] = useState('')
  const [signatureName, setSignatureName] = useState(initial?.signature_name || '')
  const [signatureDate, setSignatureDate] = useState(
    initial?.signature_date || new Date().toISOString().slice(0, 10)
  )
  const [electronicConsent, setElectronicConsent] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tinDigits = tin.replace(/\D/g, '')
  const tinValid = tinDigits.length === 9
  const valid =
    legalName.trim() &&
    addressLine1.trim() &&
    city.trim() &&
    stateCode &&
    zip.trim() &&
    tinValid &&
    signatureName.trim() &&
    signatureDate

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    setSubmitting(true)
    setError(null)
    try {
      await submitW9(accessToken, {
        legal_name: legalName.trim(),
        business_name: businessName.trim() || null,
        entity_type: entityType,
        address_line1: addressLine1.trim(),
        address_line2: addressLine2.trim() || null,
        city: city.trim(),
        state: stateCode,
        zip_code: zip.trim(),
        tin: tinDigits,
        tin_type: tinType,
        signature_name: signatureName.trim(),
        signature_date: signatureDate,
        electronic_consent: electronicConsent,
      })
      onSubmitted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save W-9')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="max-w-2xl w-full mx-auto">
      <CardHeader>
        <CardTitle>Tax info (W-9)</CardTitle>
        <p className="text-sm text-primary-400">
          Required for all 1099 contractors. Used at year-end to issue your 1099-NEC.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Legal name (as shown on your tax return)"
            value={legalName}
            onChange={e => setLegalName(e.target.value)}
            required
          />
          <Input
            label="Business name (if different)"
            value={businessName}
            onChange={e => setBusinessName(e.target.value)}
          />
          <Select
            label="Federal tax classification"
            options={ENTITY_OPTIONS}
            value={entityType}
            onChange={e => setEntityType(e.target.value as EntityType)}
            required
          />

          <div className="pt-2 border-t border-gray-200" />

          <Input
            label="Address line 1"
            value={addressLine1}
            onChange={e => setAddressLine1(e.target.value)}
            required
          />
          <Input
            label="Address line 2 (optional)"
            value={addressLine2}
            onChange={e => setAddressLine2(e.target.value)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="City"
              value={city}
              onChange={e => setCity(e.target.value)}
              required
            />
            <Select
              label="State"
              options={US_STATES}
              value={stateCode}
              onChange={e => setStateCode(e.target.value)}
              placeholder="State"
              required
            />
            <Input
              label="ZIP"
              value={zip}
              onChange={e => setZip(e.target.value)}
              maxLength={10}
              required
            />
          </div>

          <div className="pt-2 border-t border-gray-200" />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label="TIN type"
              options={[
                { value: 'ssn', label: 'SSN (Individual)' },
                { value: 'ein', label: 'EIN (Business)' },
              ]}
              value={tinType}
              onChange={e => {
                const next = e.target.value as TinType
                setTinType(next)
                setTin('')
              }}
            />
            <div className="sm:col-span-2">
              <Input
                label={tinType === 'ssn' ? 'Social Security Number' : 'Employer Identification Number'}
                value={formatTin(tin, tinType)}
                onChange={e => setTin(e.target.value)}
                placeholder={tinType === 'ssn' ? '###-##-####' : '##-#######'}
                inputMode="numeric"
                required
                error={tin && !tinValid ? 'Must be 9 digits' : undefined}
              />
            </div>
          </div>

          <div className="pt-2 border-t border-gray-200" />

          <p className="text-xs text-gray-600 leading-relaxed">
            <strong>Certification.</strong> Under penalties of perjury, I certify that: (1) the TIN
            shown is correct; (2) I am not subject to backup withholding; (3) I am a U.S. person;
            and (4) any FATCA codes are correct. Typing my name below acts as my electronic signature.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Signature (type your full legal name)"
              value={signatureName}
              onChange={e => setSignatureName(e.target.value)}
              required
            />
            <Input
              label="Date"
              type="date"
              value={signatureDate}
              onChange={e => setSignatureDate(e.target.value)}
              required
            />
          </div>

          <label className="flex items-start gap-2 text-sm text-gray-700 pt-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={electronicConsent}
              onChange={e => setElectronicConsent(e.target.checked)}
            />
            <span>
              I consent to receive my year-end 1099-NEC electronically through this portal.
              <span className="text-gray-500"> (You can also request a paper copy by email.)</span>
            </span>
          </label>

          {error && <Alert variant="error">{error}</Alert>}

          <div className="flex justify-between pt-4">
            <Button type="button" variant="ghost" onClick={onBack} disabled={submitting}>
              Back
            </Button>
            <Button type="submit" disabled={!valid || submitting}>
              {submitting ? 'Saving…' : 'Continue'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

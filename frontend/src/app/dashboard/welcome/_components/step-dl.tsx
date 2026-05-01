'use client'

import { ChangeEvent, useEffect, useRef, useState } from 'react'
import { CheckCircle2, IdCard, Loader2 } from 'lucide-react'
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui'
import { uploadDriversLicense, getDriversLicenseStatus } from '@/lib/api'

interface Props {
  accessToken: string
  onBack: () => void
  onSubmitted: () => void
}

type SideState = {
  uploaded: boolean
  uploading: boolean
  previewUrl: string | null
  error: string | null
}

const initialSide: SideState = {
  uploaded: false,
  uploading: false,
  previewUrl: null,
  error: null,
}

export function StepDL({ accessToken, onBack, onSubmitted }: Props) {
  const [front, setFront] = useState<SideState>(initialSide)
  const [back, setBack] = useState<SideState>(initialSide)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const frontInput = useRef<HTMLInputElement>(null)
  const backInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const status = await getDriversLicenseStatus(accessToken)
        if (cancelled) return
        if (status.front_uploaded) setFront(s => ({ ...s, uploaded: true }))
        if (status.back_uploaded) setBack(s => ({ ...s, uploaded: true }))
      } catch {
        // Non-fatal; just start fresh
      }
    }
    init()
    return () => {
      cancelled = true
    }
  }, [accessToken])

  async function handleSelect(side: 'front' | 'back', e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const setter = side === 'front' ? setFront : setBack
    setter({
      uploaded: false,
      uploading: true,
      previewUrl: URL.createObjectURL(file),
      error: null,
    })
    setGlobalError(null)
    try {
      await uploadDriversLicense(accessToken, side, file)
      setter(s => ({ ...s, uploading: false, uploaded: true }))
    } catch (err) {
      setter(s => ({
        ...s,
        uploading: false,
        error: err instanceof Error ? err.message : 'Upload failed',
      }))
    }
  }

  const bothDone = front.uploaded && back.uploaded
  const anyUploading = front.uploading || back.uploading

  return (
    <Card className="max-w-2xl w-full mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          <IdCard className="w-5 h-5 text-primary-400" />
          <CardTitle>Driver&apos;s License</CardTitle>
        </div>
        <p className="text-sm text-primary-400">
          Upload clear photos of the front and back of your driver&apos;s license. Both are required.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SidePicker
            label="Front"
            state={front}
            onPick={() => frontInput.current?.click()}
          />
          <SidePicker
            label="Back"
            state={back}
            onPick={() => backInput.current?.click()}
          />
        </div>
        <input
          ref={frontInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="hidden"
          onChange={e => handleSelect('front', e)}
        />
        <input
          ref={backInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="hidden"
          onChange={e => handleSelect('back', e)}
        />

        <p className="text-xs text-gray-500 mt-3">
          Stored securely; only NMB admin staff can view. Used for identity verification before paying you.
        </p>

        {globalError && (
          <Alert variant="error" className="mt-4">{globalError}</Alert>
        )}

        <div className="flex justify-between pt-6">
          <Button type="button" variant="ghost" onClick={onBack} disabled={anyUploading}>
            Back
          </Button>
          <Button type="button" disabled={!bothDone || anyUploading} onClick={onSubmitted}>
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function SidePicker({
  label,
  state,
  onPick,
}: {
  label: string
  state: SideState
  onPick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={`relative aspect-[1.6/1] w-full rounded-lg border-2 border-dashed flex items-center justify-center overflow-hidden transition-colors ${
        state.uploaded
          ? 'border-green-300 bg-green-50'
          : state.error
            ? 'border-red-300 bg-red-50'
            : 'border-gray-300 hover:border-primary-300 bg-gray-50'
      }`}
    >
      {state.previewUrl && (
        <img
          src={state.previewUrl}
          alt={`${label} preview`}
          className="absolute inset-0 w-full h-full object-cover opacity-90"
        />
      )}
      <div className="relative z-10 flex flex-col items-center justify-center text-center p-3">
        {state.uploading ? (
          <Loader2 className="w-7 h-7 text-primary-400 animate-spin mb-2" />
        ) : state.uploaded ? (
          <CheckCircle2 className="w-7 h-7 text-green-600 mb-2" />
        ) : (
          <IdCard className="w-7 h-7 text-gray-400 mb-2" />
        )}
        <p className="font-medium text-gray-900">{label}</p>
        <p className="text-xs text-primary-400">
          {state.uploading
            ? 'Uploading…'
            : state.uploaded
              ? 'Uploaded ✓'
              : state.error
                ? state.error
                : 'Click to upload'}
        </p>
      </div>
    </button>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, Alert } from '@/components/ui'

const VALID_TYPES: EmailOtpType[] = [
  'signup',
  'recovery',
  'invite',
  'magiclink',
  'email_change',
  'email',
]

export default function ConfirmPage() {
  const router = useRouter()
  const params = useSearchParams()
  const tokenHash = params.get('token_hash')
  const type = params.get('type') as EmailOtpType | null
  const next = params.get('next') || '/dashboard'
  const malformed = !tokenHash || !type || !VALID_TYPES.includes(type)
  const [verifyError, setVerifyError] = useState<string | null>(null)

  useEffect(() => {
    if (malformed) return

    const supabase = createClient()
    supabase.auth
      .verifyOtp({ token_hash: tokenHash, type })
      .then(({ error }) => {
        if (error) {
          setVerifyError('This link is invalid or has expired. Please request a new one.')
          return
        }
        router.replace(next)
      })
  }, [malformed, tokenHash, type, next, router])

  const error = malformed
    ? 'This link is malformed. Please request a new one.'
    : verifyError

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <Image
              src="/logo.jpg"
              alt="NMB Media"
              width={240}
              height={96}
              className="h-24 w-auto object-contain mx-auto"
              priority
            />
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{error ? 'Link problem' : 'Confirming…'}</CardTitle>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="space-y-4">
                <Alert variant="error">{error}</Alert>
                <div className="text-center text-sm">
                  <Link
                    href="/auth/forgot-password"
                    className="font-medium text-primary-400 hover:text-primary-500"
                  >
                    Request a new link
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-sm text-primary-400">Hold on — verifying your link.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button, Input, Card, CardContent, CardHeader, CardTitle, Alert } from '@/components/ui'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim()) {
      setError('Email is required')
      return
    }

    setIsLoading(true)

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: `${window.location.origin}/auth/callback` }
      )

      if (resetError) {
        setError(resetError.message)
        return
      }

      setSuccess(true)
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

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
          <p className="mt-4 text-primary-400">
            Reset your password
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Forgot Password</CardTitle>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="space-y-4">
                <Alert variant="success">
                  Check your email for a password reset link. It may take a minute to arrive.
                </Alert>
                <div className="text-center">
                  <Link
                    href="/"
                    className="font-medium text-primary-400 hover:text-primary-500 text-sm"
                  >
                    Back to Sign In
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="error" onClose={() => setError(null)}>
                    {error}
                  </Alert>
                )}

                <p className="text-sm text-primary-400">
                  Enter your email address and we&apos;ll send you a link to reset your password.
                </p>

                <Input
                  label="Email"
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  disabled={isLoading}
                  autoComplete="email"
                />

                <Button
                  type="submit"
                  className="w-full"
                  isLoading={isLoading}
                >
                  Send Reset Link
                </Button>

                <div className="text-center text-sm">
                  <Link
                    href="/"
                    className="font-medium text-primary-400 hover:text-primary-500"
                  >
                    Back to Sign In
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button, Input, Card, CardContent, CardHeader, CardTitle, Alert } from '@/components/ui'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const validateForm = () => {
    if (!email.trim()) {
      setError('Email is required')
      return false
    }
    if (!email.includes('@')) {
      setError('Please enter a valid email address')
      return false
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return false
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!validateForm()) return

    setIsLoading(true)

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            role: 'ba',
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (signUpError) {
        setError(signUpError.message)
        return
      }

      if (data.user && !data.session) {
        // Email confirmation is required
        setEmailSent(true)
      } else if (data.user) {
        router.push('/auth/setup')
      }
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
            Create your Brand Ambassador account
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{emailSent ? 'Check Your Email' : 'Register'}</CardTitle>
          </CardHeader>
          <CardContent>
            {emailSent ? (
              <div className="space-y-4">
                <Alert variant="success">
                  We&apos;ve sent a confirmation link to <strong>{email}</strong>. Please check your email and click the link to activate your account.
                </Alert>
                <p className="text-sm text-primary-400 text-center">
                  Didn&apos;t receive the email? Check your spam folder or try again.
                </p>
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
            <>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="error" onClose={() => setError(null)}>
                  {error}
                </Alert>
              )}

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

              <Input
                label="Password"
                type="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                disabled={isLoading}
                autoComplete="new-password"
              />

              <Input
                label="Confirm Password"
                type="password"
                name="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                disabled={isLoading}
                autoComplete="new-password"
              />

              <Button
                type="submit"
                className="w-full"
                isLoading={isLoading}
              >
                Create Account
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-primary-400">
                Already have an account?{' '}
              </span>
              <Link
                href="/"
                className="font-medium text-primary-400 hover:text-primary-500"
              >
                Sign in
              </Link>
            </div>
            </>
            )}
          </CardContent>
        </Card>

        <p className="mt-8 text-center text-xs text-primary-400">
          By creating an account, you agree to our{' '}
          <Link href="/terms" className="underline hover:text-gray-700">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="underline hover:text-gray-700">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  )
}

'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button, Input, Card, CardContent, CardHeader, CardTitle, Alert } from '@/components/ui'
import { ContactHelpLine } from '@/components/contact-phone'
import { friendlyError } from '@/lib/error-message'
import * as Sentry from '@sentry/nextjs'

function SignInForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const message = searchParams.get('message')
  const authError = searchParams.get('error')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)

    if (!email.trim()) {
      setError('Email is required')
      return
    }
    if (!password) {
      setError('Password is required')
      return
    }

    setIsLoading(true)

    try {
      const trimmedEmail = email.trim()
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      })

      if (signInError) {
        const isUnconfirmed =
          signInError.code === 'email_not_confirmed' ||
          /email not confirmed/i.test(signInError.message)
        if (isUnconfirmed) {
          const { error: resendError } = await supabase.auth.resend({
            type: 'signup',
            email: trimmedEmail,
          })
          if (resendError) {
            setError(
              `Your email hasn't been confirmed yet, and we couldn't resend the link: ${resendError.message}`
            )
          } else {
            setInfo(
              `Your email hasn't been confirmed yet. We just sent a new confirmation link to ${trimmedEmail}. Check your inbox (and spam).`
            )
          }
          return
        }
        setError(signInError.message)
        return
      }

      if (data.user) {
        Sentry.setUser({ id: data.user.id, email: data.user.email ?? undefined })

        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', data.user.id)
          .single()

        if (userData?.role === 'admin') {
          router.push('/admin/dashboard')
        } else {
          router.push('/dashboard')
        }
      }
    } catch (err) {
      setError(friendlyError(err, 'auth'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>Sign In</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {message === 'password_updated' && (
            <Alert variant="success">
              Your password has been updated. Please sign in with your new password.
            </Alert>
          )}
          {authError === 'auth_error' && (
            <Alert variant="error">
              The link is invalid or has expired. Please try again.
            </Alert>
          )}
          {error && (
            <Alert variant="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          {info && (
            <Alert variant="success" onClose={() => setInfo(null)}>
              {info}
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
            placeholder="Your password"
            disabled={isLoading}
            autoComplete="current-password"
          />

          <div className="flex justify-end">
            <Link
              href="/auth/forgot-password"
              className="text-sm text-primary-400 hover:text-primary-500"
            >
              Forgot your password?
            </Link>
          </div>

          <Button
            type="submit"
            className="w-full"
            isLoading={isLoading}
          >
            Sign In
          </Button>
        </form>

        <div className="mt-6 text-center text-sm">
          <span className="text-primary-400">
            Don&apos;t have an account?{' '}
          </span>
          <Link
            href="/auth/register"
            className="font-medium text-primary-400 hover:text-primary-500"
          >
            Apply Now
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto">
          <div className="text-center">
            <Image
              src="/logo.jpg"
              alt="NMB Media - Promotions in Motion"
              width={400}
              height={160}
              className="h-32 w-auto object-contain mx-auto"
              priority
            />
            <h1 className="mt-6 text-4xl font-bold text-heading sm:text-5xl">
              Staffing Portal
            </h1>
            <div className="mt-4 space-y-2 text-primary-400">
              <p className="text-lg font-medium">
                Welcome! You&apos;ve made it!
                <br />
                Now it&apos;s time to shine.
              </p>
              <p className="text-sm">
                Our clients are looking for happy, energetic, and outgoing individuals
                to help bring their products and services to life for consumers.
              </p>
              <p className="text-sm">
                If you&apos;re ready to be part of an exciting team, we&apos;d love to have you.
                <br />
                Please sign in or sign up below to get started.
              </p>
            </div>
          </div>

          <Suspense>
            <SignInForm />
          </Suspense>

          <p className="mt-8 text-center text-xs text-primary-400">
            By signing in, you agree to our{' '}
            <Link href="/terms" className="underline hover:text-gray-700">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="underline hover:text-gray-700">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </main>

      <footer className="border-t border-gray-200 mt-8">
        <div className="container mx-auto px-4 py-6 text-xs text-gray-500 flex flex-wrap items-center justify-center gap-4">
          <span>© {new Date().getFullYear()} National Mobile Billboards LLC</span>
          <Link href="/privacy" className="hover:text-gray-700">Privacy</Link>
          <Link href="/terms" className="hover:text-gray-700">Terms</Link>
          <ContactHelpLine variant="footer" />
        </div>
      </footer>
    </div>
  )
}

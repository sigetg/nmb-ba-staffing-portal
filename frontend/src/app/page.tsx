'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button, Input, Card, CardContent, CardHeader, CardTitle, Alert } from '@/components/ui'

export default function Home() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

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
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (signInError) {
        setError(signInError.message)
        return
      }

      if (data.user) {
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
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

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
                Welcome — you&apos;ve made it!
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

          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Sign In</CardTitle>
            </CardHeader>
            <CardContent>
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
                  placeholder="Your password"
                  disabled={isLoading}
                  autoComplete="current-password"
                />

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
        </div>
      </main>
    </div>
  )
}

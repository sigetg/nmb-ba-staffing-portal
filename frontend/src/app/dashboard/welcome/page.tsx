'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getOnboardingStatus } from '@/lib/api'
import { Spinner } from '@/components/ui'
import { getImpersonatedBAId } from '@/lib/impersonation'
import { StepWelcome } from './_components/step-welcome'
import { StepW9 } from './_components/step-w9'
import { StepDL } from './_components/step-dl'
import { StepPayPal } from './_components/step-paypal'
import { StepDone } from './_components/step-done'

type StepKey = 'welcome' | 'w9' | 'dl' | 'paypal' | 'done'

const STEPS: { key: StepKey; label: string }[] = [
  { key: 'welcome', label: 'Welcome' },
  { key: 'w9', label: 'Tax Info' },
  { key: 'dl', label: 'ID' },
  { key: 'paypal', label: 'PayPal' },
  { key: 'done', label: 'Done' },
]

export default function WelcomePage() {
  const router = useRouter()
  const supabase = createClient()
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [step, setStep] = useState<StepKey>('welcome')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/auth/login')
        return
      }
      if (cancelled) return
      setAccessToken(session.access_token)

      try {
        const status = await getOnboardingStatus(session.access_token)
        if (cancelled) return
        if (status.onboarding_complete) {
          setStep('done')
        } else if (!status.w9_submitted) {
          // Stay on welcome to introduce, then user advances to w9
          setStep('welcome')
        } else if (!status.dl_uploaded) {
          setStep('dl')
        } else if (!status.payout_submitted) {
          setStep('paypal')
        }
      } catch {
        // Ignore — welcome step is always safe
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    init()
    return () => {
      cancelled = true
    }
  }, [supabase, router])

  async function markWelcomeSeenAndExit() {
    const impersonatedId = getImpersonatedBAId()
    const { data: { user } } = await supabase.auth.getUser()
    if (impersonatedId) {
      await supabase
        .from('ba_profiles')
        .update({ has_seen_welcome: true })
        .eq('id', impersonatedId)
    } else if (user) {
      await supabase
        .from('ba_profiles')
        .update({ has_seen_welcome: true })
        .eq('user_id', user.id)
    }
    router.push('/dashboard/jobs')
    router.refresh()
  }

  if (loading || !accessToken) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner />
      </div>
    )
  }

  const activeIndex = STEPS.findIndex(s => s.key === step)

  return (
    <div className="space-y-6">
      <ol className="flex items-center justify-center gap-2 text-sm">
        {STEPS.map((s, i) => {
          const reached = i <= activeIndex
          const active = i === activeIndex
          return (
            <li key={s.key} className="flex items-center gap-2">
              <span
                className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium ${
                  active
                    ? 'bg-primary-400 text-white'
                    : reached
                      ? 'bg-primary-100 text-primary-500'
                      : 'bg-gray-100 text-gray-400'
                }`}
              >
                {i + 1}
              </span>
              <span
                className={`hidden sm:inline ${
                  active ? 'text-gray-900 font-medium' : 'text-gray-500'
                }`}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <span className={`w-6 h-0.5 ${reached ? 'bg-primary-300' : 'bg-gray-200'}`} />
              )}
            </li>
          )
        })}
      </ol>

      {step === 'welcome' && <StepWelcome onNext={() => setStep('w9')} />}
      {step === 'w9' && (
        <StepW9
          accessToken={accessToken}
          onBack={() => setStep('welcome')}
          onSubmitted={() => setStep('dl')}
        />
      )}
      {step === 'dl' && (
        <StepDL
          accessToken={accessToken}
          onBack={() => setStep('w9')}
          onSubmitted={() => setStep('paypal')}
        />
      )}
      {step === 'paypal' && (
        <StepPayPal
          accessToken={accessToken}
          onBack={() => setStep('dl')}
          onSubmitted={() => setStep('done')}
        />
      )}
      {step === 'done' && <StepDone onFinish={markWelcomeSeenAndExit} />}
    </div>
  )
}

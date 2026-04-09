'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PartyPopper } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button, Card, CardContent } from '@/components/ui'
import { getImpersonatedBAId } from '@/lib/impersonation'

export default function WelcomePage() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const markWelcomeSeen = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }

      // Mark welcome as seen
      const impersonatedId = getImpersonatedBAId()
      if (impersonatedId) {
        await supabase.from('ba_profiles').update({ has_seen_welcome: true }).eq('id', impersonatedId)
      } else {
        await supabase.from('ba_profiles').update({ has_seen_welcome: true }).eq('user_id', user.id)
      }
    }

    markWelcomeSeen()
  }, [supabase, router])

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardContent className="py-12">
          <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center mb-6">
              <PartyPopper className="w-10 h-10 text-orange-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              Congratulations!
            </h1>
            <p className="text-primary-400 mb-2">
              Your Brand Ambassador profile has been approved.
            </p>
            <p className="text-primary-400 mb-8">
              You can now browse available jobs, apply, and start working with NMB Media.
            </p>
            <Button
              onClick={() => router.push('/dashboard')}
              className="px-8"
            >
              Get Started
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

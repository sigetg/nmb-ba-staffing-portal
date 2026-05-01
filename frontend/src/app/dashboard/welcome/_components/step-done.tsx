'use client'

import { CheckCircle2 } from 'lucide-react'
import { Button, Card, CardContent } from '@/components/ui'

export function StepDone({ onFinish }: { onFinish: () => void }) {
  return (
    <Card className="max-w-xl w-full mx-auto">
      <CardContent className="py-12">
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">You&apos;re all set!</h1>
          <p className="text-primary-400 mb-2">
            Your tax info and payout method are saved.
          </p>
          <p className="text-primary-400 mb-8">
            You can update either of these any time from your profile.
          </p>
          <Button onClick={onFinish} className="px-8">
            Browse Jobs
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

'use client'

import { PartyPopper } from 'lucide-react'
import { Button, Card, CardContent } from '@/components/ui'

export function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <Card className="max-w-xl w-full mx-auto">
      <CardContent className="py-12">
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center mb-6">
            <PartyPopper className="w-10 h-10 text-orange-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Congratulations!</h1>
          <p className="text-primary-400 mb-2">
            Your Brand Ambassador profile has been approved.
          </p>
          <p className="text-primary-400 mb-6">
            Before you can apply for jobs, we need a couple of details so we can pay you correctly:
          </p>
          <ul className="text-left text-primary-400 space-y-2 mb-8">
            <li>• <span className="font-medium">Tax info (W-9)</span> — required for any 1099 contractor</li>
            <li>• <span className="font-medium">Payout method</span> — direct deposit (ACH) or PayPal</li>
          </ul>
          <p className="text-sm text-gray-500 mb-6">
            Takes about 2 minutes. Your information is encrypted and only visible to you and our admin team.
          </p>
          <Button onClick={onNext} className="px-8">
            Get Started
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

'use client'

import { useWizard } from './wizard-context'
import { Check } from 'lucide-react'

const STEPS = [
  { label: 'Basic Info', description: 'Title, brand, pay' },
  { label: 'Days', description: 'Select dates' },
  { label: 'Locations', description: 'Add locations per day' },
  { label: 'Review', description: 'Review & create' },
]

export function WizardProgress() {
  const { state, setCurrentStep, canGoNext } = useWizard()
  const { currentStep } = state

  return (
    <nav aria-label="Progress" className="mb-8">
      <ol className="flex items-center">
        {STEPS.map((step, idx) => {
          const isCompleted = idx < currentStep
          const isCurrent = idx === currentStep
          const isClickable = idx <= currentStep || (idx === currentStep + 1 && canGoNext())

          return (
            <li key={step.label} className={`flex items-center ${idx < STEPS.length - 1 ? 'flex-1' : ''}`}>
              <button
                type="button"
                onClick={() => isClickable ? setCurrentStep(idx) : undefined}
                disabled={!isClickable}
                className={`flex items-center gap-2 group ${isClickable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
              >
                <span
                  className={`
                    flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium shrink-0
                    ${isCompleted ? 'bg-primary-500 text-white' : ''}
                    ${isCurrent ? 'bg-primary-500 text-white ring-2 ring-primary-200' : ''}
                    ${!isCompleted && !isCurrent ? 'bg-gray-200 text-gray-500' : ''}
                  `}
                >
                  {isCompleted ? <Check className="w-4 h-4" /> : idx + 1}
                </span>
                <span className="hidden sm:block">
                  <span className={`text-sm font-medium ${isCurrent ? 'text-primary-600' : 'text-gray-500'}`}>
                    {step.label}
                  </span>
                </span>
              </button>
              {idx < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-4 ${idx < currentStep ? 'bg-primary-500' : 'bg-gray-200'}`} />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

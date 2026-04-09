'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button, Alert } from '@/components/ui'
import { ChevronLeft, ChevronRight, Save } from 'lucide-react'
import { uploadJobWorksheet } from '@/lib/api'
import { WizardProvider, useWizard } from '@/components/admin/job-wizard/wizard-context'
import { WizardProgress } from '@/components/admin/job-wizard/wizard-progress'
import { StepBasicInfo } from '@/components/admin/job-wizard/step-basic-info'
import { StepDays } from '@/components/admin/job-wizard/step-days'
import { StepLocations } from '@/components/admin/job-wizard/step-locations'
import { StepReview } from '@/components/admin/job-wizard/step-review'

function WizardContent() {
  const { state, setCurrentStep, canGoNext } = useWizard()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const steps = [
    <StepBasicInfo key="basic" />,
    <StepDays key="days" />,
    <StepLocations key="locations" />,
    <StepReview key="review" />,
  ]

  const saveJob = async (status: 'draft' | 'published') => {
    setError(null)

    // Draft only requires a title
    if (status === 'draft' && !state.title.trim()) {
      setError('Title is required to save a draft.')
      return
    }

    setIsLoading(true)

    try {
      // Detect timezone from first location's coordinates
      const firstLoc = state.days[0]?.locations[0]
      let timezone = 'America/Chicago'
      if (firstLoc?.latitude != null && firstLoc?.longitude != null) {
        timezone = 'America/Chicago'
      }

      // 1. Insert the job
      const { data: job, error: insertError } = await supabase.from('jobs').insert({
        title: state.title.trim(),
        brand: state.brand.trim() || null,
        description: state.description.trim() || null,
        pay_rate: state.payRate ? parseFloat(state.payRate) : 0,
        slots: state.slots ? parseInt(state.slots) : 1,
        slots_filled: 0,
        worksheet_url: null,
        status,
        timezone,
        job_type_id: state.jobTypeId || null,
      }).select('id').single()

      if (insertError || !job) {
        setError(insertError?.message || 'Failed to create job')
        return
      }

      // 2. Insert days and locations (if any exist)
      for (const day of state.days) {
        const { data: dayRow, error: dayError } = await supabase.from('job_days').insert({
          job_id: job.id,
          date: day.date,
          sort_order: day.sort_order,
        }).select('id').single()

        if (dayError || !dayRow) {
          setError('Failed to create job day: ' + (dayError?.message || ''))
          return
        }

        for (const loc of day.locations) {
          const { error: locError } = await supabase.from('job_day_locations').insert({
            job_day_id: dayRow.id,
            job_id: job.id,
            location: loc.location.trim(),
            latitude: loc.latitude,
            longitude: loc.longitude,
            start_time: loc.start_time,
            end_time: loc.end_time,
            sort_order: loc.sort_order,
          })

          if (locError) {
            setError('Failed to create location: ' + locError.message)
            return
          }
        }
      }

      // 3. Upload worksheet if provided
      if (state.worksheetFile) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          setError('Job created but failed to upload worksheet: not authenticated')
          return
        }
        try {
          await uploadJobWorksheet(session.access_token, state.worksheetFile, job.id)
        } catch (err) {
          setError('Job created but failed to upload worksheet: ' + (err instanceof Error ? err.message : String(err)))
          return
        }
      }

      router.push('/admin/jobs')
    } catch {
      setError('Failed to create job')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/jobs" className="p-2 rounded-lg hover:bg-gray-100">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-heading">Create New Job</h1>
      </div>

      {error && (
        <Alert variant="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <WizardProgress />

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {steps[state.currentStep]}
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => saveJob('draft')}
            isLoading={isLoading}
          >
            <Save className="w-4 h-4 mr-1" /> Save Draft
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setCurrentStep(state.currentStep - 1)}
            disabled={state.currentStep === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>

          {state.currentStep < 3 ? (
            <Button
              type="button"
              onClick={() => setCurrentStep(state.currentStep + 1)}
              disabled={!canGoNext()}
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => saveJob('published')}
              isLoading={isLoading}
              disabled={!canGoNext()}
            >
              Publish Job
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function NewJobPage() {
  return (
    <WizardProvider>
      <WizardContent />
    </WizardProvider>
  )
}

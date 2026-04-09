'use client'

import { useState, useEffect, use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button, Card, CardContent, CardHeader, CardTitle, Alert } from '@/components/ui'
import { ChevronLeft, MapPin, Camera, Loader2, CheckCircle2 } from 'lucide-react'
import { uploadJobPhoto } from '@/lib/api'
import { DynamicCheckoutForm, type CheckoutResponseValueData } from '@/components/worker/dynamic-checkout-form'
import type { JobType } from '@/types'
import { getImpersonatedBAId } from '@/lib/impersonation'

export default function DayCheckoutPage({ params }: { params: Promise<{ id: string; dayId: string }> }) {
  const { id: jobId, dayId } = use(params)
  const searchParams = useSearchParams()
  const lastLocationId = searchParams.get('locationId')

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [checkInId, setCheckInId] = useState<string | null>(null)
  const [hoursWorked, setHoursWorked] = useState('')

  // GPS + Photo
  const [gpsLocation, setGpsLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [checkoutPhoto, setCheckoutPhoto] = useState<string | null>(null)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)

  // Job type + dynamic form
  const [jobType, setJobType] = useState<JobType | null>(null)
  const [responseValues, setResponseValues] = useState<CheckoutResponseValueData[]>([])

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => { loadData() }, [jobId, dayId])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)

      const impersonatedId = getImpersonatedBAId()
      const { data: profile } = await (impersonatedId
        ? supabase.from('ba_profiles').select('id').eq('id', impersonatedId).single()
        : supabase.from('ba_profiles').select('id').eq('user_id', user.id).single())
      if (!profile) return
      setProfileId(profile.id)

      // Load job type
      const { data: job } = await supabase
        .from('jobs')
        .select('job_type_id')
        .eq('id', jobId)
        .single()

      if (job?.job_type_id) {
        const { data: jt } = await supabase
          .from('job_types')
          .select('*, job_type_kpis(*), job_type_questions(*, job_type_question_options(*))')
          .eq('id', job.job_type_id)
          .single()

        if (jt) {
          // Sort nested data
          if (jt.job_type_kpis) jt.job_type_kpis.sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
          if (jt.job_type_questions) {
            jt.job_type_questions.sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
            for (const q of jt.job_type_questions) {
              if (q.job_type_question_options) q.job_type_question_options.sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
            }
          }
          setJobType(jt as JobType)
        }
      }

      // Find the active check-in for the last location of the day
      const locId = lastLocationId
      if (locId) {
        const { data: ci } = await supabase
          .from('location_check_ins')
          .select('*')
          .eq('job_day_location_id', locId)
          .eq('ba_id', profile.id)
          .single()

        if (ci && !ci.check_out_time) {
          setCheckInId(ci.id)
          const start = new Date(ci.check_in_time).getTime()
          const hrs = ((Date.now() - start) / 3600000).toFixed(1)
          setHoursWorked(hrs)
        }
      }
    } catch {
      setError('Failed to load')
    } finally {
      setIsLoading(false)
    }
  }

  const getLocation = () => {
    setIsGettingLocation(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => { setGpsLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }); setIsGettingLocation(false) },
      () => { setIsGettingLocation(false) },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId || !profileId) return
    setIsUploadingPhoto(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { setError('Not authenticated'); return }

      const { url } = await uploadJobPhoto(session.access_token, file, jobId, 'check_out', lastLocationId || undefined)
      setCheckoutPhoto(url)
    } catch {
      setError('Failed to upload photo')
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  const handleCheckout = async () => {
    if (!gpsLocation || !checkoutPhoto || !checkInId) return
    setIsSubmitting(true)
    setError(null)

    try {
      // Update check-in record
      await supabase.from('location_check_ins').update({
        check_out_time: new Date().toISOString(),
        check_out_latitude: gpsLocation.latitude,
        check_out_longitude: gpsLocation.longitude,
        is_end_of_day: true,
      }).eq('id', checkInId)

      // Insert checkout response
      if (responseValues.length > 0) {
        const { data: resp } = await supabase
          .from('checkout_responses')
          .insert({
            job_id: jobId,
            ba_id: profileId,
            location_check_in_id: checkInId,
          })
          .select('id')
          .single()

        if (resp) {
          for (const val of responseValues) {
            await supabase.from('checkout_response_values').insert({
              checkout_response_id: resp.id,
              kpi_id: val.kpi_id || null,
              question_id: val.question_id || null,
              numeric_value: val.numeric_value ?? null,
              text_value: val.text_value || null,
              option_id: val.option_id || null,
            })
          }
        }
      }

      setSuccess('Day completed!')
      setTimeout(() => router.push('/dashboard/my-jobs'), 1500)
    } catch {
      setError('Failed to check out')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[400px]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400" /></div>
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 pb-8">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100"><ChevronLeft className="w-5 h-5" /></button>
        <h1 className="text-2xl font-bold text-heading">End of Day Checkout</h1>
      </div>

      {error && <Alert variant="error" onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {hoursWorked && (
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-xs text-gray-500 uppercase">Time at Last Location</p>
            <p className="text-2xl font-bold text-primary-600">{hoursWorked} hrs</p>
          </CardContent>
        </Card>
      )}

      {/* GPS */}
      <Card>
        <CardHeader><CardTitle>Checkout Location</CardTitle></CardHeader>
        <CardContent>
          {gpsLocation ? (
            <div className="p-3 bg-green-50 rounded-lg flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" /><span className="text-sm text-green-800">Location captured</span>
            </div>
          ) : (
            <Button onClick={getLocation} isLoading={isGettingLocation}><MapPin className="w-4 h-4 mr-2" />Get Location</Button>
          )}
        </CardContent>
      </Card>

      {/* Photo */}
      <Card>
        <CardHeader><CardTitle>Checkout Photo (Required)</CardTitle></CardHeader>
        <CardContent>
          {checkoutPhoto ? (
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 rounded-lg overflow-hidden border"><Image src={checkoutPhoto} alt="Checkout" fill className="object-cover" /></div>
              <div className="flex items-center gap-2 text-green-700"><CheckCircle2 className="w-5 h-5" /><span>Photo uploaded</span></div>
            </div>
          ) : (
            <label className="inline-flex items-center gap-2 px-4 py-2 bg-primary-400 text-white rounded-lg hover:bg-primary-500 cursor-pointer">
              {isUploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              {isUploadingPhoto ? 'Uploading...' : 'Take Photo'}
              <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} className="hidden" disabled={isUploadingPhoto} />
            </label>
          )}
        </CardContent>
      </Card>

      {/* Dynamic Checkout Form */}
      {jobType && (
        <DynamicCheckoutForm
          jobType={jobType}
          values={responseValues}
          onChange={setResponseValues}
        />
      )}

      {/* Submit */}
      <Button
        onClick={handleCheckout}
        isLoading={isSubmitting}
        disabled={!gpsLocation || !checkoutPhoto}
        className="w-full py-4 text-lg"
      >
        <CheckCircle2 className="w-6 h-6 mr-2" />Complete Day
      </Button>
    </div>
  )
}

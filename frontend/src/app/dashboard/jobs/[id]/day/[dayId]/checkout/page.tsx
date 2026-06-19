'use client'

import { useState, useEffect, use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button, Card, CardContent, CardHeader, CardTitle, Alert, Textarea } from '@/components/ui'
import { ChevronLeft, MapPin, Camera, Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { uploadJobPhoto } from '@/lib/api'
import { compressImage } from '@/lib/compress-image'
import { friendlyError } from '@/lib/error-message'
import { DynamicCheckoutForm, type CheckoutResponseValueData } from '@/components/worker/dynamic-checkout-form'
import { ContactHelpLine } from '@/components/contact-phone'
import type { JobType } from '@/types'

const MAX_PHOTO_BYTES = 5 * 1024 * 1024

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(deltaPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

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
  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [distance, setDistance] = useState<number | null>(null)
  const [showGpsOverride, setShowGpsOverride] = useState(false)
  const [gpsOverrideReason, setGpsOverrideReason] = useState('')
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

      const { data: profile } = await supabase
        .from('ba_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()
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

        // Load location coordinates for distance check
        const { data: locData } = await supabase
          .from('job_day_locations')
          .select('latitude, longitude')
          .eq('id', locId)
          .single()
        if (locData?.latitude && locData?.longitude) {
          setLocationCoords({ latitude: Number(locData.latitude), longitude: Number(locData.longitude) })
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
    setLocationError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude }
        setGpsLocation(coords)
        if (locationCoords) {
          const dist = calculateDistance(coords.latitude, coords.longitude, locationCoords.latitude, locationCoords.longitude)
          setDistance(Math.round(dist))
        }
        setIsGettingLocation(false)
      },
      () => { setLocationError('Unable to get location'); setIsGettingLocation(false) },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId || !profileId) return
    if (file.size > MAX_PHOTO_BYTES) {
      setError('Photo must be under 5MB')
      return
    }
    setIsUploadingPhoto(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { setError('Not authenticated'); return }

      const compressed = await compressImage(file)
      const { url } = await uploadJobPhoto(session.access_token, compressed, jobId, 'check_out', lastLocationId || undefined, profileId!)
      setCheckoutPhoto(url)
    } catch (err) {
      setError(friendlyError(err, 'upload'))
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  const handleCheckout = async () => {
    if (!gpsLocation || !checkoutPhoto || !checkInId) return
    if (!confirm('End your day and submit your shift? You will not be able to make changes after this.')) return
    setIsSubmitting(true)
    setError(null)

    try {
      const useOverride = showGpsOverride && !!gpsOverrideReason.trim()

      await supabase.from('location_check_ins').update({
        check_out_time: new Date().toISOString(),
        check_out_latitude: gpsLocation.latitude,
        check_out_longitude: gpsLocation.longitude,
        is_end_of_day: true,
        check_out_gps_override: useOverride,
        check_out_gps_override_explanation: useOverride ? gpsOverrideReason.trim() : null,
      }).eq('id', checkInId)

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

  const isWithinRange = distance !== null && distance <= 200
  const canOverride = distance === null || distance > 200

  return (
    <div className="max-w-lg mx-auto space-y-6 pb-8">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100"><ChevronLeft className="w-5 h-5" /></button>
        <h1 className="text-2xl font-bold text-heading">End of Day Checkout</h1>
      </div>

      <ContactHelpLine />

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
        <CardContent className="space-y-4">
          {locationError && <Alert variant="error">{locationError}</Alert>}

          {!gpsLocation ? (
            <div className="text-center py-4">
              <p className="text-gray-500 mb-4 text-sm">We need your location to verify you&apos;re at the site.</p>
              <Button onClick={getLocation} isLoading={isGettingLocation}><MapPin className="w-4 h-4 mr-2" />Get Location</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {distance !== null ? (
                <div className={`p-3 rounded-lg ${isWithinRange ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className="flex items-center gap-2">
                    {isWithinRange ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <XCircle className="w-5 h-5 text-red-600" />}
                    <div>
                      <p className={`font-medium text-sm ${isWithinRange ? 'text-green-800' : 'text-red-800'}`}>
                        {isWithinRange ? 'Within range' : 'Too far from location'}
                      </p>
                      <p className={`text-xs ${isWithinRange ? 'text-green-700' : 'text-red-700'}`}>
                        Distance: {distance}m {!isWithinRange && '(max: 200m)'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-amber-50">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <p className="font-medium text-sm text-amber-800">Distance can&apos;t be verified</p>
                      <p className="text-xs text-amber-700">No coordinates set for this location. Use override to continue.</p>
                    </div>
                  </div>
                </div>
              )}

              {canOverride && !showGpsOverride && (
                <button
                  type="button"
                  onClick={() => setShowGpsOverride(true)}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-300 rounded-lg hover:bg-amber-100"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  I&apos;m at the right place, override GPS check
                </button>
              )}

              {showGpsOverride && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                  <p className="text-sm text-amber-800 font-medium">GPS Override</p>
                  <p className="text-xs text-amber-700">Please explain why you need to override the GPS check.</p>
                  <Textarea
                    value={gpsOverrideReason}
                    onChange={(e) => setGpsOverrideReason(e.target.value)}
                    placeholder="e.g., Building entrance is on opposite side..."
                    rows={2}
                  />
                </div>
              )}

              <Button variant="outline" onClick={getLocation} isLoading={isGettingLocation} className="w-full">Refresh Location</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Photo */}
      <Card>
        <CardHeader><CardTitle>Checkout Photo (Required)</CardTitle></CardHeader>
        <CardContent>
          {checkoutPhoto ? (
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 rounded-lg overflow-hidden border"><Image src={checkoutPhoto} alt="Checkout" fill sizes="80px" className="object-cover" /></div>
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
        disabled={!gpsLocation || !checkoutPhoto || (!isWithinRange && !(showGpsOverride && gpsOverrideReason.trim()))}
        className="w-full py-4 text-lg"
      >
        <CheckCircle2 className="w-6 h-6 mr-2" />Complete Day
      </Button>
    </div>
  )
}

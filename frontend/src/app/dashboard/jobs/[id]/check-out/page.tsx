'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button, Card, CardContent, CardHeader, CardTitle, Alert } from '@/components/ui'
import { ChevronLeft, MapPin, CheckCircle2, LogOut, Camera, Loader2 } from 'lucide-react'
import { uploadJobPhoto } from '@/lib/api'
import { DynamicCheckoutForm, type CheckoutResponseValueData } from '@/components/worker/dynamic-checkout-form'
import type { Job, CheckIn, JobType } from '@/types'
import { getImpersonatedBAId } from '@/lib/impersonation'

export default function CheckOutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [job, setJob] = useState<Job | null>(null)
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // GPS state
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [isGettingLocation, setIsGettingLocation] = useState(false)

  // Photo state
  const [checkOutPhoto, setCheckOutPhoto] = useState<string | null>(null)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)

  // Job type + dynamic form
  const [jobType, setJobType] = useState<JobType | null>(null)
  const [responseValues, setResponseValues] = useState<CheckoutResponseValueData[]>([])

  const isRedirecting = useRef(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [id])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        isRedirecting.current = true
        router.push('/auth/login')
        return
      }
      setUserId(user.id)

      const impersonatedId = getImpersonatedBAId()
      const { data: profile } = await (impersonatedId
        ? supabase.from('ba_profiles').select('id').eq('id', impersonatedId).single()
        : supabase.from('ba_profiles').select('id').eq('user_id', user.id).single())

      if (!profile) {
        setError('Profile not found')
        return
      }
      setProfileId(profile.id)

      // Load job with days/locations to detect multi-day
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('*, job_days(*, job_day_locations(*))')
        .eq('id', id)
        .single()

      if (jobError || !jobData) {
        setError('Job not found')
        return
      }

      // Redirect to multi-day checkout if job has days
      const jobDays = jobData.job_days || []
      if (jobDays.length > 0) {
        const allLocationIds = jobDays.flatMap((d: { job_day_locations: { id: string }[] }) =>
          (d.job_day_locations || []).map((l: { id: string }) => l.id)
        )
        if (allLocationIds.length > 0) {
          const { data: activeCi } = await supabase
            .from('location_check_ins')
            .select('*, job_day_locations!inner(id, job_day_id)')
            .eq('ba_id', profile.id)
            .is('check_out_time', null)
            .eq('skipped', false)
            .in('job_day_location_id', allLocationIds)
            .limit(1)
            .single()

          isRedirecting.current = true
          if (activeCi) {
            const dayId = (activeCi as { job_day_locations: { job_day_id: string } }).job_day_locations.job_day_id
            router.push(`/dashboard/jobs/${id}/day/${dayId}/checkout?locationId=${activeCi.job_day_location_id}`)
          } else {
            router.push(`/dashboard/jobs/${id}/check-in`)
          }
          return
        }
      }

      setJob(jobData)

      // Load job type
      if (jobData.job_type_id) {
        const { data: jt } = await supabase
          .from('job_types')
          .select('*, job_type_kpis(*), job_type_questions(*, job_type_question_options(*))')
          .eq('id', jobData.job_type_id)
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

      // Legacy flow
      const { data: checkInData } = await supabase
        .from('check_ins')
        .select('*')
        .eq('job_id', id)
        .eq('ba_id', profile.id)
        .single()

      if (!checkInData) {
        isRedirecting.current = true
        router.push(`/dashboard/jobs/${id}/check-in`)
        return
      }

      if (checkInData.check_out_time) {
        setError('You have already checked out from this job')
      }

      setCheckIn(checkInData)
    } catch {
      setError('Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }

  const getLocation = () => {
    setIsGettingLocation(true)
    setLocationError(null)

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser')
      setIsGettingLocation(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude })
        setIsGettingLocation(false)
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED: setLocationError('Location permission denied.'); break
          case error.POSITION_UNAVAILABLE: setLocationError('Location information is unavailable.'); break
          case error.TIMEOUT: setLocationError('Location request timed out.'); break
          default: setLocationError('An unknown error occurred.')
        }
        setIsGettingLocation(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId || !profileId) return

    setIsUploadingPhoto(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { setError('Not authenticated'); return }

      const { url } = await uploadJobPhoto(session.access_token, file, id, 'check_out')
      setCheckOutPhoto(url)
    } catch {
      setError('Failed to upload photo')
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  const handleCheckOut = async () => {
    if (!location || !checkIn || !checkOutPhoto) return

    setError(null)
    setIsCheckingOut(true)

    try {
      const { error: updateError } = await supabase
        .from('check_ins')
        .update({
          check_out_time: new Date().toISOString(),
          check_out_latitude: location.latitude,
          check_out_longitude: location.longitude,
        })
        .eq('id', checkIn.id)

      if (updateError) {
        setError(updateError.message)
        return
      }

      // Insert checkout responses
      if (responseValues.length > 0) {
        const { data: resp } = await supabase
          .from('checkout_responses')
          .insert({
            job_id: id,
            ba_id: profileId,
            check_in_id: checkIn.id,
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

      const checkInTime = new Date(checkIn.check_in_time)
      const checkOutTime = new Date()
      const hoursWorked = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)

      setSuccess(`Checked out successfully! You worked ${hoursWorked.toFixed(2)} hours.`)
      setTimeout(() => { router.push('/dashboard/my-jobs') }, 2000)
    } catch {
      setError('Failed to check out')
    } finally {
      setIsCheckingOut(false)
    }
  }

  const getTimeWorked = () => {
    if (!checkIn) return null
    const checkInTime = new Date(checkIn.check_in_time)
    const now = new Date()
    const diff = now.getTime() - checkInTime.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return { hours, minutes }
  }

  const timeWorked = getTimeWorked()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400" />
      </div>
    )
  }

  if (!job || !checkIn) {
    if (isRedirecting.current) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400" />
        </div>
      )
    }
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">
          {error || 'Unable to load check-out page'}
        </h2>
        <Link href="/dashboard/my-jobs" className="text-primary-400 hover:text-primary-500 mt-2 inline-block">
          Back to my jobs
        </Link>
      </div>
    )
  }

  const alreadyCheckedOut = !!checkIn.check_out_time

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/jobs/${id}/active`} className="p-2 rounded-lg hover:bg-gray-100">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-heading">Check Out</h1>
      </div>

      {error && <Alert variant="error" onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {/* Job Info */}
      <Card>
        <CardHeader><CardTitle>Job Details</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-900">{job.title}</h3>
            <p className="text-primary-400">{job.brand}</p>
            <p className="text-sm text-primary-400">{job.location}</p>
          </div>
        </CardContent>
      </Card>

      {/* Shift Duration */}
      <Card>
        <CardHeader><CardTitle>Shift Duration</CardTitle></CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-sm text-primary-400 mb-2">
              Checked in at {new Date(checkIn.check_in_time).toLocaleTimeString()}
            </p>
            {timeWorked && !alreadyCheckedOut && (
              <div className="text-4xl font-bold text-gray-900">
                {timeWorked.hours}h {timeWorked.minutes}m
              </div>
            )}
            {alreadyCheckedOut && checkIn.check_out_time && (
              <p className="text-sm text-primary-400">
                Checked out at {new Date(checkIn.check_out_time).toLocaleTimeString()}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {!alreadyCheckedOut && (
        <>
          {/* GPS Location */}
          <Card>
            <CardHeader><CardTitle>Your Location</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {locationError && <Alert variant="error">{locationError}</Alert>}
              {!location ? (
                <div className="text-center py-4">
                  <p className="text-primary-400 mb-4">Get your current location to check out.</p>
                  <Button onClick={getLocation} isLoading={isGettingLocation} className="gap-2">
                    <MapPin className="w-5 h-5" />Get My Location
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-lg flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="text-green-800">Location captured</span>
                  </div>
                  <Button variant="outline" onClick={getLocation} isLoading={isGettingLocation} className="w-full">
                    Refresh Location
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Checkout Photo */}
          <Card>
            <CardHeader><CardTitle>Checkout Photo (Required)</CardTitle></CardHeader>
            <CardContent>
              {checkOutPhoto ? (
                <div className="flex items-center gap-4">
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                    <Image src={checkOutPhoto} alt="Check-out photo" fill className="object-cover" />
                  </div>
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">Photo uploaded</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-primary-400 mb-4 text-sm">Take a photo to document the end of your shift.</p>
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-primary-400 text-white rounded-lg hover:bg-primary-500 cursor-pointer transition-colors">
                    {isUploadingPhoto ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                    {isUploadingPhoto ? 'Uploading...' : 'Take Photo'}
                    <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} className="hidden" disabled={isUploadingPhoto || !userId || !profileId} />
                  </label>
                </div>
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

          {/* Check Out Button */}
          <Button
            onClick={handleCheckOut}
            isLoading={isCheckingOut}
            disabled={!location || !checkOutPhoto}
            variant="destructive"
            className="w-full py-4 text-lg bg-orange-600 hover:bg-orange-700"
          >
            <LogOut className="w-6 h-6 mr-2" />
            Confirm Check Out
          </Button>
        </>
      )}
    </div>
  )
}

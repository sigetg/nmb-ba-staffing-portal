'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button, Card, CardContent, CardHeader, CardTitle, Alert } from '@/components/ui'
import { ChevronLeft, MapPin, Clock, CheckCircle2, XCircle, Camera, Loader2 } from 'lucide-react'
import { uploadJobPhoto } from '@/lib/api'
import type { Job } from '@/types'
import { getImpersonatedBAId } from '@/lib/impersonation'

export default function CheckInPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [job, setJob] = useState<Job | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCheckingIn, setIsCheckingIn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // GPS state
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [distance, setDistance] = useState<number | null>(null)

  // Photo state
  const [checkInPhoto, setCheckInPhoto] = useState<string | null>(null)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)

  const isRedirecting = useRef(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadJobData()
  }, [id])

  const loadJobData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        isRedirecting.current = true
        router.push('/auth/login')
        return
      }
      setUserId(user.id)

      // Load job with days/locations
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('*, job_days(*, job_day_locations(*))')
        .eq('id', id)
        .single()

      if (jobError || !jobData) {
        setError('Job not found')
        return
      }

      // Redirect to multi-day flow if job has days
      const jobDays = jobData.job_days || []
      if (jobDays.length > 0) {
        const today = new Date().toISOString().split('T')[0]
        const todayDay = jobDays.find((d: { date: string }) => d.date === today) || jobDays.sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)[0]
        const locs = (todayDay?.job_day_locations || []).sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
        if (locs.length > 0) {
          isRedirecting.current = true
          router.push(`/dashboard/jobs/${id}/day/${todayDay.id}/location/${locs[0].id}/check-in`)
          return
        }
      }

      setJob(jobData)

      // Check if already checked in (legacy)
      const impersonatedId = getImpersonatedBAId()
      const { data: profile } = await (impersonatedId
        ? supabase.from('ba_profiles').select('id').eq('id', impersonatedId).single()
        : supabase.from('ba_profiles').select('id').eq('user_id', user.id).single())

      if (profile) {
        setProfileId(profile.id)
        const { data: checkIn } = await supabase
          .from('check_ins')
          .select('id, check_out_time')
          .eq('job_id', id)
          .eq('ba_id', profile.id)
          .single()

        if (checkIn) {
          isRedirecting.current = true
          if (checkIn.check_out_time) {
            router.push(`/dashboard/my-jobs`)
          } else {
            router.push(`/dashboard/jobs/${id}/active`)
          }
          return
        }
      }
    } catch {
      setError('Failed to load job')
    } finally {
      setIsLoading(false)
    }
  }

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000 // Earth's radius in meters
    const phi1 = (lat1 * Math.PI) / 180
    const phi2 = (lat2 * Math.PI) / 180
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
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
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }
        setLocation(coords)

        // Calculate distance if job has coordinates
        if (job?.latitude && job?.longitude) {
          const dist = calculateDistance(
            coords.latitude,
            coords.longitude,
            job.latitude,
            job.longitude
          )
          setDistance(Math.round(dist))
        }

        setIsGettingLocation(false)
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError('Location permission denied. Please enable location access.')
            break
          case error.POSITION_UNAVAILABLE:
            setLocationError('Location information is unavailable.')
            break
          case error.TIMEOUT:
            setLocationError('Location request timed out.')
            break
          default:
            setLocationError('An unknown error occurred.')
        }
        setIsGettingLocation(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
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

      const { url } = await uploadJobPhoto(session.access_token, file, id, 'check_in')
      setCheckInPhoto(url)
    } catch {
      setError('Failed to upload photo')
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  const handleCheckIn = async () => {
    if (!location || !job || !checkInPhoto) return

    setError(null)
    setIsCheckingIn(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }

      // Get BA profile
      const impId = getImpersonatedBAId()
      const { data: profile } = await (impId
        ? supabase.from('ba_profiles').select('id').eq('id', impId).single()
        : supabase.from('ba_profiles').select('id').eq('user_id', user.id).single())

      if (!profile) {
        setError('Profile not found')
        return
      }

      // Create check-in
      const { error: checkInError } = await supabase.from('check_ins').insert({
        job_id: job.id,
        ba_id: profile.id,
        check_in_time: new Date().toISOString(),
        check_in_latitude: location.latitude,
        check_in_longitude: location.longitude,
      })

      if (checkInError) {
        if (checkInError.code === '23505') {
          setError('You have already checked in to this job')
        } else {
          setError(checkInError.message)
        }
        return
      }

      setSuccess('Checked in successfully!')
      setTimeout(() => {
        router.push(`/dashboard/jobs/${job.id}/active`)
      }, 1500)
    } catch {
      setError('Failed to check in')
    } finally {
      setIsCheckingIn(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400" />
      </div>
    )
  }

  if (!job) {
    if (isRedirecting.current) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400" />
        </div>
      )
    }
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Job not found</h2>
        <Link href="/dashboard/my-jobs" className="text-primary-400 hover:text-primary-500 mt-2 inline-block">
          Back to my jobs
        </Link>
      </div>
    )
  }

  const isWithinRange = distance !== null && distance <= 200

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/my-jobs"
          className="p-2 rounded-lg hover:bg-gray-100"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-heading">Check In</h1>
      </div>

      {error && (
        <Alert variant="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert variant="success">
          {success}
        </Alert>
      )}

      {/* Job Info */}
      <Card>
        <CardHeader>
          <CardTitle>Job Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-900">{job.title}</h3>
            <p className="text-primary-400">{job.brand}</p>
            <div className="flex items-center gap-2 text-sm text-primary-400">
              <MapPin className="w-4 h-4" />
              {job.location}
            </div>
            <div className="flex items-center gap-2 text-sm text-primary-400">
              <Clock className="w-4 h-4" />
              {job.start_time} - {job.end_time}
            </div>
            {job.timezone && (
              <p className="text-xs text-primary-400 ml-6">Timezone: {job.timezone}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* GPS Location */}
      <Card>
        <CardHeader>
          <CardTitle>Your Location</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {locationError && (
            <Alert variant="error">
              {locationError}
            </Alert>
          )}

          {!location ? (
            <div className="text-center py-4">
              <p className="text-primary-400 mb-4">
                We need your location to verify you&apos;re at the job site.
              </p>
              <Button
                onClick={getLocation}
                isLoading={isGettingLocation}
                className="gap-2"
              >
                <MapPin className="w-5 h-5" />
                Get My Location
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-primary-400">Coordinates:</p>
                <p className="font-mono text-sm text-gray-900">
                  {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                </p>
              </div>

              {distance !== null && (
                <div className={`p-4 rounded-lg ${isWithinRange ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className="flex items-center gap-2">
                    {isWithinRange ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                    <div>
                      <p className={`font-medium ${isWithinRange ? 'text-green-800' : 'text-red-800'}`}>
                        {isWithinRange ? 'Within range' : 'Too far from job location'}
                      </p>
                      <p className={`text-sm ${isWithinRange ? 'text-green-700' : 'text-red-700'}`}>
                        Distance: {distance}m {!isWithinRange && '(max: 200m)'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <Button
                variant="outline"
                onClick={getLocation}
                isLoading={isGettingLocation}
                className="w-full"
              >
                Refresh Location
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Check-In Photo */}
      <Card>
        <CardHeader>
          <CardTitle>Check-In Photo (Required)</CardTitle>
        </CardHeader>
        <CardContent>
          {checkInPhoto ? (
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                <Image src={checkInPhoto} alt="Check-in photo" fill className="object-cover" />
              </div>
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">Photo uploaded</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-primary-400 mb-4 text-sm">
                Take a photo to document your arrival at the job site.
              </p>
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-primary-400 text-white rounded-lg hover:bg-primary-500 cursor-pointer transition-colors">
                {isUploadingPhoto ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Camera className="w-5 h-5" />
                )}
                {isUploadingPhoto ? 'Uploading...' : 'Take Photo'}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  disabled={isUploadingPhoto || !userId || !profileId}
                />
              </label>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Check In Button */}
      <Button
        onClick={handleCheckIn}
        isLoading={isCheckingIn}
        disabled={!location || !checkInPhoto || !!(job.latitude && job.longitude && !isWithinRange)}
        className="w-full py-4 text-lg"
      >
        <CheckCircle2 className="w-6 h-6 mr-2" />
        Confirm Check In
      </Button>
    </div>
  )
}

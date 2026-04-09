'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button, Card, CardContent, CardHeader, CardTitle, Alert, Textarea } from '@/components/ui'
import { ChevronLeft, MapPin, Clock, CheckCircle2, XCircle, Camera, Loader2, AlertTriangle } from 'lucide-react'
import { DayLocationTimeline } from '@/components/worker/day-location-timeline'
import { uploadJobPhoto } from '@/lib/api'
import type { JobDayLocation, LocationCheckIn } from '@/types'
import { getImpersonatedBAId } from '@/lib/impersonation'
import { getLocalToday } from '@/lib/utils'

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(deltaPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function LocationCheckInPage({ params }: { params: Promise<{ id: string; dayId: string; locationId: string }> }) {
  const { id: jobId, dayId, locationId } = use(params)
  const [isLoading, setIsLoading] = useState(true)
  const [isCheckingIn, setIsCheckingIn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [jobTitle, setJobTitle] = useState('')
  const [locationData, setLocationData] = useState<JobDayLocation | null>(null)
  const [dayLocations, setDayLocations] = useState<JobDayLocation[]>([])
  const [dayCheckIns, setDayCheckIns] = useState<LocationCheckIn[]>([])
  const [profileId, setProfileId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  // GPS state
  const [gpsLocation, setGpsLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [distance, setDistance] = useState<number | null>(null)

  // GPS override
  const [showGpsOverride, setShowGpsOverride] = useState(false)
  const [gpsOverrideReason, setGpsOverrideReason] = useState('')

  // Photo state
  const [checkInPhoto, setCheckInPhoto] = useState<string | null>(null)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => { loadData() }, [jobId, dayId, locationId])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)

      const impersonatedId = getImpersonatedBAId()
      const { data: profile } = await (impersonatedId
        ? supabase.from('ba_profiles').select('id').eq('id', impersonatedId).single()
        : supabase.from('ba_profiles').select('id').eq('user_id', user.id).single())
      if (!profile) { setError('Profile not found'); return }
      setProfileId(profile.id)

      // Load job title
      const { data: job } = await supabase.from('jobs').select('title').eq('id', jobId).single()
      if (job) setJobTitle(job.title)

      // Validate day date matches today
      const { data: dayData } = await supabase.from('job_days').select('date').eq('id', dayId).single()
      if (!dayData || dayData.date !== getLocalToday()) {
        router.push(`/dashboard/jobs/${jobId}`)
        return
      }

      // Load this location
      const { data: loc } = await supabase.from('job_day_locations').select('*').eq('id', locationId).single()
      if (!loc) { setError('Location not found'); return }
      setLocationData(loc as JobDayLocation)

      // Load all locations for this day (for timeline)
      const { data: locs } = await supabase.from('job_day_locations').select('*').eq('job_day_id', dayId).order('sort_order')
      setDayLocations((locs || []) as JobDayLocation[])

      // Check if already checked in to this location
      const locationIds = (locs || []).map((l: JobDayLocation) => l.id)
      const { data: cis } = await supabase
        .from('location_check_ins')
        .select('*')
        .eq('ba_id', profile.id)
        .in('job_day_location_id', locationIds)
      setDayCheckIns((cis || []) as LocationCheckIn[])

      const existing = (cis || []).find((c: LocationCheckIn) => c.job_day_location_id === locationId)
      if (existing && !existing.check_out_time && !existing.skipped) {
        router.push(`/dashboard/jobs/${jobId}/day/${dayId}/location/${locationId}/active`)
        return
      }
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
      setLocationError('Geolocation is not supported')
      setIsGettingLocation(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = { latitude: position.coords.latitude, longitude: position.coords.longitude }
        setGpsLocation(coords)

        if (locationData?.latitude && locationData?.longitude) {
          const dist = calculateDistance(coords.latitude, coords.longitude, Number(locationData.latitude), Number(locationData.longitude))
          setDistance(Math.round(dist))
        }
        setIsGettingLocation(false)
      },
      (err) => {
        setLocationError(err.code === 1 ? 'Location permission denied' : 'Unable to get location')
        setIsGettingLocation(false)
      },
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

      const { url } = await uploadJobPhoto(session.access_token, file, jobId, 'check_in', locationId, profileId!)
      setCheckInPhoto(url)
    } catch {
      setError('Failed to upload photo')
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  const handleCheckIn = async () => {
    if (!gpsLocation || !checkInPhoto || !profileId) return
    setIsCheckingIn(true)
    setError(null)

    try {
      const useOverride = showGpsOverride && gpsOverrideReason.trim()
      const { error: ciError } = await supabase.from('location_check_ins').insert({
        job_day_location_id: locationId,
        ba_id: profileId,
        check_in_time: new Date().toISOString(),
        check_in_latitude: gpsLocation.latitude,
        check_in_longitude: gpsLocation.longitude,
        check_in_gps_override: !!useOverride,
        check_in_gps_override_explanation: useOverride ? gpsOverrideReason.trim() : null,
      })

      if (ciError) {
        if (ciError.code === '23505') setError('Already checked in to this location')
        else setError(ciError.message)
        return
      }

      setSuccess('Checked in!')
      setTimeout(() => {
        router.push(`/dashboard/jobs/${jobId}/day/${dayId}/location/${locationId}/active`)
      }, 1000)
    } catch {
      setError('Failed to check in')
    } finally {
      setIsCheckingIn(false)
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[400px]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400" /></div>
  }

  const isWithinRange = distance !== null && distance <= 200
  const canOverride = distance !== null && distance > 200

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/my-jobs" className="p-2 rounded-lg hover:bg-gray-100"><ChevronLeft className="w-5 h-5" /></Link>
        <h1 className="text-2xl font-bold text-heading">Check In</h1>
      </div>

      {error && <Alert variant="error" onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {/* Location Info */}
      <Card>
        <CardHeader><CardTitle>{jobTitle}</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4" />{locationData?.location}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="w-4 h-4" />{locationData?.start_time} - {locationData?.end_time}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Day Timeline */}
      {dayLocations.length > 1 && (
        <Card>
          <CardHeader><CardTitle>Today&apos;s Locations</CardTitle></CardHeader>
          <CardContent>
            <DayLocationTimeline
              locations={dayLocations}
              checkIns={dayCheckIns}
              currentLocationId={locationId}
            />
          </CardContent>
        </Card>
      )}

      {/* GPS */}
      <Card>
        <CardHeader><CardTitle>Your Location</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {locationError && <Alert variant="error">{locationError}</Alert>}

          {!gpsLocation ? (
            <div className="text-center py-4">
              <p className="text-gray-500 mb-4 text-sm">We need your location to verify you&apos;re at the site.</p>
              <Button onClick={getLocation} isLoading={isGettingLocation}><MapPin className="w-5 h-5 mr-2" />Get My Location</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="font-mono text-sm">{gpsLocation.latitude.toFixed(6)}, {gpsLocation.longitude.toFixed(6)}</p>
              </div>

              {distance !== null && (
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
              )}

              {/* GPS Override */}
              {canOverride && !showGpsOverride && (
                <button
                  type="button"
                  onClick={() => setShowGpsOverride(true)}
                  className="flex items-center gap-2 text-sm text-amber-600 hover:text-amber-700"
                >
                  <AlertTriangle className="w-4 h-4" />
                  I&apos;m at the right place — override GPS check
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
        <CardHeader><CardTitle>Check-In Photo (Required)</CardTitle></CardHeader>
        <CardContent>
          {checkInPhoto ? (
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 rounded-lg overflow-hidden border"><Image src={checkInPhoto} alt="Check-in" fill className="object-cover" /></div>
              <div className="flex items-center gap-2 text-green-700"><CheckCircle2 className="w-5 h-5" /><span className="font-medium">Photo uploaded</span></div>
            </div>
          ) : (
            <div className="text-center py-4">
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-primary-400 text-white rounded-lg hover:bg-primary-500 cursor-pointer">
                {isUploadingPhoto ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                {isUploadingPhoto ? 'Uploading...' : 'Take Photo'}
                <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} className="hidden" disabled={isUploadingPhoto || !profileId} />
              </label>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Check In Button */}
      <Button
        onClick={handleCheckIn}
        isLoading={isCheckingIn}
        disabled={!gpsLocation || !checkInPhoto || (!isWithinRange && !(showGpsOverride && gpsOverrideReason.trim()))}
        className="w-full py-4 text-lg"
      >
        <CheckCircle2 className="w-6 h-6 mr-2" />Confirm Check In
      </Button>
    </div>
  )
}

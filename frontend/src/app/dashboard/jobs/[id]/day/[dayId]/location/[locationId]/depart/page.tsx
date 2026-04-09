'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button, Card, CardContent, CardHeader, CardTitle, Alert } from '@/components/ui'
import { ChevronLeft, MapPin, Camera, Loader2, CheckCircle2, Navigation } from 'lucide-react'
import { uploadJobPhoto } from '@/lib/api'
import type { JobDayLocation, LocationCheckIn } from '@/types'
import { getImpersonatedBAId } from '@/lib/impersonation'

export default function DepartLocationPage({ params }: { params: Promise<{ id: string; dayId: string; locationId: string }> }) {
  const { id: jobId, dayId, locationId } = use(params)
  const [isLoading, setIsLoading] = useState(true)
  const [isDeparting, setIsDeparting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [locationData, setLocationData] = useState<JobDayLocation | null>(null)
  const [nextLocation, setNextLocation] = useState<JobDayLocation | null>(null)
  const [checkInId, setCheckInId] = useState<string | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  // GPS + Photo
  const [gpsLocation, setGpsLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [departPhoto, setDepartPhoto] = useState<string | null>(null)
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
      if (!profile) return
      setProfileId(profile.id)

      const { data: loc } = await supabase.from('job_day_locations').select('*').eq('id', locationId).single()
      if (loc) setLocationData(loc as JobDayLocation)

      // Find next location
      const { data: locs } = await supabase.from('job_day_locations').select('*').eq('job_day_id', dayId).order('sort_order')
      const allLocs = (locs || []) as JobDayLocation[]
      const currentIdx = allLocs.findIndex(l => l.id === locationId)
      if (currentIdx < allLocs.length - 1) setNextLocation(allLocs[currentIdx + 1])

      // Get check-in
      const { data: ci } = await supabase
        .from('location_check_ins')
        .select('id, check_out_time')
        .eq('job_day_location_id', locationId)
        .eq('ba_id', profile.id)
        .single()

      if (!ci || ci.check_out_time) {
        router.push('/dashboard/my-jobs')
        return
      }
      setCheckInId(ci.id)
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

      const { url } = await uploadJobPhoto(session.access_token, file, jobId, 'check_out', locationId, profileId!)
      setDepartPhoto(url)
    } catch {
      setError('Failed to upload')
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  const handleDepart = async () => {
    if (!gpsLocation || !departPhoto || !checkInId || !profileId) return
    setIsDeparting(true)
    setError(null)

    try {
      const now = new Date().toISOString()

      // Update check-out on current location
      await supabase.from('location_check_ins').update({
        check_out_time: now,
        check_out_latitude: gpsLocation.latitude,
        check_out_longitude: gpsLocation.longitude,
        is_end_of_day: false,
      }).eq('id', checkInId)

      // Create travel log
      await supabase.from('travel_logs').insert({
        ba_id: profileId,
        from_location_check_in_id: checkInId,
        departure_time: now,
      })

      // Navigate to next location check-in
      if (nextLocation) {
        router.push(`/dashboard/jobs/${jobId}/day/${dayId}/location/${nextLocation.id}/check-in`)
      } else {
        router.push('/dashboard/my-jobs')
      }
    } catch {
      setError('Failed to depart')
    } finally {
      setIsDeparting(false)
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[400px]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400" /></div>
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100"><ChevronLeft className="w-5 h-5" /></button>
        <h1 className="text-2xl font-bold text-heading">Depart Location</h1>
      </div>

      {error && <Alert variant="error" onClose={() => setError(null)}>{error}</Alert>}

      {/* Current → Next */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs text-gray-500">Leaving</p>
              <p className="text-sm font-medium flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-gray-400" />{locationData?.location}</p>
            </div>
            <Navigation className="w-5 h-5 text-primary-400" />
            <div className="flex-1">
              <p className="text-xs text-gray-500">Next</p>
              <p className="text-sm font-medium flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-primary-400" />{nextLocation?.location || 'End of day'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* GPS */}
      <Card>
        <CardHeader><CardTitle>Departure GPS</CardTitle></CardHeader>
        <CardContent>
          {gpsLocation ? (
            <div className="p-3 bg-green-50 rounded-lg flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <span className="text-sm text-green-800">Location captured</span>
            </div>
          ) : (
            <Button onClick={getLocation} isLoading={isGettingLocation}><MapPin className="w-4 h-4 mr-2" />Capture Location</Button>
          )}
        </CardContent>
      </Card>

      {/* Photo */}
      <Card>
        <CardHeader><CardTitle>Departure Photo (Required)</CardTitle></CardHeader>
        <CardContent>
          {departPhoto ? (
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 rounded-lg overflow-hidden border"><Image src={departPhoto} alt="Departure" fill className="object-cover" /></div>
              <div className="flex items-center gap-2 text-green-700"><CheckCircle2 className="w-5 h-5" /><span className="font-medium">Photo uploaded</span></div>
            </div>
          ) : (
            <div className="text-center py-4">
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-primary-400 text-white rounded-lg hover:bg-primary-500 cursor-pointer">
                {isUploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                {isUploadingPhoto ? 'Uploading...' : 'Take Photo'}
                <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} className="hidden" disabled={isUploadingPhoto} />
              </label>
            </div>
          )}
        </CardContent>
      </Card>

      <Button
        onClick={handleDepart}
        isLoading={isDeparting}
        disabled={!gpsLocation || !departPhoto}
        className="w-full py-4 text-lg"
      >
        <Navigation className="w-5 h-5 mr-2" />
        {nextLocation ? 'Depart → Next Location' : 'Depart'}
      </Button>
    </div>
  )
}

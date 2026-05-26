'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button, Card, CardContent, CardHeader, CardTitle, Alert } from '@/components/ui'
import { ChevronLeft, MapPin, Clock } from 'lucide-react'
import { DayLocationTimeline } from '@/components/worker/day-location-timeline'
import { ContactPhoneBanner } from '@/components/contact-phone'
import { LocationPhotoSection } from '@/components/worker/location-photo-section'
import type { JobDayLocation, LocationCheckIn, JobPhoto } from '@/types'

export default function LocationActivePage({ params }: { params: Promise<{ id: string; dayId: string; locationId: string }> }) {
  const { id: jobId, dayId, locationId } = use(params)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [locationData, setLocationData] = useState<JobDayLocation | null>(null)
  const [dayLocations, setDayLocations] = useState<JobDayLocation[]>([])
  const [dayCheckIns, setDayCheckIns] = useState<LocationCheckIn[]>([])
  const [checkIn, setCheckIn] = useState<LocationCheckIn | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)

  // Photos
  const [photos, setPhotos] = useState<JobPhoto[]>([])

  // Timer
  const [elapsed, setElapsed] = useState('00:00:00')

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => { loadData() }, [jobId, dayId, locationId])

  useEffect(() => {
    if (!checkIn?.check_in_time) return
    const start = new Date(checkIn.check_in_time).getTime()
    const interval = setInterval(() => {
      const diff = Date.now() - start
      const hrs = Math.floor(diff / 3600000).toString().padStart(2, '0')
      const mins = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0')
      const secs = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0')
      setElapsed(`${hrs}:${mins}:${secs}`)
    }, 1000)
    return () => clearInterval(interval)
  }, [checkIn])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: profile } = await supabase
        .from('ba_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (!profile) return
      setProfileId(profile.id)

      const { data: loc } = await supabase.from('job_day_locations').select('*').eq('id', locationId).single()
      if (loc) setLocationData(loc as JobDayLocation)

      const { data: locs } = await supabase.from('job_day_locations').select('*').eq('job_day_id', dayId).order('sort_order')
      setDayLocations((locs || []) as JobDayLocation[])

      const locationIds = (locs || []).map((l: JobDayLocation) => l.id)
      const { data: cis } = await supabase.from('location_check_ins').select('*').eq('ba_id', profile.id).in('job_day_location_id', locationIds)
      setDayCheckIns((cis || []) as LocationCheckIn[])

      const ci = (cis || []).find((c: LocationCheckIn) => c.job_day_location_id === locationId)
      if (!ci || ci.check_out_time) {
        router.push(`/dashboard/jobs/${jobId}/day/${dayId}/location/${locationId}/check-in`)
        return
      }
      setCheckIn(ci as LocationCheckIn)

      // Load photos for this location
      const { data: photoData } = await supabase
        .from('job_photos')
        .select('*')
        .eq('job_id', jobId)
        .eq('ba_id', profile.id)
        .eq('job_day_location_id', locationId)
      setPhotos((photoData || []) as JobPhoto[])
    } catch {
      setError('Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }

  // Determine if this is the last location of the day
  const currentIdx = dayLocations.findIndex(l => l.id === locationId)
  const isLastLocation = currentIdx === dayLocations.length - 1
  const nextLocation = !isLastLocation ? dayLocations[currentIdx + 1] : null

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[400px]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400" /></div>
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 pb-24">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/my-jobs" className="p-2 rounded-lg hover:bg-gray-100"><ChevronLeft className="w-5 h-5" /></Link>
        <h1 className="text-2xl font-bold text-heading">Active</h1>
      </div>

      {error && <Alert variant="error" onClose={() => setError(null)}>{error}</Alert>}

      <ContactPhoneBanner />

      {/* Timer + Location */}
      <Card>
        <CardContent className="py-4">
          <div className="text-center mb-3">
            <p className="text-xs text-gray-500 uppercase">Time at Location</p>
            <p className="text-3xl font-mono font-bold text-primary-600">{elapsed}</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 justify-center">
            <MapPin className="w-4 h-4" />{locationData?.location}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 justify-center mt-1">
            <Clock className="w-3 h-3" />{locationData?.start_time} - {locationData?.end_time}
          </div>
        </CardContent>
      </Card>

      {/* Day Timeline (if multi-location) */}
      {dayLocations.length > 1 && (
        <Card>
          <CardHeader><CardTitle>Today&apos;s Progress</CardTitle></CardHeader>
          <CardContent>
            <DayLocationTimeline locations={dayLocations} checkIns={dayCheckIns} currentLocationId={locationId} />
          </CardContent>
        </Card>
      )}

      {/* Photo Documentation */}
      {profileId && (
        <LocationPhotoSection
          jobId={jobId}
          baId={profileId}
          jobDayLocationId={locationId}
          photos={photos}
          onPhotoAdded={(p) => setPhotos(prev => [...prev, p])}
          onPhotoDeleted={(id) => setPhotos(prev => prev.filter(p => p.id !== id))}
          helperText="Take and upload photos throughout your shift to document your work. Select a category from the dropdown, then tap Upload to take a new photo or choose one from your camera roll. Green checkmarks show which requirements you have met. All categories must be complete before you can check out. You can upload more than the required minimum if needed."
        />
      )}

      {/* Bottom navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
        <div className="max-w-lg mx-auto flex gap-3">
          {isLastLocation ? (
            <Button
              onClick={() => router.push(`/dashboard/jobs/${jobId}/day/${dayId}/checkout?locationId=${locationId}`)}
              className="flex-1 py-3"
              variant="primary"
            >
              End Day & Check Out
            </Button>
          ) : (
            <>
              <Button
                onClick={() => router.push(`/dashboard/jobs/${jobId}/day/${dayId}/location/${locationId}/depart`)}
                className="flex-1 py-3"
              >
                Depart → {nextLocation ? 'Next Location' : ''}
              </Button>
              <Button
                onClick={() => router.push(`/dashboard/jobs/${jobId}/day/${dayId}/checkout?locationId=${locationId}`)}
                variant="outline"
                className="py-3"
              >
                End Day Early
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

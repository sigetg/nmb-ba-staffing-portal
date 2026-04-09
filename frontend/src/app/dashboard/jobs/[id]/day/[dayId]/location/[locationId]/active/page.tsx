'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button, Card, CardContent, CardHeader, CardTitle, Alert, Select } from '@/components/ui'
import { ChevronLeft, MapPin, Clock, Camera, Loader2, ChevronDown, ChevronUp, CheckCircle2, X } from 'lucide-react'
import { DayLocationTimeline } from '@/components/worker/day-location-timeline'
import { uploadJobPhoto, deleteJobPhoto } from '@/lib/api'
import type { JobDayLocation, LocationCheckIn, JobPhoto } from '@/types'
import { getImpersonatedBAId } from '@/lib/impersonation'

const PHOTO_CATEGORIES = [
  { value: 'setup', label: 'Setup', min: 3 },
  { value: 'engagement', label: 'Engagement', min: 5 },
  { value: 'storefront_signage', label: 'Storefront & Signage', min: 4 },
  { value: 'team_uniform', label: 'Team Uniform Compliance', min: 1 },
]

const categoryOptions = PHOTO_CATEGORIES.map(c => ({ value: c.value, label: c.label }))

export default function LocationActivePage({ params }: { params: Promise<{ id: string; dayId: string; locationId: string }> }) {
  const { id: jobId, dayId, locationId } = use(params)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [jobTitle, setJobTitle] = useState('')
  const [locationData, setLocationData] = useState<JobDayLocation | null>(null)
  const [dayLocations, setDayLocations] = useState<JobDayLocation[]>([])
  const [dayCheckIns, setDayCheckIns] = useState<LocationCheckIn[]>([])
  const [checkIn, setCheckIn] = useState<LocationCheckIn | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  // Photos
  const [photos, setPhotos] = useState<JobPhoto[]>([])
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [isDeletingPhoto, setIsDeletingPhoto] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState('setup')
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({ setup: true })

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
      setUserId(user.id)

      const impersonatedId = getImpersonatedBAId()
      const { data: profile } = await (impersonatedId
        ? supabase.from('ba_profiles').select('id').eq('id', impersonatedId).single()
        : supabase.from('ba_profiles').select('id').eq('user_id', user.id).single())
      if (!profile) return
      setProfileId(profile.id)

      const { data: job } = await supabase.from('jobs').select('title').eq('id', jobId).single()
      if (job) setJobTitle(job.title)

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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId || !profileId) return
    setIsUploadingPhoto(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { setError('Not authenticated'); return }

      const result = await uploadJobPhoto(session.access_token, file, jobId, selectedCategory, locationId)
      const newPhoto = { id: result.id, url: result.url, photo_type: selectedCategory, job_id: jobId, ba_id: profileId!, job_day_location_id: locationId, created_at: new Date().toISOString() } as JobPhoto
      setPhotos(prev => [...prev, newPhoto])
    } catch {
      setError('Failed to upload photo')
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  const handlePhotoDelete = async (photo: JobPhoto, photoType: string) => {
    if (!confirm('Remove this photo?')) return
    setIsDeletingPhoto(photo.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        await deleteJobPhoto(session.access_token, photo.id)
      }
      setPhotos(prev => prev.filter(p => p.id !== photo.id))
    } catch {
      setError('Failed to remove photo')
    } finally {
      setIsDeletingPhoto(null)
    }
  }

  const getPhotosForCategory = (cat: string) => photos.filter(p => p.photo_type === cat)

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
      <Card>
        <CardHeader><CardTitle>Documentation Requirements</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* Upload control */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Select
                label="Photo Category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                options={categoryOptions}
              />
            </div>
            <div className="pt-6">
              <label className="inline-flex items-center gap-2 px-3 py-2 bg-primary-400 text-white rounded-lg hover:bg-primary-500 cursor-pointer text-sm">
                {isUploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                {isUploadingPhoto ? 'Uploading' : 'Upload'}
                <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} className="hidden" disabled={isUploadingPhoto} />
              </label>
            </div>
          </div>

          {/* Category sections */}
          {PHOTO_CATEGORIES.map(cat => {
            const catPhotos = getPhotosForCategory(cat.value)
            const met = catPhotos.length >= cat.min
            const isExpanded = expandedCategories[cat.value]

            return (
              <div key={cat.value} className="border border-gray-200 rounded-lg">
                <button
                  type="button"
                  onClick={() => setExpandedCategories(prev => ({ ...prev, [cat.value]: !prev[cat.value] }))}
                  className="w-full flex items-center justify-between px-4 py-3"
                >
                  <div className="flex items-center gap-2">
                    {met ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <div className="w-4 h-4 rounded-full border-2 border-gray-300" />}
                    <span className="text-sm font-medium">{cat.label}</span>
                    <span className={`text-xs ${met ? 'text-green-600' : 'text-gray-400'}`}>
                      {catPhotos.length}/{cat.min}
                    </span>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>

                {isExpanded && catPhotos.length > 0 && (
                  <div className="px-4 pb-3 grid grid-cols-4 gap-2">
                    {catPhotos.map(p => (
                      <div key={p.id} className="relative aspect-square rounded overflow-hidden border group">
                        <Image src={p.url} alt={cat.label} fill className="object-cover" />
                        <button
                          type="button"
                          onClick={() => handlePhotoDelete(p, cat.value)}
                          disabled={isDeletingPhoto === p.id}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
                        >
                          {isDeletingPhoto === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

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

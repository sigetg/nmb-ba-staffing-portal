'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button, Card, CardContent, CardHeader, CardTitle, Alert } from '@/components/ui'
import { ChevronLeft, MapPin, Clock, Camera, Loader2, LogOut, CheckCircle2, ChevronDown, ChevronUp, X } from 'lucide-react'
import { uploadJobPhoto, deleteJobPhoto } from '@/lib/api'
import type { Job, CheckIn, JobPhoto } from '@/types'
import { getImpersonatedBAId } from '@/lib/impersonation'

const PHOTO_CATEGORIES = [
  { type: 'setup', label: 'Setup', min: 3 },
  { type: 'engagement', label: 'Engagement', min: 5 },
  { type: 'storefront_signage', label: 'Storefront & Signage', min: 4 },
  { type: 'team_uniform', label: 'Team Uniform Compliance', min: 1 },
] as const

const TOTAL_MINIMUM = 15

type PhotoCategory = typeof PHOTO_CATEGORIES[number]['type']

export default function ActiveJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [job, setJob] = useState<Job | null>(null)
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Photo state - categorized
  const [checkInPhoto, setCheckInPhoto] = useState<JobPhoto | null>(null)
  const [photosByCategory, setPhotosByCategory] = useState<Record<PhotoCategory, JobPhoto[]>>({
    setup: [],
    engagement: [],
    storefront_signage: [],
    team_uniform: [],
  })
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<string | null>(null)
  const [isDeletingPhoto, setIsDeletingPhoto] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)

  // Collapsible sections
  const [expandedSections, setExpandedSections] = useState<Record<PhotoCategory, boolean>>({
    setup: true,
    engagement: true,
    storefront_signage: true,
    team_uniform: true,
  })

  // Timer state
  const [elapsed, setElapsed] = useState('')

  const isRedirecting = useRef(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [id])

  // Real-time timer
  useEffect(() => {
    if (!checkIn) return

    const updateElapsed = () => {
      const diff = Date.now() - new Date(checkIn.check_in_time).getTime()
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      setElapsed(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      )
    }

    updateElapsed()
    const interval = setInterval(updateElapsed, 1000)
    return () => clearInterval(interval)
  }, [checkIn])

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
        setIsLoading(false)
        return
      }
      setProfileId(profile.id)

      // Load job with days/locations to detect multi-day
      const { data: jobData } = await supabase
        .from('jobs')
        .select('*, job_days(*, job_day_locations(*))')
        .eq('id', id)
        .single()

      if (!jobData) {
        setError('Job not found')
        setIsLoading(false)
        return
      }

      // Redirect to multi-day flow if job has days
      const jobDays = jobData.job_days || []
      if (jobDays.length > 0) {
        // Find active location_check_in (no check_out_time)
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
            router.push(`/dashboard/jobs/${id}/day/${dayId}/location/${activeCi.job_day_location_id}/active`)
          } else {
            router.push(`/dashboard/jobs/${id}/check-in`)
          }
          return
        }
      }

      // Legacy flow: Get active check-in (no check_out_time)
      const { data: checkInData } = await supabase
        .from('check_ins')
        .select('*')
        .eq('job_id', id)
        .eq('ba_id', profile.id)
        .is('check_out_time', null)
        .single()

      if (!checkInData) {
        // Check if already checked out
        const { data: completedCheckIn } = await supabase
          .from('check_ins')
          .select('id')
          .eq('job_id', id)
          .eq('ba_id', profile.id)
          .not('check_out_time', 'is', null)
          .single()

        isRedirecting.current = true
        if (completedCheckIn) {
          router.push('/dashboard/my-jobs')
        } else {
          router.push(`/dashboard/jobs/${id}/check-in`)
        }
        return
      }
      setCheckIn(checkInData)

      if (!jobData) {
        setError('Job not found')
        setIsLoading(false)
        return
      }
      setJob(jobData)

      // Load photos
      const { data: photos } = await supabase
        .from('job_photos')
        .select('*')
        .eq('job_id', id)
        .eq('ba_id', profile.id)
        .order('created_at', { ascending: true })

      if (photos) {
        setCheckInPhoto(photos.find(p => p.photo_type === 'check_in') || null)

        const categorized: Record<PhotoCategory, JobPhoto[]> = {
          setup: [],
          engagement: [],
          storefront_signage: [],
          team_uniform: [],
        }

        for (const photo of photos) {
          const type = photo.photo_type as PhotoCategory
          if (type in categorized) {
            categorized[type].push(photo)
          }
          // Legacy on_the_job photos go into engagement by default
          if (photo.photo_type === 'on_the_job') {
            categorized.engagement.push(photo)
          }
        }

        setPhotosByCategory(categorized)
      }
    } catch {
      setError('Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, photoType: PhotoCategory) => {
    const file = e.target.files?.[0]
    if (!file || !userId || !profileId) return

    setIsUploadingPhoto(photoType)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { setError('Not authenticated'); return }

      const result = await uploadJobPhoto(session.access_token, file, id, photoType)
      const newPhoto = { id: result.id, url: result.url, photo_type: photoType, job_id: id, ba_id: profileId!, created_at: new Date().toISOString() } as JobPhoto
      setPhotosByCategory(prev => ({
        ...prev,
        [photoType]: [...prev[photoType], newPhoto],
      }))
    } catch {
      setError('Failed to upload photo')
    } finally {
      setIsUploadingPhoto(null)
    }
  }

  const handlePhotoDelete = async (photo: JobPhoto, photoType: PhotoCategory) => {
    if (!confirm('Remove this photo?')) return
    setIsDeletingPhoto(photo.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        await deleteJobPhoto(session.access_token, photo.id)
      }
      setPhotosByCategory(prev => ({
        ...prev,
        [photoType]: prev[photoType].filter(p => p.id !== photo.id),
      }))
    } catch {
      setError('Failed to remove photo')
    } finally {
      setIsDeletingPhoto(null)
    }
  }

  const toggleSection = (type: PhotoCategory) => {
    setExpandedSections(prev => ({ ...prev, [type]: !prev[type] }))
  }

  const totalPhotos = Object.values(photosByCategory).reduce((sum, arr) => sum + arr.length, 0)
  const totalMinMet = totalPhotos >= TOTAL_MINIMUM

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
          {error || 'Unable to load active job'}
        </h2>
        <Link href="/dashboard/my-jobs" className="text-primary-400 hover:text-primary-500 mt-2 inline-block">
          Back to my jobs
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/my-jobs"
          className="p-2 rounded-lg hover:bg-gray-100"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-heading">Active Job</h1>
      </div>

      {error && (
        <Alert variant="error" onClose={() => setError(null)}>
          {error}
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
              {job.date} | {job.start_time} - {job.end_time}
            </div>
            {job.timezone && (
              <p className="text-xs text-primary-400 ml-6">Timezone: {job.timezone}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Check-In Status */}
      <Card>
        <CardHeader>
          <CardTitle>Check-In Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-primary-400">Checked in at</p>
                <p className="font-medium text-gray-900">
                  {new Date(checkIn.check_in_time).toLocaleTimeString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-primary-400">Duration</p>
                <p className="text-2xl font-bold font-mono text-green-700">{elapsed}</p>
              </div>
            </div>

            {checkInPhoto && (
              <div>
                <p className="text-sm text-primary-400 mb-2">Check-in photo</p>
                <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                  <Image src={checkInPhoto.url} alt="Check-in photo" fill className="object-cover" />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Documentation Requirements */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Documentation Requirements</CardTitle>
            <span className={`text-sm font-medium ${totalMinMet ? 'text-green-600' : 'text-primary-400'}`}>
              {totalMinMet && <CheckCircle2 className="w-4 h-4 inline mr-1" />}
              {totalPhotos} / {TOTAL_MINIMUM} minimum
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {PHOTO_CATEGORIES.map((category) => {
            const photos = photosByCategory[category.type]
            const isExpanded = expandedSections[category.type]
            const categoryMet = photos.length >= category.min

            return (
              <div key={category.type} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Category header - clickable to collapse */}
                <button
                  type="button"
                  onClick={() => toggleSection(category.type)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {categoryMet && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                    <span className="font-medium text-gray-900 text-sm">{category.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${categoryMet ? 'text-green-600' : 'text-primary-400'}`}>
                      {photos.length} / {category.min} min
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Collapsible content */}
                {isExpanded && (
                  <div className="p-4 space-y-3">
                    {photos.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {photos.map((photo) => (
                          <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 group">
                            <Image src={photo.url} alt={`${category.label} photo`} fill className="object-cover" />
                            <button
                              type="button"
                              onClick={() => handlePhotoDelete(photo, category.type)}
                              disabled={isDeletingPhoto === photo.id}
                              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
                            >
                              {isDeletingPhoto === photo.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <label className="flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-primary-400 hover:border-primary-400 hover:text-primary-500 cursor-pointer transition-colors">
                      {isUploadingPhoto === category.type ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Camera className="w-5 h-5" />
                      )}
                      {isUploadingPhoto === category.type ? 'Uploading...' : `Add ${category.label} Photo`}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handlePhotoUpload(e, category.type)}
                        className="hidden"
                        disabled={isUploadingPhoto !== null}
                      />
                    </label>

                    {photos.length === 0 && isUploadingPhoto !== category.type && (
                      <p className="text-xs text-center text-primary-400">
                        Upload at least {category.min} {category.label.toLowerCase()} photo{category.min > 1 ? 's' : ''}.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Check Out Button */}
      <Link href={`/dashboard/jobs/${id}/check-out`} className="block">
        <Button
          variant="destructive"
          className="w-full py-4 text-lg bg-orange-600 hover:bg-orange-700"
        >
          <LogOut className="w-6 h-6 mr-2" />
          Check Out
        </Button>
      </Link>
    </div>
  )
}

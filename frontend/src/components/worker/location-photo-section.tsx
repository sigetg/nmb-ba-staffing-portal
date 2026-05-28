'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, Select, Alert } from '@/components/ui'
import { Camera, Loader2, ChevronDown, ChevronUp, CheckCircle2, X } from 'lucide-react'
import { uploadJobPhoto, deleteJobPhoto } from '@/lib/api'
import { compressImage } from '@/lib/compress-image'
import { friendlyError } from '@/lib/error-message'
import type { JobPhoto } from '@/types'

const MAX_PHOTO_BYTES = 5 * 1024 * 1024

export const PHOTO_CATEGORIES = [
  { value: 'setup', label: 'Setup', min: 3 },
  { value: 'engagement', label: 'Engagement', min: 5 },
  { value: 'storefront_signage', label: 'Storefront & Signage', min: 4 },
  { value: 'team_uniform', label: 'Team Uniform Compliance', min: 1 },
] as const

const categoryOptions = PHOTO_CATEGORIES.map(c => ({ value: c.value, label: c.label }))

export function allCategoryMinsMet(photos: JobPhoto[]): boolean {
  return PHOTO_CATEGORIES.every(
    cat => photos.filter(p => p.photo_type === cat.value).length >= cat.min
  )
}

interface Props {
  jobId: string
  baId: string
  jobDayLocationId: string
  photos: JobPhoto[]
  onPhotoAdded: (photo: JobPhoto) => void
  onPhotoDeleted: (photoId: string) => void
  headerLabel?: string
  helperText?: string
  initiallyCollapsed?: boolean
}

export function LocationPhotoSection({
  jobId,
  baId,
  jobDayLocationId,
  photos,
  onPhotoAdded,
  onPhotoDeleted,
  headerLabel,
  helperText,
  initiallyCollapsed = false,
}: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string>('setup')
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(
    initiallyCollapsed ? {} : { setup: true }
  )
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [isDeletingPhoto, setIsDeletingPhoto] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_PHOTO_BYTES) {
      setError('Photo must be under 5MB')
      e.target.value = ''
      return
    }
    setIsUploadingPhoto(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('Not authenticated')
        return
      }
      const compressed = await compressImage(file)
      const result = await uploadJobPhoto(
        session.access_token,
        compressed,
        jobId,
        selectedCategory,
        jobDayLocationId,
        baId
      )
      const newPhoto: JobPhoto = {
        id: result.id,
        url: result.url,
        photo_type: selectedCategory,
        job_id: jobId,
        ba_id: baId,
        job_day_location_id: jobDayLocationId,
        created_at: new Date().toISOString(),
      }
      onPhotoAdded(newPhoto)
    } catch (err) {
      setError(friendlyError(err, 'upload'))
    } finally {
      setIsUploadingPhoto(false)
      e.target.value = ''
    }
  }

  const handlePhotoDelete = async (photo: JobPhoto) => {
    if (!confirm('Remove this photo?')) return
    setIsDeletingPhoto(photo.id)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        await deleteJobPhoto(session.access_token, photo.id)
      }
      onPhotoDeleted(photo.id)
    } catch {
      setError('Failed to remove photo')
    } finally {
      setIsDeletingPhoto(null)
    }
  }

  const getPhotosForCategory = (cat: string) => photos.filter(p => p.photo_type === cat)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{headerLabel || 'Documentation Requirements'}</CardTitle>
        {helperText && <p className="text-sm text-gray-500 mt-1">{helperText}</p>}
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <Alert variant="error" onClose={() => setError(null)}>{error}</Alert>}

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
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
                disabled={isUploadingPhoto}
              />
            </label>
          </div>
        </div>

        {PHOTO_CATEGORIES.map(cat => {
          const catPhotos = getPhotosForCategory(cat.value)
          const count = catPhotos.length
          const met = count >= cat.min
          const isExpanded = expandedCategories[cat.value]
          const progressLabel = met
            ? `${count} uploaded (${cat.min} required minimum)`
            : `${count} of ${cat.min} required uploaded`

          return (
            <div key={cat.value} className="border border-gray-200 rounded-lg">
              <button
                type="button"
                onClick={() => setExpandedCategories(prev => ({ ...prev, [cat.value]: !prev[cat.value] }))}
                className="w-full flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  {met ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                  )}
                  <span className="text-sm font-medium">{cat.label}</span>
                  <span className={`text-xs ${met ? 'text-green-600' : 'text-gray-400'}`}>
                    {progressLabel}
                  </span>
                </div>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>

              {isExpanded && catPhotos.length > 0 && (
                <div className="px-4 pb-3 grid grid-cols-4 gap-2">
                  {catPhotos.map(p => (
                    <div key={p.id} className="relative aspect-square rounded overflow-hidden border group">
                      <Image src={p.url} alt={cat.label} fill sizes="128px" className="object-cover" />
                      <button
                        type="button"
                        onClick={() => handlePhotoDelete(p)}
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
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button, Input, Card, CardContent, CardHeader, CardTitle, Alert, Badge, Avatar } from '@/components/ui'
import { ImagePlus, FileText } from 'lucide-react'
import type { BAProfile, BAPhoto } from '@/types'
import { getImpersonatedBAId } from '@/lib/impersonation'

const daysOfWeek = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

export default function ProfilePage() {
  const [profile, setProfile] = useState<BAProfile | null>(null)
  const [photos, setPhotos] = useState<BAPhoto[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Edit form state
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [availability, setAvailability] = useState<Record<string, { morning: boolean; afternoon: boolean; evening: boolean }>>({})

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }

      const impersonatedId = getImpersonatedBAId()
      const profileQuery = impersonatedId
        ? supabase.from('ba_profiles').select('*, users(email)').eq('id', impersonatedId).single()
        : supabase.from('ba_profiles').select('*, users(email)').eq('user_id', user.id).single()
      const { data: profileData, error: profileError } = await profileQuery

      if (profileError || !profileData) {
        router.push('/auth/setup')
        return
      }

      const email = (profileData as Record<string, unknown>).users
        ? ((profileData as Record<string, unknown>).users as { email?: string })?.email
        : undefined
      setProfile({ ...profileData, email })
      setName(profileData.name)
      setPhone(profileData.phone)
      setZipCode(profileData.zip_code)
      setAvailability(profileData.availability as Record<string, { morning: boolean; afternoon: boolean; evening: boolean }> || {})

      // Load photos
      const { data: photosData } = await supabase
        .from('ba_photos')
        .select('*')
        .eq('ba_id', profileData.id)
        .order('created_at', { ascending: false })

      setPhotos(photosData || [])
    } catch {
      setError('Failed to load profile')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleAvailability = (day: string, period: 'morning' | 'afternoon' | 'evening') => {
    setAvailability((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [period]: !prev[day]?.[period],
      },
    }))
  }

  const handleSave = async () => {
    if (!profile) return

    setError(null)
    setSuccess(null)
    setIsSaving(true)

    try {
      const updateData: Record<string, unknown> = {
        phone: phone.trim(),
        zip_code: zipCode.trim(),
        availability,
        updated_at: new Date().toISOString(),
      }

      // Re-geocode if zip code changed
      if (zipCode.trim() !== profile.zip_code) {
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
          const { data: { session } } = await supabase.auth.getSession()
          const geoRes = await fetch(`${apiUrl}/api/bas/geocode-zip?zip_code=${zipCode.trim()}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${session?.access_token}` },
          })
          if (geoRes.ok) {
            const geo = await geoRes.json()
            updateData.latitude = geo.latitude
            updateData.longitude = geo.longitude
          }
        } catch {
          // Geocoding failure is non-blocking
        }
      }

      const { error: updateError } = await supabase
        .from('ba_profiles')
        .update(updateData)
        .eq('id', profile.id)

      if (updateError) {
        setError(updateError.message)
        return
      }

      setProfile({
        ...profile,
        phone: phone.trim(),
        zip_code: zipCode.trim(),
        availability,
        latitude: updateData.latitude as number | undefined ?? profile.latitude,
        longitude: updateData.longitude as number | undefined ?? profile.longitude,
      })
      setSuccess('Profile updated successfully')
      setIsEditing(false)
    } catch {
      setError('Failed to update profile')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400" />
      </div>
    )
  }

  if (!profile) {
    return null
  }

  const statusBadge = {
    pending: { variant: 'warning' as const, text: 'Pending Approval' },
    approved: { variant: 'success' as const, text: 'Approved' },
    rejected: { variant: 'error' as const, text: 'Rejected' },
    suspended: { variant: 'error' as const, text: 'Suspended' },
  }[profile.status]

  const headshotPhoto = photos.find(p => p.photo_type === 'headshot')
  const fullLengthPhoto = photos.find(p => p.photo_type === 'full_length')
  const otherPhotos = photos.filter(p => p.photo_type !== 'headshot' && p.photo_type !== 'full_length')
  const profilePhoto = headshotPhoto || photos.find(p => p.photo_type === 'profile')

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-heading">My Profile</h1>
        {!isEditing && (
          <Button onClick={() => setIsEditing(true)}>Edit Profile</Button>
        )}
      </div>

      {error && (
        <Alert variant="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert variant="success" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Profile Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <Avatar
              src={profilePhoto?.url}
              name={profile.name}
              size="xl"
              className="w-24 h-24"
            />
            <div className="text-center sm:text-left">
              <h2 className="text-xl font-semibold text-gray-900">
                {profile.name}
              </h2>
              <p className="text-primary-400">{profile.phone}</p>
              <p className="text-primary-400">ZIP: {profile.zip_code}</p>
              <div className="mt-2">
                <Badge variant={statusBadge.variant}>{statusBadge.text}</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Details */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="space-y-4">
              <Input
                label="Phone Number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
              />
              <div>
                <Input
                  label="Work Area ZIP Code"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  placeholder="12345"
                  maxLength={5}
                />
                <p className="text-xs text-primary-400 mt-1">Enter the ZIP code where you&apos;d like to find work</p>
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false)
                    setName(profile.name)
                    setPhone(profile.phone)
                    setZipCode(profile.zip_code)
                    setAvailability(profile.availability as Record<string, { morning: boolean; afternoon: boolean; evening: boolean }>)
                  }}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button onClick={handleSave} isLoading={isSaving}>
                  Save Changes
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-primary-400">Full Name</p>
                <p className="font-medium text-gray-900">{profile.name}</p>
              </div>
              <div>
                <p className="text-sm text-primary-400">Email</p>
                <p className="font-medium text-gray-900">{profile.email || 'Not available'}</p>
              </div>
              <div>
                <p className="text-sm text-primary-400">Phone Number</p>
                <p className="font-medium text-gray-900">{profile.phone}</p>
              </div>
              <div>
                <p className="text-sm text-primary-400">Work Area ZIP Code</p>
                <p className="font-medium text-gray-900">{profile.zip_code}</p>
              </div>
              <div>
                <p className="text-sm text-primary-400">Member Since</p>
                <p className="font-medium text-gray-900">
                  {new Date(profile.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-primary-400">Languages</p>
              {profile.languages && profile.languages.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {profile.languages.map((lang: string) => (
                    <span
                      key={lang}
                      className="px-2.5 py-1 text-xs bg-primary-50 text-primary-700 rounded-full border border-primary-200"
                    >
                      {lang}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 mt-1">Not provided</p>
              )}
            </div>
            <div>
              <p className="text-sm text-primary-400">Shirt Size</p>
              <p className="font-medium text-gray-900 mt-1">
                {profile.shirt_size || <span className="text-gray-400 font-normal">Not provided</span>}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-sm text-primary-400">Additional Information</p>
              <p className="font-medium text-gray-900 mt-1">
                {profile.additional_info || <span className="text-gray-400 font-normal">Not provided</span>}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resume */}
      <Card>
        <CardHeader>
          <CardTitle>Resume</CardTitle>
        </CardHeader>
        <CardContent>
          {profile.resume_url ? (
            <a
              href={profile.resume_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition-colors"
            >
              <FileText className="w-4 h-4" />
              View Resume
            </a>
          ) : (
            <p className="text-sm text-gray-400">No resume uploaded</p>
          )}
        </CardContent>
      </Card>

      {/* Availability */}
      <Card>
        <CardHeader>
          <CardTitle>Availability</CardTitle>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="space-y-3">
              {daysOfWeek.map((day) => (
                <div key={day} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 w-24">
                    {day}
                  </span>
                  <div className="flex gap-2">
                    {(['morning', 'afternoon', 'evening'] as const).map((period) => (
                      <button
                        key={period}
                        type="button"
                        onClick={() => toggleAvailability(day, period)}
                        className={`
                          px-3 py-1 text-xs rounded-full transition-colors
                          ${availability[day]?.[period]
                            ? 'bg-primary-400 text-white'
                            : 'bg-gray-100 text-primary-400'
                          }
                        `}
                      >
                        {period.charAt(0).toUpperCase() + period.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {daysOfWeek.map((day) => {
                const dayAvail = (profile.availability as Record<string, { morning: boolean; afternoon: boolean; evening: boolean }>)?.[day] || {}
                const periods = Object.entries(dayAvail)
                  .filter(([, v]) => v)
                  .map(([k]) => k.charAt(0).toUpperCase() + k.slice(1))

                return (
                  <div key={day} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 w-24">
                      {day}
                    </span>
                    <span className="text-sm text-primary-400">
                      {periods.length > 0 ? periods.join(', ') : 'Not available'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Photos */}
      <Card>
        <CardHeader>
          <CardTitle>Photos</CardTitle>
        </CardHeader>
        <CardContent>
          {photos.length === 0 ? (
            <div className="text-center py-8 text-primary-400">
              <ImagePlus className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No photos uploaded yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {(headshotPhoto || fullLengthPhoto) && (
                <div className="grid grid-cols-2 gap-4">
                  {headshotPhoto && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Headshot</p>
                      <div className="relative aspect-square rounded-lg overflow-hidden">
                        <img src={headshotPhoto.url} alt="Headshot" className="w-full h-full object-cover" />
                      </div>
                    </div>
                  )}
                  {fullLengthPhoto && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Full-Length Photo</p>
                      <div className="relative aspect-[3/4] rounded-lg overflow-hidden">
                        <img src={fullLengthPhoto.url} alt="Full-Length" className="w-full h-full object-cover" />
                      </div>
                    </div>
                  )}
                </div>
              )}
              {otherPhotos.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {otherPhotos.map((photo) => (
                    <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden">
                      <img src={photo.url} alt={photo.photo_type} className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                        <span className="text-xs text-white capitalize">{photo.photo_type}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

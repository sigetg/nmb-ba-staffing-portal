'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Alert, Avatar, Textarea } from '@/components/ui'
import { ChevronLeft, Check, X, Calendar, DollarSign, FileText } from 'lucide-react'
import { parseLocalDate } from '@/lib/utils'
import type { JobApplication, Job, BAProfile, BAPhoto } from '@/types'

interface ApplicationWithRelations extends JobApplication {
  ba_profiles: BAProfile & { ba_photos: BAPhoto[] }
  jobs: Job
}

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function ApplicationReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [application, setApplication] = useState<ApplicationWithRelations | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [notes, setNotes] = useState('')

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadApplication()
  }, [id])

  const loadApplication = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('job_applications')
        .select('*, ba_profiles(*, ba_photos(*), users(email)), jobs(*)')
        .eq('id', id)
        .single()

      if (fetchError || !data) {
        setError('Application not found')
        return
      }

      const app = data as ApplicationWithRelations
      setApplication(app)
      setNotes(app.notes || '')
    } catch {
      setError('Failed to load application')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAction = async (action: 'approved' | 'rejected') => {
    if (!application) return

    setError(null)
    setSuccess(null)
    setIsUpdating(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Not authenticated')
        return
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const res = await fetch(`${apiUrl}/api/admin/applications/${application.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ status: action, notes: notes || null }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.detail || 'Failed to update application')
        return
      }

      setApplication({ ...application, status: action })
      setSuccess(`Application ${action} successfully`)

      setTimeout(() => {
        router.push(`/admin/jobs/${application.job_id}`)
      }, 1500)
    } catch {
      setError('Failed to update application')
    } finally {
      setIsUpdating(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400" />
      </div>
    )
  }

  if (!application) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Application not found</h2>
        <Link href="/admin/jobs" className="text-primary-400 hover:text-primary-500 mt-2 inline-block">
          Back to Jobs
        </Link>
      </div>
    )
  }

  const profileRaw = application.ba_profiles
  const profileEmail = (profileRaw as unknown as Record<string, unknown>).users
    ? ((profileRaw as unknown as Record<string, unknown>).users as { email?: string })?.email
    : undefined
  const profile = { ...profileRaw, email: profileEmail }
  const job = application.jobs
  const photos = profile.ba_photos || []
  const headshotPhoto = photos.find(p => p.photo_type === 'headshot')
  const fullLengthPhoto = photos.find(p => p.photo_type === 'full_length')
  const otherPhotos = photos.filter(p => p.photo_type !== 'headshot' && p.photo_type !== 'full_length')
  const profilePhoto = headshotPhoto || photos.find(p => p.photo_type === 'profile')
  const availability = profile.availability as Record<string, { morning?: boolean; afternoon?: boolean; evening?: boolean }>

  const statusBadge = {
    pending: { variant: 'warning' as const, text: 'Pending Approval' },
    approved: { variant: 'success' as const, text: 'Approved' },
    rejected: { variant: 'error' as const, text: 'Rejected' },
    suspended: { variant: 'error' as const, text: 'Suspended' },
  }[profile.status] || { variant: 'default' as const, text: profile.status }

  const appStatusBadge = {
    pending: { variant: 'warning' as const, text: 'Pending Review' },
    approved: { variant: 'success' as const, text: 'Approved' },
    rejected: { variant: 'error' as const, text: 'Rejected' },
    withdrawn: { variant: 'default' as const, text: 'Withdrawn' },
  }[application.status] || { variant: 'default' as const, text: application.status }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/admin/jobs/${application.job_id}`}
          className="p-2 rounded-lg hover:bg-gray-100"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-heading">Review Application</h1>
        <Badge variant={appStatusBadge.variant}>{appStatusBadge.text}</Badge>
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

      {/* Job Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Job Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="font-medium text-gray-900">{job.title}</p>
              <p className="text-sm text-primary-400">{job.brand}</p>
            </div>
            <div className="flex items-center gap-4 text-sm text-primary-400">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {parseLocalDate(job.date).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1">
                <DollarSign className="w-4 h-4" />
                ${job.pay_rate}/hr
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* BA Profile Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <Avatar
              src={profilePhoto?.url}
              name={profile.name}
              size="xl"
              className="w-24 h-24"
            />
            <div className="text-center sm:text-left flex-1">
              <h2 className="text-xl font-semibold text-gray-900">{profile.name}</h2>
              <p className="text-primary-400">{profile.phone}</p>
              <p className="text-primary-400">ZIP: {profile.zip_code}</p>
              <div className="mt-2">
                <Badge variant={statusBadge.variant}>{statusBadge.text}</Badge>
              </div>
            </div>
            <div className="text-center sm:text-right">
              <p className="text-sm text-primary-400">Member Since</p>
              <p className="font-medium text-gray-900">
                {new Date(profile.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-primary-400">Full Name</p>
              <p className="font-medium text-gray-900">{profile.name}</p>
            </div>
            <div>
              <p className="text-sm text-primary-400">Email</p>
              <p className="font-medium">
                {profile.email ? (
                  <a href={`mailto:${profile.email}`} className="text-primary-400 hover:text-primary-500 underline">
                    {profile.email}
                  </a>
                ) : (
                  <span className="text-gray-400">Not available</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-primary-400">Phone Number</p>
              <p className="font-medium text-gray-900">{profile.phone}</p>
            </div>
            <div>
              <p className="text-sm text-primary-400">ZIP Code</p>
              <p className="font-medium text-gray-900">{profile.zip_code}</p>
            </div>
            <div>
              <p className="text-sm text-primary-400">Member Since</p>
              <p className="font-medium text-gray-900">
                {new Date(profile.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
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
              Download Resume
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
          <div className="space-y-3">
            {daysOfWeek.map((day) => {
              const dayAvail = availability?.[day] || {}
              const periods = Object.entries(dayAvail)
                .filter(([, v]) => v)
                .map(([k]) => k.charAt(0).toUpperCase() + k.slice(1))

              return (
                <div key={day} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 w-24">{day}</span>
                  <div className="flex gap-2">
                    {periods.length > 0 ? (
                      periods.map((period) => (
                        <span
                          key={period}
                          className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full"
                        >
                          {period}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-primary-400">Not available</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Photos */}
      <Card>
        <CardHeader>
          <CardTitle>Photos</CardTitle>
        </CardHeader>
        <CardContent>
          {photos.length === 0 ? (
            <p className="text-center py-4 text-primary-400">No photos uploaded</p>
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

      {/* Review Decision / Status */}
      {application.status === 'pending' ? (
        <Card>
          <CardHeader>
            <CardTitle>Review Decision</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (included in notification email)
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this application (optional)..."
                rows={3}
              />
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => handleAction('approved')}
                isLoading={isUpdating}
                className="flex-1 sm:flex-none"
              >
                <Check className="w-5 h-5 mr-2" />
                Approve
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleAction('rejected')}
                isLoading={isUpdating}
                className="flex-1 sm:flex-none"
              >
                <X className="w-5 h-5 mr-2" />
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Decision</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Badge variant={appStatusBadge.variant}>{appStatusBadge.text}</Badge>
              {application.reviewed_at && (
                <span className="text-sm text-primary-400">
                  on {new Date(application.reviewed_at).toLocaleDateString()}
                </span>
              )}
            </div>
            {notes && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-600 mb-1">Notes</p>
                <p className="text-sm text-gray-900">{notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

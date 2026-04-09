'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Alert, Avatar, Textarea } from '@/components/ui'
import { ChevronLeft, Check, X, FileText, Save, Eye } from 'lucide-react'
import { startImpersonation } from '@/lib/actions/impersonation'
import type { BAProfile, BAPhoto, Job, JobApplication } from '@/types'
import { formatJobStatus, getJobDisplayStatus, getJobStatusBadgeVariant, parseLocalDate } from '@/lib/utils'

interface AssignedJob extends JobApplication {
  jobs: Job
}

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function BADetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [profile, setProfile] = useState<BAProfile | null>(null)
  const [photos, setPhotos] = useState<BAPhoto[]>([])
  const [assignedJobs, setAssignedJobs] = useState<AssignedJob[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [isSavingNotes, setIsSavingNotes] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadProfile()
  }, [id])

  const loadProfile = async () => {
    try {
      // Get BA profile
      const { data: profileData, error: profileError } = await supabase
        .from('ba_profiles')
        .select('*, users(email)')
        .eq('id', id)
        .single()

      if (profileError || !profileData) {
        setError('BA not found')
        return
      }

      const email = (profileData as Record<string, unknown>).users
        ? ((profileData as Record<string, unknown>).users as { email?: string })?.email
        : undefined
      setProfile({ ...profileData, email })
      setNotes(profileData.admin_notes || '')

      // Get photos
      const { data: photosData } = await supabase
        .from('ba_photos')
        .select('*')
        .eq('ba_id', id)
        .order('created_at', { ascending: false })

      setPhotos(photosData || [])

      // Get assigned jobs (approved applications)
      const { data: assignedData } = await supabase
        .from('job_applications')
        .select('*, jobs(*)')
        .eq('ba_id', id)
        .eq('status', 'approved')

      setAssignedJobs((assignedData || []) as AssignedJob[])
    } catch {
      setError('Failed to load BA profile')
    } finally {
      setIsLoading(false)
    }
  }

  const updateStatus = async (newStatus: 'approved' | 'rejected' | 'suspended') => {
    if (!profile) return

    setError(null)
    setSuccess(null)
    setIsUpdating(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('Not authenticated')
        return
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const res = await fetch(`${apiUrl}/api/admin/bas/${profile.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ status: newStatus, notes: notes || null }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.detail || 'Failed to update status')
        return
      }

      setProfile({ ...profile, status: newStatus })
      setSuccess(`BA ${newStatus === 'approved' ? 'approved' : newStatus === 'rejected' ? 'rejected' : 'suspended'} successfully`)

      // Redirect back to pending list after approval/rejection
      if (newStatus === 'approved' || newStatus === 'rejected') {
        setTimeout(() => {
          router.push('/admin/bas/pending')
        }, 1500)
      }
    } catch {
      setError('Failed to update status')
    } finally {
      setIsUpdating(false)
    }
  }

  const saveNotes = async () => {
    if (!profile) return

    setError(null)
    setSuccess(null)
    setIsSavingNotes(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('Not authenticated')
        return
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const res = await fetch(`${apiUrl}/api/admin/bas/${profile.id}/notes`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ notes }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.detail || 'Failed to save notes')
        return
      }

      setSuccess('Notes saved successfully')
    } catch {
      setError('Failed to save notes')
    } finally {
      setIsSavingNotes(false)
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
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">BA not found</h2>
        <Link href="/admin/bas" className="text-primary-400 hover:text-primary-500 mt-2 inline-block">
          Back to BAs
        </Link>
      </div>
    )
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
  const availability = profile.availability as Record<string, { morning?: boolean; afternoon?: boolean; evening?: boolean }>

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/bas"
          className="p-2 rounded-lg hover:bg-gray-100"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-heading">
          {profile.status === 'pending' ? 'Review Application' : 'Brand Ambassador'}
        </h1>
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
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <Avatar
              src={profilePhoto?.url}
              name={profile.name}
              size="xl"
              className="w-24 h-24"
            />
            <div className="text-center sm:text-left flex-1">
              <h2 className="text-xl font-semibold text-gray-900">
                {profile.name}
              </h2>
              <p className="text-primary-400">{profile.phone}</p>
              <p className="text-primary-400">ZIP: {profile.zip_code}</p>
              <div className="mt-2">
                <Badge variant={statusBadge.variant}>{statusBadge.text}</Badge>
              </div>
            </div>
            <div className="flex flex-col items-center sm:items-end gap-2">
              <div className="text-center sm:text-right">
                <p className="text-sm text-primary-400">Applied</p>
                <p className="font-medium text-gray-900">
                  {new Date(profile.created_at).toLocaleDateString()}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await startImpersonation(id)
                  router.push('/dashboard')
                }}
              >
                <Eye className="w-4 h-4 mr-1" />
                Login As
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Details */}
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
                  {profile.languages.map((lang) => (
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
                  <span className="text-sm font-medium text-gray-700 w-24">
                    {day}
                  </span>
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
            <p className="text-center py-4 text-primary-400">
              No photos uploaded
            </p>
          ) : (
            <div className="space-y-4">
              {/* Labeled headshot and full-length side by side */}
              {(headshotPhoto || fullLengthPhoto) && (
                <div className="grid grid-cols-2 gap-4">
                  {headshotPhoto && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Headshot</p>
                      <div className="relative aspect-square rounded-lg overflow-hidden">
                        <img
                          src={headshotPhoto.url}
                          alt="Headshot"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  )}
                  {fullLengthPhoto && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Full-Length Photo</p>
                      <div className="relative aspect-[3/4] rounded-lg overflow-hidden">
                        <img
                          src={fullLengthPhoto.url}
                          alt="Full-Length"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* Other photos */}
              {otherPhotos.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {otherPhotos.map((photo) => (
                    <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden">
                      <img
                        src={photo.url}
                        alt={photo.photo_type}
                        className="w-full h-full object-cover"
                      />
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

      {/* Assigned Jobs */}
      <Card>
        <CardHeader>
          <CardTitle>Assigned Jobs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {assignedJobs.length === 0 ? (
            <div className="text-center py-8 text-primary-400">
              No assigned jobs
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 text-sm font-medium text-primary-400">Job Title</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-primary-400">Brand</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-primary-400">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-primary-400">Pay Rate</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-primary-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {assignedJobs.map((aj) => {
                    const jobDisplayStatus = aj.jobs.date && aj.jobs.start_time && aj.jobs.end_time
                      ? getJobDisplayStatus({ status: aj.jobs.status, date: aj.jobs.date, start_time: aj.jobs.start_time, end_time: aj.jobs.end_time, timezone: aj.jobs.timezone })
                      : aj.jobs.status === 'draft' ? 'draft' : aj.jobs.status === 'cancelled' ? 'cancelled' : 'in_progress'
                    return (
                    <tr key={aj.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm">
                        <Link
                          href={`/admin/jobs/${aj.jobs.id}`}
                          className="text-primary-400 hover:text-primary-500"
                        >
                          {aj.jobs.title}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900">{aj.jobs.brand}</td>
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {aj.jobs.date ? parseLocalDate(aj.jobs.date).toLocaleDateString() : 'Multi-day'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900">${aj.jobs.pay_rate}/hr</td>
                      <td className="py-3 px-4">
                        <Badge variant={getJobStatusBadgeVariant(jobDisplayStatus)}>
                          {formatJobStatus(jobDisplayStatus)}
                        </Badge>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin Notes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Admin Notes</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={saveNotes}
              isLoading={isSavingNotes}
            >
              <Save className="w-4 h-4 mr-1" />
              Save Notes
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this BA (optional)..."
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-3">
            {profile.status === 'pending' && (
              <>
                <Button
                  onClick={() => updateStatus('approved')}
                  isLoading={isUpdating}
                  className="flex-1 sm:flex-none"
                >
                  <Check className="w-5 h-5 mr-2" />
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => updateStatus('rejected')}
                  isLoading={isUpdating}
                  className="flex-1 sm:flex-none"
                >
                  <X className="w-5 h-5 mr-2" />
                  Reject
                </Button>
              </>
            )}

            {profile.status === 'approved' && (
              <Button
                variant="destructive"
                onClick={() => updateStatus('suspended')}
                isLoading={isUpdating}
              >
                Suspend BA
              </Button>
            )}

            {profile.status === 'suspended' && (
              <Button
                onClick={() => updateStatus('approved')}
                isLoading={isUpdating}
              >
                Reinstate BA
              </Button>
            )}

            {profile.status === 'rejected' && (
              <Button
                onClick={() => updateStatus('approved')}
                isLoading={isUpdating}
              >
                Approve BA
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

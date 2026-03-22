'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Alert } from '@/components/ui'
import { ChevronLeft, Calendar, Clock, MapPin, FileText, CheckCircle2 } from 'lucide-react'
import { parseLocalDate } from '@/lib/utils'
import type { Job, BAProfile, JobApplication } from '@/types'

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [job, setJob] = useState<Job | null>(null)
  const [profile, setProfile] = useState<BAProfile | null>(null)
  const [application, setApplication] = useState<JobApplication | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isApplying, setIsApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadJobData()
  }, [id])

  const loadJobData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }

      // Load job
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', id)
        .single()

      if (jobError || !jobData) {
        setError('Job not found')
        return
      }
      setJob(jobData)

      // Load profile
      const { data: profileData } = await supabase
        .from('ba_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      setProfile(profileData)

      // Load application if exists
      if (profileData) {
        const { data: appData } = await supabase
          .from('job_applications')
          .select('*')
          .eq('job_id', id)
          .eq('ba_id', profileData.id)
          .single()

        setApplication(appData)
      }
    } catch {
      setError('Failed to load job')
    } finally {
      setIsLoading(false)
    }
  }

  const handleApply = async () => {
    if (!profile || !job) return

    setError(null)
    setSuccess(null)
    setIsApplying(true)

    try {
      const { data, error: applyError } = await supabase
        .from('job_applications')
        .insert({
          job_id: job.id,
          ba_id: profile.id,
          status: 'pending',
          applied_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (applyError) {
        if (applyError.code === '23505') {
          setError('You have already applied to this job')
        } else {
          setError(applyError.message)
        }
        return
      }

      setApplication(data)
      setSuccess('Application submitted successfully!')
    } catch {
      setError('Failed to submit application')
    } finally {
      setIsApplying(false)
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
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Job not found</h2>
        <Link href="/dashboard/jobs" className="text-primary-400 hover:text-primary-500 mt-2 inline-block">
          Back to jobs
        </Link>
      </div>
    )
  }

  const canApply = profile?.status === 'approved' && !application && job.slots_filled < job.slots
  const slotsAvailable = job.slots - job.slots_filled

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/jobs"
          className="p-2 rounded-lg hover:bg-gray-100"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-heading">Job Details</h1>
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

      {/* Job Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {job.title}
              </h2>
              <p className="text-lg text-primary-400">{job.brand}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">
                ${job.pay_rate}<span className="text-base font-normal">/hr</span>
              </p>
              <Badge variant={slotsAvailable > 0 ? 'success' : 'error'}>
                {slotsAvailable} {slotsAvailable === 1 ? 'slot' : 'slots'} available
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Job Details */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <Calendar className="w-5 h-5 text-primary-400" />
              </div>
              <div>
                <p className="text-sm text-primary-400">Date</p>
                <p className="font-medium text-gray-900">
                  {parseLocalDate(job.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <Clock className="w-5 h-5 text-primary-400" />
              </div>
              <div>
                <p className="text-sm text-primary-400">Time</p>
                <p className="font-medium text-gray-900">
                  {job.start_time} - {job.end_time}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:col-span-2">
              <div className="p-2 bg-primary-100 rounded-lg">
                <MapPin className="w-5 h-5 text-primary-400" />
              </div>
              <div>
                <p className="text-sm text-primary-400">Location</p>
                <p className="font-medium text-gray-900">{job.location}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Description */}
      {job.description && (
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 whitespace-pre-wrap">
              {job.description}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Worksheet Link */}
      {job.worksheet_url && (
        <Card>
          <CardHeader>
            <CardTitle>Resources</CardTitle>
          </CardHeader>
          <CardContent>
            <a
              href={job.worksheet_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary-400 hover:text-primary-500"
            >
              <FileText className="w-5 h-5" />
              View Worksheet
            </a>
          </CardContent>
        </Card>
      )}

      {/* Application Status / Apply Button */}
      <Card>
        <CardContent className="p-6">
          {application ? (
            <div className="text-center">
              <Badge
                variant={
                  application.status === 'approved'
                    ? 'success'
                    : application.status === 'rejected'
                    ? 'error'
                    : 'warning'
                }
                className="text-base px-4 py-2"
              >
                {application.status === 'approved'
                  ? 'Application Approved'
                  : application.status === 'rejected'
                  ? 'Application Rejected'
                  : 'Application Pending'}
              </Badge>
              {application.status === 'approved' && (
                <div className="mt-4">
                  <Link
                    href={`/dashboard/jobs/${job.id}/check-in`}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    Check In
                  </Link>
                </div>
              )}
            </div>
          ) : profile?.status !== 'approved' ? (
            <div className="text-center">
              <p className="text-primary-400 mb-2">
                Your profile must be approved before you can apply for jobs.
              </p>
              <Badge variant="warning">Profile Pending Approval</Badge>
            </div>
          ) : slotsAvailable === 0 ? (
            <div className="text-center">
              <p className="text-primary-400">
                This job has no available slots.
              </p>
            </div>
          ) : (
            <div className="text-center">
              <Button
                onClick={handleApply}
                isLoading={isApplying}
                className="px-8 py-3"
              >
                Apply for this Job
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

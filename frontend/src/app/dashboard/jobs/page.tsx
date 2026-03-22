import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Card, CardContent, Badge } from '@/components/ui'
import { Calendar, Clock, MapPin, Briefcase, AlertTriangle } from 'lucide-react'
import { parseLocalDate, getLocalToday } from '@/lib/utils'

async function getAvailableJobs(userId: string) {
  const supabase = await createClient()

  // Get BA profile
  const { data: profile } = await supabase
    .from('ba_profiles')
    .select('id, status')
    .eq('user_id', userId)
    .single()

  // Get available jobs
  const { data: jobs } = await supabase
    .from('jobs')
    .select('*')
    .in('status', ['published', 'in_progress'])
    .gte('date', getLocalToday())
    .order('date', { ascending: true })

  // Get user's applications
  const { data: applications } = await supabase
    .from('job_applications')
    .select('job_id, status')
    .eq('ba_id', profile?.id || '')

  const appliedJobIds = new Set(applications?.map(a => a.job_id) || [])
  const applicationStatuses = Object.fromEntries(
    applications?.map(a => [a.job_id, a.status]) || []
  )

  return {
    profile,
    jobs: jobs || [],
    appliedJobIds,
    applicationStatuses,
  }
}

export default async function JobsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { profile, jobs, appliedJobIds, applicationStatuses } = await getAvailableJobs(user.id)

  const canApply = profile?.status === 'approved'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-heading">Find Jobs</h1>
        <p className="text-primary-400">
          Browse available job opportunities
        </p>
      </div>

      {!canApply && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800">Profile Pending Approval</p>
              <p className="text-sm text-yellow-700">
                Your profile is currently under review. Once approved, you&apos;ll be able to apply for jobs.
              </p>
            </div>
          </div>
        </div>
      )}

      {jobs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Briefcase className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-primary-400">No jobs available at the moment</p>
            <p className="text-sm text-primary-400 mt-1">Check back later for new opportunities</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobs.map((job: { id: string; title: string; brand: string; description: string; location: string; date: string; start_time: string; end_time: string; pay_rate: number; slots: number; slots_filled: number }) => {
            const isApplied = appliedJobIds.has(job.id)
            const applicationStatus = applicationStatuses[job.id]
            const slotsAvailable = job.slots - job.slots_filled

            return (
              <Card key={job.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {job.title}
                      </h3>
                      <p className="text-sm text-primary-400">{job.brand}</p>
                    </div>
                    {isApplied && (
                      <Badge
                        variant={
                          applicationStatus === 'approved'
                            ? 'success'
                            : applicationStatus === 'rejected'
                            ? 'error'
                            : 'warning'
                        }
                      >
                        {applicationStatus === 'approved'
                          ? 'Approved'
                          : applicationStatus === 'rejected'
                          ? 'Rejected'
                          : 'Applied'}
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-2 text-sm text-primary-400 mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>{parseLocalDate(job.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>{job.start_time} - {job.end_time}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      <span className="truncate">{job.location}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div>
                      <span className="text-lg font-semibold text-gray-900">
                        ${job.pay_rate}
                      </span>
                      <span className="text-sm text-primary-400">/hr</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm ${slotsAvailable > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {slotsAvailable} {slotsAvailable === 1 ? 'slot' : 'slots'} left
                      </span>
                      <Link
                        href={`/dashboard/jobs/${job.id}`}
                        className="px-3 py-1.5 text-sm bg-primary-400 text-white rounded-lg hover:bg-primary-500 transition-colors"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

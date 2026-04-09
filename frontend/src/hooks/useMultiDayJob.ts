'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Job, JobDay, JobDayLocation, LocationCheckIn, TravelLog } from '@/types'
import { getLocalToday } from '@/lib/utils'
import { getImpersonatedBAId } from '@/lib/impersonation'

interface MultiDayJobState {
  job: Job | null
  profileId: string | null
  userId: string | null
  checkIns: LocationCheckIn[]
  travelLogs: TravelLog[]
  isLoading: boolean
  error: string | null
  // Derived
  currentDay: JobDay | null
  currentLocation: JobDayLocation | null
  nextLocation: JobDayLocation | null
  isLastLocationOfDay: boolean
  isLastDay: boolean
  sortedDays: JobDay[]
  progress: { completedLocations: number; totalLocations: number; completedDays: number; totalDays: number }
}

export function useMultiDayJob(jobId: string) {
  const [job, setJob] = useState<Job | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [checkIns, setCheckIns] = useState<LocationCheckIn[]>([])
  const [travelLogs, setTravelLogs] = useState<TravelLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [jobId])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Not authenticated'); return }
      setUserId(user.id)

      const impersonatedId = getImpersonatedBAId()
      const { data: profile } = await (impersonatedId
        ? supabase.from('ba_profiles').select('id').eq('id', impersonatedId).single()
        : supabase.from('ba_profiles').select('id').eq('user_id', user.id).single())

      if (!profile) { setError('Profile not found'); return }
      setProfileId(profile.id)

      // Load job with nested days/locations
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('*, job_days(*, job_day_locations(*))')
        .eq('id', jobId)
        .single()

      if (jobError || !jobData) { setError('Job not found'); return }
      setJob(jobData as Job)

      // Load check-ins for this BA
      const locationIds = (jobData.job_days || []).flatMap(
        (d: JobDay) => (d.job_day_locations || []).map((l: JobDayLocation) => l.id)
      )

      if (locationIds.length > 0) {
        const { data: cis } = await supabase
          .from('location_check_ins')
          .select('*')
          .eq('ba_id', profile.id)
          .in('job_day_location_id', locationIds)

        setCheckIns((cis || []) as LocationCheckIn[])

        // Load travel logs
        const ciIds = (cis || []).map((ci: LocationCheckIn) => ci.id)
        if (ciIds.length > 0) {
          const { data: tls } = await supabase
            .from('travel_logs')
            .select('*')
            .eq('ba_id', profile.id)
            .in('from_location_check_in_id', ciIds)

          setTravelLogs((tls || []) as TravelLog[])
        }
      }
    } catch {
      setError('Failed to load job data')
    } finally {
      setIsLoading(false)
    }
  }

  const sortedDays = useMemo(() => {
    if (!job?.job_days) return []
    return [...job.job_days].sort((a, b) => a.sort_order - b.sort_order).map(d => ({
      ...d,
      job_day_locations: (d.job_day_locations || []).sort((a: JobDayLocation, b: JobDayLocation) => a.sort_order - b.sort_order),
    }))
  }, [job])

  const today = getLocalToday()

  const currentDay = useMemo(() => {
    return sortedDays.find(d => d.date === today) || null
  }, [sortedDays, today])

  const currentLocation = useMemo(() => {
    if (!currentDay) return null
    const locations = currentDay.job_day_locations || []
    // Find first location that has check-in but no check-out (active)
    for (const loc of locations) {
      const ci = checkIns.find(c => c.job_day_location_id === loc.id && !c.skipped)
      if (ci && !ci.check_out_time) return loc
    }
    // Find first location with no check-in yet (next to check into)
    for (const loc of locations) {
      const ci = checkIns.find(c => c.job_day_location_id === loc.id)
      if (!ci) return loc
    }
    return null
  }, [currentDay, checkIns])

  const nextLocation = useMemo(() => {
    if (!currentDay || !currentLocation) return null
    const locations = currentDay.job_day_locations || []
    const currentIdx = locations.findIndex((l: JobDayLocation) => l.id === currentLocation.id)
    if (currentIdx < 0 || currentIdx >= locations.length - 1) return null
    return locations[currentIdx + 1]
  }, [currentDay, currentLocation])

  const isLastLocationOfDay = useMemo(() => {
    if (!currentDay || !currentLocation) return false
    const locations = currentDay.job_day_locations || []
    const currentIdx = locations.findIndex((l: JobDayLocation) => l.id === currentLocation.id)
    return currentIdx === locations.length - 1
  }, [currentDay, currentLocation])

  const isLastDay = useMemo(() => {
    if (!currentDay) return false
    return sortedDays.indexOf(currentDay) === sortedDays.length - 1
  }, [currentDay, sortedDays])

  const progress = useMemo(() => {
    const allLocations = sortedDays.flatMap(d => d.job_day_locations || [])
    const completedLocations = allLocations.filter((l: JobDayLocation) =>
      checkIns.some(ci => ci.job_day_location_id === l.id && (ci.check_out_time || ci.skipped))
    ).length

    const completedDays = sortedDays.filter(d => {
      const dayLocs = d.job_day_locations || []
      return dayLocs.length > 0 && dayLocs.every((l: JobDayLocation) =>
        checkIns.some(ci => ci.job_day_location_id === l.id && (ci.check_out_time || ci.skipped))
      )
    }).length

    return {
      completedLocations,
      totalLocations: allLocations.length,
      completedDays,
      totalDays: sortedDays.length,
    }
  }, [sortedDays, checkIns])

  return {
    job, profileId, userId, checkIns, travelLogs,
    isLoading, error,
    currentDay, currentLocation, nextLocation,
    isLastLocationOfDay, isLastDay,
    sortedDays, progress,
    reload: loadData,
  } as MultiDayJobState & { reload: () => Promise<void> }
}

'use client'

import { useState, useEffect, use, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button, Input, Textarea, Select, Card, CardContent, CardHeader, CardTitle, Alert, AddressAutocomplete } from '@/components/ui'
import { ChevronLeft, FileText, Plus, Trash2, ChevronUp, ChevronDown, Calendar, MapPin, Copy, X } from 'lucide-react'
import { JobActions } from '@/components/admin/job-actions'
import { getMultiDayDisplayStatus } from '@/lib/utils'
import { uploadJobWorksheet, deleteJobWorksheet } from '@/lib/api'
import type { Job, JobDay, JobDayLocation, JobStatus, DisplayJobStatus, JobWithDays } from '@/types'

const statusOptions = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'archived', label: 'Archived' },
]

interface EditLocation {
  id: string
  location: string
  latitude: number | null
  longitude: number | null
  start_time: string
  end_time: string
  sort_order: number
  isNew?: boolean
}

interface EditDay {
  id: string
  date: string
  sort_order: number
  locations: EditLocation[]
  isNew?: boolean
}

let tempId = 0
function genTempId() { return `new-${++tempId}-${Date.now()}` }

export default function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'basic' | 'schedule'>('basic')

  // Basic Info state
  const [title, setTitle] = useState('')
  const [brand, setBrand] = useState('')
  const [description, setDescription] = useState('')
  const [payRate, setPayRate] = useState('')
  const [slots, setSlots] = useState('')
  const [worksheetFile, setWorksheetFile] = useState<File | null>(null)
  const [existingWorksheetUrl, setExistingWorksheetUrl] = useState<string | null>(null)
  const [removeWorksheet, setRemoveWorksheet] = useState(false)
  const [status, setStatus] = useState('draft')
  const [timezone, setTimezone] = useState('')
  const [jobTypeId, setJobTypeId] = useState('')
  const [jobTypes, setJobTypes] = useState<{ id: string; name: string }[]>([])

  // Schedule state
  const [days, setDays] = useState<EditDay[]>([])
  const [activeDayIdx, setActiveDayIdx] = useState(0)
  const [dateInput, setDateInput] = useState('')
  const [isMultiDay, setIsMultiDay] = useState(false)

  // Legacy single-day fields
  const [legacyLocation, setLegacyLocation] = useState('')
  const [legacyLatitude, setLegacyLatitude] = useState<number | null>(null)
  const [legacyLongitude, setLegacyLongitude] = useState<number | null>(null)
  const [legacyDate, setLegacyDate] = useState('')
  const [legacyStartTime, setLegacyStartTime] = useState('')
  const [legacyEndTime, setLegacyEndTime] = useState('')

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadJob()
    supabase
      .from('job_types')
      .select('id, name')
      .eq('is_archived', false)
      .order('sort_order')
      .then(({ data }) => setJobTypes(data || []))
  }, [id])

  const loadJob = async () => {
    try {
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('*, job_days(*, job_day_locations(*))')
        .eq('id', id)
        .single()

      if (jobError || !job) {
        setError('Job not found')
        return
      }

      setTitle(job.title)
      setBrand(job.brand)
      setDescription(job.description || '')
      setPayRate(job.pay_rate.toString())
      setSlots(job.slots.toString())
      setExistingWorksheetUrl(job.worksheet_url || null)
      setStatus(job.status)
      setTimezone(job.timezone || '')
      setJobTypeId(job.job_type_id || '')

      // Check if multi-day
      const jobDays = (job.job_days || []) as JobDay[]
      if (jobDays.length > 0) {
        setIsMultiDay(true)
        const sortedDays = [...jobDays].sort((a, b) => a.sort_order - b.sort_order)
        setDays(sortedDays.map(d => ({
          id: d.id,
          date: d.date,
          sort_order: d.sort_order,
          locations: ((d.job_day_locations || []) as JobDayLocation[])
            .sort((a, b) => a.sort_order - b.sort_order)
            .map(l => ({
              id: l.id,
              location: l.location,
              latitude: l.latitude ?? null,
              longitude: l.longitude ?? null,
              start_time: l.start_time,
              end_time: l.end_time,
              sort_order: l.sort_order,
            })),
        })))
      } else {
        setIsMultiDay(false)
        setLegacyLocation(job.location || '')
        setLegacyLatitude(job.latitude ?? null)
        setLegacyLongitude(job.longitude ?? null)
        setLegacyDate(job.date || '')
        setLegacyStartTime(job.start_time || '')
        setLegacyEndTime(job.end_time || '')
      }
    } catch {
      setError('Failed to load job')
    } finally {
      setIsLoading(false)
    }
  }

  const addDay = useCallback(() => {
    if (!dateInput || days.some(d => d.date === dateInput)) return
    setDays(prev => [...prev, {
      id: genTempId(),
      date: dateInput,
      sort_order: prev.length,
      locations: [],
      isNew: true,
    }].sort((a, b) => a.date.localeCompare(b.date)))
    setDateInput('')
  }, [dateInput, days])

  const removeDay = useCallback((dayId: string) => {
    setDays(prev => {
      const filtered = prev.filter(d => d.id !== dayId)
      if (activeDayIdx >= filtered.length) setActiveDayIdx(Math.max(0, filtered.length - 1))
      return filtered.map((d, i) => ({ ...d, sort_order: i }))
    })
  }, [activeDayIdx])

  const addLocation = useCallback((dayId: string) => {
    setDays(prev => prev.map(d => d.id !== dayId ? d : {
      ...d,
      locations: [...d.locations, {
        id: genTempId(),
        location: '',
        latitude: null,
        longitude: null,
        start_time: '',
        end_time: '',
        sort_order: d.locations.length,
        isNew: true,
      }],
    }))
  }, [])

  const removeLocation = useCallback((dayId: string, locId: string) => {
    setDays(prev => prev.map(d => d.id !== dayId ? d : {
      ...d,
      locations: d.locations.filter(l => l.id !== locId).map((l, i) => ({ ...l, sort_order: i })),
    }))
  }, [])

  const updateLocation = useCallback((dayId: string, locId: string, updates: Partial<EditLocation>) => {
    setDays(prev => prev.map(d => d.id !== dayId ? d : {
      ...d,
      locations: d.locations.map(l => l.id !== locId ? l : { ...l, ...updates }),
    }))
  }, [])

  const reorderLocation = useCallback((dayId: string, locId: string, dir: 'up' | 'down') => {
    setDays(prev => prev.map(d => {
      if (d.id !== dayId) return d
      const idx = d.locations.findIndex(l => l.id === locId)
      const swapIdx = dir === 'up' ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= d.locations.length) return d
      const locs = [...d.locations]
      ;[locs[idx], locs[swapIdx]] = [locs[swapIdx], locs[idx]]
      return { ...d, locations: locs.map((l, i) => ({ ...l, sort_order: i })) }
    }))
  }, [])

  const copyLocationsToAllDays = useCallback((sourceDayId: string) => {
    setDays(prev => {
      const src = prev.find(d => d.id === sourceDayId)
      if (!src) return prev
      return prev.map(d => d.id === sourceDayId ? d : {
        ...d,
        locations: src.locations.map(l => ({ ...l, id: genTempId(), isNew: true })),
      })
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    // Validate
    if (!title.trim() || !brand.trim() || !payRate || parseFloat(payRate) <= 0 || !slots || parseInt(slots) <= 0) {
      setError('Please fill in all required fields')
      return
    }

    if (isMultiDay) {
      if (days.length === 0) { setError('Add at least one day'); return }
      for (const d of days) {
        if (d.locations.length === 0) { setError(`Day ${d.date} needs at least one location`); return }
        for (const l of d.locations) {
          if (!l.location.trim() || !l.start_time || !l.end_time) {
            setError(`All locations need address, start time, and end time`); return
          }
        }
      }
    }

    setIsSaving(true)

    try {
      // Handle worksheet via backend API
      let worksheetUrl: string | null = existingWorksheetUrl

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { setError('Not authenticated'); return }

      if (worksheetFile) {
        try {
          const { url } = await uploadJobWorksheet(session.access_token, worksheetFile, id)
          worksheetUrl = url
        } catch (err) {
          setError('Failed to upload worksheet: ' + (err instanceof Error ? err.message : String(err)))
          return
        }
      } else if (removeWorksheet) {
        if (existingWorksheetUrl) {
          await deleteJobWorksheet(session.access_token, id)
        }
        worksheetUrl = null
      }

      // Update job basic info
      const jobUpdate: Record<string, unknown> = {
        title: title.trim(),
        brand: brand.trim(),
        description: description.trim(),
        pay_rate: parseFloat(payRate),
        slots: parseInt(slots),
        worksheet_url: worksheetUrl,
        status,
        job_type_id: jobTypeId || null,
        updated_at: new Date().toISOString(),
      }

      if (isMultiDay) {
        jobUpdate.location = null
        jobUpdate.latitude = null
        jobUpdate.longitude = null
        jobUpdate.date = null
        jobUpdate.start_time = null
        jobUpdate.end_time = null
      } else {
        jobUpdate.location = legacyLocation.trim()
        jobUpdate.latitude = legacyLatitude
        jobUpdate.longitude = legacyLongitude
        jobUpdate.date = legacyDate
        jobUpdate.start_time = legacyStartTime
        jobUpdate.end_time = legacyEndTime
      }

      const { error: updateError } = await supabase.from('jobs').update(jobUpdate).eq('id', id)
      if (updateError) { setError(updateError.message); return }

      // Update schedule if multi-day (full replace)
      if (isMultiDay) {
        // Delete existing days (cascade deletes locations)
        await supabase.from('job_days').delete().eq('job_id', id)

        // Insert new days and locations
        for (const day of days) {
          const { data: dayRow, error: dayErr } = await supabase.from('job_days').insert({
            job_id: id,
            date: day.date,
            sort_order: day.sort_order,
          }).select('id').single()

          if (dayErr || !dayRow) { setError('Failed to save day'); return }

          for (const loc of day.locations) {
            const { error: locErr } = await supabase.from('job_day_locations').insert({
              job_day_id: dayRow.id,
              job_id: id,
              location: loc.location.trim(),
              latitude: loc.latitude,
              longitude: loc.longitude,
              start_time: loc.start_time,
              end_time: loc.end_time,
              sort_order: loc.sort_order,
            })
            if (locErr) { setError('Failed to save location'); return }
          }
        }
      }

      setSuccess('Job updated successfully')
      setTimeout(() => router.push('/admin/jobs'), 1500)
    } catch {
      setError('Failed to update job')
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

  const activeDay = days[activeDayIdx]

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/jobs" className="p-2 rounded-lg hover:bg-gray-100">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-heading">Edit Job</h1>
      </div>

      {error && <Alert variant="error" onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('basic')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'basic' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Basic Info
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('schedule')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'schedule' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Schedule
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {activeTab === 'basic' && (
          <Card>
            <CardHeader><CardTitle>Job Details</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Job Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Brand Ambassador" />
                <Input label="Brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g., Nike" />
              </div>
              {/* Job Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Type</label>
                <select
                  value={jobTypeId}
                  onChange={(e) => setJobTypeId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
                >
                  <option value="">Select a job type...</option>
                  {jobTypes.map((jt) => (
                    <option key={jt.id} value={jt.id}>{jt.name}</option>
                  ))}
                </select>
              </div>

              <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Pay Rate ($/hr)" type="number" step="0.01" min="0" value={payRate} onChange={(e) => setPayRate(e.target.value)} />
                <Input label="Available Slots" type="number" min="1" value={slots} onChange={(e) => setSlots(e.target.value)} />
              </div>

              {/* Worksheet */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Worksheet (optional, PDF)</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                  {worksheetFile ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-primary-400" />
                        <span className="text-sm">{worksheetFile.name}</span>
                      </div>
                      <button type="button" onClick={() => { setWorksheetFile(null); setRemoveWorksheet(true) }} className="text-sm text-red-500">Remove</button>
                    </div>
                  ) : existingWorksheetUrl && !removeWorksheet ? (
                    <div className="flex items-center justify-between">
                      <a href={existingWorksheetUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-400 hover:underline flex items-center gap-1">
                        <FileText className="w-4 h-4" /> Current worksheet
                      </a>
                      <div className="flex gap-2">
                        <label className="cursor-pointer text-sm text-primary-400">
                          Replace
                          <input type="file" accept=".pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setWorksheetFile(f); setRemoveWorksheet(false) } }} className="hidden" />
                        </label>
                        <button type="button" onClick={() => setRemoveWorksheet(true)} className="text-sm text-red-500">Remove</button>
                      </div>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <FileText className="w-8 h-8 mx-auto text-gray-300 mb-1" />
                      <span className="text-sm text-primary-400">Choose PDF file</span>
                      <input type="file" accept=".pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setWorksheetFile(f); setRemoveWorksheet(false) } }} className="hidden" />
                    </label>
                  )}
                </div>
              </div>

              <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} options={statusOptions} />

              {timezone && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                  <p className="text-sm text-gray-600 py-2">{timezone}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'schedule' && (
          <div className="space-y-4">
            {/* Mode toggle */}
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-gray-700">Schedule type:</span>
                  <button
                    type="button"
                    onClick={() => setIsMultiDay(false)}
                    className={`px-3 py-1 text-sm rounded-full ${!isMultiDay ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'}`}
                  >
                    Single Day
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMultiDay(true)}
                    className={`px-3 py-1 text-sm rounded-full ${isMultiDay ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'}`}
                  >
                    Multi-Day
                  </button>
                </div>
              </CardContent>
            </Card>

            {!isMultiDay ? (
              /* Legacy single-day editor */
              <Card>
                <CardHeader><CardTitle>Date, Time & Location</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <AddressAutocomplete
                    label="Location"
                    value={legacyLocation}
                    onChange={(val) => { setLegacyLocation(val); setLegacyLatitude(null); setLegacyLongitude(null) }}
                    onPlaceSelect={(place) => { setLegacyLocation(place.address); setLegacyLatitude(place.latitude); setLegacyLongitude(place.longitude) }}
                    helperText={legacyLatitude != null && legacyLongitude != null ? `GPS: ${legacyLatitude.toFixed(4)}, ${legacyLongitude.toFixed(4)}` : undefined}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Input label="Date" type="date" value={legacyDate} onChange={(e) => setLegacyDate(e.target.value)} />
                    <Input label="Start Time" type="time" value={legacyStartTime} onChange={(e) => setLegacyStartTime(e.target.value)} />
                    <Input label="End Time" type="time" value={legacyEndTime} onChange={(e) => setLegacyEndTime(e.target.value)} />
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* Multi-day schedule editor */
              <div className="space-y-4">
                {/* Add day */}
                <Card>
                  <CardContent className="py-4">
                    <div className="flex items-end gap-3">
                      <div className="flex-1">
                        <Input label="Add Date" type="date" value={dateInput} onChange={(e) => setDateInput(e.target.value)} />
                      </div>
                      <Button type="button" size="sm" onClick={addDay} disabled={!dateInput || days.some(d => d.date === dateInput)}>
                        <Plus className="w-4 h-4 mr-1" /> Add Day
                      </Button>
                    </div>

                    {days.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {days.map(d => (
                          <span key={d.id} className="inline-flex items-center gap-1 bg-primary-50 text-primary-700 px-2 py-1 rounded text-sm">
                            <Calendar className="w-3 h-3" /> {formatDate(d.date)}
                            <button type="button" onClick={() => removeDay(d.id)} className="ml-1 text-primary-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                          </span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Day tabs + locations */}
                {days.length > 0 && (
                  <Card>
                    <CardContent className="pt-4">
                      {/* Day tabs */}
                      <div className="flex gap-1 border-b border-gray-200 mb-4 overflow-x-auto">
                        {days.map((d, idx) => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => setActiveDayIdx(idx)}
                            className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 ${
                              idx === activeDayIdx ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500'
                            }`}
                          >
                            {formatDate(d.date)}
                            {d.locations.length > 0 && ` (${d.locations.length})`}
                          </button>
                        ))}
                      </div>

                      {/* Locations for active day */}
                      {activeDay && (
                        <div className="space-y-3">
                          {activeDay.locations.map((loc, idx) => (
                            <div key={loc.id} className="border border-gray-200 rounded-lg p-4">
                              <div className="flex items-start gap-3">
                                <div className="flex flex-col gap-1 pt-6">
                                  <button type="button" onClick={() => reorderLocation(activeDay.id, loc.id, 'up')} disabled={idx === 0} className="p-0.5 text-gray-400 disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
                                  <button type="button" onClick={() => reorderLocation(activeDay.id, loc.id, 'down')} disabled={idx === activeDay.locations.length - 1} className="p-0.5 text-gray-400 disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
                                </div>
                                <div className="flex-1 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-600">Location {idx + 1}</span>
                                    <button type="button" onClick={() => removeLocation(activeDay.id, loc.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                                  </div>
                                  <AddressAutocomplete
                                    label="Address"
                                    value={loc.location}
                                    onChange={(val) => updateLocation(activeDay.id, loc.id, { location: val, latitude: null, longitude: null })}
                                    onPlaceSelect={(place) => updateLocation(activeDay.id, loc.id, { location: place.address, latitude: place.latitude, longitude: place.longitude })}
                                    helperText={loc.latitude != null && loc.longitude != null ? `GPS: ${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}` : undefined}
                                  />
                                  <div className="grid grid-cols-2 gap-3">
                                    <Input label="Start Time" type="time" value={loc.start_time} onChange={(e) => updateLocation(activeDay.id, loc.id, { start_time: e.target.value })} />
                                    <Input label="End Time" type="time" value={loc.end_time} onChange={(e) => updateLocation(activeDay.id, loc.id, { end_time: e.target.value })} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}

                          {activeDay.locations.length === 0 && (
                            <div className="text-center py-6 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                              <MapPin className="w-6 h-6 mx-auto mb-1" />
                              <p className="text-sm">No locations for this day</p>
                            </div>
                          )}

                          <div className="flex gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => addLocation(activeDay.id)}>
                              <Plus className="w-4 h-4 mr-1" /> Add Location
                            </Button>
                            {activeDay.locations.length > 0 && days.length > 1 && (
                              <Button type="button" variant="outline" size="sm" onClick={() => copyLocationsToAllDays(activeDay.id)}>
                                <Copy className="w-4 h-4 mr-1" /> Copy to All Days
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}

        {/* Submit buttons */}
        <div className="flex items-center gap-3 pt-4">
          <Button type="button" variant="outline" onClick={() => router.push('/admin/jobs')} disabled={isSaving}>Cancel</Button>
          <Button type="submit" isLoading={isSaving}>Save Changes</Button>
          <div className="ml-auto">
            <JobActions
              jobId={id}
              jobStatus={status as JobStatus}
              displayStatus={
                isMultiDay
                  ? getMultiDayDisplayStatus({
                      id, title, brand, date: legacyDate || null, start_time: legacyStartTime || null,
                      end_time: legacyEndTime || null, location: legacyLocation || null,
                      pay_rate: parseFloat(payRate) || 0, slots: parseInt(slots) || 0,
                      slots_filled: 0, status, timezone,
                      job_days: days.map(d => ({ id: d.id, job_id: id, date: d.date, sort_order: d.sort_order, created_at: '', job_day_locations: d.locations.map(l => ({ id: l.id, job_day_id: d.id, job_id: id, location: l.location, latitude: l.latitude, longitude: l.longitude, start_time: l.start_time, end_time: l.end_time, sort_order: l.sort_order, created_at: '' })) })),
                    } as JobWithDays)
                  : (status === 'draft' ? 'draft' : status === 'cancelled' ? 'cancelled' : status === 'archived' ? 'archived' : 'completed') as DisplayJobStatus
              }
              jobTitle={title}
              variant="button"
            />
          </div>
        </div>
      </form>
    </div>
  )
}

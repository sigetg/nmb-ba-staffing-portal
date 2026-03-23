'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button, Card, CardContent, CardHeader, CardTitle, Alert, Input, Textarea, Select } from '@/components/ui'
import { ChevronLeft, MapPin, CheckCircle2, LogOut, Camera, Loader2 } from 'lucide-react'
import type { Job, CheckIn, KpiSnapshot, Materials, ScopeOfWork } from '@/types'

const MATERIAL_ITEMS = ['Flyers', 'Branded Hoodie/Jacket', 'Foam Board Signage', 'Other'] as const

export default function CheckOutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [job, setJob] = useState<Job | null>(null)
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // GPS state
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [isGettingLocation, setIsGettingLocation] = useState(false)

  // Photo state
  const [checkOutPhoto, setCheckOutPhoto] = useState<string | null>(null)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)

  // Card 1: KPI Snapshot
  const [kpiSnapshot, setKpiSnapshot] = useState<KpiSnapshot>({
    total_engagements: undefined,
    qr_codes_scanned: undefined,
    customers_walked_in: undefined,
    common_objection: '',
  })

  // Card 2: Schedule Deviations
  const [scheduleDeviation, setScheduleDeviation] = useState<boolean | null>(null)
  const [scheduleDeviationExplanation, setScheduleDeviationExplanation] = useState('')

  // Card 3: Materials Received
  const [materialsConditionAcceptable, setMaterialsConditionAcceptable] = useState<boolean | null>(null)
  const [materialsAllReturned, setMaterialsAllReturned] = useState<boolean | null>(null)
  const [materialItems, setMaterialItems] = useState<string[]>([])
  const [materialOtherDescription, setMaterialOtherDescription] = useState('')

  // Card 4: Scope of Work
  const [scopeOfWork, setScopeOfWork] = useState<ScopeOfWork>({
    canvass_neighborhoods: false,
    engage_pedestrians: false,
    engage_pedestrians_count: undefined,
    distribute_flyers: false,
    distribute_flyers_count: undefined,
    direct_customers: false,
    direct_customers_count: undefined,
    maintain_appearance: false,
  })

  // Card 5: General Notes & Feedback (existing)
  const [checkoutNotes, setCheckoutNotes] = useState('')
  const [checkoutIssues, setCheckoutIssues] = useState('')
  const [customerFeedback, setCustomerFeedback] = useState('')
  const [footTraffic, setFootTraffic] = useState('')

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [id])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }
      setUserId(user.id)

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

      const { data: profile } = await supabase
        .from('ba_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!profile) {
        setError('Profile not found')
        return
      }
      setProfileId(profile.id)

      const { data: checkInData } = await supabase
        .from('check_ins')
        .select('*')
        .eq('job_id', id)
        .eq('ba_id', profile.id)
        .single()

      if (!checkInData) {
        router.push(`/dashboard/jobs/${id}/check-in`)
        return
      }

      if (checkInData.check_out_time) {
        setError('You have already checked out from this job')
      }

      setCheckIn(checkInData)
    } catch {
      setError('Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }

  const getLocation = () => {
    setIsGettingLocation(true)
    setLocationError(null)

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser')
      setIsGettingLocation(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
        setIsGettingLocation(false)
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError('Location permission denied.')
            break
          case error.POSITION_UNAVAILABLE:
            setLocationError('Location information is unavailable.')
            break
          case error.TIMEOUT:
            setLocationError('Location request timed out.')
            break
          default:
            setLocationError('An unknown error occurred.')
        }
        setIsGettingLocation(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId || !profileId) return

    setIsUploadingPhoto(true)
    setError(null)

    try {
      const ext = file.name.split('.').pop()
      const filePath = `${userId}/${id}/check_out-${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('job-photos')
        .upload(filePath, file)

      if (uploadError) {
        setError(uploadError.message)
        return
      }

      const { data: { publicUrl } } = supabase.storage
        .from('job-photos')
        .getPublicUrl(filePath)

      const { error: insertError } = await supabase.from('job_photos').insert({
        job_id: id,
        ba_id: profileId,
        url: publicUrl,
        photo_type: 'check_out',
      })

      if (insertError) {
        setError(insertError.message)
        return
      }

      setCheckOutPhoto(publicUrl)
    } catch {
      setError('Failed to upload photo')
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  const handleCheckOut = async () => {
    if (!location || !checkIn || !checkOutPhoto || !checkoutNotes.trim()) return

    setError(null)
    setIsCheckingOut(true)

    try {
      const kpiData: KpiSnapshot = {
        total_engagements: kpiSnapshot.total_engagements,
        qr_codes_scanned: kpiSnapshot.qr_codes_scanned,
        customers_walked_in: kpiSnapshot.customers_walked_in,
        common_objection: kpiSnapshot.common_objection?.trim() || undefined,
      }

      const materialsData: Materials = {
        condition_acceptable: materialsConditionAcceptable ?? undefined,
        all_returned: materialsAllReturned ?? undefined,
        items: materialItems.length > 0 ? materialItems : undefined,
        other_description: materialOtherDescription.trim() || undefined,
      }

      const { error: updateError } = await supabase
        .from('check_ins')
        .update({
          check_out_time: new Date().toISOString(),
          check_out_latitude: location.latitude,
          check_out_longitude: location.longitude,
          checkout_notes: checkoutNotes.trim(),
          checkout_issues: checkoutIssues.trim() || null,
          checkout_customer_feedback: customerFeedback.trim() || null,
          checkout_foot_traffic: footTraffic || null,
          kpi_snapshot: kpiData,
          schedule_deviation: scheduleDeviation,
          schedule_deviation_explanation: scheduleDeviation ? scheduleDeviationExplanation.trim() || null : null,
          materials: materialsData,
          scope_of_work: scopeOfWork,
        })
        .eq('id', checkIn.id)

      if (updateError) {
        setError(updateError.message)
        return
      }

      const checkInTime = new Date(checkIn.check_in_time)
      const checkOutTime = new Date()
      const hoursWorked = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)

      setSuccess(`Checked out successfully! You worked ${hoursWorked.toFixed(2)} hours.`)
      setTimeout(() => {
        router.push('/dashboard/my-jobs')
      }, 2000)
    } catch {
      setError('Failed to check out')
    } finally {
      setIsCheckingOut(false)
    }
  }

  const getTimeWorked = () => {
    if (!checkIn) return null
    const checkInTime = new Date(checkIn.check_in_time)
    const now = new Date()
    const diff = now.getTime() - checkInTime.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return { hours, minutes }
  }

  const toggleMaterialItem = (item: string) => {
    setMaterialItems(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    )
  }

  const timeWorked = getTimeWorked()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400" />
      </div>
    )
  }

  if (!job || !checkIn) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">
          {error || 'Unable to load check-out page'}
        </h2>
        <Link href="/dashboard/my-jobs" className="text-primary-400 hover:text-primary-500 mt-2 inline-block">
          Back to my jobs
        </Link>
      </div>
    )
  }

  const alreadyCheckedOut = !!checkIn.check_out_time

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/dashboard/jobs/${id}/active`}
          className="p-2 rounded-lg hover:bg-gray-100"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-heading">Check Out</h1>
      </div>

      {error && (
        <Alert variant="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert variant="success">
          {success}
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
            <p className="text-sm text-primary-400">{job.location}</p>
          </div>
        </CardContent>
      </Card>

      {/* Shift Duration */}
      <Card>
        <CardHeader>
          <CardTitle>Shift Duration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-sm text-primary-400 mb-2">
              Checked in at {new Date(checkIn.check_in_time).toLocaleTimeString()}
            </p>
            {timeWorked && !alreadyCheckedOut && (
              <div className="text-4xl font-bold text-gray-900">
                {timeWorked.hours}h {timeWorked.minutes}m
              </div>
            )}
            {alreadyCheckedOut && checkIn.check_out_time && (
              <div>
                <p className="text-sm text-primary-400">
                  Checked out at {new Date(checkIn.check_out_time).toLocaleTimeString()}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {!alreadyCheckedOut && (
        <>
          {/* GPS Location */}
          <Card>
            <CardHeader>
              <CardTitle>Your Location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {locationError && (
                <Alert variant="error">
                  {locationError}
                </Alert>
              )}

              {!location ? (
                <div className="text-center py-4">
                  <p className="text-primary-400 mb-4">
                    Get your current location to check out.
                  </p>
                  <Button
                    onClick={getLocation}
                    isLoading={isGettingLocation}
                    className="gap-2"
                  >
                    <MapPin className="w-5 h-5" />
                    Get My Location
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-lg flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="text-green-800">Location captured</span>
                  </div>

                  <Button
                    variant="outline"
                    onClick={getLocation}
                    isLoading={isGettingLocation}
                    className="w-full"
                  >
                    Refresh Location
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Checkout Photo */}
          <Card>
            <CardHeader>
              <CardTitle>Checkout Photo (Required)</CardTitle>
            </CardHeader>
            <CardContent>
              {checkOutPhoto ? (
                <div className="flex items-center gap-4">
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                    <Image src={checkOutPhoto} alt="Check-out photo" fill className="object-cover" />
                  </div>
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">Photo uploaded</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-primary-400 mb-4 text-sm">
                    Take a photo to document the end of your shift.
                  </p>
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-primary-400 text-white rounded-lg hover:bg-primary-500 cursor-pointer transition-colors">
                    {isUploadingPhoto ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Camera className="w-5 h-5" />
                    )}
                    {isUploadingPhoto ? 'Uploading...' : 'Take Photo'}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoUpload}
                      className="hidden"
                      disabled={isUploadingPhoto || !userId || !profileId}
                    />
                  </label>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 1: KPI Snapshot */}
          <Card>
            <CardHeader>
              <CardTitle>KPI Snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Total Engagements"
                type="number"
                min={0}
                value={kpiSnapshot.total_engagements ?? ''}
                onChange={(e) => setKpiSnapshot(prev => ({
                  ...prev,
                  total_engagements: e.target.value ? Number(e.target.value) : undefined,
                }))}
                placeholder="0"
              />
              <Input
                label="QR Codes Scanned"
                type="number"
                min={0}
                value={kpiSnapshot.qr_codes_scanned ?? ''}
                onChange={(e) => setKpiSnapshot(prev => ({
                  ...prev,
                  qr_codes_scanned: e.target.value ? Number(e.target.value) : undefined,
                }))}
                placeholder="0"
              />
              <Input
                label="Customers Walked Into Store"
                type="number"
                min={0}
                value={kpiSnapshot.customers_walked_in ?? ''}
                onChange={(e) => setKpiSnapshot(prev => ({
                  ...prev,
                  customers_walked_in: e.target.value ? Number(e.target.value) : undefined,
                }))}
                placeholder="0"
              />
              <Input
                label="Most Common Objection Heard"
                type="text"
                value={kpiSnapshot.common_objection ?? ''}
                onChange={(e) => setKpiSnapshot(prev => ({
                  ...prev,
                  common_objection: e.target.value,
                }))}
                placeholder="e.g. Not interested, already a customer..."
              />
            </CardContent>
          </Card>

          {/* Card 2: Schedule Deviations */}
          <Card>
            <CardHeader>
              <CardTitle>Schedule Deviations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-primary-400">Were there any deviations from the planned schedule?</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setScheduleDeviation(true)}
                  className={`flex-1 py-2.5 px-4 rounded-lg border-2 font-medium transition-colors ${
                    scheduleDeviation === true
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScheduleDeviation(false)
                    setScheduleDeviationExplanation('')
                  }}
                  className={`flex-1 py-2.5 px-4 rounded-lg border-2 font-medium transition-colors ${
                    scheduleDeviation === false
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  No
                </button>
              </div>
              {scheduleDeviation && (
                <Textarea
                  label="Explain the deviation"
                  value={scheduleDeviationExplanation}
                  onChange={(e) => setScheduleDeviationExplanation(e.target.value)}
                  placeholder="Describe what changed and why..."
                  rows={3}
                />
              )}
            </CardContent>
          </Card>

          {/* Card 3: Materials Received */}
          <Card>
            <CardHeader>
              <CardTitle>Materials Received</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Was the condition of materials acceptable?</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setMaterialsConditionAcceptable(true)}
                    className={`flex-1 py-2.5 px-4 rounded-lg border-2 font-medium transition-colors ${
                      materialsConditionAcceptable === true
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setMaterialsConditionAcceptable(false)}
                    className={`flex-1 py-2.5 px-4 rounded-lg border-2 font-medium transition-colors ${
                      materialsConditionAcceptable === false
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Were all materials returned?</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setMaterialsAllReturned(true)}
                    className={`flex-1 py-2.5 px-4 rounded-lg border-2 font-medium transition-colors ${
                      materialsAllReturned === true
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setMaterialsAllReturned(false)}
                    className={`flex-1 py-2.5 px-4 rounded-lg border-2 font-medium transition-colors ${
                      materialsAllReturned === false
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Materials used</p>
                <div className="space-y-2">
                  {MATERIAL_ITEMS.map((item) => (
                    <label key={item} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={materialItems.includes(item)}
                        onChange={() => toggleMaterialItem(item)}
                        className="w-4 h-4 rounded border-gray-300 text-primary-400 focus:ring-primary-400"
                      />
                      <span className="text-sm text-gray-700">{item}</span>
                    </label>
                  ))}
                </div>
              </div>

              {materialItems.includes('Other') && (
                <Input
                  label="Other material description"
                  type="text"
                  value={materialOtherDescription}
                  onChange={(e) => setMaterialOtherDescription(e.target.value)}
                  placeholder="Describe other materials..."
                />
              )}
            </CardContent>
          </Card>

          {/* Card 4: Scope of Work */}
          <Card>
            <CardHeader>
              <CardTitle>Scope of Work</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scopeOfWork.canvass_neighborhoods}
                  onChange={(e) => setScopeOfWork(prev => ({ ...prev, canvass_neighborhoods: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-primary-400 focus:ring-primary-400"
                />
                <span className="text-sm text-gray-700">Canvass neighborhoods</span>
              </label>

              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scopeOfWork.engage_pedestrians}
                    onChange={(e) => setScopeOfWork(prev => ({
                      ...prev,
                      engage_pedestrians: e.target.checked,
                      engage_pedestrians_count: e.target.checked ? prev.engage_pedestrians_count : undefined,
                    }))}
                    className="w-4 h-4 rounded border-gray-300 text-primary-400 focus:ring-primary-400"
                  />
                  <span className="text-sm text-gray-700">Engage pedestrians</span>
                </label>
                {scopeOfWork.engage_pedestrians && (
                  <div className="ml-7">
                    <Input
                      type="number"
                      min={0}
                      value={scopeOfWork.engage_pedestrians_count ?? ''}
                      onChange={(e) => setScopeOfWork(prev => ({
                        ...prev,
                        engage_pedestrians_count: e.target.value ? Number(e.target.value) : undefined,
                      }))}
                      placeholder="How many?"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scopeOfWork.distribute_flyers}
                    onChange={(e) => setScopeOfWork(prev => ({
                      ...prev,
                      distribute_flyers: e.target.checked,
                      distribute_flyers_count: e.target.checked ? prev.distribute_flyers_count : undefined,
                    }))}
                    className="w-4 h-4 rounded border-gray-300 text-primary-400 focus:ring-primary-400"
                  />
                  <span className="text-sm text-gray-700">Distribute flyers</span>
                </label>
                {scopeOfWork.distribute_flyers && (
                  <div className="ml-7">
                    <Input
                      type="number"
                      min={0}
                      value={scopeOfWork.distribute_flyers_count ?? ''}
                      onChange={(e) => setScopeOfWork(prev => ({
                        ...prev,
                        distribute_flyers_count: e.target.value ? Number(e.target.value) : undefined,
                      }))}
                      placeholder="How many?"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scopeOfWork.direct_customers}
                    onChange={(e) => setScopeOfWork(prev => ({
                      ...prev,
                      direct_customers: e.target.checked,
                      direct_customers_count: e.target.checked ? prev.direct_customers_count : undefined,
                    }))}
                    className="w-4 h-4 rounded border-gray-300 text-primary-400 focus:ring-primary-400"
                  />
                  <span className="text-sm text-gray-700">Direct customers to store</span>
                </label>
                {scopeOfWork.direct_customers && (
                  <div className="ml-7">
                    <Input
                      type="number"
                      min={0}
                      value={scopeOfWork.direct_customers_count ?? ''}
                      onChange={(e) => setScopeOfWork(prev => ({
                        ...prev,
                        direct_customers_count: e.target.value ? Number(e.target.value) : undefined,
                      }))}
                      placeholder="How many?"
                    />
                  </div>
                )}
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scopeOfWork.maintain_appearance}
                  onChange={(e) => setScopeOfWork(prev => ({ ...prev, maintain_appearance: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-primary-400 focus:ring-primary-400"
                />
                <span className="text-sm text-gray-700">Maintain appearance / setup</span>
              </label>
            </CardContent>
          </Card>

          {/* Card 5: General Notes & Feedback */}
          <Card>
            <CardHeader>
              <CardTitle>General Notes & Feedback</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                label="General Notes (Required)"
                value={checkoutNotes}
                onChange={(e) => setCheckoutNotes(e.target.value)}
                placeholder="Summarize your shift..."
                rows={3}
              />

              <Textarea
                label="Issues / Highlights (Optional)"
                value={checkoutIssues}
                onChange={(e) => setCheckoutIssues(e.target.value)}
                placeholder="Any issues encountered or highlights..."
                rows={2}
              />

              <Textarea
                label="Customer Feedback Summary (Optional)"
                value={customerFeedback}
                onChange={(e) => setCustomerFeedback(e.target.value)}
                placeholder="Any notable customer feedback..."
                rows={2}
              />

              <Select
                label="Foot Traffic Estimate (Optional)"
                value={footTraffic}
                onChange={(e) => setFootTraffic(e.target.value)}
                placeholder="Select foot traffic level"
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                  { value: 'very_high', label: 'Very High' },
                ]}
              />
            </CardContent>
          </Card>

          {/* Check Out Button */}
          <Button
            onClick={handleCheckOut}
            isLoading={isCheckingOut}
            disabled={!location || !checkOutPhoto || !checkoutNotes.trim()}
            variant="destructive"
            className="w-full py-4 text-lg bg-orange-600 hover:bg-orange-700"
          >
            <LogOut className="w-6 h-6 mr-2" />
            Confirm Check Out
          </Button>
        </>
      )}
    </div>
  )
}

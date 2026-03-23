'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button, Input, Textarea, Select, Card, CardContent, CardHeader, CardTitle, Alert, AddressAutocomplete } from '@/components/ui'
import { ChevronLeft } from 'lucide-react'

const statusOptions = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
]

export default function NewJobPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [title, setTitle] = useState('')
  const [brand, setBrand] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [payRate, setPayRate] = useState('')
  const [slots, setSlots] = useState('')
  const [worksheetUrl, setWorksheetUrl] = useState('')
  const [status, setStatus] = useState('draft')

  const router = useRouter()
  const supabase = createClient()

  const validateForm = () => {
    if (!title.trim()) {
      setError('Title is required')
      return false
    }
    if (!brand.trim()) {
      setError('Brand is required')
      return false
    }
    if (!location.trim()) {
      setError('Location is required')
      return false
    }
    if (!date) {
      setError('Date is required')
      return false
    }
    if (!startTime) {
      setError('Start time is required')
      return false
    }
    if (!endTime) {
      setError('End time is required')
      return false
    }
    if (!payRate || parseFloat(payRate) <= 0) {
      setError('Pay rate must be greater than 0')
      return false
    }
    if (!slots || parseInt(slots) <= 0) {
      setError('Slots must be greater than 0')
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!validateForm()) return

    setIsLoading(true)

    try {
      const { error: insertError } = await supabase.from('jobs').insert({
        title: title.trim(),
        brand: brand.trim(),
        description: description.trim(),
        location: location.trim(),
        latitude,
        longitude,
        date,
        start_time: startTime,
        end_time: endTime,
        pay_rate: parseFloat(payRate),
        slots: parseInt(slots),
        slots_filled: 0,
        worksheet_url: worksheetUrl.trim() || null,
        status,
        timezone: 'America/Chicago',
      })

      if (insertError) {
        setError(insertError.message)
        return
      }

      router.push('/admin/jobs')
    } catch {
      setError('Failed to create job')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/jobs"
          className="p-2 rounded-lg hover:bg-gray-100"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-heading">Create New Job</h1>
      </div>

      {error && (
        <Alert variant="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Job Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Job Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Brand Ambassador - Product Demo"
              />
              <Input
                label="Brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g., Nike, Apple"
              />
            </div>

            <Textarea
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Job description, requirements, and expectations..."
              rows={4}
            />

            {/* Location */}
            <AddressAutocomplete
              label="Location"
              value={location}
              onChange={(val) => {
                setLocation(val)
                setLatitude(null)
                setLongitude(null)
              }}
              onPlaceSelect={(place) => {
                setLocation(place.address)
                setLatitude(place.latitude)
                setLongitude(place.longitude)
              }}
              placeholder="e.g., 123 Main St, New York, NY 10001"
              helperText={
                latitude !== null && longitude !== null
                  ? `Coordinates: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
                  : 'Select an address from suggestions to set coordinates'
              }
            />

            {/* Date and Time */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <Input
                label="Start Time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
              <Input
                label="End Time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>

            {/* Pay and Slots */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Pay Rate ($/hr)"
                type="number"
                step="0.01"
                min="0"
                value={payRate}
                onChange={(e) => setPayRate(e.target.value)}
                placeholder="e.g., 25.00"
              />
              <Input
                label="Available Slots"
                type="number"
                min="1"
                value={slots}
                onChange={(e) => setSlots(e.target.value)}
                placeholder="e.g., 5"
              />
            </div>

            {/* Additional */}
            <Input
              label="Worksheet URL (optional)"
              type="url"
              value={worksheetUrl}
              onChange={(e) => setWorksheetUrl(e.target.value)}
              placeholder="https://docs.google.com/..."
            />

            <Select
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={statusOptions}
            />

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/admin/jobs')}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={isLoading}>
                Create Job
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

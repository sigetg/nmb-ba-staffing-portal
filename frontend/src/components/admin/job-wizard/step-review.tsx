'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useWizard } from './wizard-context'
import { Card, CardContent } from '@/components/ui'
import { Calendar, MapPin, Clock, DollarSign, Users, Tag } from 'lucide-react'

export function StepReview() {
  const { state } = useWizard()
  const [typeName, setTypeName] = useState('')

  useEffect(() => {
    if (!state.jobTypeId) return
    const supabase = createClient()
    supabase
      .from('job_types')
      .select('name')
      .eq('id', state.jobTypeId)
      .single()
      .then(({ data }) => setTypeName(data?.name || ''))
  }, [state.jobTypeId])

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }

  const formatTime = (time: string) => {
    const [h, m] = time.split(':')
    const hour = parseInt(h)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${h12}:${m} ${ampm}`
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-heading">Review Job</h2>
        <p className="text-sm text-gray-500">Review all details before creating the job.</p>
      </div>

      {/* Basic Info */}
      <Card>
        <CardContent className="pt-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{state.title || 'Untitled Job'}</h3>
            </div>
            <p className="text-sm text-gray-600">{state.brand}</p>
            {state.description && (
              <p className="text-sm text-gray-500 mt-2">{state.description}</p>
            )}
            <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
              {typeName && (
                <span className="flex items-center gap-1">
                  <Tag className="w-4 h-4" />{typeName}
                </span>
              )}
              <span className="flex items-center gap-1">
                <DollarSign className="w-4 h-4" />${state.payRate}/hr
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />{state.slots} slot{parseInt(state.slots) !== 1 ? 's' : ''}
              </span>
            </div>
            {state.worksheetFile && (
              <p className="text-sm text-primary-500 mt-2">
                Worksheet: {state.worksheetFile.name}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Schedule */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Schedule ({state.days.length} day{state.days.length !== 1 ? 's' : ''})
        </h3>

        {state.days.map((day) => (
          <Card key={day.id}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-primary-500" />
                <span className="font-medium">{formatDate(day.date)}</span>
              </div>

              <div className="space-y-2 pl-6">
                {day.locations.map((loc, idx) => (
                  <div key={loc.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                    <span className="w-5 h-5 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-xs font-medium shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        <span>{loc.location}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>{formatTime(loc.start_time)} - {formatTime(loc.end_time)}</span>
                      </div>
                      {loc.latitude != null && loc.longitude != null && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          GPS: {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

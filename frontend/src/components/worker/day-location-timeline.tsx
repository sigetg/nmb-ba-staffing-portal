'use client'

import type { JobDayLocation, LocationCheckIn } from '@/types'
import { MapPin, CheckCircle2, Clock, SkipForward, Circle } from 'lucide-react'

interface Props {
  locations: JobDayLocation[]
  checkIns: LocationCheckIn[]
  currentLocationId?: string
}

function formatTime(time: string) {
  const [h, m] = time.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${h12}:${m} ${ampm}`
}

export function DayLocationTimeline({ locations, checkIns, currentLocationId }: Props) {
  return (
    <div className="space-y-0">
      {locations.map((loc, idx) => {
        const ci = checkIns.find(c => c.job_day_location_id === loc.id)
        const isActive = loc.id === currentLocationId && ci && !ci.check_out_time
        const isCompleted = ci && (ci.check_out_time || ci.skipped)
        const isSkipped = ci?.skipped
        const isPending = !ci

        return (
          <div key={loc.id} className="flex items-start gap-3">
            {/* Vertical line + icon */}
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                isActive ? 'bg-green-500 text-white' :
                isCompleted ? (isSkipped ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600') :
                'bg-gray-100 text-gray-400'
              }`}>
                {isSkipped ? <SkipForward className="w-3.5 h-3.5" /> :
                 isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                 isActive ? <Clock className="w-3.5 h-3.5 animate-pulse" /> :
                 <Circle className="w-3.5 h-3.5" />}
              </div>
              {idx < locations.length - 1 && (
                <div className={`w-0.5 h-8 ${isCompleted ? 'bg-green-200' : 'bg-gray-200'}`} />
              )}
            </div>

            {/* Content */}
            <div className={`pb-4 ${isActive ? 'font-medium' : ''}`}>
              <div className="flex items-center gap-1 text-sm">
                <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className={isActive ? 'text-green-700' : 'text-gray-700'}>{loc.location}</span>
              </div>
              <p className="text-xs text-gray-500 ml-5">
                {formatTime(loc.start_time)} - {formatTime(loc.end_time)}
                {isSkipped && <span className="ml-2 text-amber-500">(Skipped)</span>}
                {isActive && <span className="ml-2 text-green-600">(Active)</span>}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

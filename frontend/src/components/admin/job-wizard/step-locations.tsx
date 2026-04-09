'use client'

import { useState } from 'react'
import { useWizard } from './wizard-context'
import { DayLocationForm } from './day-location-form'
import { Button } from '@/components/ui'
import { Plus, Copy, MapPin } from 'lucide-react'

export function StepLocations() {
  const { state, addLocation, copyLocationsToAllDays, copyLocationsToSpecificDays } = useWizard()
  const [activeDayIdx, setActiveDayIdx] = useState(0)
  const [showCopyMenu, setShowCopyMenu] = useState(false)
  const [copyTargets, setCopyTargets] = useState<string[]>([])

  const activeDay = state.days[activeDayIdx]

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  if (!activeDay) return null

  const otherDays = state.days.filter(d => d.id !== activeDay.id)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-heading">Locations Per Day</h2>
        <p className="text-sm text-gray-500">Add locations to each day. Workers visit them in order.</p>
      </div>

      {/* Day tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {state.days.map((day, idx) => {
          const hasLocations = day.locations.length > 0
          const allValid = hasLocations && day.locations.every(l => l.location.trim() && l.start_time && l.end_time)
          return (
            <button
              key={day.id}
              type="button"
              onClick={() => setActiveDayIdx(idx)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
                ${idx === activeDayIdx
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                }
              `}
            >
              {formatDate(day.date)}
              {allValid && <span className="ml-1 text-green-500">&#10003;</span>}
              {hasLocations && !allValid && <span className="ml-1 text-amber-500">&#9679;</span>}
              {!hasLocations && <span className="ml-1 text-red-400">&#9679;</span>}
            </button>
          )
        })}
      </div>

      {/* Locations for active day */}
      <div className="space-y-3">
        {activeDay.locations.length === 0 && (
          <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
            <MapPin className="w-8 h-8 mx-auto mb-2" />
            <p>No locations added for this day</p>
          </div>
        )}

        {activeDay.locations.map((loc, idx) => (
          <DayLocationForm
            key={loc.id}
            dayId={activeDay.id}
            location={loc}
            index={idx}
            totalLocations={activeDay.locations.length}
          />
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addLocation(activeDay.id)}
        >
          <Plus className="w-4 h-4 mr-1" /> Add Location
        </Button>

        {activeDay.locations.length > 0 && otherDays.length > 0 && (
          <div className="relative">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCopyMenu(!showCopyMenu)}
            >
              <Copy className="w-4 h-4 mr-1" /> Copy Locations
            </Button>

            {showCopyMenu && (
              <div className="absolute z-10 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                <button
                  type="button"
                  className="w-full px-4 py-2 text-sm text-left hover:bg-gray-50"
                  onClick={() => {
                    copyLocationsToAllDays(activeDay.id)
                    setShowCopyMenu(false)
                  }}
                >
                  Copy to all other days
                </button>
                <div className="border-t border-gray-100 mt-1 pt-1">
                  <p className="px-4 py-1 text-xs text-gray-400 font-medium">Copy to specific days:</p>
                  {otherDays.map(d => (
                    <label key={d.id} className="flex items-center px-4 py-1.5 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mr-2 rounded"
                        checked={copyTargets.includes(d.id)}
                        onChange={(e) => {
                          setCopyTargets(prev =>
                            e.target.checked
                              ? [...prev, d.id]
                              : prev.filter(id => id !== d.id)
                          )
                        }}
                      />
                      <span className="text-sm">{formatDate(d.date)}</span>
                    </label>
                  ))}
                  {copyTargets.length > 0 && (
                    <div className="px-4 py-2 border-t border-gray-100">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          copyLocationsToSpecificDays(activeDay.id, copyTargets)
                          setCopyTargets([])
                          setShowCopyMenu(false)
                        }}
                      >
                        Copy to {copyTargets.length} day{copyTargets.length !== 1 ? 's' : ''}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

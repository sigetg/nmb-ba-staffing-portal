'use client'

import { useWizard, LocationData } from './wizard-context'
import { Input, AddressAutocomplete } from '@/components/ui'
import { Trash2, ChevronUp, ChevronDown, GripVertical } from 'lucide-react'

interface DayLocationFormProps {
  dayId: string
  location: LocationData
  index: number
  totalLocations: number
}

export function DayLocationForm({ dayId, location, index, totalLocations }: DayLocationFormProps) {
  const { updateLocation, removeLocation, reorderLocation } = useWizard()

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-start gap-3">
        {/* Reorder controls */}
        <div className="flex flex-col items-center gap-1 pt-6">
          <GripVertical className="w-4 h-4 text-gray-300" />
          <button
            type="button"
            onClick={() => reorderLocation(dayId, location.id, 'up')}
            disabled={index === 0}
            className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => reorderLocation(dayId, location.id, 'down')}
            disabled={index === totalLocations - 1}
            className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        {/* Location fields */}
        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Location {index + 1}</span>
            <button
              type="button"
              onClick={() => removeLocation(dayId, location.id)}
              className="text-gray-400 hover:text-red-500"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <AddressAutocomplete
            label="Address"
            value={location.location}
            onChange={(val) => updateLocation(dayId, location.id, { location: val, latitude: null, longitude: null })}
            onPlaceSelect={(place) => updateLocation(dayId, location.id, {
              location: place.address,
              latitude: place.latitude,
              longitude: place.longitude,
            })}
            placeholder="Start typing an address..."
            helperText={
              location.latitude != null && location.longitude != null
                ? `GPS: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
                : undefined
            }
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start Time"
              type="time"
              value={location.start_time}
              onChange={(e) => updateLocation(dayId, location.id, { start_time: e.target.value })}
            />
            <Input
              label="End Time"
              type="time"
              value={location.end_time}
              onChange={(e) => updateLocation(dayId, location.id, { end_time: e.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

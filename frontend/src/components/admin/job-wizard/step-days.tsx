'use client'

import { useState } from 'react'
import { useWizard } from './wizard-context'
import { Button, Input } from '@/components/ui'
import { Plus, X, Calendar } from 'lucide-react'

export function StepDays() {
  const { state, addDay, removeDay } = useWizard()
  const [dateInput, setDateInput] = useState('')
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')

  const handleAddDate = () => {
    if (!dateInput) return
    addDay(dateInput)
    setDateInput('')
  }

  const handleAddRange = () => {
    if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) return
    const current = new Date(rangeStart + 'T00:00:00')
    const end = new Date(rangeEnd + 'T00:00:00')
    while (current <= end) {
      const yyyy = current.getFullYear()
      const mm = String(current.getMonth() + 1).padStart(2, '0')
      const dd = String(current.getDate()).padStart(2, '0')
      addDay(`${yyyy}-${mm}-${dd}`)
      current.setDate(current.getDate() + 1)
    }
    setRangeStart('')
    setRangeEnd('')
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  }

  const rangeDisabled = !rangeStart || !rangeEnd || rangeStart > rangeEnd

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-heading">Select Dates</h2>
        <p className="text-sm text-gray-500">Pick individual dates or a date range. At least 1 date required.</p>
      </div>

      {/* Single date */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Input
            label="Add Date"
            type="date"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
          />
        </div>
        <Button
          type="button"
          onClick={handleAddDate}
          disabled={!dateInput || state.days.some(d => d.date === dateInput)}
          size="sm"
        >
          <Plus className="w-4 h-4 mr-1" /> Add
        </Button>
      </div>

      {/* Date range */}
      <div className="border border-gray-200 rounded-lg p-4 space-y-3">
        <p className="text-sm font-medium text-gray-700">Add Date Range</p>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Input
              label="Start"
              type="date"
              value={rangeStart}
              onChange={(e) => setRangeStart(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <Input
              label="End"
              type="date"
              value={rangeEnd}
              onChange={(e) => setRangeEnd(e.target.value)}
            />
          </div>
          <Button
            type="button"
            onClick={handleAddRange}
            disabled={rangeDisabled}
            size="sm"
          >
            <Plus className="w-4 h-4 mr-1" /> Add Range
          </Button>
        </div>
      </div>

      {state.days.length === 0 && (
        <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
          <Calendar className="w-8 h-8 mx-auto mb-2" />
          <p>No dates selected yet</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {state.days.map((day) => (
          <div
            key={day.id}
            className="inline-flex items-center gap-2 bg-primary-50 text-primary-700 px-3 py-2 rounded-lg border border-primary-200"
          >
            <Calendar className="w-4 h-4" />
            <span className="text-sm font-medium">{formatDate(day.date)}</span>
            <button
              type="button"
              onClick={() => removeDay(day.id)}
              className="ml-1 text-primary-400 hover:text-primary-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {state.days.length > 0 && (
        <p className="text-sm text-gray-500">
          {state.days.length} day{state.days.length !== 1 ? 's' : ''} selected
        </p>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useWizard } from './wizard-context'
import { Input, Textarea } from '@/components/ui'
import { FileText } from 'lucide-react'
import type { JobType } from '@/types'

export function StepBasicInfo() {
  const { state, setField } = useWizard()
  const [jobTypes, setJobTypes] = useState<JobType[]>([])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('job_types')
      .select('id, name')
      .eq('is_archived', false)
      .order('sort_order')
      .then(({ data }) => setJobTypes(data || []))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-heading">Basic Information</h2>
        <p className="text-sm text-gray-500">Enter the core job details.</p>
      </div>

      {/* Job Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Job Type</label>
        <select
          value={state.jobTypeId}
          onChange={(e) => setField('jobTypeId', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
        >
          <option value="">Select a job type...</option>
          {jobTypes.map((jt) => (
            <option key={jt.id} value={jt.id}>{jt.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Job Title"
          value={state.title}
          onChange={(e) => setField('title', e.target.value)}
          placeholder="e.g., Brand Ambassador - Product Demo"
        />
        <Input
          label="Brand"
          value={state.brand}
          onChange={(e) => setField('brand', e.target.value)}
          placeholder="e.g., Nike, Apple"
        />
      </div>

      <Textarea
        label="Description"
        value={state.description}
        onChange={(e) => setField('description', e.target.value)}
        placeholder="Job description, requirements, and expectations..."
        rows={4}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Pay Rate ($/hr)"
          type="number"
          step="0.01"
          min="0"
          value={state.payRate}
          onChange={(e) => setField('payRate', e.target.value)}
          placeholder="e.g., 25.00"
        />
        <Input
          label="Available Slots"
          type="number"
          min="1"
          value={state.slots}
          onChange={(e) => setField('slots', e.target.value)}
          placeholder="e.g., 5"
        />
      </div>

      {/* Worksheet Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Worksheet (optional, PDF)
        </label>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
          {state.worksheetFile ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary-400" />
                <span className="text-sm text-gray-900">{state.worksheetFile.name}</span>
                <span className="text-xs text-gray-500">
                  ({(state.worksheetFile.size / (1024 * 1024)).toFixed(1)} MB)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer text-sm text-primary-400 hover:text-primary-500">
                  Replace
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      if (file.type !== 'application/pdf') return
                      if (file.size > 10 * 1024 * 1024) return
                      setField('worksheetFile', file)
                    }}
                    className="hidden"
                  />
                </label>
                <button type="button" onClick={() => setField('worksheetFile', null)} className="text-sm text-red-500 hover:text-red-600">
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <label className="cursor-pointer">
              <FileText className="w-8 h-8 mx-auto text-gray-300 mb-1" />
              <span className="text-sm text-primary-400 hover:text-primary-500">Choose PDF file</span>
              <p className="text-xs text-gray-400 mt-1">PDF, up to 10MB</p>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  if (file.type !== 'application/pdf') return
                  if (file.size > 10 * 1024 * 1024) return
                  setField('worksheetFile', file)
                }}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>

    </div>
  )
}

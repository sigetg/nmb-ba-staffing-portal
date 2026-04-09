'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { JobType, JobTypeKpi, JobTypeQuestion } from '@/types'

export interface CheckoutResponseValueData {
  kpi_id?: string | null
  question_id?: string | null
  numeric_value?: number | null
  text_value?: string | null
  option_id?: string | null
}

interface DynamicCheckoutFormProps {
  jobType: JobType
  values: CheckoutResponseValueData[]
  onChange: (values: CheckoutResponseValueData[]) => void
}

export function DynamicCheckoutForm({ jobType, values, onChange }: DynamicCheckoutFormProps) {
  const kpis = jobType.job_type_kpis || []
  const questions = jobType.job_type_questions || []

  function getKpiValue(kpiId: string): string {
    const v = values.find((v) => v.kpi_id === kpiId)
    return v?.numeric_value != null ? String(v.numeric_value) : ''
  }

  function setKpiValue(kpiId: string, val: string) {
    const num = val === '' ? null : parseFloat(val)
    const existing = values.filter((v) => v.kpi_id !== kpiId)
    if (num !== null) {
      existing.push({ kpi_id: kpiId, numeric_value: num })
    }
    onChange(existing)
  }

  function getOptionValue(questionId: string): string {
    const v = values.find((v) => v.question_id === questionId && v.option_id)
    return v?.option_id || ''
  }

  function setOptionValue(questionId: string, optionId: string) {
    const existing = values.filter((v) => !(v.question_id === questionId && v.option_id))
    existing.push({ question_id: questionId, option_id: optionId })
    onChange(existing)
  }

  function getTextValue(questionId: string): string {
    const v = values.find((v) => v.question_id === questionId && !v.option_id)
    return v?.text_value || ''
  }

  function setTextValue(questionId: string, text: string) {
    const existing = values.filter((v) => !(v.question_id === questionId && !v.option_id))
    if (text) {
      existing.push({ question_id: questionId, text_value: text })
    }
    onChange(existing)
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      {kpis.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Metrics</h3>
          {kpis.map((kpi) => (
            <div key={kpi.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {kpi.label}
              </label>
              <Input
                type="number"
                min="0"
                value={getKpiValue(kpi.id)}
                onChange={(e) => setKpiValue(kpi.id, e.target.value)}
                placeholder="0"
              />
            </div>
          ))}
        </div>
      )}

      {/* Questions */}
      {questions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Review Questions</h3>
          {questions.map((q) => (
            <div key={q.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {q.question_text}
                {q.is_required && <span className="text-red-500 ml-1">*</span>}
              </label>

              {q.question_type === 'multiple_choice' && q.job_type_question_options && (
                <div className="space-y-2">
                  {q.job_type_question_options.map((opt) => (
                    <label
                      key={opt.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        getOptionValue(q.id) === opt.id
                          ? 'border-primary-400 bg-primary-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        checked={getOptionValue(q.id) === opt.id}
                        onChange={() => setOptionValue(q.id, opt.id)}
                        className="text-primary-500"
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
              )}

              {q.question_type === 'free_text' && (
                <Textarea
                  value={getTextValue(q.id)}
                  onChange={(e) => setTextValue(q.id, e.target.value)}
                  placeholder="Your answer..."
                  rows={3}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

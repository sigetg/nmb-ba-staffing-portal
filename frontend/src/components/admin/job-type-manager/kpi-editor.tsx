'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import type { JobTypeKpi } from '@/types'

interface KpiEditorProps {
  typeId: string
  kpis: JobTypeKpi[]
  onUpdate: () => void
}

export function KpiEditor({ typeId, kpis, onUpdate }: KpiEditorProps) {
  const [newLabel, setNewLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function addKpi() {
    if (!newLabel.trim()) return
    setSaving(true)
    const name = newLabel.trim().toLowerCase().replace(/\s+/g, '_')
    await supabase.from('job_type_kpis').insert({
      job_type_id: typeId,
      name,
      label: newLabel.trim(),
      kpi_type: 'numeric',
      aggregation: 'sum',
      sort_order: kpis.length,
    })
    setNewLabel('')
    setSaving(false)
    onUpdate()
  }

  async function deleteKpi(kpiId: string) {
    await supabase.from('job_type_kpis').delete().eq('id', kpiId)
    onUpdate()
  }

  async function updateAggregation(kpiId: string, aggregation: 'sum' | 'avg') {
    await supabase.from('job_type_kpis').update({ aggregation }).eq('id', kpiId)
    onUpdate()
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-gray-700">KPIs (Numeric Metrics)</h4>

      {kpis.map((kpi) => (
        <div key={kpi.id} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
          <GripVertical className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <span className="flex-1 text-sm">{kpi.label}</span>
          <select
            value={kpi.aggregation}
            onChange={(e) => updateAggregation(kpi.id, e.target.value as 'sum' | 'avg')}
            className="text-xs border rounded px-2 py-1"
          >
            <option value="sum">Sum</option>
            <option value="avg">Average</option>
          </select>
          <button
            onClick={() => deleteKpi(kpi.id)}
            className="text-red-500 hover:text-red-700 p-1"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}

      <div className="flex gap-2">
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="New KPI label..."
          className="flex-1"
          onKeyDown={(e) => e.key === 'Enter' && addKpi()}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={addKpi}
          disabled={!newLabel.trim() || saving}
          leftIcon={<Plus className="h-4 w-4" />}
        >
          Add
        </Button>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Modal, ModalHeader, ModalTitle, ModalContent } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { KpiEditor } from './kpi-editor'
import { QuestionEditor } from './question-editor'
import { JobTypeForm } from './job-type-form'
import { Plus, Archive, Pencil, Check, X } from 'lucide-react'
import type { JobType } from '@/types'

interface JobTypeManagerModalProps {
  isOpen: boolean
  onClose: () => void
}

export function JobTypeManagerModal({ isOpen, onClose }: JobTypeManagerModalProps) {
  const [types, setTypes] = useState<JobType[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchTypes = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('job_types')
      .select('*, job_type_kpis(*), job_type_questions(*, job_type_question_options(*))')
      .eq('is_archived', false)
      .order('sort_order')

    const sorted = (data || []).map((jt: JobType) => {
      if (jt.job_type_kpis) {
        jt.job_type_kpis.sort((a, b) => a.sort_order - b.sort_order)
      }
      if (jt.job_type_questions) {
        jt.job_type_questions.sort((a, b) => a.sort_order - b.sort_order)
        for (const q of jt.job_type_questions) {
          if (q.job_type_question_options) {
            q.job_type_question_options.sort((a, b) => a.sort_order - b.sort_order)
          }
        }
      }
      return jt
    })

    setTypes(sorted)
    setLoading(false)

    // Auto-select first if none selected
    if (!selectedId && sorted.length > 0) {
      setSelectedId(sorted[0].id)
    }
  }, [supabase, selectedId])

  useEffect(() => {
    if (isOpen) fetchTypes()
  }, [isOpen, fetchTypes])

  const selected = types.find((t) => t.id === selectedId)

  function startEditName() {
    if (!selected) return
    setEditName(selected.name)
    setEditDesc(selected.description || '')
    setEditingName(true)
  }

  async function saveNameEdit() {
    if (!selected || !editName.trim()) return
    await supabase
      .from('job_types')
      .update({ name: editName.trim(), description: editDesc.trim() || null })
      .eq('id', selected.id)
    setEditingName(false)
    fetchTypes()
  }

  async function archiveType(id: string) {
    await supabase.from('job_types').update({ is_archived: true }).eq('id', id)
    if (selectedId === id) setSelectedId(null)
    fetchTypes()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalHeader>
        <ModalTitle>Manage Job Types</ModalTitle>
      </ModalHeader>
      <ModalContent className="p-0">
        <div className="flex min-h-[500px]">
          {/* Left sidebar */}
          <div className="w-56 border-r bg-gray-50 p-3 flex flex-col gap-1">
            {loading ? (
              <div className="text-sm text-gray-500 p-2">Loading...</div>
            ) : (
              types.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setSelectedId(t.id); setShowCreateForm(false); setEditingName(false) }}
                  className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedId === t.id
                      ? 'bg-primary-100 text-primary-700 font-medium'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  {t.name}
                </button>
              ))
            )}
            <button
              onClick={() => { setShowCreateForm(true); setSelectedId(null) }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-primary-600 hover:bg-primary-50 rounded-lg mt-1"
            >
              <Plus className="h-4 w-4" />
              New Type
            </button>
          </div>

          {/* Right panel */}
          <div className="flex-1 p-4 overflow-y-auto">
            {showCreateForm ? (
              <JobTypeForm
                onCreated={() => {
                  setShowCreateForm(false)
                  fetchTypes()
                }}
                onCancel={() => setShowCreateForm(false)}
              />
            ) : selected ? (
              <div className="space-y-6">
                {/* Type header */}
                <div>
                  {editingName ? (
                    <div className="space-y-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="font-semibold"
                      />
                      <Textarea
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        placeholder="Description..."
                        rows={2}
                      />
                      <div className="flex gap-1">
                        <button onClick={saveNameEdit} className="text-green-600 hover:text-green-800 p-1">
                          <Check className="h-4 w-4" />
                        </button>
                        <button onClick={() => setEditingName(false)} className="text-gray-400 hover:text-gray-600 p-1">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-heading">{selected.name}</h3>
                        {selected.description && (
                          <p className="text-sm text-gray-500 mt-0.5">{selected.description}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={startEditName}
                          className="text-gray-400 hover:text-gray-600 p-1"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => archiveType(selected.id)}
                          className="text-gray-400 hover:text-red-600 p-1"
                          title="Archive"
                        >
                          <Archive className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* KPIs */}
                <KpiEditor
                  typeId={selected.id}
                  kpis={selected.job_type_kpis || []}
                  onUpdate={fetchTypes}
                />

                {/* Questions */}
                <QuestionEditor
                  typeId={selected.id}
                  questions={selected.job_type_questions || []}
                  onUpdate={fetchTypes}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                Select a job type or create a new one
              </div>
            )}
          </div>
        </div>
      </ModalContent>
    </Modal>
  )
}

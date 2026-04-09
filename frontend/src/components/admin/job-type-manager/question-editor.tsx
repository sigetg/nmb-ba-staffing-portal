'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, GripVertical, X } from 'lucide-react'
import type { JobTypeQuestion } from '@/types'

interface QuestionEditorProps {
  typeId: string
  questions: JobTypeQuestion[]
  onUpdate: () => void
}

export function QuestionEditor({ typeId, questions, onUpdate }: QuestionEditorProps) {
  const [adding, setAdding] = useState(false)
  const [newText, setNewText] = useState('')
  const [newType, setNewType] = useState<'multiple_choice' | 'free_text'>('free_text')
  const [newOptions, setNewOptions] = useState<string[]>([''])
  const [newRequired, setNewRequired] = useState(false)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  function resetForm() {
    setNewText('')
    setNewType('free_text')
    setNewOptions([''])
    setNewRequired(false)
    setAdding(false)
  }

  async function addQuestion() {
    if (!newText.trim()) return
    setSaving(true)

    const insertData: Record<string, unknown> = {
      job_type_id: typeId,
      question_text: newText.trim(),
      question_type: newType,
      is_required: newRequired,
      sort_order: questions.length,
    }

    const { data } = await supabase
      .from('job_type_questions')
      .insert(insertData)
      .select()
      .single()

    if (data && newType === 'multiple_choice') {
      const validOptions = newOptions.filter((o) => o.trim())
      for (let i = 0; i < validOptions.length; i++) {
        await supabase.from('job_type_question_options').insert({
          question_id: data.id,
          label: validOptions[i].trim(),
          sort_order: i,
        })
      }
    }

    setSaving(false)
    resetForm()
    onUpdate()
  }

  async function deleteQuestion(qId: string) {
    await supabase.from('job_type_questions').delete().eq('id', qId)
    onUpdate()
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-gray-700">Review Questions</h4>

      {questions.map((q) => (
        <div key={q.id} className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <GripVertical className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{q.question_text}</span>
                {q.is_required && (
                  <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Required</span>
                )}
              </div>
              <span className="text-xs text-gray-500">
                {q.question_type === 'multiple_choice' ? 'Multiple Choice' : 'Free Text'}
              </span>
              {q.question_type === 'multiple_choice' && q.job_type_question_options && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {q.job_type_question_options.map((opt) => (
                    <span key={opt.id} className="text-xs bg-white border rounded px-2 py-0.5">
                      {opt.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => deleteQuestion(q.id)}
              className="text-red-500 hover:text-red-700 p-1"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}

      {adding ? (
        <div className="border rounded-lg p-3 space-y-3">
          <Input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Question text..."
          />

          <div className="flex items-center gap-4">
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as 'multiple_choice' | 'free_text')}
              className="text-sm border rounded px-2 py-1.5"
            >
              <option value="free_text">Free Text</option>
              <option value="multiple_choice">Multiple Choice</option>
            </select>

            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={newRequired}
                onChange={(e) => setNewRequired(e.target.checked)}
              />
              Required
            </label>
          </div>

          {newType === 'multiple_choice' && (
            <div className="space-y-2">
              <span className="text-xs text-gray-500">Options:</span>
              {newOptions.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={opt}
                    onChange={(e) => {
                      const updated = [...newOptions]
                      updated[i] = e.target.value
                      setNewOptions(updated)
                    }}
                    placeholder={`Option ${i + 1}`}
                    className="flex-1"
                  />
                  {newOptions.length > 1 && (
                    <button
                      onClick={() => setNewOptions(newOptions.filter((_, j) => j !== i))}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setNewOptions([...newOptions, ''])}
                className="text-xs text-primary-500 hover:text-primary-700"
              >
                + Add option
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <Button size="sm" onClick={addQuestion} disabled={!newText.trim() || saving}>
              Save Question
            </Button>
            <Button size="sm" variant="ghost" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAdding(true)}
          leftIcon={<Plus className="h-4 w-4" />}
        >
          Add Question
        </Button>
      )}
    </div>
  )
}

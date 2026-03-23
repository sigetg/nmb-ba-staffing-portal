'use client'

import { Download } from 'lucide-react'

interface ExportCSVButtonProps {
  data: { name: string; phone: string; email: string }[]
  filename: string
}

function escapeCSVField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`
  }
  return field
}

export function ExportCSVButton({ data, filename }: ExportCSVButtonProps) {
  const handleExport = () => {
    const header = 'Name,Phone,Email'
    const rows = data.map(
      (row) =>
        `${escapeCSVField(row.name)},${escapeCSVField(row.phone)},${escapeCSVField(row.email)}`
    )
    const csv = [header, ...rows].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${filename}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (data.length === 0) return null

  return (
    <button
      onClick={handleExport}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-primary-400 hover:text-primary-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
    >
      <Download className="w-4 h-4" />
      Export CSV
    </button>
  )
}

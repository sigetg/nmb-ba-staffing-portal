import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface ReportData {
  jobs: {
    id: string
    title: string
    brand: string
    date?: string | null
    job_days?: { date: string; job_day_locations?: { location: string }[] }[]
    job_types?: { name: string } | null
  }[]
  job_type: {
    name: string
    job_type_kpis?: { id: string; label: string; aggregation: string; sort_order: number }[]
    job_type_questions?: {
      id: string
      question_text: string
      question_type: string
      sort_order: number
      job_type_question_options?: { id: string; label: string; sort_order: number }[]
    }[]
  } | null
  kpi_aggregates: Record<string, { sum: number; avg: number; count: number; values: number[] }>
  mc_aggregates: Record<string, Record<string, { count: number; percentage: number }>>
  per_ba_responses: {
    ba_id: string
    ba_name: string
    job_id: string
    values: { kpi_id?: string | null; question_id?: string | null; numeric_value?: number | null; text_value?: string | null; option_id?: string | null }[]
  }[]
  attendance: {
    job_id: string
    ba_id: string
    ba_name: string
    check_in_time: string
    check_out_time?: string | null
    location?: string | null
  }[]
  photos: { id: string; url: string; ba_id: string; photo_type: string }[]
  selectedPhotoIds?: Set<string>
}

const PRIMARY_COLOR: [number, number, number] = [75, 85, 99]
const HEADER_BG: [number, number, number] = [31, 41, 55]

export function generateReportPDF(data: ReportData): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 15

  const kpis = (data.job_type?.job_type_kpis || []).sort((a, b) => a.sort_order - b.sort_order)
  const questions = (data.job_type?.job_type_questions || []).sort((a, b) => a.sort_order - b.sort_order)
  const mcQuestions = questions.filter(q => q.question_type === 'multiple_choice')
  const textQuestions = questions.filter(q => q.question_type === 'free_text')

  // ==================== COVER PAGE ====================
  doc.setFillColor(...HEADER_BG)
  doc.rect(0, 0, pageWidth, 80, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(28)
  doc.text('Job Report', margin, 35)

  doc.setFontSize(14)
  doc.text(data.job_type?.name || 'General', margin, 50)

  doc.setFontSize(10)
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, margin, 65)

  // Job summary info below header
  let y = 95
  doc.setTextColor(...PRIMARY_COLOR)
  doc.setFontSize(11)

  const jobCount = data.jobs.length
  const baCount = new Set(data.per_ba_responses.map(r => r.ba_id)).size
  const responseCount = data.per_ba_responses.length

  // Date range
  const allDates = data.jobs.flatMap(j => {
    if (j.job_days && j.job_days.length > 0) {
      return j.job_days.map(d => d.date)
    }
    return j.date ? [j.date] : []
  }).sort()
  const dateRange = allDates.length > 0
    ? `${formatDate(allDates[0])} - ${formatDate(allDates[allDates.length - 1])}`
    : 'N/A'

  const summaryItems = [
    ['Jobs', String(jobCount)],
    ['BAs', String(baCount)],
    ['Checkout Responses', String(responseCount)],
    ['Date Range', dateRange],
  ]

  for (const [label, value] of summaryItems) {
    doc.setFont('helvetica', 'bold')
    doc.text(`${label}:`, margin, y)
    doc.setFont('helvetica', 'normal')
    doc.text(value, margin + 45, y)
    y += 8
  }

  // Job titles
  y += 5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Jobs Included:', margin, y)
  y += 7
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  for (const job of data.jobs) {
    doc.text(`• ${job.title} (${job.brand})`, margin + 5, y)
    y += 6
    if (y > 270) {
      doc.addPage()
      y = 20
    }
  }

  // ==================== KPI SUMMARY ====================
  if (kpis.length > 0) {
    doc.addPage()
    y = 20

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(...HEADER_BG)
    doc.text('KPI Summary', margin, y)
    y += 10

    const kpiTableData = kpis.map(kpi => {
      const agg = data.kpi_aggregates[kpi.id]
      return [
        kpi.label,
        agg ? String(Math.round(agg.sum)) : '0',
        agg ? String(agg.avg) : '0',
        agg ? String(agg.count) : '0',
      ]
    })

    autoTable(doc, {
      startY: y,
      head: [['KPI', 'Total', 'Avg per BA', 'Responses']],
      body: kpiTableData,
      theme: 'grid',
      headStyles: { fillColor: HEADER_BG, textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 10 },
      margin: { left: margin, right: margin },
    })

    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15
  }

  // ==================== MC QUESTION BREAKDOWNS ====================
  if (mcQuestions.length > 0) {
    if (y > 220) {
      doc.addPage()
      y = 20
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(...HEADER_BG)
    doc.text('Question Breakdowns', margin, y)
    y += 10

    for (const q of mcQuestions) {
      if (y > 240) {
        doc.addPage()
        y = 20
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(...PRIMARY_COLOR)
      doc.text(q.question_text, margin, y)
      y += 7

      const options = (q.job_type_question_options || []).sort((a, b) => a.sort_order - b.sort_order)
      const mcData = data.mc_aggregates[q.id] || {}

      const tableData = options.map(opt => {
        const d = mcData[opt.id]
        return [opt.label, d ? String(d.count) : '0', d ? `${d.percentage}%` : '0%']
      })

      autoTable(doc, {
        startY: y,
        head: [['Option', 'Count', 'Percentage']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: HEADER_BG, textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 9 },
        margin: { left: margin, right: margin },
      })

      y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
    }
  }

  // ==================== PER-BA RESPONSE TABLE ====================
  if (data.per_ba_responses.length > 0 && (kpis.length > 0 || mcQuestions.length > 0)) {
    doc.addPage()
    y = 20

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(...HEADER_BG)
    doc.text('Per-BA Responses', margin, y)
    y += 10

    const headers = [
      'BA Name',
      ...kpis.map(k => k.label),
      ...mcQuestions.map(q => q.question_text.length > 25 ? q.question_text.slice(0, 25) + '...' : q.question_text),
    ]

    // Build an option lookup
    const optionLookup: Record<string, string> = {}
    for (const q of mcQuestions) {
      for (const opt of (q.job_type_question_options || [])) {
        optionLookup[opt.id] = opt.label
      }
    }

    const rows = data.per_ba_responses.map(r => [
      r.ba_name,
      ...kpis.map(kpi => {
        const v = r.values.find(v => v.kpi_id === kpi.id)
        return v?.numeric_value != null ? String(v.numeric_value) : '\u2014'
      }),
      ...mcQuestions.map(q => {
        const v = r.values.find(v => v.question_id === q.id && v.option_id)
        return v?.option_id ? (optionLookup[v.option_id] || '\u2014') : '\u2014'
      }),
    ])

    autoTable(doc, {
      startY: y,
      head: [headers],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: HEADER_BG, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
      styles: { fontSize: 8, cellPadding: 2 },
      margin: { left: margin, right: margin },
    })

    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15
  }

  // ==================== FREE TEXT RESPONSES ====================
  if (textQuestions.length > 0) {
    doc.addPage()
    y = 20

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(...HEADER_BG)
    doc.text('Free Text Responses', margin, y)
    y += 10

    for (const q of textQuestions) {
      if (y > 240) {
        doc.addPage()
        y = 20
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(...PRIMARY_COLOR)
      doc.text(q.question_text, margin, y)
      y += 7

      const answers = data.per_ba_responses
        .map(r => {
          const v = r.values.find(v => v.question_id === q.id && v.text_value)
          return v ? [r.ba_name, v.text_value!] : null
        })
        .filter(Boolean) as [string, string][]

      if (answers.length === 0) {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(9)
        doc.setTextColor(150, 150, 150)
        doc.text('No responses', margin + 5, y)
        y += 8
      } else {
        autoTable(doc, {
          startY: y,
          head: [['BA Name', 'Response']],
          body: answers,
          theme: 'grid',
          headStyles: { fillColor: HEADER_BG, textColor: [255, 255, 255], fontStyle: 'bold' },
          styles: { fontSize: 9 },
          columnStyles: { 1: { cellWidth: 'auto' } },
          margin: { left: margin, right: margin },
        })
        y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
      }
    }
  }

  // ==================== ATTENDANCE ====================
  if (data.attendance.length > 0) {
    doc.addPage()
    y = 20

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(...HEADER_BG)
    doc.text('Attendance', margin, y)
    y += 10

    // Map job IDs to titles
    const jobTitleMap: Record<string, string> = {}
    for (const j of data.jobs) {
      jobTitleMap[j.id] = j.title
    }

    const attendanceRows = data.attendance.map(a => {
      const ci = a.check_in_time ? new Date(a.check_in_time) : null
      const co = a.check_out_time ? new Date(a.check_out_time) : null
      let hours = '\u2014'
      if (ci && co) {
        const diff = (co.getTime() - ci.getTime()) / (1000 * 60 * 60)
        hours = diff.toFixed(2) + 'h'
      }
      return [
        a.ba_name,
        data.jobs.length > 1 ? (jobTitleMap[a.job_id] || '') : '',
        a.location || '\u2014',
        ci ? ci.toLocaleString() : '\u2014',
        co ? co.toLocaleString() : '\u2014',
        hours,
      ].filter((_, i) => data.jobs.length > 1 || i !== 1) // Remove job column if single job
    })

    const attendanceHeaders = data.jobs.length > 1
      ? ['BA Name', 'Job', 'Location', 'Check-in', 'Check-out', 'Hours']
      : ['BA Name', 'Location', 'Check-in', 'Check-out', 'Hours']

    autoTable(doc, {
      startY: y,
      head: [attendanceHeaders],
      body: attendanceRows,
      theme: 'grid',
      headStyles: { fillColor: HEADER_BG, textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8 },
      margin: { left: margin, right: margin },
    })
  }

  return doc
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

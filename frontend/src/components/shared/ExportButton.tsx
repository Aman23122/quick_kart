import { Download } from 'lucide-react'

interface ExportButtonProps {
  data: Record<string, unknown>[]
  filename: string
  className?: string
}

function toCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return ''
  const headers = Object.keys(data[0])
  const rows = data.map((row) =>
    headers
      .map((h) => {
        const val = row[h]
        const str = val === null || val === undefined ? '' : String(val)
        // Escape quotes and wrap if contains comma/newline/quote
        if (str.includes(',') || str.includes('\n') || str.includes('"')) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      })
      .join(',')
  )
  return [headers.join(','), ...rows].join('\n')
}

export default function ExportButton({ data, filename, className }: ExportButtonProps) {
  const handleExport = () => {
    const csv = toCSV(data)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={handleExport}
      disabled={data.length === 0}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${className ?? ''}`}
      type="button"
    >
      <Download size={15} />
      Export CSV
    </button>
  )
}

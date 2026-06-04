import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { CheckCircle, XCircle, FileDown } from 'lucide-react'
import {
  uploadInboundCSV,
  getInboundLedger,
  type InboundRow,
  type UploadResult,
} from '@/services/inboundApi'
import CSVUploader from '@/components/shared/CSVUploader'
import DataTable, { type ColumnDef } from '@/components/shared/DataTable'
import StatusBadge from '@/components/shared/StatusBadge'
import ExportButton from '@/components/shared/ExportButton'

const PAGE_SIZE = 20

const columns: ColumnDef<InboundRow>[] = [
  { key: 'po_number', header: 'PO #' },
  { key: 'vendor', header: 'Vendor' },
  { key: 'variant_name', header: 'Variant' },
  {
    key: 'ordered_qty',
    header: 'Ordered',
    render: (r) => String(r.ordered_qty ?? '—'),
  },
  {
    key: 'received_qty',
    header: 'Received',
    render: (r) => String(r.received_qty ?? '—'),
  },
  {
    key: 'temperature_c',
    header: 'Temp (°C)',
    render: (r) => (r.temperature_c !== null && r.temperature_c !== undefined ? `${r.temperature_c}°` : '—'),
  },
  { key: 'batch_code', header: 'Batch' },
  {
    key: 'sell_before_date',
    header: 'Sell Before',
    render: (r) => String(r.sell_before_date ?? '—'),
  },
  {
    key: 'status',
    header: 'Status',
    render: (r) => r.status ? <StatusBadge status={String(r.status)} /> : <span className="text-slate-400">—</span>,
  },
  {
    key: 'created_at',
    header: 'Timestamp',
    render: (r) => <span className="text-xs text-slate-500">{String(r.created_at ?? '—')}</span>,
  },
]

export default function InboundLedger() {
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [page, setPage] = useState(1)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [status, setStatus] = useState('')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['inbound-ledger', page, dateFrom, dateTo, status],
    queryFn: () =>
      getInboundLedger({
        skip: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        status: status || undefined,
      }).then((r) => r.data),
  })

  const uploadMutation = useMutation({
    mutationFn: uploadInboundCSV,
    onSuccess: (result) => {
      setUploadResult(result)
      refetch()
    },
  })

  const handleUpload = (file: File) => {
    uploadMutation.mutate(file)
  }

  return (
    <div className="space-y-6">
      {/* Upload section */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-semibold text-slate-800">Upload Inbound CSV</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Upload a CSV file to record inbound stock entries.
            </p>
          </div>
          <a
            href="/sample_csvs/inbound_sample.csv"
            download
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            <FileDown size={15} />
            Download Sample
          </a>
        </div>

        <CSVUploader
          onUpload={handleUpload}
          loading={uploadMutation.isPending}
          label="Drop inbound CSV here or click to browse"
        />

        {/* Upload result */}
        {uploadResult && (
          <div className="flex flex-wrap gap-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-500" />
              <span className="text-sm font-medium text-slate-700">
                Accepted: <span className="text-emerald-600 font-bold">{uploadResult.accepted}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle size={16} className="text-rose-500" />
              <span className="text-sm font-medium text-slate-700">
                Rejected: <span className="text-rose-600 font-bold">{uploadResult.rejected}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">
                Total: <span className="font-medium text-slate-700">{uploadResult.total}</span>
              </span>
            </div>
            {uploadMutation.isError && (
              <p className="w-full text-sm text-rose-600">
                Upload failed. Please check the file format.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Ledger */}
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 font-medium">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 font-medium">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
            />
          </div>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1) }}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white"
          >
            <option value="">All Status</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </select>
          <div className="ml-auto">
            <ExportButton
              data={(data?.data as Record<string, unknown>[]) ?? []}
              filename="inbound_ledger"
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={(data?.data as InboundRow[]) ?? []}
          loading={isLoading}
          totalCount={data?.total ?? 0}
          page={page}
          onPageChange={setPage}
          pageSize={PAGE_SIZE}
          emptyMessage="No inbound records found. Upload a CSV to get started."
        />
      </div>
    </div>
  )
}

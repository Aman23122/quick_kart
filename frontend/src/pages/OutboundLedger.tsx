import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { CheckCircle, XCircle, SplitSquareHorizontal } from 'lucide-react'
import {
  uploadOutboundCSV,
  getOutboundLedger,
  type OutboundRow,
  type OutboundUploadResult,
} from '@/services/outboundApi'
import CSVUploader from '@/components/shared/CSVUploader'
import DataTable, { type ColumnDef } from '@/components/shared/DataTable'
import StatusBadge from '@/components/shared/StatusBadge'
import ExportButton from '@/components/shared/ExportButton'
import { formatCurrency } from '@/lib/utils'

const PAGE_SIZE = 20

const columns: ColumnDef<OutboundRow>[] = [
  { key: 'order_id', header: 'Order ID' },
  { key: 'user_name', header: 'User' },
  { key: 'variant_name', header: 'Variant' },
  {
    key: 'qty',
    header: 'Qty',
    render: (r) => String(r.qty ?? '—'),
  },
  {
    key: 'unit_price',
    header: 'Unit Price',
    render: (r) =>
      r.unit_price !== undefined && r.unit_price !== null
        ? formatCurrency(Number(r.unit_price))
        : '—',
  },
  {
    key: 'total',
    header: 'Total',
    render: (r) =>
      r.total !== undefined && r.total !== null
        ? formatCurrency(Number(r.total))
        : '—',
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

export default function OutboundLedger() {
  const [uploadResult, setUploadResult] = useState<OutboundUploadResult | null>(null)
  const [page, setPage] = useState(1)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [status, setStatus] = useState('')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['outbound-ledger', page, dateFrom, dateTo, status],
    queryFn: () =>
      getOutboundLedger({
        skip: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        status: status || undefined,
      }).then((r) => r.data),
  })

  const uploadMutation = useMutation({
    mutationFn: uploadOutboundCSV,
    onSuccess: (result) => {
      setUploadResult(result)
      refetch()
    },
  })

  return (
    <div className="space-y-6">
      {/* Upload */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 space-y-5">
        <div>
          <h2 className="font-semibold text-slate-800">Upload Outbound CSV</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Upload a CSV file to process outbound orders with FEFO dispatch logic.
          </p>
        </div>

        <CSVUploader
          onUpload={(file) => uploadMutation.mutate(file)}
          loading={uploadMutation.isPending}
          label="Drop outbound CSV here or click to browse"
        />

        {/* FEFO result */}
        {uploadResult && (
          <div className="flex flex-wrap gap-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-500" />
              <span className="text-sm font-medium text-slate-700">
                Fulfilled: <span className="text-emerald-600 font-bold">{uploadResult.fulfilled}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle size={16} className="text-rose-500" />
              <span className="text-sm font-medium text-slate-700">
                Blocked: <span className="text-rose-600 font-bold">{uploadResult.blocked}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <SplitSquareHorizontal size={16} className="text-amber-500" />
              <span className="text-sm font-medium text-slate-700">
                Partial: <span className="text-amber-600 font-bold">{uploadResult.partial}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">
                Total: <span className="font-medium text-slate-700">{uploadResult.total}</span>
              </span>
            </div>
          </div>
        )}

        {uploadMutation.isError && (
          <p className="text-sm text-rose-600">Upload failed. Please check the file format.</p>
        )}
      </div>

      {/* Ledger */}
      <div className="space-y-4">
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
            <option value="fulfilled">Fulfilled</option>
            <option value="blocked">Blocked</option>
            <option value="partial">Partial</option>
          </select>
          <div className="ml-auto">
            <ExportButton
              data={(data?.data as Record<string, unknown>[]) ?? []}
              filename="outbound_ledger"
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={(data?.data as OutboundRow[]) ?? []}
          loading={isLoading}
          totalCount={data?.total ?? 0}
          page={page}
          onPageChange={setPage}
          pageSize={PAGE_SIZE}
          emptyMessage="No outbound records found. Upload a CSV to get started."
        />
      </div>
    </div>
  )
}

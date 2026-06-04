import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle, XCircle, SplitSquareHorizontal, Clock,
  ShieldAlert, ChevronDown, ChevronRight, PackageCheck,
} from 'lucide-react'
import {
  uploadOutboundCSV,
  getOutboundLedger,
  getPendingOutbound,
  approveOutbound,
  rejectOutbound,
  type OutboundRow,
  type OutboundUploadResult,
  type PendingOrder,
  type PendingOrderLine,
} from '@/services/outboundApi'
import CSVUploader from '@/components/shared/CSVUploader'
import DataTable, { type ColumnDef } from '@/components/shared/DataTable'
import StatusBadge from '@/components/shared/StatusBadge'
import ExportButton from '@/components/shared/ExportButton'
import { formatCurrency } from '@/lib/utils'

const PAGE_SIZE = 20

const ledgerColumns: ColumnDef<OutboundRow>[] = [
  { key: 'order_id', header: 'Order ID', render: (r) => <span className="font-mono text-xs">{String(r.order_id ?? '—').slice(0, 12)}…</span> },
  { key: 'user_id', header: 'User' },
  { key: 'variant_name', header: 'Variant' },
  {
    key: 'quantity',
    header: 'Qty',
    render: (r) => String(r.quantity ?? '—'),
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
    key: 'total_price',
    header: 'Total',
    render: (r) =>
      r.total_price !== undefined && r.total_price !== null
        ? formatCurrency(Number(r.total_price))
        : '—',
  },
  {
    key: 'order_status',
    header: 'Status',
    render: (r) =>
      r.order_status ? (
        <StatusBadge status={String(r.order_status)} />
      ) : (
        <span className="text-slate-400">—</span>
      ),
  },
  {
    key: 'created_at',
    header: 'Timestamp',
    render: (r) => <span className="text-xs text-slate-500">{String(r.created_at ?? '—')}</span>,
  },
]

function LineItemRow({ line }: { line: PendingOrderLine }) {
  const [expanded, setExpanded] = useState(false)
  const preview = line.fefo_preview

  return (
    <div className="border border-slate-100 rounded-lg overflow-hidden">
      {/* Line header */}
      <div
        className="flex items-center gap-3 px-4 py-3 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
        <div className="flex-1 min-w-0">
          <span className="font-medium text-slate-800">{line.product_name}</span>
          {line.brand_name && <span className="text-xs text-slate-400 ml-2">{line.brand_name}</span>}
          <div className="text-xs text-slate-500 mt-0.5">{line.variant_name}</div>
        </div>
        <div className="text-sm text-slate-600 shrink-0">
          Requested: <span className="font-semibold">{line.qty_requested}</span>
        </div>
        <div className="text-sm shrink-0">
          {line.shelf_blocked ? (
            <span className="flex items-center gap-1 text-rose-600 font-semibold">
              <ShieldAlert size={14} /> Blocked
            </span>
          ) : preview.fulfilled ? (
            <span className="flex items-center gap-1 text-emerald-600 font-semibold">
              <PackageCheck size={14} /> Fully Fulfilled
            </span>
          ) : preview.qty_fulfilled === 0 ? (
            <span className="text-rose-600 font-semibold">No Stock</span>
          ) : (
            <span className="flex items-center gap-1 text-amber-600 font-semibold">
              <SplitSquareHorizontal size={14} /> Partial ({preview.qty_fulfilled}/{line.qty_requested})
            </span>
          )}
        </div>
        <div className="text-sm text-slate-600 shrink-0">
          {formatCurrency(line.qty_requested * line.unit_price)}
        </div>
      </div>

      {/* Shelf block warning */}
      {line.shelf_blocked && (
        <div className="px-4 py-2 bg-rose-50 border-t border-rose-100 text-xs text-rose-700 flex items-center gap-2">
          <ShieldAlert size={13} /> {line.block_reason}
        </div>
      )}

      {/* FEFO batch breakdown */}
      {expanded && !line.shelf_blocked && (
        <div className="p-4 bg-white border-t border-slate-100">
          {preview.batches.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No available stock batches for this variant.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 uppercase tracking-wide border-b border-slate-100">
                  <th className="pb-2 text-left">Batch</th>
                  <th className="pb-2 text-left">Sell Before</th>
                  <th className="pb-2 text-left">Expiry</th>
                  <th className="pb-2 text-right">Available</th>
                  <th className="pb-2 text-right font-bold text-slate-600">To Dispatch</th>
                  <th className="pb-2 text-center">Days Left</th>
                  <th className="pb-2 text-center">Temp (°C)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {preview.batches.map((batch) => (
                  <tr key={batch.inventory_id} className="hover:bg-slate-50">
                    <td className="py-2 font-mono">{batch.batch_no ?? '—'}</td>
                    <td className="py-2 text-slate-600">{batch.sell_before_date}</td>
                    <td className="py-2 text-slate-500">{batch.expiry_date ?? '—'}</td>
                    <td className="py-2 text-right">{batch.qty_available}</td>
                    <td className="py-2 text-right font-bold text-blue-700">{batch.qty_to_dispatch}</td>
                    <td className="py-2 text-center">
                      <span
                        className={`px-1.5 py-0.5 rounded font-semibold ${
                          batch.days_until_expiry !== null && batch.days_until_expiry <= 2
                            ? 'bg-rose-50 text-rose-700'
                            : batch.days_until_expiry !== null && batch.days_until_expiry <= 7
                            ? 'bg-amber-50 text-amber-700'
                            : 'text-slate-600'
                        }`}
                      >
                        {batch.days_until_expiry !== null ? `${batch.days_until_expiry}d` : '—'}
                      </span>
                    </td>
                    <td className="py-2 text-center">
                      {batch.temperature_measured !== null ? `${batch.temperature_measured}°` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {preview.shortage > 0 && (
            <p className="mt-2 text-xs text-amber-700 font-medium">
              ⚠ Shortage: {preview.shortage} unit(s) cannot be fulfilled from current stock.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function PendingOutboundPanel() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['pending-outbound'],
    queryFn: () => getPendingOutbound().then((r) => r.data),
    refetchInterval: 15000,
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveOutbound(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-outbound'] })
      queryClient.invalidateQueries({ queryKey: ['outbound-ledger'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-grid'] })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectOutbound(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-outbound'] })
      queryClient.invalidateQueries({ queryKey: ['outbound-ledger'] })
    },
  })

  const orders: PendingOrder[] = data?.data ?? []
  const total = data?.total ?? 0

  if (!isLoading && total === 0) return null

  return (
    <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 bg-amber-50 border-b border-amber-200">
        <Clock size={18} className="text-amber-600" />
        <h2 className="font-semibold text-amber-800">Pending Outbound Approvals</h2>
        {total > 0 && (
          <span className="ml-1 px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500 text-white">
            {total}
          </span>
        )}
        <p className="ml-auto text-xs text-amber-700">
          Review FEFO batch allocation before dispatching
        </p>
      </div>

      {isLoading ? (
        <div className="p-6 text-sm text-slate-400">Loading pending orders…</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {orders.map((order) => {
            const isBusy = approveMutation.isPending || rejectMutation.isPending
            const cannotFulfill = order.lines.some((l) => !l.fefo_preview.fulfilled)
            const noStock = order.lines.every((l) => l.fefo_preview.qty_fulfilled === 0)
            return (
              <div key={order.order_id} className="p-5 space-y-3">
                {/* Order header */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-slate-700">{order.order_id.slice(0, 16)}…</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Customer: {order.user_id} &nbsp;·&nbsp; {order.created_at}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm text-slate-500 mr-2">
                      Est. {formatCurrency(order.estimated_total)}
                    </span>
                    <div className="flex flex-col items-end gap-1">
                      <button
                        disabled={isBusy || cannotFulfill}
                        onClick={() => approveMutation.mutate(order.order_id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <CheckCircle size={13} /> Approve & Dispatch
                      </button>
                      {cannotFulfill && (
                        <span className="text-xs text-rose-500 font-medium">
                          {noStock ? 'No stock available' : 'Insufficient stock'}
                        </span>
                      )}
                    </div>
                    <button
                      disabled={isBusy}
                      onClick={() => rejectMutation.mutate(order.order_id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50 transition-colors"
                    >
                      <XCircle size={13} /> Reject
                    </button>
                  </div>
                </div>

                {/* Line items — each expandable to show FEFO batches */}
                <div className="space-y-2">
                  {order.lines.map((line) => (
                    <LineItemRow key={line.order_line_id} line={line} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

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
      {/* Pending approvals — hidden when empty */}
      <PendingOutboundPanel />

      {/* Upload */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 space-y-5">
        <div>
          <h2 className="font-semibold text-slate-800">Upload Outbound CSV</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Upload a CSV file to stage an outbound order for admin review.
          </p>
        </div>

        <CSVUploader
          onUpload={(file) => uploadMutation.mutate(file)}
          loading={uploadMutation.isPending}
          label="Drop outbound CSV here or click to browse"
        />

        {uploadResult && (
          <div className="flex flex-wrap gap-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-amber-500" />
              <span className="text-sm font-medium text-slate-700">
                Pending Approval:{' '}
                <span className="text-amber-600 font-bold">{uploadResult.pending_approval}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">
                Items:{' '}
                <span className="font-medium text-slate-700">{uploadResult.processed}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
              Order: {uploadResult.order_id.slice(0, 16)}…
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
            <option value="pending_approval">Pending Approval</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <div className="ml-auto">
            <ExportButton
              data={(data?.data as Record<string, unknown>[]) ?? []}
              filename="outbound_ledger"
            />
          </div>
        </div>

        <DataTable
          columns={ledgerColumns}
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

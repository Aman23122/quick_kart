import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, Clock, Thermometer, ShieldAlert, Timer } from 'lucide-react'
import {
  getInboundLedger,
  getPendingApprovals,
  approveInbound,
  rejectInbound,
  type InboundRow,
  type PendingItem,
} from '@/services/inboundApi'
import DataTable, { type ColumnDef } from '@/components/shared/DataTable'
import StatusBadge from '@/components/shared/StatusBadge'
import ExportButton from '@/components/shared/ExportButton'

const PAGE_SIZE = 20

const ledgerColumns: ColumnDef<InboundRow>[] = [
  { key: 'po_number', header: 'PO #' },
  { key: 'vendor_name', header: 'Vendor' },
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
    key: 'temperature_measured',
    header: 'Temp (°C)',
    render: (r) =>
      r.temperature_measured !== null && r.temperature_measured !== undefined
        ? `${r.temperature_measured}°`
        : '—',
  },
  { key: 'batch_no', header: 'Batch' },
  {
    key: 'sell_before_date',
    header: 'Sell Before',
    render: (r) => String(r.sell_before_date ?? '—'),
  },
  {
    key: 'on_time',
    header: 'On Time?',
    render: (r) => {
      if (r.on_time === null || r.on_time === undefined) {
        return <span className="text-slate-300 text-xs">—</span>
      }
      return r.on_time ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700">
          <Timer size={11} /> On Time
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-rose-50 text-rose-700">
          <Timer size={11} /> Late
        </span>
      )
    },
  },
  {
    key: 'status',
    header: 'Status',
    render: (r) =>
      r.status ? (
        <StatusBadge status={String(r.status)} />
      ) : (
        <span className="text-slate-400">—</span>
      ),
  },
  {
    key: 'created_at',
    header: 'Timestamp',
    render: (r) => (
      <span className="text-xs text-slate-500">{String(r.created_at ?? '—')}</span>
    ),
  },
]

function PendingApprovalPanel() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['pending-approvals'],
    queryFn: () => getPendingApprovals().then((r) => r.data),
    refetchInterval: 15000,
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveInbound(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] })
      queryClient.invalidateQueries({ queryKey: ['inbound-ledger'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-grid'] })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectInbound(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] })
      queryClient.invalidateQueries({ queryKey: ['inbound-ledger'] })
    },
  })

  const items: PendingItem[] = data?.data ?? []
  const total = data?.total ?? 0

  if (!isLoading && total === 0) return null

  return (
    <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 bg-amber-50 border-b border-amber-200">
        <Clock size={18} className="text-amber-600" />
        <h2 className="font-semibold text-amber-800">Pending Approvals</h2>
        {total > 0 && (
          <span className="ml-1 px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500 text-white">
            {total}
          </span>
        )}
        <p className="ml-auto text-xs text-amber-700">
          Review each shipment before it enters inventory
        </p>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="p-6 text-sm text-slate-400">Loading pending approvals…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left">PO #</th>
                <th className="px-4 py-3 text-left">Product / Variant</th>
                <th className="px-4 py-3 text-left">Vendor</th>
                <th className="px-4 py-3 text-right">Ordered</th>
                <th className="px-4 py-3 text-right">Received</th>
                <th className="px-4 py-3 text-center">Temp (°C)</th>
                <th className="px-4 py-3 text-left">Batch</th>
                <th className="px-4 py-3 text-left">Expiry</th>
                <th className="px-4 py-3 text-left">Sell Before</th>
                <th className="px-4 py-3 text-right">Total Cost</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map((item) => {
                const isBusy =
                  approveMutation.isPending || rejectMutation.isPending
                return (
                  <tr key={item.procurement_item_id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {item.po_number}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{item.product_name}</div>
                      <div className="text-xs text-slate-400">{item.variant_name}</div>
                      {item.brand_name && (
                        <div className="text-xs text-slate-400">{item.brand_name}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{item.vendor_name}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{item.ordered_qty}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{item.received_qty}</td>
                    <td className="px-4 py-3 text-center">
                      <div
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                          item.temp_ok
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {item.temp_ok ? (
                          <Thermometer size={12} />
                        ) : (
                          <ShieldAlert size={12} />
                        )}
                        {item.temperature_measured}°
                        {!item.temp_ok && (
                          <span className="text-rose-500 font-normal">
                            &nbsp;(max {item.temp_threshold}°)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {item.batch_no ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {item.expiry_date ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{item.sell_before_date}</td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      ₹{item.total_cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          disabled={isBusy}
                          onClick={() => approveMutation.mutate(item.procurement_id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                        >
                          <CheckCircle size={13} />
                          Approve
                        </button>
                        <button
                          disabled={isBusy}
                          onClick={() => rejectMutation.mutate(item.procurement_id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50 transition-colors"
                        >
                          <XCircle size={13} />
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function InboundLedger() {
  const [page, setPage] = useState(1)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [status, setStatus] = useState('')

  const { data, isLoading } = useQuery({
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

  return (
    <div className="space-y-6">
      {/* Pending approvals — hidden when empty */}
      <PendingApprovalPanel />

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
            <option value="approved">Approved</option>
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
          columns={ledgerColumns}
          data={(data?.data as InboundRow[]) ?? []}
          loading={isLoading}
          totalCount={data?.total ?? 0}
          page={page}
          onPageChange={setPage}
          pageSize={PAGE_SIZE}
          emptyMessage="No inbound records yet."
        />
      </div>
    </div>
  )
}

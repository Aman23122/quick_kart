import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, Clock, Thermometer, ShieldAlert, PackageCheck, Timer, ShieldCheck, History } from 'lucide-react'
import {
  getPendingApprovals,
  approveInbound,
  rejectInbound,
  getInboundLedger,
  type PendingItem,
  type InboundRow,
} from '@/services/inboundApi'
import ExportButton from '@/components/shared/ExportButton'
import DataTable, { type ColumnDef } from '@/components/shared/DataTable'
import StatusBadge from '@/components/shared/StatusBadge'

const PAGE_SIZE = 20

// ── helpers ──────────────────────────────────────────────────────────────────

interface PendingPO {
  procurement_id: string
  po_number: string
  vendor_name: string
  created_at: string
  items: PendingItem[]
  total_value: number
}

function groupByPO(items: PendingItem[]): PendingPO[] {
  const map = new Map<string, PendingPO>()
  for (const item of items) {
    if (!map.has(item.procurement_id)) {
      map.set(item.procurement_id, {
        procurement_id: item.procurement_id,
        po_number: item.po_number,
        vendor_name: item.vendor_name,
        created_at: item.created_at,
        items: [],
        total_value: 0,
      })
    }
    const po = map.get(item.procurement_id)!
    po.items.push(item)
    po.total_value += item.total_cost
  }
  return Array.from(map.values())
}

function OnTimeCell({ on_time, on_time_diff_minutes }: { on_time: boolean | null; on_time_diff_minutes: number | null }) {
  if (on_time === null || on_time === undefined) return <span className="text-slate-300 text-xs">—</span>
  const abs = Math.abs(on_time_diff_minutes ?? 0)
  const diffLabel = on_time_diff_minutes == null ? null
    : abs < 60 ? `${abs}m`
    : abs < 1440 ? `${Math.floor(abs / 60)}h${abs % 60 > 0 ? ` ${abs % 60}m` : ''}`
    : `${Math.floor(abs / 1440)}d`
  return on_time ? (
    <div className="flex flex-col items-center gap-0.5">
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700">
        <Timer size={11} /> On Time
      </span>
      {diffLabel && <span className="text-xs text-emerald-600">{diffLabel} early</span>}
    </div>
  ) : (
    <div className="flex flex-col items-center gap-0.5">
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-rose-50 text-rose-700">
        <Timer size={11} /> Late
      </span>
      {diffLabel && <span className="text-xs text-rose-600">{diffLabel}</span>}
    </div>
  )
}

// ── ledger columns ────────────────────────────────────────────────────────────

const ledgerColumns: ColumnDef<InboundRow>[] = [
  { key: 'po_number', header: 'PO #' },
  { key: 'vendor_name', header: 'Vendor' },
  {
    key: 'variant_name',
    header: 'Product / Variant',
    render: (r) => (
      <div>
        {r.product_name && <div className="font-medium text-slate-800">{String(r.product_name)}</div>}
        <div className="text-xs text-slate-400">{String(r.variant_name ?? '—')}</div>
      </div>
    ),
  },
  { key: 'ordered_qty', header: 'Ordered', render: (r) => String(r.ordered_qty ?? '—') },
  { key: 'received_qty', header: 'Received', render: (r) => String(r.received_qty ?? '—') },
  {
    key: 'variance',
    header: 'Variance',
    render: (r) => {
      if (r.ordered_qty == null || r.received_qty == null) return <span className="text-slate-300">—</span>
      const v = (r.received_qty as number) - (r.ordered_qty as number)
      if (v === 0) return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700">
          ✓ Match
        </span>
      )
      return (
        <span className={`font-semibold text-sm ${v > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
          {v > 0 ? `+${v}` : v}
        </span>
      )
    },
  },
  {
    key: 'temperature_measured',
    header: 'Temp (°C)',
    render: (r) =>
      r.temperature_measured != null ? `${r.temperature_measured}°` : '—',
  },
  { key: 'batch_no', header: 'Batch' },
  { key: 'sell_before_date', header: 'Sell Before', render: (r) => String(r.sell_before_date ?? '—') },
  {
    key: 'on_time',
    header: 'On Time?',
    render: (r) => (
      <OnTimeCell
        on_time={(r.on_time as boolean | null) ?? null}
        on_time_diff_minutes={(r.on_time_diff_minutes as number | null) ?? null}
      />
    ),
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

// ── main page ─────────────────────────────────────────────────────────────────

export default function ApprovalPage() {
  const queryClient = useQueryClient()

  // pending approvals
  const { data: pendingData, isLoading: pendingLoading } = useQuery({
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

  // ledger
  const [page, setPage] = useState(1)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [status, setStatus] = useState('')

  const { data: ledgerData, isLoading: ledgerLoading } = useQuery({
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

  const forceApproveMutation = useMutation({
    mutationFn: (id: string) => approveInbound(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbound-ledger'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-grid'] })
    },
  })

  const ledgerColumnsWithActions: ColumnDef<InboundRow>[] = [
    ...ledgerColumns,
    {
      key: 'actions',
      header: '',
      render: (r) => {
        if (r.status !== 'rejected') return null
        return (
          <button
            disabled={forceApproveMutation.isPending}
            onClick={() => r.procurement_id && forceApproveMutation.mutate(r.procurement_id as string)}
            title="Force approve — bypass QC and add to inventory"
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            <ShieldCheck size={12} />
            Force Approve
          </button>
        )
      },
    },
  ]

  const items: PendingItem[] = pendingData?.data ?? []
  const total = pendingData?.total ?? 0
  const groups = groupByPO(items)
  const isBusy = approveMutation.isPending || rejectMutation.isPending

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-8">

      {/* ── Page header ── */}
      <div className="flex items-center gap-3">
        <PackageCheck size={22} className="text-amber-600" />
        <div>
          <h1 className="text-xl font-bold text-slate-800">Approval Queue</h1>
          <p className="text-sm text-slate-500">
            Compare PO vs received stock before adding to inventory
          </p>
        </div>
        {total > 0 && (
          <span className="ml-2 px-2.5 py-0.5 text-sm font-bold rounded-full bg-amber-500 text-white">
            {total} pending
          </span>
        )}
      </div>

      {/* ── Pending approvals ── */}
      <div className="space-y-4">
        {pendingLoading && (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">
            Loading pending approvals…
          </div>
        )}

        {!pendingLoading && total === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <CheckCircle size={36} className="mx-auto mb-3 text-emerald-400" />
            <p className="text-slate-600 font-medium">All caught up!</p>
            <p className="text-slate-400 text-sm mt-1">No pending approvals right now.</p>
          </div>
        )}

        {groups.map((po) => (
          <div
            key={po.procurement_id}
            className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden"
          >
            {/* Card header */}
            <div className="flex items-center gap-4 px-6 py-4 bg-amber-50 border-b border-amber-200">
              <Clock size={16} className="text-amber-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-sm font-semibold text-slate-700">{po.po_number}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-sm text-slate-600">{po.vendor_name}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-xs text-slate-500">{po.created_at}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {po.items.length} line item{po.items.length > 1 ? 's' : ''}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-slate-500">Total Value</p>
                <p className="font-semibold text-slate-700">
                  ₹{po.total_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* Comparison table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wide">
                    <th className="px-4 py-3 text-left">Product / Variant</th>
                    <th className="px-4 py-3 text-right">PO Ordered</th>
                    <th className="px-4 py-3 text-right">Received</th>
                    <th className="px-4 py-3 text-right">Variance</th>
                    <th className="px-4 py-3 text-center">On Time?</th>
                    <th className="px-4 py-3 text-center">Temp QC</th>
                    <th className="px-4 py-3 text-left">Batch</th>
                    <th className="px-4 py-3 text-left">Expiry</th>
                    <th className="px-4 py-3 text-left">Sell Before</th>
                    <th className="px-4 py-3 text-right">Unit Cost</th>
                    <th className="px-4 py-3 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {po.items.map((item) => {
                    const variance = item.received_qty - item.ordered_qty
                    return (
                      <tr key={item.procurement_item_id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800">{item.product_name}</div>
                          <div className="text-xs text-slate-400">{item.variant_name}</div>
                          {item.brand_name && <div className="text-xs text-slate-400">{item.brand_name}</div>}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700">{item.ordered_qty}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700">{item.received_qty}</td>
                        <td className="px-4 py-3 text-right">
                          {variance === 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700">
                              ✓ Match
                            </span>
                          ) : (
                            <span className={`font-semibold ${variance > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {variance > 0 ? `+${variance}` : variance}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <OnTimeCell on_time={item.on_time} on_time_diff_minutes={item.on_time_diff_minutes} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${item.temp_ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                            {item.temp_ok ? <Thermometer size={12} /> : <ShieldAlert size={12} />}
                            {item.temperature_measured}°
                            {!item.temp_ok && <span className="text-rose-500 font-normal">&nbsp;(max {item.temp_threshold}°)</span>}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.batch_no ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">{item.expiry_date ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">{item.sell_before_date}</td>
                        <td className="px-4 py-3 text-right text-slate-600">
                          ₹{item.unit_cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700">
                          ₹{item.total_cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Actions footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
              <p className="text-xs text-slate-500">
                Approving adds received quantities to inventory. Rejecting discards this shipment.
              </p>
              <div className="flex items-center gap-3">
                <button
                  disabled={isBusy}
                  onClick={() => rejectMutation.mutate(po.procurement_id)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50 transition-colors"
                >
                  <XCircle size={15} /> Reject
                </button>
                <button
                  disabled={isBusy}
                  onClick={() => approveMutation.mutate(po.procurement_id)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                >
                  <CheckCircle size={15} /> Approve & Add to Inventory
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Inbound History ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
          <History size={17} className="text-slate-400" />
          <h2 className="font-semibold text-slate-700">Approval History</h2>
        </div>

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
              data={(ledgerData?.data as Record<string, unknown>[]) ?? []}
              filename={`inbound_history_${today}`}
            />
          </div>
        </div>

        <DataTable
          columns={ledgerColumnsWithActions}
          data={(ledgerData?.data as InboundRow[]) ?? []}
          loading={ledgerLoading}
          totalCount={ledgerData?.total ?? 0}
          page={page}
          onPageChange={setPage}
          pageSize={PAGE_SIZE}
          emptyMessage="No inbound records yet."
        />
      </div>

    </div>
  )
}

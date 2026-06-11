import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Truck, CheckCircle, History, PackageCheck } from 'lucide-react'
import {
  getConfirmedOrders,
  dispatchOrder,
  getOutboundLedger,
  type ConfirmedOrder,
  type ConfirmedOrderLine,
  type OutboundRow,
} from '@/services/outboundApi'
import DataTable, { type ColumnDef } from '@/components/shared/DataTable'
import StatusBadge from '@/components/shared/StatusBadge'
import ExportButton from '@/components/shared/ExportButton'

const PAGE_SIZE = 20

// Per-order editable dispatch state
type DispatchState = Record<string, number>

function OrderCard({
  order,
  onDispatched,
}: {
  order: ConfirmedOrder
  onDispatched: () => void
}) {
  const queryClient = useQueryClient()

  const [state, setState] = useState<DispatchState>(() =>
    Object.fromEntries(order.lines.map((l) => [l.order_line_id, l.allocated_qty]))
  )

  const mutation = useMutation({
    mutationFn: () =>
      dispatchOrder(
        order.order_id,
        order.lines.map((l) => ({
          order_line_id: l.order_line_id,
          dispatch_qty: state[l.order_line_id] ?? l.allocated_qty,
        }))
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['confirmed-orders'] })
      queryClient.invalidateQueries({ queryKey: ['outbound-ledger'] })
      onDispatched()
    },
  })

  const hasVariance = order.lines.some((l) => {
    const d = state[l.order_line_id] ?? l.allocated_qty
    return d !== l.allocated_qty
  })

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Card header */}
      <div
        className="flex items-center gap-4 px-6 py-4 border-b border-slate-100"
        style={{ background: 'var(--brand-50)' }}
      >
        <Truck size={16} className="flex-shrink-0" style={{ color: 'var(--brand-600)' }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-semibold text-slate-800">{order.customer_name}</span>
            <span className="text-slate-300">•</span>
            <span className="font-mono text-xs text-slate-500">{order.order_id.slice(0, 12)}…</span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-500">Admin confirmed: {order.confirmed_at}</span>
          </div>
          {order.notes && (
            <p className="text-xs text-slate-500 mt-0.5 truncate">{order.notes}</p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs text-slate-500">Order Total</p>
          <p className="font-semibold text-slate-700">
            ₹{order.total_price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>
        {hasVariance && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex-shrink-0">
            Qty adjusted
          </span>
        )}
      </div>

      {/* Items table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wide">
              <th className="px-4 py-3 text-left">Product / Variant</th>
              <th className="px-4 py-3 text-right">Ordered</th>
              <th className="px-4 py-3 text-right">FEFO Allocated</th>
              <th className="px-4 py-3 text-right">Dispatch Qty</th>
              <th className="px-4 py-3 text-right">Variance</th>
              <th className="px-4 py-3 text-right">Unit Price</th>
              <th className="px-4 py-3 text-right">Line Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {order.lines.map((line: ConfirmedOrderLine) => {
              const dqty = state[line.order_line_id] ?? line.allocated_qty
              const variance = dqty - line.allocated_qty
              return (
                <tr key={line.order_line_id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{line.product_name}</div>
                    <div className="text-xs text-slate-400">{line.variant_name}</div>
                    {line.brand_name && <div className="text-xs text-slate-400">{line.brand_name}</div>}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">{line.original_qty}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-700">{line.allocated_qty}</td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      min={0}
                      max={line.allocated_qty}
                      value={dqty}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(line.allocated_qty, parseInt(e.target.value) || 0))
                        setState((prev) => ({ ...prev, [line.order_line_id]: v }))
                      }}
                      className="w-20 px-2 py-1 text-sm text-right border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
                      style={{ '--tw-ring-color': 'var(--brand-400)' } as React.CSSProperties}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {variance === 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700">
                        ✓ Match
                      </span>
                    ) : (
                      <span className={`font-semibold text-sm ${variance > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {variance > 0 ? `+${variance}` : variance}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    ₹{line.unit_price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-700">
                    ₹{(dqty * line.unit_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
        <p className="text-xs text-slate-500">
          Edit dispatch qty if you're sending less than allocated. Confirm to mark as dispatched.
        </p>
        <button
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
          className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-50 transition-colors"
          style={{ background: 'var(--brand-600)' }}
          onMouseEnter={(e) => { if (!mutation.isPending) (e.currentTarget as HTMLButtonElement).style.background = 'var(--brand-700)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--brand-600)' }}
        >
          <CheckCircle size={15} />
          {mutation.isPending ? 'Confirming…' : 'Confirm Dispatch'}
        </button>
      </div>
    </div>
  )
}

const historyColumns: ColumnDef<OutboundRow>[] = [
  {
    key: 'order_id',
    header: 'Order ID',
    render: (r) => <span className="font-mono text-xs">{String(r.order_id ?? '—').slice(0, 12)}…</span>,
  },
  {
    key: 'customer_name',
    header: 'Customer',
    render: (r) => String(r.customer_name ?? r.user_id ?? '—'),
  },
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
  {
    key: 'original_qty',
    header: 'Ordered',
    render: (r) => String(r.original_qty ?? r.quantity ?? '—'),
  },
  { key: 'quantity', header: 'Allocated', render: (r) => String(r.quantity ?? '—') },
  {
    key: 'dispatch_qty',
    header: 'Dispatched',
    render: (r) => {
      const d = r.dispatch_qty as number | null
      return d != null ? <span className="font-semibold text-slate-700">{d}</span> : <span className="text-slate-300">—</span>
    },
  },
  {
    key: 'order_status',
    header: 'Status',
    render: (r) => r.order_status ? <StatusBadge status={String(r.order_status)} /> : <span className="text-slate-400">—</span>,
  },
  {
    key: 'created_at',
    header: 'Timestamp',
    render: (r) => <span className="text-xs text-slate-500">{String(r.created_at ?? '—')}</span>,
  },
]

export default function LogisticsSupervisorPage() {
  const [dispatched, setDispatched] = useState<Set<string>>(new Set())

  const { data, isLoading } = useQuery({
    queryKey: ['confirmed-orders'],
    queryFn: () => getConfirmedOrders().then((r) => r.data),
    refetchInterval: 15000,
  })

  const [page, setPage] = useState(1)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const today = new Date().toISOString().slice(0, 10)

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['outbound-ledger', page, dateFrom, dateTo, 'dispatched'],
    queryFn: () =>
      getOutboundLedger({
        skip: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        status: 'dispatched',
      }).then((r) => r.data),
  })

  const orders = (data?.data ?? []).filter((o) => !dispatched.has(o.order_id))
  const total = data?.total ?? 0

  return (
    <div className="space-y-8">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Truck size={22} style={{ color: 'var(--brand-600)' }} />
        <div>
          <h1 className="text-xl font-bold text-slate-800">Logistics Supervisor</h1>
          <p className="text-sm text-slate-500">
            Verify quantities against the order before handing off to the delivery partner
          </p>
        </div>
        {total > 0 && (
          <span className="ml-2 px-2.5 py-0.5 text-sm font-bold rounded-full text-white" style={{ background: 'var(--brand-600)' }}>
            {total} awaiting
          </span>
        )}
      </div>

      {/* ── Confirmed orders ── */}
      <div className="space-y-4">
        {isLoading && (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">
            Loading orders…
          </div>
        )}

        {!isLoading && orders.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <PackageCheck size={36} className="mx-auto mb-3 text-emerald-400" />
            <p className="text-slate-600 font-medium">Nothing to dispatch</p>
            <p className="text-slate-400 text-sm mt-1">All confirmed orders have been handed off.</p>
          </div>
        )}

        {orders.map((order) => (
          <OrderCard
            key={order.order_id}
            order={order}
            onDispatched={() => setDispatched((prev) => new Set([...prev, order.order_id]))}
          />
        ))}
      </div>

      {/* ── Dispatch History ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
          <History size={17} className="text-slate-400" />
          <h2 className="font-semibold text-slate-700">Dispatch History</h2>
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
          <div className="ml-auto">
            <ExportButton
              data={(historyData?.data as Record<string, unknown>[]) ?? []}
              filename={`dispatch_history_${today}`}
            />
          </div>
        </div>

        <DataTable
          columns={historyColumns}
          data={(historyData?.data as OutboundRow[]) ?? []}
          loading={historyLoading}
          totalCount={historyData?.total ?? 0}
          page={page}
          onPageChange={setPage}
          pageSize={PAGE_SIZE}
          emptyMessage="No dispatched orders yet."
        />
      </div>

    </div>
  )
}

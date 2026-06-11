import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PackageCheck, CheckCircle, AlertTriangle, History } from 'lucide-react'
import {
  getAdminApproved,
  confirmInbound,
  getInboundLedger,
  type AdminApprovedItem,
  type ConfirmItemPayload,
  type InboundRow,
} from '@/services/inboundApi'
import DataTable, { type ColumnDef } from '@/components/shared/DataTable'
import StatusBadge from '@/components/shared/StatusBadge'
import ExportButton from '@/components/shared/ExportButton'

const PAGE_SIZE = 20

interface POGroup {
  procurement_id: string
  po_number: string
  vendor_name: string
  updated_at: string
  items: AdminApprovedItem[]
}

function groupByPO(items: AdminApprovedItem[]): POGroup[] {
  const map = new Map<string, POGroup>()
  for (const item of items) {
    if (!map.has(item.procurement_id)) {
      map.set(item.procurement_id, {
        procurement_id: item.procurement_id,
        po_number: item.po_number,
        vendor_name: item.vendor_name,
        updated_at: item.updated_at,
        items: [],
      })
    }
    map.get(item.procurement_id)!.items.push(item)
  }
  return Array.from(map.values())
}

// Per-PO editable state: { [procurement_item_id]: { final_qty, damaged_qty } }
type ItemState = Record<string, { final_qty: number; damaged_qty: number }>

function POCard({
  po,
  onConfirmed,
}: {
  po: POGroup
  onConfirmed: () => void
}) {
  const queryClient = useQueryClient()

  const [state, setState] = useState<ItemState>(() =>
    Object.fromEntries(
      po.items.map((item) => [
        item.procurement_item_id,
        { final_qty: item.received_qty, damaged_qty: 0 },
      ])
    )
  )

  const confirmMutation = useMutation({
    mutationFn: (payload: ConfirmItemPayload[]) =>
      confirmInbound(po.procurement_id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-approved'] })
      queryClient.invalidateQueries({ queryKey: ['inbound-ledger'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-grid'] })
      onConfirmed()
    },
  })

  function handleChange(
    itemId: string,
    field: 'final_qty' | 'damaged_qty',
    value: string
  ) {
    const num = Math.max(0, parseInt(value) || 0)
    setState((prev) => ({ ...prev, [itemId]: { ...prev[itemId], [field]: num } }))
  }

  function handleConfirm() {
    const payload: ConfirmItemPayload[] = po.items.map((item) => ({
      procurement_item_id: item.procurement_item_id,
      final_qty: state[item.procurement_item_id]?.final_qty ?? item.received_qty,
      damaged_qty: state[item.procurement_item_id]?.damaged_qty ?? 0,
    }))
    confirmMutation.mutate(payload)
  }

  const hasDamage = po.items.some(
    (item) => (state[item.procurement_item_id]?.damaged_qty ?? 0) > 0
  )

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-slate-100" style={{ background: 'var(--brand-50)' }}>
        <PackageCheck size={16} className="flex-shrink-0" style={{ color: 'var(--brand-600)' }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-sm font-semibold text-slate-700">{po.po_number}</span>
            <span className="text-slate-300">•</span>
            <span className="text-sm text-slate-600">{po.vendor_name}</span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-500">Admin approved: {po.updated_at}</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {po.items.length} line item{po.items.length > 1 ? 's' : ''} — verify quantities and note any damage before confirming
          </p>
        </div>
        {hasDamage && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-orange-50 text-orange-700 border border-orange-200 flex-shrink-0">
            <AlertTriangle size={11} /> Damage noted
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
              <th className="px-4 py-3 text-right">Received</th>
              <th className="px-4 py-3 text-right">Final Qty</th>
              <th className="px-4 py-3 text-right">Damaged Qty</th>
              <th className="px-4 py-3 text-right">Net → Inventory</th>
              <th className="px-4 py-3 text-left">Batch</th>
              <th className="px-4 py-3 text-left">Expiry</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {po.items.map((item) => {
              const s = state[item.procurement_item_id] ?? { final_qty: item.received_qty, damaged_qty: 0 }
              const net = Math.max(0, s.final_qty - s.damaged_qty)
              const hasDamageOnItem = s.damaged_qty > 0
              return (
                <tr key={item.procurement_item_id} className={`transition-colors ${hasDamageOnItem ? 'bg-orange-50/40' : 'hover:bg-slate-50/60'}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{item.product_name}</div>
                    <div className="text-xs text-slate-400">{item.variant_name}</div>
                    {item.brand_name && <div className="text-xs text-slate-400">{item.brand_name}</div>}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">{item.ordered_qty}</td>
                  <td className="px-4 py-3 text-right text-slate-700 font-medium">{item.received_qty}</td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      min={0}
                      value={s.final_qty}
                      onChange={(e) => handleChange(item.procurement_item_id, 'final_qty', e.target.value)}
                      className="w-20 px-2 py-1 text-sm text-right border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
                      style={{ '--tw-ring-color': 'var(--brand-400)' } as React.CSSProperties}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      min={0}
                      value={s.damaged_qty}
                      onChange={(e) => handleChange(item.procurement_item_id, 'damaged_qty', e.target.value)}
                      className={`w-20 px-2 py-1 text-sm text-right border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${
                        hasDamageOnItem
                          ? 'border-orange-300 bg-orange-50 text-orange-700'
                          : 'border-slate-200'
                      }`}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-semibold ${net === 0 ? 'text-rose-500' : 'text-slate-800'}`}>
                      {net}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.batch_no ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{item.expiry_date ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
        <p className="text-xs text-slate-500">
          Net qty = Final − Damaged. Only net qty goes to inventory. Damaged qty is recorded for tracking.
        </p>
        <button
          disabled={confirmMutation.isPending}
          onClick={handleConfirm}
          className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-50 transition-colors"
          style={{ background: 'var(--brand-600)' }}
          onMouseEnter={(e) => { if (!confirmMutation.isPending) (e.currentTarget as HTMLButtonElement).style.background = 'var(--brand-700)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--brand-600)' }}
        >
          <CheckCircle size={15} />
          {confirmMutation.isPending ? 'Confirming…' : 'Confirm & Add to Inventory'}
        </button>
      </div>
    </div>
  )
}

const historyColumns: ColumnDef<InboundRow>[] = [
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
    key: 'damaged_qty',
    header: 'Damaged',
    render: (r) => {
      const d = (r.damaged_qty as number) ?? 0
      return d > 0
        ? <span className="font-semibold text-orange-600">{d}</span>
        : <span className="text-slate-300">—</span>
    },
  },
  {
    key: 'net_qty',
    header: 'Net to Inventory',
    render: (r) => {
      const recv = (r.received_qty as number) ?? 0
      const dmg = (r.damaged_qty as number) ?? 0
      const net = recv - dmg
      return <span className="font-semibold text-slate-700">{net}</span>
    },
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
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set())

  // Pending confirmation
  const { data, isLoading } = useQuery({
    queryKey: ['admin-approved'],
    queryFn: () => getAdminApproved().then((r) => r.data),
    refetchInterval: 15000,
  })

  // History
  const [page, setPage] = useState(1)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const today = new Date().toISOString().slice(0, 10)

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['inbound-ledger', page, dateFrom, dateTo, 'approved'],
    queryFn: () =>
      getInboundLedger({
        skip: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        status: 'approved',
      }).then((r) => r.data),
  })

  const items = data?.data ?? []
  const total = data?.total ?? 0
  const groups = groupByPO(items).filter((po) => !confirmed.has(po.procurement_id))

  return (
    <div className="space-y-8">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <PackageCheck size={22} style={{ color: 'var(--brand-600)' }} />
        <div>
          <h1 className="text-xl font-bold text-slate-800">Incoming — Awaiting Confirmation</h1>
          <p className="text-sm text-slate-500">
            Verify quantities, note any damage, then confirm to add to inventory
          </p>
        </div>
        {total > 0 && (
          <span className="ml-2 px-2.5 py-0.5 text-sm font-bold rounded-full text-white" style={{ background: 'var(--brand-600)' }}>
            {total} awaiting
          </span>
        )}
      </div>

      {/* ── Pending cards ── */}
      <div className="space-y-4">
        {isLoading && (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">
            Loading shipments…
          </div>
        )}

        {!isLoading && groups.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <CheckCircle size={36} className="mx-auto mb-3 text-emerald-400" />
            <p className="text-slate-600 font-medium">Nothing to confirm</p>
            <p className="text-slate-400 text-sm mt-1">All admin-approved shipments have been processed.</p>
          </div>
        )}

        {groups.map((po) => (
          <POCard
            key={po.procurement_id}
            po={po}
            onConfirmed={() => setConfirmed((prev) => new Set([...prev, po.procurement_id]))}
          />
        ))}
      </div>

      {/* ── Confirmed History ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
          <History size={17} className="text-slate-400" />
          <h2 className="font-semibold text-slate-700">Confirmed History</h2>
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
              filename={`inbound_confirmed_${today}`}
            />
          </div>
        </div>

        <DataTable
          columns={historyColumns}
          data={(historyData?.data as InboundRow[]) ?? []}
          loading={historyLoading}
          totalCount={historyData?.total ?? 0}
          page={page}
          onPageChange={setPage}
          pageSize={PAGE_SIZE}
          emptyMessage="No confirmed records yet."
        />
      </div>

    </div>
  )
}

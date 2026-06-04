import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings2, AlertTriangle, Calendar, Layers, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { daysLabel } from '@/lib/utils'
import { deleteBatch } from '@/services/inventoryApi'

export interface BatchDetail {
  inventory_id: string
  batch_no: string | null
  qty: number
  sell_before_date: string | null
  expiry_date: string | null
  days_until_expiry: number | null
  created_at: string
}

export interface InventoryItem {
  variant_id: string
  variant_name: string
  product_name: string
  brand_name: string
  brand_id: string
  cat_id: string
  total_qty: number
  min_stock_level: number
  max_stock_level: number | null
  sell_before_date: string | null
  days_until_expiry: number | null
  batch_count: number
  batches: BatchDetail[]
  blocked: boolean
  block_reason: string
  card_status: 'green' | 'orange' | 'red'
  oldest_intake: string
  threshold_id: string | null
  reorder_point: number | null
  reorder_qty: number | null
}

interface InventoryCardProps {
  item: InventoryItem
  onEditThreshold: (item: InventoryItem) => void
}

const statusBorder: Record<string, string> = {
  green: 'border-l-emerald-400',
  orange: 'border-l-amber-400',
  red: 'border-l-rose-500',
}

const statusQtyColor: Record<string, string> = {
  green: 'text-emerald-600',
  orange: 'text-amber-600',
  red: 'text-rose-600',
}

const expiryColor = (days: number | null): string => {
  if (days === null) return 'text-slate-400'
  if (days < 0) return 'text-rose-600 font-semibold'
  if (days <= 1) return 'text-rose-500 font-semibold'
  if (days <= 3) return 'text-amber-500 font-medium'
  return 'text-slate-500'
}

const batchRowBg = (days: number | null): string => {
  if (days === null) return ''
  if (days < 0) return 'bg-rose-50'
  if (days <= 1) return 'bg-rose-50'
  if (days <= 3) return 'bg-amber-50'
  return ''
}

const batchRowDot = (days: number | null): string => {
  if (days === null) return 'bg-slate-300'
  if (days < 0) return 'bg-rose-500'
  if (days <= 1) return 'bg-rose-400'
  if (days <= 3) return 'bg-amber-400'
  return 'bg-emerald-400'
}

export default function InventoryCard({ item, onEditThreshold }: InventoryCardProps) {
  const [expanded, setExpanded] = useState(false)
  const queryClient = useQueryClient()

  const { mutate: removeBatch, variables: deletingId } = useMutation({
    mutationFn: (inventoryId: string) => deleteBatch(inventoryId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory-grid'] }),
  })

  return (
    <div
      className={cn(
        'relative bg-white rounded-xl shadow-sm border border-slate-100 border-l-4 flex flex-col hover:shadow-md transition-shadow',
        statusBorder[item.card_status] ?? 'border-l-slate-200'
      )}
    >
      {/* Main card content */}
      <div className="p-5 flex flex-col gap-3">

        {/* Top row: name + gear */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-800 text-sm leading-tight truncate">
              {item.product_name}
            </p>
            <p className="text-xs text-slate-500 mt-0.5 truncate">{item.variant_name}</p>
          </div>
          <button
            onClick={() => onEditThreshold(item)}
            className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            title="Edit thresholds"
          >
            <Settings2 size={15} />
          </button>
        </div>

        {/* Brand badge */}
        <div>
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-600 rounded-md border border-blue-100">
            {item.brand_name || '—'}
          </span>
        </div>

        {/* Total qty */}
        <div className="flex items-end gap-1">
          <span className={cn('text-3xl font-bold leading-none', statusQtyColor[item.card_status])}>
            {item.total_qty.toLocaleString()}
          </span>
          <span className="text-sm text-slate-400 mb-0.5">units</span>
        </div>

        {/* Stock levels */}
        <div className="text-xs text-slate-400 flex gap-3">
          <span>Min: <span className="text-slate-600 font-medium">{item.min_stock_level}</span></span>
          {item.max_stock_level !== null && (
            <span>Max: <span className="text-slate-600 font-medium">{item.max_stock_level}</span></span>
          )}
          {item.reorder_point !== null && (
            <span>Reorder @ <span className="text-slate-600 font-medium">{item.reorder_point}</span></span>
          )}
        </div>

        {/* Earliest sell before */}
        {item.sell_before_date && (
          <div className="flex items-center gap-1.5 text-xs">
            <Calendar size={12} className="text-slate-400 flex-shrink-0" />
            <span className="text-slate-500">Sell before:</span>
            <span className="text-slate-700 font-medium">{item.sell_before_date}</span>
            <span className={cn(expiryColor(item.days_until_expiry))}>
              ({daysLabel(item.days_until_expiry)})
            </span>
          </div>
        )}

        {/* Batch count row — clickable toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center justify-between w-full text-xs text-slate-500 hover:text-blue-600 transition-colors group"
        >
          <span className="flex items-center gap-1.5">
            <Layers size={12} />
            <span className="group-hover:underline">
              {item.batch_count} batch{item.batch_count !== 1 ? 'es' : ''}
            </span>
            <span className="text-slate-400">— click to {expanded ? 'collapse' : 'expand'}</span>
          </span>
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        {/* Blocked banner */}
        {item.blocked && (
          <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            <AlertTriangle size={14} className="text-rose-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-rose-600">Dispatch Blocked</p>
              {item.block_reason && (
                <p className="text-xs text-rose-500 mt-0.5 leading-tight">{item.block_reason}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Expandable batch breakdown */}
      {expanded && item.batches.length > 0 && (
        <div className="border-t border-slate-100 px-3 pb-3">
          <table className="w-full text-xs mt-2">
            <thead>
              <tr className="text-slate-400 uppercase tracking-wide">
                <th className="text-left py-1.5 px-2 font-semibold">Batch</th>
                <th className="text-right py-1.5 px-2 font-semibold">Qty</th>
                <th className="text-right py-1.5 px-2 font-semibold">Sell Before</th>
                <th className="text-right py-1.5 px-2 font-semibold">Status</th>
                <th className="py-1.5 px-2 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {item.batches.map((batch, idx) => {
                const isDeletable = batch.qty === 0 || (batch.days_until_expiry !== null && batch.days_until_expiry < 0)
                const isDeleting = deletingId === batch.inventory_id
                return (
                  <tr
                    key={batch.inventory_id}
                    className={cn(
                      'rounded transition-opacity',
                      batchRowBg(batch.days_until_expiry),
                      isDeleting && 'opacity-40'
                    )}
                  >
                    {/* Batch no or fallback */}
                    <td className="py-1.5 px-2">
                      <div className="flex items-center gap-1.5">
                        <span className={cn('w-2 h-2 rounded-full flex-shrink-0', batchRowDot(batch.days_until_expiry))} />
                        <span className="font-medium text-slate-700">
                          {batch.batch_no ?? `Batch ${idx + 1}`}
                        </span>
                      </div>
                    </td>
                    {/* Qty */}
                    <td className="py-1.5 px-2 text-right font-semibold text-slate-700">
                      {batch.qty.toLocaleString()}
                    </td>
                    {/* Sell before date */}
                    <td className="py-1.5 px-2 text-right text-slate-500">
                      {batch.sell_before_date ?? '—'}
                    </td>
                    {/* Days left */}
                    <td className={cn('py-1.5 px-2 text-right font-medium', expiryColor(batch.days_until_expiry))}>
                      {daysLabel(batch.days_until_expiry)}
                    </td>
                    {/* Delete */}
                    <td className="py-1.5 px-2 text-right">
                      {isDeletable && (
                        <button
                          onClick={() => removeBatch(batch.inventory_id)}
                          disabled={isDeleting}
                          title={batch.qty === 0 ? 'Delete empty batch' : 'Delete expired batch'}
                          className="p-1 rounded text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors disabled:cursor-not-allowed"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
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

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Package, Settings2, AlertTriangle, Calendar, Layers } from 'lucide-react'
import { getInventoryGrid, updateThreshold } from '@/services/inventoryApi'
import { type InventoryItem, expiryColor } from '@/components/inventory/InventoryCard'
import InventoryFilters from '@/components/inventory/InventoryFilters'
import ThresholdEditModal from '@/components/inventory/ThresholdEditModal'
import InventoryDetailModal from '@/components/inventory/InventoryDetailModal'
import { type ThresholdUpdateData } from '@/services/inventoryApi'
import { cn, daysLabel } from '@/lib/utils'

const statusDot: Record<string, string> = {
  green: 'bg-emerald-400',
  orange: 'bg-amber-400',
  red: 'bg-rose-500',
}

const statusQtyColor: Record<string, string> = {
  green: 'text-emerald-600',
  orange: 'text-amber-600',
  red: 'text-rose-600',
}

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-50">
      {Array.from({ length: 9 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${40 + (i % 3) * 20}%` }} />
        </td>
      ))}
    </tr>
  )
}

export default function InventoryGrid() {
  const queryClient = useQueryClient()
  const [selectedBrandId, setSelectedBrandId] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [search, setSearch] = useState('')
  const [editItem, setEditItem] = useState<InventoryItem | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-grid', selectedBrandId, selectedStatus],
    queryFn: () =>
      getInventoryGrid({
        brand_id: selectedBrandId || undefined,
        status_filter: selectedStatus || undefined,
      }).then((r) => r.data),
  })

  const saveMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ThresholdUpdateData }) =>
      updateThreshold(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-grid'] })
      setModalOpen(false)
      setEditItem(null)
      setSaveError('')
    },
    onError: () => {
      setSaveError('Failed to save. Please try again.')
    },
  })

  const brands = useMemo(() => {
    if (!data?.data) return []
    const map = new Map<string, string>()
    data.data.forEach((item) => {
      if (!map.has(item.brand_id)) map.set(item.brand_id, item.brand_name)
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [data])

  const filteredItems = useMemo(() => {
    if (!data?.data) return []
    let items = data.data
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter(
        (item) =>
          item.product_name.toLowerCase().includes(q) ||
          item.variant_name.toLowerCase().includes(q)
      )
    }
    return [...items].sort((a, b) => a.product_name.localeCompare(b.product_name))
  }, [data, search])

  // Always derive selectedItem from fresh data so it updates after mutations
  const selectedItem = useMemo(() => {
    if (!selectedVariantId || !data?.data) return null
    return data.data.find((i) => i.variant_id === selectedVariantId) ?? null
  }, [selectedVariantId, data])

  const handleEditThreshold = (item: InventoryItem) => {
    setEditItem(item)
    setModalOpen(true)
    setSaveError('')
  }

  const handleSave = (thresholdId: string, formData: ThresholdUpdateData) => {
    saveMutation.mutate({ id: thresholdId, data: formData })
  }

  const handleRowClick = (item: InventoryItem) => {
    setSelectedVariantId(item.variant_id)
    setDetailOpen(true)
  }

  return (
    <div className="space-y-5">
      <InventoryFilters
        brands={brands}
        selectedBrandId={selectedBrandId}
        onBrandChange={setSelectedBrandId}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        search={search}
        onSearchChange={setSearch}
      />

      {!isLoading && data && (
        <p className="text-sm text-slate-500">
          Showing{' '}
          <span className="font-semibold text-slate-700">{filteredItems.length}</span>{' '}
          of{' '}
          <span className="font-semibold text-slate-700">{data.data.length}</span>{' '}
          items
        </p>
      )}

      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['', 'Product', 'Brand', 'Qty', 'Min', 'Max', 'Reorder @', 'Sell Before', 'Batches', ''].map((h, i) => (
                  <th key={i} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
            </tbody>
          </table>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400 bg-white rounded-xl border border-slate-100">
          <Package size={40} className="opacity-30" />
          <p className="text-sm">No inventory items match the current filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 w-6" />
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Product</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Brand</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Qty</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Min</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Max</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Reorder @</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    <span className="flex items-center gap-1"><Calendar size={11} />Sell Before</span>
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    <span className="flex items-center justify-end gap-1"><Layers size={11} />Batches</span>
                  </th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredItems.map((item) => (
                  <tr
                    key={item.variant_id}
                    onClick={() => handleRowClick(item)}
                    className="hover:bg-blue-50/40 cursor-pointer transition-colors group"
                  >
                    {/* Status dot */}
                    <td className="px-4 py-3">
                      <span className={cn('inline-block w-2 h-2 rounded-full', statusDot[item.card_status] ?? 'bg-slate-300')} />
                    </td>

                    {/* Product name + variant */}
                    <td className="px-4 py-3 min-w-[160px]">
                      <p className="font-medium text-slate-800 leading-tight">{item.product_name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{item.variant_name}</p>
                    </td>

                    {/* Brand */}
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-600 rounded-md border border-blue-100 whitespace-nowrap">
                        {item.brand_name || '—'}
                      </span>
                    </td>

                    {/* Total qty */}
                    <td className={cn('px-4 py-3 text-right font-bold tabular-nums', statusQtyColor[item.card_status])}>
                      {item.total_qty.toLocaleString()}
                    </td>

                    {/* Min */}
                    <td className="px-4 py-3 text-right text-xs text-slate-500 tabular-nums">
                      {item.min_stock_level}
                    </td>

                    {/* Max */}
                    <td className="px-4 py-3 text-right text-xs text-slate-500 tabular-nums">
                      {item.max_stock_level !== null ? item.max_stock_level : <span className="text-slate-300">—</span>}
                    </td>

                    {/* Reorder point */}
                    <td className="px-4 py-3 text-right text-xs text-slate-500 tabular-nums">
                      {item.reorder_point !== null ? item.reorder_point : <span className="text-slate-300">—</span>}
                    </td>

                    {/* Sell before */}
                    <td className="px-4 py-3 text-xs min-w-[140px]">
                      {item.sell_before_date ? (
                        <span className="flex items-center gap-1.5">
                          <span className="text-slate-600">{item.sell_before_date}</span>
                          <span className={cn(expiryColor(item.days_until_expiry))}>
                            ({daysLabel(item.days_until_expiry)})
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Batches + blocked warning */}
                    <td className="px-4 py-3 text-right text-xs text-slate-500">
                      <span className="flex items-center justify-end gap-1.5">
                        {item.blocked && (
                          <span title={item.block_reason}>
                            <AlertTriangle size={12} className="text-rose-500 flex-shrink-0" />
                          </span>
                        )}
                        {item.batch_count}
                      </span>
                    </td>

                    {/* Settings gear — stops row-click propagation */}
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEditThreshold(item) }}
                        className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-100 hover:text-slate-600 transition-colors opacity-0 group-hover:opacity-100"
                        title="Edit thresholds"
                      >
                        <Settings2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {saveError && (
        <p className="text-sm text-rose-600 text-center">{saveError}</p>
      )}

      <InventoryDetailModal
        item={selectedItem}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onEditThreshold={handleEditThreshold}
      />

      <ThresholdEditModal
        item={editItem}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditItem(null)
          setSaveError('')
        }}
        onSave={handleSave}
        saving={saveMutation.isPending}
      />
    </div>
  )
}

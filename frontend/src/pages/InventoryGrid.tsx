import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Package } from 'lucide-react'
import { getInventoryGrid, updateThreshold } from '@/services/inventoryApi'
import InventoryCard, { type InventoryItem } from '@/components/inventory/InventoryCard'
import InventoryFilters from '@/components/inventory/InventoryFilters'
import ThresholdEditModal from '@/components/inventory/ThresholdEditModal'
import { type ThresholdUpdateData } from '@/services/inventoryApi'

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-3">
      <div className="flex justify-between">
        <div className="space-y-1.5 flex-1">
          <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4" />
          <div className="h-3 bg-slate-100 rounded animate-pulse w-1/2" />
        </div>
        <div className="w-7 h-7 bg-slate-100 rounded animate-pulse" />
      </div>
      <div className="h-6 bg-slate-100 rounded animate-pulse w-16" />
      <div className="h-8 bg-slate-100 rounded animate-pulse w-20" />
      <div className="h-3 bg-slate-100 rounded animate-pulse w-full" />
    </div>
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

  // Derive brand list from items
  const brands = useMemo(() => {
    if (!data?.data) return []
    const map = new Map<string, string>()
    data.data.forEach((item) => {
      if (!map.has(item.brand_id)) map.set(item.brand_id, item.brand_name)
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [data])

  // Client-side search filter
  const filteredItems = useMemo(() => {
    if (!data?.data) return []
    if (!search.trim()) return data.data
    const q = search.toLowerCase()
    return data.data.filter(
      (item) =>
        item.product_name.toLowerCase().includes(q) ||
        item.variant_name.toLowerCase().includes(q)
    )
  }, [data, search])

  const handleEditThreshold = (item: InventoryItem) => {
    setEditItem(item)
    setModalOpen(true)
    setSaveError('')
  }

  const handleSave = (thresholdId: string, formData: ThresholdUpdateData) => {
    saveMutation.mutate({ id: thresholdId, data: formData })
  }

  return (
    <div className="space-y-5">
      {/* Filters */}
      <InventoryFilters
        brands={brands}
        selectedBrandId={selectedBrandId}
        onBrandChange={setSelectedBrandId}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        search={search}
        onSearchChange={setSearch}
      />

      {/* Count */}
      {!isLoading && data && (
        <p className="text-sm text-slate-500">
          Showing{' '}
          <span className="font-semibold text-slate-700">{filteredItems.length}</span>{' '}
          of{' '}
          <span className="font-semibold text-slate-700">{data.data.length}</span>{' '}
          items
        </p>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400 bg-white rounded-xl border border-slate-100">
          <Package size={40} className="opacity-30" />
          <p className="text-sm">No inventory items match the current filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map((item) => (
            <InventoryCard
              key={item.variant_id}
              item={item}
              onEditThreshold={handleEditThreshold}
            />
          ))}
        </div>
      )}

      {/* Save error */}
      {saveError && (
        <p className="text-sm text-rose-600 text-center">{saveError}</p>
      )}

      {/* Threshold modal */}
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

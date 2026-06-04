import { Search, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InventoryFiltersProps {
  brands: { id: string; name: string }[]
  selectedBrandId: string
  onBrandChange: (brandId: string) => void
  selectedStatus: string
  onStatusChange: (status: string) => void
  search: string
  onSearchChange: (v: string) => void
}

const statusOptions = [
  { value: '', label: 'All' },
  { value: 'green', label: 'Healthy' },
  { value: 'orange', label: 'Warning' },
  { value: 'red', label: 'Critical' },
]

const statusColor: Record<string, string> = {
  '': 'bg-slate-100 text-slate-600 hover:bg-slate-200',
  green: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
  orange: 'bg-amber-100 text-amber-700 hover:bg-amber-200',
  red: 'bg-rose-100 text-rose-700 hover:bg-rose-200',
}

const statusActiveColor: Record<string, string> = {
  '': 'bg-slate-700 text-white',
  green: 'bg-emerald-600 text-white',
  orange: 'bg-amber-500 text-white',
  red: 'bg-rose-600 text-white',
}

export default function InventoryFilters({
  brands,
  selectedBrandId,
  onBrandChange,
  selectedStatus,
  onStatusChange,
  search,
  onSearchChange,
}: InventoryFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Brand selector */}
      <div className="relative">
        <select
          value={selectedBrandId}
          onChange={(e) => onBrandChange(e.target.value)}
          className="appearance-none pl-3 pr-8 py-2 text-sm text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 cursor-pointer hover:border-slate-300 transition-colors"
        >
          <option value="">All Brands</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>

      {/* Status pills */}
      <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1">
        {statusOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onStatusChange(opt.value)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
              selectedStatus === opt.value
                ? statusActiveColor[opt.value]
                : statusColor[opt.value]
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-[320px]">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search product or variant…"
          className="w-full pl-9 pr-4 py-2 text-sm text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 placeholder-slate-400 transition-colors"
        />
      </div>
    </div>
  )
}

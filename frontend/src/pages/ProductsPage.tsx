import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, X, Check, Package, ChevronDown, Pencil, Trash2 } from 'lucide-react'
import { getProducts, getBrands, createProduct, updateProduct, deleteProduct, type CreateProductPayload, type ProductRow } from '@/services/productApi'
import { cn } from '@/lib/utils'

const inputCls =
  'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400'
const labelCls = 'block text-xs font-medium text-slate-600 mb-1'

function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
}: {
  value: string
  onChange: (val: string) => void
  options: { value: string; label: string; className?: string }[]
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })

  useEffect(() => {
    if (!open || !triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 4, left: r.left, width: r.width })
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!triggerRef.current?.closest('[data-csel]')?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selected = options.find((o) => o.value === value)

  return (
    <div data-csel className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          inputCls,
          'flex items-center justify-between text-left gap-2',
          open && 'ring-2 ring-blue-500/30 border-blue-400'
        )}
      >
        <span className={cn('flex-1 truncate', selected ? 'text-slate-800' : 'text-slate-400')}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={14} className={cn('flex-shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open &&
        createPortal(
          <div
            style={{ top: pos.top, left: pos.left, width: pos.width }}
            className="fixed z-[9999] bg-white border border-slate-200 rounded-lg shadow-xl overflow-y-auto max-h-56"
          >
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  onChange(o.value)
                  setOpen(false)
                }}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm transition-colors',
                  o.value === value
                    ? 'bg-blue-50 text-blue-600 font-medium'
                    : 'text-slate-700 hover:bg-slate-50',
                  o.className
                )}
              >
                {o.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  )
}

const PRODUCT_TYPES = [
  { value: 'dairy', label: 'Dairy' },
  { value: 'fresh', label: 'Fresh Produce' },
  { value: 'packaged', label: 'Packaged' },
  { value: 'beverage', label: 'Beverage' },
  { value: 'frozen', label: 'Frozen' },
  { value: 'meat', label: 'Meat & Poultry' },
  { value: 'bakery', label: 'Bakery' },
  { value: 'other', label: 'Other' },
]

const UNIT_OPTIONS = ['G', 'KG', 'ML', 'L', 'PCS', 'Pack', 'Dozen', 'Box']

const EMPTY_FORM: CreateProductPayload = {
  product_name: '',
  brand_id: '',
  brand_name: '',
  type: 'other',
  description: '',
  unit: 'G',
  quantity: 1,
  base_price: 0,
  base_mrp: 0,
  buying_price: 0,
  sell_before_days: 7,
  temperature_required: 4,
  min_stock_level: 10,
  max_stock_level: 500,
  reorder_point: 25,
  reorder_qty: 100,
}

export default function ProductsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<CreateProductPayload>(EMPTY_FORM)
  const [saved, setSaved] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['products', search, brandFilter],
    queryFn: () =>
      getProducts({ q: search || undefined, brand_id: brandFilter || undefined }).then((r) => r.data),
  })

  const { data: brandsData } = useQuery({
    queryKey: ['brands'],
    queryFn: () => getBrands().then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['brands'] })
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        setShowModal(false)
        setForm(EMPTY_FORM)
      }, 1200)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CreateProductPayload }) =>
      updateProduct(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        setShowModal(false)
        setForm(EMPTY_FORM)
        setEditingId(null)
      }, 1200)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      setDeleteConfirmId(null)
    },
  })

  const openEdit = (p: ProductRow) => {
    const v = p.variants[0]
    setForm({
      product_name: p.product_name,
      brand_id: p.brand_id ?? '',
      brand_name: '',
      type: p.type ?? 'other',
      description: p.description ?? '',
      unit: v?.unit ?? 'G',
      quantity: v?.quantity ?? 1,
      base_price: v?.base_price ?? 0,
      base_mrp: v?.base_mrp ?? 0,
      buying_price: v?.buying_price ?? 0,
      sell_before_days: v?.sell_before_days ?? 7,
      temperature_required: v?.temperature_required ?? 4,
      min_stock_level: v?.min_stock_level ?? 10,
      max_stock_level: v?.max_stock_level ?? 500,
      reorder_point: v?.reorder_point ?? 25,
      reorder_qty: v?.reorder_qty ?? 100,
    })
    setEditingId(p.product_id)
    setShowModal(true)
  }

  const handleSubmit = () => {
    if (!form.product_name.trim()) return
    const isNewBrand = form.brand_id === '__new__'
    if (isNewBrand && !form.brand_name?.trim()) return
    if (!isNewBrand && !form.brand_id) return
    const payload = {
      ...form,
      brand_id: !isNewBrand ? form.brand_id : undefined,
      brand_name: isNewBrand ? form.brand_name : undefined,
      description: form.description || undefined,
      base_mrp: form.base_mrp || form.base_price,
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const set = (key: keyof CreateProductPayload, value: string | number) =>
    setForm((f) => ({ ...f, [key]: value }))

  const brands = brandsData ?? []
  const products = data?.data ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
            <Package size={20} className="text-blue-600" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-800">Products</h2>
            <p className="text-sm text-slate-500">{data?.total ?? 0} products registered</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={16} />
          Add Product
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className={cn(inputCls, 'pl-8')}
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className={cn(inputCls, 'w-44')}
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value)}
        >
          <option value="">All Brands</option>
          {brands.map((b) => (
            <option key={b.brand_id} value={b.brand_id}>{b.name}</option>
          ))}
        </select>
      </div>

      {/* Product List */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading...</div>
        ) : products.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No products found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr className="text-xs text-slate-500 uppercase tracking-wide">
                <th className="text-left px-5 py-3 font-semibold">Product</th>
                <th className="text-left px-5 py-3 font-semibold">Brand</th>
                <th className="text-left px-5 py-3 font-semibold">Type</th>
                <th className="text-left px-5 py-3 font-semibold">Unit</th>
                <th className="text-right px-5 py-3 font-semibold">Sell Price</th>
                <th className="text-right px-5 py-3 font-semibold">Cost Price</th>
                <th className="text-right px-5 py-3 font-semibold">Shelf Life</th>
                <th className="text-right px-5 py-3 font-semibold">Min / Max</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {products.map((p) => {
                const v = p.variants[0]
                return (
                  <tr key={p.product_id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-slate-800">{p.product_name}</td>
                    <td className="px-5 py-3 text-slate-500">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs font-medium">
                        {p.brand_name}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-500 capitalize">{p.type ?? '—'}</td>
                    <td className="px-5 py-3 text-slate-500">{v?.unit ?? '—'}</td>
                    <td className="px-5 py-3 text-right font-medium text-slate-700">
                      {v?.base_price != null ? `₹${v.base_price}` : '—'}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-500">
                      {v?.buying_price != null ? `₹${v.buying_price}` : '—'}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-500">
                      {v?.sell_before_days != null ? `${v.sell_before_days}d` : '—'}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-500">
                      {v?.min_stock_level != null && v?.max_stock_level != null
                        ? `${v.min_stock_level} / ${v.max_stock_level}`
                        : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(p)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(p.product_id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (() => {
        const target = products.find((p) => p.product_id === deleteConfirmId)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Trash2 size={18} className="text-red-500" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">Delete product?</p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    <span className="font-medium text-slate-700">{target?.product_name}</span> will be permanently removed.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteMutation.mutate(deleteConfirmId)}
                  disabled={deleteMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-60"
                >
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Add / Edit Product Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">{editingId ? 'Edit Product' : 'Add New Product'}</h3>
              <button
                onClick={() => { setShowModal(false); setForm(EMPTY_FORM); setEditingId(null) }}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-6">
              {/* Section: Product Info */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Product Info</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className={labelCls}>Product Name *</label>
                    <input className={inputCls} value={form.product_name} onChange={(e) => set('product_name', e.target.value)} placeholder="e.g. Al Ain Skimmed Milk" />
                  </div>
                  <div>
                    <label className={labelCls}>Brand *</label>
                    {form.brand_id === '__new__' ? (
                      <div className="flex gap-2">
                        <input
                          className={inputCls}
                          placeholder="New brand name..."
                          value={form.brand_name ?? ''}
                          onChange={(e) => set('brand_name', e.target.value)}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, brand_id: '', brand_name: '' }))}
                          className="px-3 py-2 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <CustomSelect
                        value={form.brand_id}
                        onChange={(v) => set('brand_id', v)}
                        placeholder="Select brand..."
                        options={[
                          ...brands.map((b) => ({ value: b.brand_id, label: b.name })),
                          { value: '__new__', label: '+ Add new brand', className: 'text-blue-600 font-medium border-t border-slate-100' },
                        ]}
                      />
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>Type</label>
                    <CustomSelect
                      value={form.type}
                      onChange={(v) => set('type', v)}
                      options={PRODUCT_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Description (optional)</label>
                    <input className={inputCls} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Short description..." />
                  </div>
                </div>
              </div>

              {/* Section: Variant / Pricing */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Pricing & Unit</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Unit *</label>
                    <CustomSelect
                      value={form.unit}
                      onChange={(v) => set('unit', v)}
                      options={UNIT_OPTIONS.map((u) => ({ value: u, label: u }))}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Qty per Unit (e.g. 250 for 250g)</label>
                    <input type="number" className={inputCls} value={form.quantity} onChange={(e) => set('quantity', parseFloat(e.target.value) || 1)} />
                  </div>
                  <div>
                    <label className={labelCls}>Selling Price (₹) *</label>
                    <input type="number" className={inputCls} value={form.base_price} onChange={(e) => set('base_price', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label className={labelCls}>MRP (₹)</label>
                    <input type="number" className={inputCls} value={form.base_mrp} onChange={(e) => set('base_mrp', parseFloat(e.target.value) || 0)} placeholder="Leave 0 to use selling price" />
                  </div>
                  <div>
                    <label className={labelCls}>Cost / Buying Price (₹) *</label>
                    <input type="number" className={inputCls} value={form.buying_price} onChange={(e) => set('buying_price', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label className={labelCls}>Shelf Life (days) *</label>
                    <input type="number" className={inputCls} value={form.sell_before_days} onChange={(e) => set('sell_before_days', parseInt(e.target.value) || 1)} />
                  </div>
                  <div>
                    <label className={labelCls}>Storage Temp (°C)</label>
                    <input type="number" className={inputCls} value={form.temperature_required} onChange={(e) => set('temperature_required', parseInt(e.target.value) || 0)} />
                  </div>
                </div>
              </div>

              {/* Section: Alert Thresholds */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Stock Thresholds</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Min Stock Level *</label>
                    <input type="number" className={inputCls} value={form.min_stock_level} onChange={(e) => set('min_stock_level', parseInt(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label className={labelCls}>Max Stock Level *</label>
                    <input type="number" className={inputCls} value={form.max_stock_level} onChange={(e) => set('max_stock_level', parseInt(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label className={labelCls}>Reorder Point *</label>
                    <input type="number" className={inputCls} value={form.reorder_point} onChange={(e) => set('reorder_point', parseInt(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label className={labelCls}>Reorder Qty *</label>
                    <input type="number" className={inputCls} value={form.reorder_qty} onChange={(e) => set('reorder_qty', parseInt(e.target.value) || 0)} />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button
                onClick={() => { setShowModal(false); setForm(EMPTY_FORM); setEditingId(null) }}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending || saved}
                className={cn(
                  'flex items-center gap-2 px-5 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-60',
                  saved ? 'bg-emerald-500' : 'bg-blue-600 hover:bg-blue-700'
                )}
              >
                {saved
                  ? <><Check size={14} /> Saved!</>
                  : createMutation.isPending || updateMutation.isPending
                  ? 'Saving...'
                  : editingId ? 'Update Product' : 'Save Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

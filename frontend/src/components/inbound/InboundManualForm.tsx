import { useState, useEffect, useRef, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  X, Plus, Trash2, Thermometer, ShieldAlert, Package,
  ChevronDown, Laptop, Smartphone, Loader2, CheckCircle, AlertCircle,
} from 'lucide-react'
import { getVendorList } from '@/services/vendorApi'
import { searchVariants, quickAddProduct, type VariantOption } from '@/services/productApi'
import { submitManualInbound, type UploadResult } from '@/services/inboundApi'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ItemDraft {
  _id: string
  variant_id: string
  variant_label: string
  sell_before_days: number
  temperature_required: number
  ordered_qty: string
  received_qty: string
  temperature_measured: string
  unit_cost: string
  expiry_date: string
  sell_before_date: string
  batch_no: string
  procurement_item_id?: string  // set when linked to a PO
  ordered_qty_ref?: number       // reference qty from PO
}

export interface FormDraft {
  vendor_id: string
  vendor_invoice_number: string
  expected_receive_date: string
  expected_receive_time: string
  notes: string
  items: ItemDraft[]
}

interface NewProductForm {
  product_name: string
  brand_name: string
  type: string
  variant_name: string
  unit: string
  quantity: string
  base_mrp: string
  sell_before_days: string
  temperature_required: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DRAFT_KEY = 'qk_inbound_draft'
export const TEMP_THRESHOLD = 8

export const PRODUCT_TYPES = [
  { value: 'dairy', label: 'Dairy' },
  { value: 'fresh', label: 'Fresh Produce' },
  { value: 'packaged', label: 'Packaged' },
  { value: 'beverage', label: 'Beverage' },
  { value: 'frozen', label: 'Frozen' },
  { value: 'other', label: 'Other' },
]

export const UNIT_OPTIONS = ['kg', 'litre', 'piece', 'pack', 'dozen', 'box', 'gm', 'ml']

export function emptyItem(): ItemDraft {
  return {
    _id: crypto.randomUUID(),
    variant_id: '',
    variant_label: '',
    sell_before_days: 7,
    temperature_required: 0,
    ordered_qty: '',
    received_qty: '',
    temperature_measured: '',
    unit_cost: '',
    expiry_date: '',
    sell_before_date: '',
    batch_no: '',
  }
}

function defaultDraft(): FormDraft {
  return {
    vendor_id: '',
    vendor_invoice_number: '',
    expected_receive_date: '',
    expected_receive_time: '',
    notes: '',
    items: [emptyItem()],
  }
}

function loadDraft(): FormDraft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return defaultDraft()
}

// ─── Variant Search Combobox ──────────────────────────────────────────────────

export function VariantCombobox({
  value,
  label,
  onSelect,
  onCreateNew,
}: {
  value: string
  label: string
  onSelect: (v: VariantOption) => void
  onCreateNew: () => void
}) {
  const [query, setQuery] = useState(label)
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<VariantOption[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  // Sync label when parent changes
  useEffect(() => { setQuery(label) }, [label])

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        dropRef.current && !dropRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
        if (!value) setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [value])

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const res = await searchVariants(q)
      setResults(res.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => search(query), 300)
    return () => clearTimeout(t)
  }, [query, search])

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder="Search by product name…"
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          className="w-full px-3 py-2 pr-8 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
        />
        <ChevronDown size={14} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
      </div>

      {open && (
        <div
          ref={dropRef}
          className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-60 overflow-y-auto"
        >
          {loading && (
            <div className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-400">
              <Loader2 size={13} className="animate-spin" /> Searching…
            </div>
          )}
          {!loading && results.length === 0 && query.length >= 2 && (
            <div className="px-3 py-2 text-sm text-slate-400">No results for "{query}"</div>
          )}
          {results.map((r) => (
            <button
              key={r.variant_id}
              type="button"
              onMouseDown={() => {
                onSelect(r)
                setQuery(`${r.product_name} — ${r.variant_name}`)
                setOpen(false)
              }}
              className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors border-b border-slate-50 last:border-0"
            >
              <div className="text-sm font-medium text-slate-800">{r.product_name}</div>
              <div className="text-xs text-slate-400">
                {r.variant_name}
                {r.brand_name ? ` · ${r.brand_name}` : ''}
                {r.unit ? ` · ${r.unit}` : ''}
              </div>
            </button>
          ))}
          <button
            type="button"
            onMouseDown={onCreateNew}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors border-t border-slate-100"
          >
            <Plus size={13} /> Add new product / variant
          </button>
        </div>
      )}
    </div>
  )
}

// ─── New Product Modal ────────────────────────────────────────────────────────

export function NewProductModal({
  onCreated,
  onClose,
}: {
  onCreated: (v: VariantOption) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<NewProductForm>({
    product_name: '',
    brand_name: '',
    type: 'other',
    variant_name: '',
    unit: 'piece',
    quantity: '1',
    base_mrp: '',
    sell_before_days: '7',
    temperature_required: '0',
  })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: quickAddProduct,
    onSuccess: (res) => {
      onCreated(res.data)
    },
    onError: () => setError('Failed to create product. Try again.'),
  })

  const set = (k: keyof NewProductForm, v: string) =>
    setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.product_name.trim() || !form.variant_name.trim()) {
      setError('Product name and variant name are required.')
      return
    }
    setError('')
    mutation.mutate({
      product_name: form.product_name,
      brand_name: form.brand_name || undefined,
      type: form.type,
      variant_name: form.variant_name,
      unit: form.unit,
      quantity: parseFloat(form.quantity) || 1,
      base_mrp: parseFloat(form.base_mrp) || 0,
      sell_before_days: parseInt(form.sell_before_days) || 7,
      temperature_required: parseInt(form.temperature_required) || 0,
    })
  }

  const inputCls =
    'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-800">Add New Product / Variant</h3>
            <p className="text-xs text-slate-400 mt-0.5">Creates a new product entry for inbound use</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Product info */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Product</p>
            <div>
              <label className="text-xs text-slate-600 font-medium mb-1 block">Product Name *</label>
              <input className={inputCls} value={form.product_name} onChange={(e) => set('product_name', e.target.value)} placeholder="e.g. Amul Milk" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-600 font-medium mb-1 block">Brand</label>
                <input className={inputCls} value={form.brand_name} onChange={(e) => set('brand_name', e.target.value)} placeholder="e.g. Amul" />
              </div>
              <div>
                <label className="text-xs text-slate-600 font-medium mb-1 block">Type</label>
                <select className={inputCls} value={form.type} onChange={(e) => set('type', e.target.value)}>
                  {PRODUCT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Variant info */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Variant / SKU</p>
            <div>
              <label className="text-xs text-slate-600 font-medium mb-1 block">Variant Name *</label>
              <input className={inputCls} value={form.variant_name} onChange={(e) => set('variant_name', e.target.value)} placeholder="e.g. 500ml, 1kg, 6-pack" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-600 font-medium mb-1 block">Unit</label>
                <select className={inputCls} value={form.unit} onChange={(e) => set('unit', e.target.value)}>
                  {UNIT_OPTIONS.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-600 font-medium mb-1 block">Pack Size</label>
                <input type="number" min="0.01" step="0.01" className={inputCls} value={form.quantity} onChange={(e) => set('quantity', e.target.value)} placeholder="1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-600 font-medium mb-1 block">MRP (₹)</label>
                <input type="number" min="0" step="0.01" className={inputCls} value={form.base_mrp} onChange={(e) => set('base_mrp', e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <label className="text-xs text-slate-600 font-medium mb-1 block">Sell Before Days</label>
                <input type="number" min="1" className={inputCls} value={form.sell_before_days} onChange={(e) => set('sell_before_days', e.target.value)} placeholder="7" />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-600 font-medium mb-1 block">Temp Required (°C, 0 = no check)</label>
              <input type="number" min="0" className={inputCls} value={form.temperature_required} onChange={(e) => set('temperature_required', e.target.value)} placeholder="0" />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-100 rounded-lg text-sm text-rose-600">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Create & Select
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Item Card ────────────────────────────────────────────────────────────────

export function ItemCard({
  item,
  index,
  onChange,
  onRemove,
  canRemove,
  onOpenNewProduct,
}: {
  item: ItemDraft
  index: number
  onChange: (updated: Partial<ItemDraft>) => void
  onRemove: () => void
  canRemove: boolean
  onOpenNewProduct: () => void
}) {
  const temp = parseInt(item.temperature_measured)
  const tempOk = !isNaN(temp) && item.temperature_required > 0
    ? temp <= TEMP_THRESHOLD
    : !isNaN(temp) ? true : null

  // Auto-calc sell_before_date from expiry_date + sell_before_days
  useEffect(() => {
    if (item.expiry_date && item.sell_before_days > 0) {
      const expiry = new Date(item.expiry_date)
      if (!isNaN(expiry.getTime())) {
        const sbd = new Date(expiry)
        sbd.setDate(sbd.getDate() - item.sell_before_days)
        onChange({ sell_before_date: sbd.toISOString().split('T')[0] })
      }
    }
  }, [item.expiry_date, item.sell_before_days])

  const inputCls =
    'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400'

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
      {/* Item header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Item {index + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Variant selector */}
      <div>
        <label className="text-xs text-slate-600 font-medium mb-1.5 block">Product / Variant *</label>
        <VariantCombobox
          value={item.variant_id}
          label={item.variant_label}
          onSelect={(v) =>
            onChange({
              variant_id: v.variant_id,
              variant_label: `${v.product_name} — ${v.variant_name}`,
              sell_before_days: v.sell_before_days,
              temperature_required: v.temperature_required,
              unit_cost: v.buying_price ? String(v.buying_price) : item.unit_cost,
            })
          }
          onCreateNew={onOpenNewProduct}
        />
      </div>

      {/* Quantities row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-600 font-medium mb-1.5 block">Ordered Qty *</label>
          <input
            type="number"
            min="1"
            className={inputCls}
            value={item.ordered_qty}
            onChange={(e) => onChange({ ordered_qty: e.target.value })}
            placeholder="0"
          />
        </div>
        <div>
          <label className="text-xs text-slate-600 font-medium mb-1.5 block">Received Qty *</label>
          <input
            type="number"
            min="0"
            className={inputCls}
            value={item.received_qty}
            onChange={(e) => onChange({ received_qty: e.target.value })}
            placeholder="0"
          />
        </div>
      </div>

      {/* Temperature + Unit Cost */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-600 font-medium mb-1.5 block">Temperature (°C) *</label>
          <div className="relative">
            <input
              type="number"
              className={`${inputCls} pr-8`}
              value={item.temperature_measured}
              onChange={(e) => onChange({ temperature_measured: e.target.value })}
              placeholder={`≤${TEMP_THRESHOLD}`}
            />
            {tempOk !== null && (
              <span className="absolute right-2.5 top-2.5">
                {tempOk ? (
                  <Thermometer size={14} className="text-emerald-500" />
                ) : (
                  <ShieldAlert size={14} className="text-rose-500" />
                )}
              </span>
            )}
          </div>
          {tempOk === false && (
            <p className="text-xs text-rose-500 mt-1">Exceeds {TEMP_THRESHOLD}°C — will be rejected</p>
          )}
        </div>
        <div>
          <label className="text-xs text-slate-600 font-medium mb-1.5 block">Unit Cost (₹) *</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className={inputCls}
            value={item.unit_cost}
            onChange={(e) => onChange({ unit_cost: e.target.value })}
            placeholder="0.00"
          />
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-600 font-medium mb-1.5 block">Expiry Date</label>
          <input
            type="date"
            className={inputCls}
            value={item.expiry_date}
            onChange={(e) => onChange({ expiry_date: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs text-slate-600 font-medium mb-1.5 block">
            Sell Before *
            {item.expiry_date && item.sell_before_days > 0 && (
              <span className="ml-1 text-blue-400 font-normal">(auto)</span>
            )}
          </label>
          <input
            type="date"
            className={inputCls}
            value={item.sell_before_date}
            onChange={(e) => onChange({ sell_before_date: e.target.value })}
          />
        </div>
      </div>

      {/* Batch No */}
      <div>
        <label className="text-xs text-slate-600 font-medium mb-1.5 block">Batch No (optional)</label>
        <input
          type="text"
          className={inputCls}
          value={item.batch_no}
          onChange={(e) => onChange({ batch_no: e.target.value })}
          placeholder="e.g. BT-2024-001"
        />
      </div>
    </div>
  )
}

// ─── Main Form Component ──────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
}

export default function InboundManualForm({ open, onClose }: Props) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<FormDraft>(loadDraft)
  const [mobilePreview, setMobilePreview] = useState(false)
  const [showNewProduct, setShowNewProduct] = useState(false)
  const [newProductTargetIdx, setNewProductTargetIdx] = useState<number | null>(null)
  const [submitResult, setSubmitResult] = useState<UploadResult | null>(null)

  const { data: vendors } = useQuery({
    queryKey: ['vendor-list'],
    queryFn: () => getVendorList().then((r) => r.data),
    enabled: open,
  })

  // Persist draft to localStorage on every change
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  }, [draft])

  // Load draft when drawer opens
  useEffect(() => {
    if (open) setDraft(loadDraft())
  }, [open])

  const submitMutation = useMutation({
    mutationFn: submitManualInbound,
    onSuccess: (res) => {
      setSubmitResult(res.data)
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] })
      queryClient.invalidateQueries({ queryKey: ['inbound-ledger'] })
      // Clear draft after successful submit
      localStorage.removeItem(DRAFT_KEY)
    },
  })

  const setHeader = (k: keyof Omit<FormDraft, 'items'>, v: string) =>
    setDraft((d) => ({ ...d, [k]: v }))

  const updateItem = (idx: number, patch: Partial<ItemDraft>) =>
    setDraft((d) => ({
      ...d,
      items: d.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    }))

  const addItem = () =>
    setDraft((d) => ({ ...d, items: [...d.items, emptyItem()] }))

  const removeItem = (idx: number) =>
    setDraft((d) => ({ ...d, items: d.items.filter((_, i) => i !== idx) }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitResult(null)

    const items = draft.items.filter((it) => it.variant_id)
    if (!draft.vendor_id || !draft.vendor_invoice_number || items.length === 0) return

    submitMutation.mutate({
      vendor_id: draft.vendor_id,
      vendor_invoice_number: parseInt(draft.vendor_invoice_number),
      expected_receive_date: draft.expected_receive_date || undefined,
      expected_receive_time: draft.expected_receive_time || undefined,
      notes: draft.notes || undefined,
      items: items.map((it) => ({
        variant_id: it.variant_id,
        ordered_qty: parseInt(it.ordered_qty) || 0,
        received_qty: parseInt(it.received_qty) || 0,
        temperature_measured: parseInt(it.temperature_measured) || 0,
        unit_cost: parseFloat(it.unit_cost) || 0,
        expiry_date: it.expiry_date || undefined,
        sell_before_date: it.sell_before_date,
        batch_no: it.batch_no || undefined,
      })),
    })
  }

  const handleReset = () => {
    setDraft(defaultDraft())
    setSubmitResult(null)
    localStorage.removeItem(DRAFT_KEY)
  }

  const handleClose = () => {
    setSubmitResult(null)
    onClose()
  }

  const inputCls =
    'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400'

  if (!open) return null

  const drawerWidth = mobilePreview ? 'max-w-[390px]' : 'sm:max-w-[600px]'

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 bottom-0 z-50 flex flex-col bg-white shadow-2xl
          w-full ${drawerWidth} transition-all duration-200`}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
          <Package size={18} className="text-blue-600" />
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-slate-800 truncate">Manual Inbound Entry</h2>
            <p className="text-xs text-slate-400">
              {draft.items.filter(Boolean).length} item{draft.items.length !== 1 ? 's' : ''}
              {draft.vendor_id && vendors
                ? ` · ${vendors.find((v) => v.vendor_id === draft.vendor_id)?.name ?? ''}`
                : ''}
            </p>
          </div>

          {/* Preview toggle */}
          <button
            type="button"
            onClick={() => setMobilePreview((v) => !v)}
            title={mobilePreview ? 'Switch to desktop view' : 'Preview mobile view'}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
              mobilePreview
                ? 'border-blue-300 bg-blue-50 text-blue-600'
                : 'border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            {mobilePreview ? <Smartphone size={13} /> : <Laptop size={13} />}
            {mobilePreview ? 'Mobile' : 'Desktop'}
          </button>

          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {submitResult ? (
            // ─── Success screen ───
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <CheckCircle size={20} className="text-emerald-600 shrink-0" />
                <div>
                  <p className="font-semibold text-emerald-800">Submitted successfully</p>
                  <p className="text-sm text-emerald-700 mt-0.5">
                    {submitResult.processed} item(s) processed
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-center">
                  <p className="text-2xl font-bold text-amber-600">{submitResult.pending_approval}</p>
                  <p className="text-xs text-amber-700 mt-0.5">Pending Approval</p>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-center">
                  <p className="text-2xl font-bold text-rose-600">{submitResult.rejected}</p>
                  <p className="text-xs text-rose-700 mt-0.5">Rejected (QC)</p>
                </div>
              </div>
              {submitResult.rows.length > 0 && (
                <div className="space-y-1.5">
                  {submitResult.rows.map((r, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 p-2.5 rounded-lg text-sm ${
                        r.status === 'pending_approval'
                          ? 'bg-amber-50 text-amber-800'
                          : r.status === 'rejected'
                          ? 'bg-rose-50 text-rose-800'
                          : 'bg-slate-50 text-slate-600'
                      }`}
                    >
                      {r.status === 'pending_approval' ? (
                        <CheckCircle size={13} className="mt-0.5 shrink-0" />
                      ) : (
                        <AlertCircle size={13} className="mt-0.5 shrink-0" />
                      )}
                      <span className="font-mono text-xs">{r.variant_id}</span>
                      {r.reason && <span className="text-xs opacity-70 ml-auto">{r.reason}</span>}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleReset}
                  className="flex-1 px-4 py-2.5 text-sm font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  New Entry
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            // ─── Form ───
            <form onSubmit={handleSubmit} className="p-5 space-y-5">
              {/* Draft indicator */}
              {(draft.vendor_id || draft.items.some((i) => i.variant_id)) && (
                <div className="flex items-center justify-between p-2.5 bg-blue-50 border border-blue-100 rounded-lg">
                  <p className="text-xs text-blue-700">Draft saved — data will persist if you switch devices</p>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-xs text-blue-500 hover:text-blue-700 underline"
                  >
                    Clear
                  </button>
                </div>
              )}

              {/* Section: Procurement Details */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Procurement Details
                </p>

                <div>
                  <label className="text-xs text-slate-600 font-medium mb-1.5 block">Vendor *</label>
                  <select
                    required
                    className={inputCls}
                    value={draft.vendor_id}
                    onChange={(e) => setHeader('vendor_id', e.target.value)}
                  >
                    <option value="">Select vendor…</option>
                    {(vendors ?? []).map((v) => (
                      <option key={v.vendor_id} value={v.vendor_id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-xs text-slate-600 font-medium mb-1.5 block">Invoice No. *</label>
                    <input
                      type="number"
                      required
                      className={inputCls}
                      value={draft.vendor_invoice_number}
                      onChange={(e) => setHeader('vendor_invoice_number', e.target.value)}
                      placeholder="e.g. 100123"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-xs text-slate-600 font-medium mb-1.5 block">
                      Expected Date &amp; Time
                      <span className="ml-1 font-normal text-slate-400">(optional)</span>
                    </label>
                    <div className="flex flex-col gap-2">
                      <input
                        type="date"
                        className={inputCls}
                        value={draft.expected_receive_date}
                        onChange={(e) => setHeader('expected_receive_date', e.target.value)}
                      />
                      <input
                        type="time"
                        className={inputCls}
                        value={draft.expected_receive_time}
                        onChange={(e) => setHeader('expected_receive_time', e.target.value)}
                        disabled={!draft.expected_receive_date}
                        title="Expected arrival time"
                      />
                    </div>
                    {draft.expected_receive_date && !draft.expected_receive_time && (
                      <p className="text-xs text-slate-400 mt-1">No time = end of day (23:59) used for on-time check</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-600 font-medium mb-1.5 block">Notes</label>
                  <textarea
                    rows={2}
                    className={`${inputCls} resize-none`}
                    value={draft.notes}
                    onChange={(e) => setHeader('notes', e.target.value)}
                    placeholder="Optional notes about this shipment…"
                  />
                </div>
              </div>

              {/* Section: Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Items</p>
                  <span className="text-xs text-slate-400">{draft.items.length} item(s)</span>
                </div>

                {draft.items.map((item, idx) => (
                  <ItemCard
                    key={item._id}
                    item={item}
                    index={idx}
                    onChange={(patch) => updateItem(idx, patch)}
                    onRemove={() => removeItem(idx)}
                    canRemove={draft.items.length > 1}
                    onOpenNewProduct={() => {
                      setNewProductTargetIdx(idx)
                      setShowNewProduct(true)
                    }}
                  />
                ))}

                <button
                  type="button"
                  onClick={addItem}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-blue-600 border border-dashed border-blue-300 rounded-xl hover:bg-blue-50 transition-colors"
                >
                  <Plus size={14} /> Add Another Item
                </button>
              </div>

              {submitMutation.isError && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-100 rounded-lg text-sm text-rose-600">
                  <AlertCircle size={14} /> Submission failed. Check all required fields.
                </div>
              )}
            </form>
          )}
        </div>

        {/* Footer */}
        {!submitResult && (
          <div className="px-5 py-4 border-t border-slate-100 bg-white shrink-0">
            <button
              form="inbound-manual-form"
              type="submit"
              onClick={handleSubmit}
              disabled={
                submitMutation.isPending ||
                !draft.vendor_id ||
                !draft.vendor_invoice_number ||
                !draft.items.some((i) => i.variant_id && i.sell_before_date)
              }
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitMutation.isPending ? (
                <><Loader2 size={15} className="animate-spin" /> Submitting…</>
              ) : (
                <><CheckCircle size={15} /> Submit for Approval</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* New Product Modal */}
      {showNewProduct && (
        <NewProductModal
          onCreated={(v) => {
            if (newProductTargetIdx !== null) {
              updateItem(newProductTargetIdx, {
                variant_id: v.variant_id,
                variant_label: `${v.product_name} — ${v.variant_name}`,
                sell_before_days: v.sell_before_days,
                temperature_required: v.temperature_required,
                unit_cost: v.buying_price ? String(v.buying_price) : '',
              })
            }
            setShowNewProduct(false)
            setNewProductTargetIdx(null)
          }}
          onClose={() => {
            setShowNewProduct(false)
            setNewProductTargetIdx(null)
          }}
        />
      )}
    </>
  )
}

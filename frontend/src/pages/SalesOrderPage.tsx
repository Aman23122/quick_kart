import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Loader2, CheckCircle, AlertCircle, ShoppingCart, Laptop, Smartphone } from 'lucide-react'
import { createManualOrder, type ManualOrderItem } from '@/services/outboundApi'
import { type VariantOption } from '@/services/productApi'
import {
  VariantCombobox,
  NewProductModal,
} from '@/components/inbound/InboundManualForm'

// ─── Types + Draft persistence ────────────────────────────────────────────────

interface SalesItemDraft {
  _id: string
  variant_id: string
  variant_label: string
  quantity: string
  unit_price: string
}

interface SalesDraft {
  customer_name: string
  delivery_date: string
  notes: string
  items: SalesItemDraft[]
}

const DRAFT_KEY = 'qk_sales_order_draft'

function emptyItem(): SalesItemDraft {
  return { _id: crypto.randomUUID(), variant_id: '', variant_label: '', quantity: '', unit_price: '' }
}

function defaultDraft(): SalesDraft {
  return { customer_name: '', delivery_date: '', notes: '', items: [emptyItem()] }
}

function loadDraft(): SalesDraft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return defaultDraft()
}

const inputCls =
  'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400'

// ─── Item Card ────────────────────────────────────────────────────────────────

function SalesItemCard({
  item,
  index,
  onChange,
  onRemove,
  canRemove,
  onOpenNewProduct,
}: {
  item: SalesItemDraft
  index: number
  onChange: (patch: Partial<SalesItemDraft>) => void
  onRemove: () => void
  canRemove: boolean
  onOpenNewProduct: () => void
}) {
  const handleSelectVariant = (v: VariantOption) => {
    onChange({
      variant_id: v.variant_id,
      variant_label: `${v.product_name} — ${v.variant_name}`,
      unit_price: v.base_price ? String(v.base_price) : '',
    })
  }

  const subtotal =
    item.quantity && item.unit_price
      ? parseFloat(item.quantity) * parseFloat(item.unit_price)
      : null

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">Item {index + 1}</span>
        <div className="flex items-center gap-3">
          {subtotal != null && (
            <span className="text-xs font-semibold text-slate-600">
              ₹{subtotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </span>
          )}
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      <div>
        <label className="text-xs text-slate-600 font-medium mb-1.5 block">Product / Variant *</label>
        <VariantCombobox
          value={item.variant_id}
          label={item.variant_label}
          onSelect={handleSelectVariant}
          onCreateNew={onOpenNewProduct}
        />
      </div>

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="text-xs text-slate-600 font-medium mb-1.5 block">Quantity *</label>
          <input
            type="number"
            min="1"
            className={inputCls}
            value={item.quantity}
            onChange={(e) => onChange({ quantity: e.target.value })}
            placeholder="0"
          />
        </div>
        {item.unit_price && (
          <div className="pb-2 text-right shrink-0">
            <p className="text-xs text-slate-400 mb-0.5">Unit Price</p>
            <p className="text-sm font-semibold text-slate-700">
              ₹{parseFloat(item.unit_price).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SalesOrderPage() {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<SalesDraft>(loadDraft)
  const [mobilePreview, setMobilePreview] = useState(false)
  const [submitResult, setSubmitResult] = useState<{ order_id: string; total: number } | null>(null)
  const [showNewProduct, setShowNewProduct] = useState(false)
  const [newProductTargetIdx, setNewProductTargetIdx] = useState<number | null>(null)

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  }, [draft])

  const mutation = useMutation({
    mutationFn: createManualOrder,
    onSuccess: (res) => {
      setSubmitResult({ order_id: res.data.order_id, total: res.data.total })
      queryClient.invalidateQueries({ queryKey: ['pending-outbound'] })
      queryClient.invalidateQueries({ queryKey: ['outbound-ledger'] })
      localStorage.removeItem(DRAFT_KEY)
    },
  })

  const setHeader = (k: keyof Omit<SalesDraft, 'items'>, v: string) =>
    setDraft((d) => ({ ...d, [k]: v }))

  const updateItem = (idx: number, patch: Partial<SalesItemDraft>) =>
    setDraft((d) => ({ ...d, items: d.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }))

  const addItem = () => setDraft((d) => ({ ...d, items: [...d.items, emptyItem()] }))

  const removeItem = (idx: number) =>
    setDraft((d) => ({ ...d, items: d.items.filter((_, i) => i !== idx) }))

  const orderTotal = draft.items.reduce((sum, it) => {
    return sum + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0)
  }, 0)

  const validItems = draft.items.filter((i) => i.variant_id && i.quantity)
  const canSubmit =
    !mutation.isPending &&
    draft.customer_name.trim() !== '' &&
    validItems.length > 0

  const hasDraft = draft.customer_name || draft.items.some((i) => i.variant_id)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    mutation.mutate({
      customer_name: draft.customer_name.trim(),
      notes: draft.notes.trim() || undefined,
      items: validItems.map((i): ManualOrderItem => ({
        variant_id: i.variant_id,
        quantity: parseInt(i.quantity) || 0,
        unit_price: parseFloat(i.unit_price) || 0,
      })),
    })
  }

  const handleNewOrder = () => {
    setDraft(defaultDraft())
    setSubmitResult(null)
    mutation.reset()
  }

  // ─── Success screen ───────────────────────────────────────────────────────

  if (submitResult) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4 space-y-6">
        <div className="flex items-center gap-3 p-5 bg-emerald-50 border border-emerald-200 rounded-2xl">
          <CheckCircle size={24} className="text-emerald-600 shrink-0" />
          <div>
            <p className="font-semibold text-emerald-800 text-lg">Order Placed!</p>
            <p className="text-xs text-emerald-700 font-mono mt-0.5">{submitResult.order_id}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-center">
            <p className="text-3xl font-bold text-blue-600">
              ₹{submitResult.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
            <p className="text-sm text-blue-700 mt-1">Order Total</p>
          </div>
          <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-center">
            <p className="text-3xl font-bold text-amber-600">1</p>
            <p className="text-sm text-amber-700 mt-1">Pending Approval</p>
          </div>
        </div>

        <p className="text-sm text-slate-500">
          Admin will review from <strong>Outbound Ledger</strong>. FEFO batch allocation happens at approval time.
        </p>

        <button
          onClick={handleNewOrder}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          <ShoppingCart size={16} /> New Order
        </button>
      </div>
    )
  }

  // ─── Form ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Preview toggle — desktop only */}
      <div className="hidden sm:flex justify-end mb-4">
        <button
          type="button"
          onClick={() => setMobilePreview((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            mobilePreview
              ? 'border-blue-300 bg-blue-50 text-blue-600'
              : 'border-slate-200 text-slate-500 hover:bg-slate-50'
          }`}
        >
          {mobilePreview ? <Smartphone size={13} /> : <Laptop size={13} />}
          {mobilePreview ? 'Mobile Preview' : 'Desktop View'}
        </button>
      </div>

      {/* Outer container */}
      <div className={mobilePreview ? 'max-w-[390px] mx-auto border border-slate-200 rounded-2xl overflow-hidden shadow-xl' : ''}>
        {/* Phone chrome bar */}
        {mobilePreview && (
          <div className="bg-slate-800 px-4 py-2 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-slate-500" />
            <div className="flex-1 bg-slate-700 rounded-full h-4 mx-2" />
            <div className="w-2 h-2 rounded-full bg-slate-500" />
          </div>
        )}

        <div className={mobilePreview ? 'bg-white overflow-y-auto max-h-[780px]' : ''}>
        <div className={mobilePreview ? 'p-4' : ''}>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Page header */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-800">Sales Order</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Fill in the details below — order will go for admin approval.
              </p>
            </div>
            {!mobilePreview && (
              <button
                type="submit"
                disabled={!canSubmit}
                className="hidden sm:flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0"
              >
                {mutation.isPending ? (
                  <><Loader2 size={15} className="animate-spin" /> Placing…</>
                ) : (
                  <><CheckCircle size={15} /> Place Order</>
                )}
              </button>
            )}
          </div>

          {/* Draft indicator */}
          {hasDraft && (
            <div className="flex items-center justify-between px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
              <p className="text-xs text-blue-700">Draft saved — data persists if you reload</p>
              <button
                type="button"
                onClick={handleNewOrder}
                className="text-xs text-blue-500 hover:text-blue-700 underline"
              >
                Clear draft
              </button>
            </div>
          )}

          {/* Order details card */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Order Details</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="text-xs text-slate-600 font-medium mb-1.5 block">Customer Name *</label>
                <input
                  type="text"
                  required
                  className={inputCls}
                  value={draft.customer_name}
                  onChange={(e) => setHeader('customer_name', e.target.value)}
                  placeholder="e.g. Rahul Sharma / Store B"
                />
              </div>

              <div>
                <label className="text-xs text-slate-600 font-medium mb-1.5 block">
                  Delivery Date
                  <span className="ml-1 font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  type="date"
                  className={inputCls}
                  value={draft.delivery_date}
                  onChange={(e) => setHeader('delivery_date', e.target.value)}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs text-slate-600 font-medium mb-1.5 block">Notes</label>
                <textarea
                  rows={2}
                  className={`${inputCls} resize-none`}
                  value={draft.notes}
                  onChange={(e) => setHeader('notes', e.target.value)}
                  placeholder="Optional instructions…"
                />
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Items <span className="normal-case text-slate-400">({draft.items.length})</span>
              </p>
              {orderTotal > 0 && (
                <p className="text-sm font-semibold text-slate-700">
                  Total: ₹{orderTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </p>
              )}
            </div>

            {draft.items.map((item, idx) => (
              <SalesItemCard
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
              className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-blue-600 border border-dashed border-blue-300 rounded-xl hover:bg-blue-50 transition-colors"
            >
              <Plus size={15} /> Add Another Item
            </button>
          </div>

          {mutation.isError && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-100 rounded-lg text-sm text-rose-600">
              <AlertCircle size={14} /> Failed to place order. Check all fields and try again.
            </div>
          )}

          {/* Bottom submit */}
          <div className="pb-6">
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {mutation.isPending ? (
                <><Loader2 size={15} className="animate-spin" /> Placing Order…</>
              ) : (
                <><CheckCircle size={15} /> Place Order</>
              )}
            </button>
          </div>
        </form>

        </div>{/* /inner padding */}
        </div>{/* /scroll area */}
      </div>{/* /preview container */}

      {/* New Product Modal */}
      {showNewProduct && (
        <NewProductModal
          onCreated={(v) => {
            if (newProductTargetIdx !== null) {
              updateItem(newProductTargetIdx, {
                variant_id: v.variant_id,
                variant_label: `${v.product_name} — ${v.variant_name}`,
                unit_price: v.base_price ? String(v.base_price) : '',
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

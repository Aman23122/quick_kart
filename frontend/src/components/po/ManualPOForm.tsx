import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Plus, Trash2, Loader2, CheckCircle, AlertCircle, FileText } from 'lucide-react'
import { getVendorList } from '@/services/vendorApi'
import { createManualPO, type ManualPOItem } from '@/services/poApi'
import {
  VariantCombobox,
  type VariantOption,
} from '@/components/inbound/InboundManualForm'

// ─── Types ────────────────────────────────────────────────────────────────────

interface POItemDraft {
  _id: string
  variant_id: string
  variant_label: string
  ordered_qty: string
  unit_cost: string
}

function emptyPOItem(): POItemDraft {
  return { _id: crypto.randomUUID(), variant_id: '', variant_label: '', ordered_qty: '', unit_cost: '' }
}

const inputCls =
  'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400'

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
}

export default function ManualPOForm({ open, onClose }: Props) {
  const queryClient = useQueryClient()
  const [vendorId, setVendorId] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [expectedTime, setExpectedTime] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<POItemDraft[]>([emptyPOItem()])
  const [created, setCreated] = useState<{ po_number: string } | null>(null)

  const { data: vendors } = useQuery({
    queryKey: ['vendor-list'],
    queryFn: () => getVendorList().then((r) => r.data),
    enabled: open,
  })

  const mutation = useMutation({
    mutationFn: createManualPO,
    onSuccess: (res) => {
      setCreated({ po_number: res.data.po_number })
      queryClient.invalidateQueries({ queryKey: ['open-pos'] })
      queryClient.invalidateQueries({ queryKey: ['po-open-monitor'] })
    },
  })

  const updateItem = (idx: number, patch: Partial<POItemDraft>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))

  const handleSelectVariant = (idx: number, v: VariantOption) => {
    updateItem(idx, {
      variant_id: v.variant_id,
      variant_label: `${v.product_name} — ${v.variant_name}`,
      unit_cost: v.buying_price ? String(v.buying_price) : '',
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const validItems = items.filter((i) => i.variant_id && i.ordered_qty)
    if (!vendorId || validItems.length === 0) return
    mutation.mutate({
      vendor_id: vendorId,
      expected_receive_date: expectedDate || undefined,
      expected_receive_time: expectedTime || undefined,
      notes: notes || undefined,
      items: validItems.map((i): ManualPOItem => ({
        variant_id: i.variant_id,
        ordered_qty: parseInt(i.ordered_qty) || 0,
        unit_cost: parseFloat(i.unit_cost) || 0,
      })),
    })
  }

  const handleClose = () => {
    setVendorId(''); setExpectedDate(''); setExpectedTime('')
    setNotes(''); setItems([emptyPOItem()]); setCreated(null)
    onClose()
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={handleClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 flex flex-col bg-white shadow-2xl w-full sm:max-w-[560px]">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
          <FileText size={18} className="text-blue-600" />
          <div className="flex-1">
            <h2 className="font-semibold text-slate-800">Create Purchase Order</h2>
            <p className="text-xs text-slate-400">Draft PO — send to vendor after review</p>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {created ? (
            // ─── Success ─────────────────────────────────────────────────────
            <div className="space-y-5">
              <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <CheckCircle size={20} className="text-emerald-600 shrink-0" />
                <div>
                  <p className="font-semibold text-emerald-800">PO Created</p>
                  <p className="text-sm text-emerald-700 font-mono mt-0.5">{created.po_number}</p>
                </div>
              </div>
              <p className="text-sm text-slate-500">
                PO is in <strong>Draft</strong> status. Go to PO Monitor to review and send it to the vendor.
              </p>
              <button
                onClick={handleClose}
                className="w-full py-2.5 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          ) : (
            // ─── Form ────────────────────────────────────────────────────────
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Vendor + dates */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">PO Details</p>
                <div>
                  <label className="text-xs text-slate-600 font-medium mb-1.5 block">Vendor *</label>
                  <select required className={inputCls} value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
                    <option value="">Select vendor…</option>
                    {(vendors ?? []).map((v) => (
                      <option key={v.vendor_id} value={v.vendor_id}>{v.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-600 font-medium mb-1.5 block">
                    Expected Delivery Date &amp; Time
                    <span className="ml-1 font-normal text-slate-400">(optional)</span>
                  </label>
                  <div className="flex flex-col gap-2">
                    <input type="date" className={inputCls} value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
                    <input type="time" className={inputCls} value={expectedTime} onChange={(e) => setExpectedTime(e.target.value)} disabled={!expectedDate} />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-600 font-medium mb-1.5 block">Notes</label>
                  <textarea rows={2} className={`${inputCls} resize-none`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes…" />
                </div>
              </div>

              {/* Items */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Line Items</p>
                {items.map((item, idx) => (
                  <div key={item._id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500">Item {idx + 1}</span>
                      {items.length > 1 && (
                        <button type="button" onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-slate-600 font-medium mb-1.5 block">Product / Variant *</label>
                      <VariantCombobox
                        value={item.variant_id}
                        label={item.variant_label}
                        onSelect={(v) => handleSelectVariant(idx, v)}
                        onCreateNew={() => {}}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-600 font-medium mb-1.5 block">Ordered Qty *</label>
                        <input type="number" min="1" className={inputCls} value={item.ordered_qty}
                          onChange={(e) => updateItem(idx, { ordered_qty: e.target.value })} placeholder="0" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-600 font-medium mb-1.5 block">Expected Price (₹)</label>
                        <input type="number" min="0" step="0.01" className={inputCls} value={item.unit_cost}
                          onChange={(e) => updateItem(idx, { unit_cost: e.target.value })} placeholder="0.00" />
                      </div>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => setItems((p) => [...p, emptyPOItem()])}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-blue-600 border border-dashed border-blue-300 rounded-xl hover:bg-blue-50">
                  <Plus size={14} /> Add Item
                </button>
              </div>

              {mutation.isError && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-100 rounded-lg text-sm text-rose-600">
                  <AlertCircle size={14} /> Failed to create PO. Check all fields.
                </div>
              )}
            </form>
          )}
        </div>

        {/* Footer */}
        {!created && (
          <div className="px-5 py-4 border-t border-slate-100 shrink-0">
            <button
              onClick={handleSubmit}
              disabled={mutation.isPending || !vendorId || !items.some((i) => i.variant_id && i.ordered_qty)}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {mutation.isPending ? <><Loader2 size={15} className="animate-spin" /> Creating…</> : <><CheckCircle size={15} /> Create Draft PO</>}
            </button>
          </div>
        )}
      </div>
    </>
  )
}

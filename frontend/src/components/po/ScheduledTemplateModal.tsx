import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Plus, Trash2, Loader2, CheckCircle, AlertCircle, CalendarClock } from 'lucide-react'
import { getVendorList } from '@/services/vendorApi'
import { getTemplate, updateTemplate, type POTemplate } from '@/services/poApi'
import { VariantCombobox, type VariantOption } from '@/components/inbound/InboundManualForm'

interface ItemDraft {
  _id: string
  variant_id: string
  variant_label: string
  ordered_qty: string
  unit_cost: string
}

function emptyItem(): ItemDraft {
  return { _id: crypto.randomUUID(), variant_id: '', variant_label: '', ordered_qty: '', unit_cost: '' }
}

const inputCls =
  'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400'

interface Props {
  slotId: string
  slotLabel: string
  open: boolean
  onClose: () => void
}

export default function ScheduledTemplateModal({ slotId, slotLabel, open, onClose }: Props) {
  const queryClient = useQueryClient()
  const [vendorId, setVendorId] = useState('')
  const [notes, setNotes] = useState('')
  const [cronTime, setCronTime] = useState('')
  const [receiveTime, setReceiveTime] = useState('')
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()])
  const [saved, setSaved] = useState(false)

  const { data: template, isLoading: templateLoading } = useQuery({
    queryKey: ['po-template', slotId],
    queryFn: () => getTemplate(slotId).then((r) => r.data),
    enabled: open,
  })

  const { data: vendors } = useQuery({
    queryKey: ['vendor-list'],
    queryFn: () => getVendorList().then((r) => r.data),
    enabled: open,
  })

  // Populate form when template loads
  useEffect(() => {
    if (!template) return
    setVendorId(template.vendor_id ?? '')
    setNotes(template.notes ?? '')
    setCronTime(template.cron_time ?? '')
    setReceiveTime(template.expected_receive_time ?? '')
    setItems(
      template.items.length > 0
        ? template.items.map((it) => ({
            _id: crypto.randomUUID(),
            variant_id: it.variant_id,
            variant_label: `${it.product_name} — ${it.variant_name}`,
            ordered_qty: String(it.ordered_qty),
            unit_cost: String(it.unit_cost),
          }))
        : [emptyItem()]
    )
    setSaved(false)
  }, [template])

  const saveMutation = useMutation({
    mutationFn: () =>
      updateTemplate(slotId, {
        vendor_id: vendorId || undefined,
        notes: notes || undefined,
        cron_time: cronTime || undefined,
        expected_receive_time: receiveTime || undefined,
        items: items
          .filter((i) => i.variant_id && i.ordered_qty)
          .map((i) => ({
            variant_id: i.variant_id,
            ordered_qty: parseInt(i.ordered_qty) || 0,
            unit_cost: parseFloat(i.unit_cost) || 0,
          })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['po-template', slotId] })
      queryClient.invalidateQueries({ queryKey: ['po-templates'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const updateItem = (idx: number, patch: Partial<ItemDraft>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))

  const handleSelectVariant = (idx: number, v: VariantOption) => {
    updateItem(idx, {
      variant_id: v.variant_id,
      variant_label: `${v.product_name} — ${v.variant_name}`,
      unit_cost: v.buying_price ? String(v.buying_price) : '',
    })
  }

  const handleClose = () => {
    setSaved(false)
    onClose()
  }

  const canSave = !!vendorId && items.some((i) => i.variant_id && i.ordered_qty)

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={handleClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 flex flex-col bg-white shadow-2xl w-full sm:max-w-[560px]">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
          <CalendarClock size={18} className="text-blue-600" />
          <div className="flex-1">
            <h2 className="font-semibold text-slate-800">Edit Scheduled PO Template</h2>
            <p className="text-xs text-slate-400">{slotLabel} — changes apply to the next auto-fire</p>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {templateLoading ? (
            <div className="flex items-center justify-center h-40 text-slate-400">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* Vendor */}
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
                  <label className="text-xs text-slate-600 font-medium mb-1.5 block">Notes</label>
                  <textarea rows={2} className={`${inputCls} resize-none`} value={notes}
                    onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes…" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-600 font-medium mb-1.5 block">
                      Fire Time
                      <span className="ml-1 font-normal text-slate-400">(daily)</span>
                    </label>
                    <input type="time" className={inputCls} value={cronTime}
                      onChange={(e) => setCronTime(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 font-medium mb-1.5 block">Expected Receive Time</label>
                    <input type="time" className={inputCls} value={receiveTime}
                      onChange={(e) => setReceiveTime(e.target.value)} />
                  </div>
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
                <button type="button" onClick={() => setItems((p) => [...p, emptyItem()])}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-blue-600 border border-dashed border-blue-300 rounded-xl hover:bg-blue-50">
                  <Plus size={14} /> Add Item
                </button>
              </div>

              {saveMutation.isError && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-100 rounded-lg text-sm text-rose-600">
                  <AlertCircle size={14} /> Failed to save template. Try again.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 shrink-0">
          {saved ? (
            <div className="flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-emerald-600 bg-emerald-50 rounded-xl border border-emerald-200">
              <CheckCircle size={15} /> Template saved — applies to next scheduled PO
            </div>
          ) : (
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !canSave}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saveMutation.isPending
                ? <><Loader2 size={15} className="animate-spin" /> Saving…</>
                : <><CheckCircle size={15} /> Save Template</>
              }
            </button>
          )}
        </div>
      </div>
    </>
  )
}

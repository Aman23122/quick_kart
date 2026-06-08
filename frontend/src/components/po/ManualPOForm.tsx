import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Plus, Trash2, Loader2, CheckCircle, AlertCircle, FileText, CalendarClock } from 'lucide-react'
import { getVendorList } from '@/services/vendorApi'
import { createManualPO, createDailyPO, type ManualPOItem } from '@/services/poApi'
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
  const [poType, setPoType] = useState<'normal' | 'daily'>('normal')

  // Normal PO fields
  const [vendorId, setVendorId] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [expectedTime, setExpectedTime] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<POItemDraft[]>([emptyPOItem()])

  // Daily PO extra fields
  const [scheduleLabel, setScheduleLabel] = useState('')
  const [cronTime, setCronTime] = useState('')
  const [receiveTime, setReceiveTime] = useState('')

  const [created, setCreated] = useState<{ label?: string; po_number?: string; isDaily?: boolean } | null>(null)

  const { data: vendors } = useQuery({
    queryKey: ['vendor-list'],
    queryFn: () => getVendorList().then((r) => r.data),
    enabled: open,
  })

  const normalMutation = useMutation({
    mutationFn: createManualPO,
    onSuccess: (res) => {
      setCreated({ po_number: res.data.po_number, isDaily: false })
      queryClient.invalidateQueries({ queryKey: ['open-pos'] })
      queryClient.invalidateQueries({ queryKey: ['po-open-monitor'] })
    },
  })

  const dailyMutation = useMutation({
    mutationFn: createDailyPO,
    onSuccess: (res) => {
      setCreated({ label: res.data.label, isDaily: true })
      queryClient.invalidateQueries({ queryKey: ['po-templates'] })
    },
  })

  const isPending = normalMutation.isPending || dailyMutation.isPending
  const isError = normalMutation.isError || dailyMutation.isError

  const updateItem = (idx: number, patch: Partial<POItemDraft>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))

  const handleSelectVariant = (idx: number, v: VariantOption) => {
    updateItem(idx, {
      variant_id: v.variant_id,
      variant_label: `${v.product_name} — ${v.variant_name}`,
      unit_cost: v.buying_price ? String(v.buying_price) : '',
    })
  }

  const handleTypeSwitch = (type: 'normal' | 'daily') => {
    setPoType(type)
    setVendorId(''); setNotes(''); setItems([emptyPOItem()])
    setExpectedDate(''); setExpectedTime(''); setScheduleLabel('')
    setCronTime(''); setReceiveTime('')
    normalMutation.reset(); dailyMutation.reset()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const validItems = items.filter((i) => i.variant_id && i.ordered_qty)
    if (!vendorId || validItems.length === 0) return

    const itemPayload = validItems.map((i): ManualPOItem => ({
      variant_id: i.variant_id,
      ordered_qty: parseInt(i.ordered_qty) || 0,
      unit_cost: parseFloat(i.unit_cost) || 0,
    }))

    if (poType === 'daily') {
      if (!scheduleLabel.trim() || !cronTime || !receiveTime) return
      dailyMutation.mutate({
        label: scheduleLabel.trim(),
        vendor_id: vendorId,
        cron_time: cronTime,
        expected_receive_time: receiveTime,
        notes: notes || undefined,
        items: itemPayload,
      })
    } else {
      normalMutation.mutate({
        vendor_id: vendorId,
        expected_receive_date: expectedDate || undefined,
        expected_receive_time: expectedTime || undefined,
        notes: notes || undefined,
        items: itemPayload,
      })
    }
  }

  const handleClose = () => {
    setPoType('normal')
    setVendorId(''); setExpectedDate(''); setExpectedTime('')
    setNotes(''); setItems([emptyPOItem()]); setCreated(null)
    setScheduleLabel(''); setCronTime(''); setReceiveTime('')
    normalMutation.reset(); dailyMutation.reset()
    onClose()
  }

  const canSubmit = !!vendorId && items.some((i) => i.variant_id && i.ordered_qty) &&
    (poType === 'normal' || (!!scheduleLabel.trim() && !!cronTime && !!receiveTime))

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={handleClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 flex flex-col bg-white shadow-2xl w-full sm:max-w-[560px]">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
          {poType === 'daily'
            ? <CalendarClock size={18} className="text-violet-600" />
            : <FileText size={18} className="text-blue-600" />
          }
          <div className="flex-1">
            <h2 className="font-semibold text-slate-800">Create Purchase Order</h2>
            <p className="text-xs text-slate-400">
              {poType === 'daily' ? 'Scheduled daily — fires automatically every day' : 'Draft PO — send to vendor after review'}
            </p>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X size={18} />
          </button>
        </div>

        {/* PO Type Toggle */}
        {!created && (
          <div className="flex gap-1 px-5 py-3 border-b border-slate-100 bg-slate-50">
            {(['normal', 'daily'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => handleTypeSwitch(type)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  type === poType
                    ? type === 'daily' ? 'bg-violet-600 text-white' : 'bg-blue-600 text-white'
                    : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {type === 'normal' ? 'Normal PO' : 'Daily PO'}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5">
          {created ? (
            // ─── Success ─────────────────────────────────────────────────────
            <div className="space-y-5">
              {created.isDaily ? (
                <div className="flex items-center gap-3 p-4 bg-violet-50 border border-violet-200 rounded-xl">
                  <CheckCircle size={20} className="text-violet-600 shrink-0" />
                  <div>
                    <p className="font-semibold text-violet-800">Daily PO Scheduled</p>
                    <p className="text-sm text-violet-700 mt-0.5">"{created.label}" — fires every day at your set time</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <CheckCircle size={20} className="text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-semibold text-emerald-800">PO Created</p>
                    <p className="text-sm text-emerald-700 font-mono mt-0.5">{created.po_number}</p>
                  </div>
                </div>
              )}
              <p className="text-sm text-slate-500">
                {created.isDaily
                  ? 'PO will be created automatically when the scheduler fires. Check Manual POs section after that.'
                  : 'PO is in Draft status. Go to PO Monitor to review and send it to the vendor.'}
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
              {/* Daily PO info banner */}
              {poType === 'daily' && (
                <div className="flex items-start gap-2 p-3 bg-violet-50 border border-violet-100 rounded-lg text-xs text-violet-700">
                  <CalendarClock size={13} className="mt-0.5 shrink-0" />
                  <span>
                    This PO will fire automatically every day at your chosen time and create a real PO for the vendor.
                  </span>
                </div>
              )}

              {/* PO Details */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">PO Details</p>

                {/* Daily PO fields */}
                {poType === 'daily' && (
                  <>
                    <div>
                      <label className="text-xs text-slate-600 font-medium mb-1.5 block">Schedule Name *</label>
                      <input
                        type="text"
                        className={inputCls}
                        value={scheduleLabel}
                        onChange={(e) => setScheduleLabel(e.target.value)}
                        placeholder="e.g. Dairy Morning, Bread Daily…"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-600 font-medium mb-1.5 block">
                          Fire Time *
                          <span className="ml-1 font-normal text-slate-400">(daily)</span>
                        </label>
                        <input
                          type="time"
                          className={inputCls}
                          value={cronTime}
                          onChange={(e) => setCronTime(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-600 font-medium mb-1.5 block">
                          Expected Receive Time *
                        </label>
                        <input
                          type="time"
                          className={inputCls}
                          value={receiveTime}
                          onChange={(e) => setReceiveTime(e.target.value)}
                        />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="text-xs text-slate-600 font-medium mb-1.5 block">Vendor *</label>
                  <select required className={inputCls} value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
                    <option value="">Select vendor…</option>
                    {(vendors ?? []).map((v) => (
                      <option key={v.vendor_id} value={v.vendor_id}>{v.name}</option>
                    ))}
                  </select>
                </div>

                {/* Expected date — normal PO only */}
                {poType === 'normal' && (
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
                )}

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

              {isError && (
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
              disabled={isPending || !canSubmit}
              className={`w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl text-white disabled:opacity-50 ${
                poType === 'daily' ? 'bg-violet-600 hover:bg-violet-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isPending
                ? <><Loader2 size={15} className="animate-spin" /> Creating…</>
                : poType === 'daily'
                  ? <><CalendarClock size={15} /> Schedule Daily PO</>
                  : <><CheckCircle size={15} /> Create Draft PO</>
              }
            </button>
          </div>
        )}
      </div>
    </>
  )
}

import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Plus, Loader2, CheckCircle, AlertCircle, PackagePlus, Laptop, Smartphone, Link2 } from 'lucide-react'
import { getVendorList } from '@/services/vendorApi'
import { submitManualInbound, receiveAgainstPO, type UploadResult, type ReceivePOResult } from '@/services/inboundApi'
import { getOpenPOs, type OpenPO } from '@/services/poApi'
import {
  ItemCard,
  NewProductModal,
  emptyItem,
  type ItemDraft,
  type FormDraft,
} from '@/components/inbound/InboundManualForm'

// ─── Draft persistence ────────────────────────────────────────────────────────

const DRAFT_KEY = 'qk_stock_entry_draft'

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

// ─── Page ─────────────────────────────────────────────────────────────────────

const inputCls =
  'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400'

function POSelectorInputs({
  openPOs,
  onSelect,
}: {
  openPOs: OpenPO[]
  onSelect: (po: OpenPO) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = query.trim()
    ? openPOs.filter(
        (p) =>
          p.po_number.toLowerCase().includes(query.toLowerCase()) ||
          p.vendor_name.toLowerCase().includes(query.toLowerCase())
      )
    : openPOs

  const handleSelect = (po: OpenPO) => {
    onSelect(po)
    setQuery('')
    setOpen(false)
  }

  return (
    <div className="relative">
      <input
        type="text"
        className={inputCls}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Type PO number or vendor, or click to browse…"
        autoComplete="off"
        spellCheck={false}
      />
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400">No matching open POs</p>
          ) : (
            filtered.map((po) => (
              <button
                key={po.procurement_id}
                type="button"
                onMouseDown={() => handleSelect(po)}
                className="w-full text-left px-3 py-2.5 hover:bg-blue-50 flex items-center justify-between gap-2 border-b border-slate-50 last:border-0"
              >
                <div>
                  <span className="font-mono text-xs font-semibold text-slate-700">{po.po_number}</span>
                  <span className="text-xs text-slate-500 ml-2">{po.vendor_name}</span>
                </div>
                <span className="text-xs text-slate-400 shrink-0">{po.items.length} items</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default function InboundEntryPage() {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<FormDraft>(loadDraft)
  const [showNewProduct, setShowNewProduct] = useState(false)
  const [newProductTargetIdx, setNewProductTargetIdx] = useState<number | null>(null)
  const [submitResult, setSubmitResult] = useState<UploadResult | ReceivePOResult | null>(null)
  const [mobilePreview, setMobilePreview] = useState(false)
  const [searchParams] = useSearchParams()
  const [selectedPO, setSelectedPO] = useState<OpenPO | null>(null)

  const { data: vendors } = useQuery({
    queryKey: ['vendor-list'],
    queryFn: () => getVendorList().then((r) => r.data),
  })

  const { data: openPOsData } = useQuery({
    queryKey: ['open-pos'],
    queryFn: () => getOpenPOs().then((r) => r.data),
  })
  const openPOs: OpenPO[] = openPOsData?.data ?? []

  // Auto-select PO from URL param (?po=procurement_id)
  useEffect(() => {
    const poId = searchParams.get('po')
    if (poId && openPOs.length > 0) {
      const po = openPOs.find((p) => p.procurement_id === poId)
      if (po) applyPO(po)
    }
  }, [searchParams.get('po'), openPOs.length])

  // Persist draft on every change
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  }, [draft])

  const applyPO = (po: OpenPO) => {
    setSelectedPO(po)
    setDraft((d) => ({
      ...d,
      vendor_id: po.vendor_id,
      expected_receive_date: po.expected_receive_date ?? '',
      expected_receive_time: po.expected_receive_time ?? '',
      notes: po.notes ?? '',
      items: po.items.map((item) => ({
        ...emptyItem(),
        variant_id: item.variant_id,
        variant_label: `${item.product_name} — ${item.variant_name}`,
        sell_before_days: item.sell_before_days,
        temperature_required: item.temperature_required,
        unit_cost: String(item.unit_cost),
        ordered_qty: String(item.ordered_qty),
        procurement_item_id: item.procurement_item_id,
        ordered_qty_ref: item.ordered_qty,
      })),
    }))
  }

  const clearPO = () => {
    setSelectedPO(null)
    setDraft(defaultDraft())
  }

  const submitMutation = useMutation({
    mutationFn: (vars: { type: 'manual' | 'po'; payload: unknown }) => {
      if (vars.type === 'po') {
        const { procurementId, data } = vars.payload as { procurementId: string; data: Parameters<typeof receiveAgainstPO>[1] }
        return receiveAgainstPO(procurementId, data).then((r) => r.data as UploadResult | ReceivePOResult)
      }
      return submitManualInbound(vars.payload as Parameters<typeof submitManualInbound>[0]).then((r) => r.data as UploadResult | ReceivePOResult)
    },
    onSuccess: (res) => {
      setSubmitResult(res)
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] })
      queryClient.invalidateQueries({ queryKey: ['inbound-ledger'] })
      queryClient.invalidateQueries({ queryKey: ['open-pos'] })
      queryClient.invalidateQueries({ queryKey: ['po-open-monitor'] })
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
    const items = draft.items.filter((it) => it.variant_id && it.sell_before_date)
    if (!draft.vendor_invoice_number || items.length === 0) return

    if (selectedPO) {
      submitMutation.mutate({
        type: 'po',
        payload: {
          procurementId: selectedPO.procurement_id,
          data: {
            vendor_invoice_number: parseInt(draft.vendor_invoice_number),
            items: items
              .filter((it) => it.procurement_item_id)
              .map((it) => ({
                procurement_item_id: it.procurement_item_id!,
                received_qty: parseInt(it.received_qty) || 0,
                temperature_measured: parseInt(it.temperature_measured) || 0,
                expiry_date: it.expiry_date || undefined,
                sell_before_date: it.sell_before_date,
                batch_no: it.batch_no || undefined,
              })),
          },
        },
      })
    } else {
      if (!draft.vendor_id) return
      submitMutation.mutate({
        type: 'manual',
        payload: {
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
        },
      })
    }
  }

  const handleNewEntry = () => {
    setDraft(defaultDraft())
    setSubmitResult(null)
    setSelectedPO(null)
  }

  const hasDraft = draft.vendor_id || selectedPO || draft.items.some((i) => i.variant_id)
  const canSubmit = !submitMutation.isPending &&
    !!draft.vendor_invoice_number &&
    draft.items.some((i) => i.variant_id && i.sell_before_date) &&
    (selectedPO ? true : !!draft.vendor_id)

  // ─── Success screen ───────────────────────────────────────────────────────

  if (submitResult) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4 space-y-6">
        <div className="flex items-center gap-3 p-5 bg-emerald-50 border border-emerald-200 rounded-2xl">
          <CheckCircle size={24} className="text-emerald-600 shrink-0" />
          <div>
            <p className="font-semibold text-emerald-800 text-lg">Submitted for Approval</p>
            <p className="text-sm text-emerald-700 mt-0.5">
              {submitResult.processed} item(s) sent to the admin for review.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-center">
            <p className="text-3xl font-bold text-amber-600">{submitResult.pending_approval}</p>
            <p className="text-sm text-amber-700 mt-1">Pending Approval</p>
          </div>
          <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-center">
            <p className="text-3xl font-bold text-rose-600">{submitResult.rejected}</p>
            <p className="text-sm text-rose-700 mt-1">Rejected (QC)</p>
          </div>
        </div>

        {submitResult.rows.some((r) => r.status === 'rejected') && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Rejection Reasons</p>
            {submitResult.rows
              .filter((r) => r.status === 'rejected')
              .map((r, i) => (
                <div key={i} className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-100 rounded-lg text-sm text-rose-700">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <span>{r.reason || r.variant_id}</span>
                </div>
              ))}
          </div>
        )}

        <button
          onClick={handleNewEntry}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          <PackagePlus size={16} /> New Entry
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

      {/* Outer container: shrink to phone width when preview active */}
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
            <h1 className="text-xl font-bold text-slate-800">Stock Entry</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Fill in the details below — entry will go for admin approval.
            </p>
          </div>
          {!mobilePreview && (
          <button
            type="submit"
            disabled={!canSubmit}
            className="hidden sm:flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0"
          >
            {submitMutation.isPending ? (
              <><Loader2 size={15} className="animate-spin" /> Submitting…</>
            ) : (
              <><CheckCircle size={15} /> Submit for Approval</>
            )}
          </button>
          )}
        </div>

        {/* PO Selector */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Link2 size={15} className="text-blue-500" />
            <p className="text-sm font-semibold text-slate-700">Link to Purchase Order</p>
            <span className="text-xs text-slate-400">(optional)</span>
          </div>

          {selectedPO ? (
            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div>
                <p className="text-sm font-semibold text-blue-800 font-mono">{selectedPO.po_number}</p>
                <p className="text-xs text-blue-600 mt-0.5">{selectedPO.vendor_name} · {selectedPO.items.length} item(s)</p>
              </div>
              <button type="button" onClick={clearPO} className="text-xs text-blue-500 hover:text-blue-700 underline">
                Clear
              </button>
            </div>
          ) : (
            <POSelectorInputs openPOs={openPOs} onSelect={applyPO} />
          )}
        </div>

        {/* Draft indicator */}
        {hasDraft && (
          <div className="flex items-center justify-between px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
            <p className="text-xs text-blue-700">Draft saved — data persists if you switch devices or reload</p>
            <button
              type="button"
              onClick={handleNewEntry}
              className="text-xs text-blue-500 hover:text-blue-700 underline"
            >
              Clear draft
            </button>
          </div>
        )}

        {/* Procurement details card */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Shipment Details</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs text-slate-600 font-medium mb-1.5 block">Vendor *</label>
              {selectedPO ? (
                <div className={`${inputCls} bg-slate-50 text-slate-600 cursor-not-allowed`}>
                  {selectedPO.vendor_name}
                </div>
              ) : (
                <select
                  required
                  className={inputCls}
                  value={draft.vendor_id}
                  onChange={(e) => setHeader('vendor_id', e.target.value)}
                >
                  <option value="">Select vendor…</option>
                  {(vendors ?? []).map((v) => (
                    <option key={v.vendor_id} value={v.vendor_id}>{v.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
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

            <div>
              <label className="text-xs text-slate-600 font-medium mb-1.5 block">
                Expected Date
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
                {draft.expected_receive_date && !draft.expected_receive_time && (
                  <p className="text-xs text-slate-400">No time = end of day (23:59) assumed</p>
                )}
              </div>
            </div>

            <div className="sm:col-span-2">
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
        </div>

        {/* Items */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Items <span className="normal-case text-slate-400">({draft.items.length})</span>
            </p>
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
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-blue-600 border border-dashed border-blue-300 rounded-xl hover:bg-blue-50 transition-colors"
          >
            <Plus size={15} /> Add Another Item
          </button>
        </div>

        {submitMutation.isError && (
          <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-100 rounded-lg text-sm text-rose-600">
            <AlertCircle size={14} /> Submission failed. Check all required fields and try again.
          </div>
        )}

        {/* Bottom submit — always visible on mobile / in preview */}
        <div className="pb-6">
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {submitMutation.isPending ? (
              <><Loader2 size={15} className="animate-spin" /> Submitting…</>
            ) : (
              <><CheckCircle size={15} /> Submit for Approval</>
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

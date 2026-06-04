import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Package, Save } from 'lucide-react'
import { type DraftPO } from './DraftPOCard'

interface LineItem {
  product: string
  qty: number
  unit: string
}

interface DraftPOModalProps {
  draft: DraftPO | null
  open: boolean
  onClose: () => void
  onSave: (draftId: string, lineItems: LineItem[], notes: string) => void
  saving?: boolean
}

export default function DraftPOModal({
  draft,
  open,
  onClose,
  onSave,
  saving = false,
}: DraftPOModalProps) {
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (draft) {
      setLineItems(draft.line_items.map((li) => ({ ...li })))
      setNotes(draft.notes ?? '')
    }
  }, [draft])

  const updateQty = (idx: number, qty: number) => {
    setLineItems((prev) =>
      prev.map((li, i) => (i === idx ? { ...li, qty } : li))
    )
  }

  const updateUnit = (idx: number, unit: string) => {
    setLineItems((prev) =>
      prev.map((li, i) => (i === idx ? { ...li, unit } : li))
    )
  }

  const handleSave = () => {
    if (!draft) return
    onSave(draft.draft_id, lineItems, notes)
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col focus:outline-none">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package size={18} className="text-blue-600" />
              </div>
              <div>
                <Dialog.Title className="font-semibold text-slate-800">
                  Edit Draft PO
                </Dialog.Title>
                {draft && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {draft.po_type} · {draft.slot_label}
                  </p>
                )}
              </div>
            </div>
            <Dialog.Close asChild>
              <button className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Line Items Table */}
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Line Items
              </h3>
              <div className="border border-slate-100 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Product
                      </th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">
                        Qty
                      </th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">
                        Unit
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 bg-white">
                    {lineItems.map((li, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2.5 text-slate-700">{li.product}</td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            value={li.qty}
                            onChange={(e) => updateQty(i, Number(e.target.value))}
                            className="w-20 px-2 py-1 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-slate-50 focus:bg-white"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={li.unit}
                            onChange={(e) => updateUnit(i, e.target.value)}
                            className="w-20 px-2 py-1 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-slate-50 focus:bg-white"
                          />
                        </td>
                      </tr>
                    ))}
                    {lineItems.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-center text-sm text-slate-400">
                          No line items
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Add notes for this PO…"
                className="w-full px-3 py-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 focus:bg-white resize-none transition-colors"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors shadow-sm"
            >
              <Save size={14} />
              {saving ? 'Saving…' : 'Override & Save'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

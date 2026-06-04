import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Settings2 } from 'lucide-react'
import { type InventoryItem } from './InventoryCard'

interface ThresholdData {
  min_stock_level: number
  max_stock_level: number | null
  reorder_point: number | null
  reorder_qty: number | null
  expiry_alert_days: number | null
}

interface ThresholdEditModalProps {
  item: InventoryItem | null
  open: boolean
  onClose: () => void
  onSave: (thresholdId: string, data: ThresholdData) => void
  saving?: boolean
}

function NumericInput({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
  required?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label} {required && <span className="text-rose-400">*</span>}
      </label>
      <input
        type="number"
        min={0}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        placeholder={placeholder ?? '—'}
        className="w-full px-3 py-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 focus:bg-white transition-colors"
      />
    </div>
  )
}

export default function ThresholdEditModal({
  item,
  open,
  onClose,
  onSave,
  saving = false,
}: ThresholdEditModalProps) {
  const [form, setForm] = useState<ThresholdData>({
    min_stock_level: 0,
    max_stock_level: null,
    reorder_point: null,
    reorder_qty: null,
    expiry_alert_days: null,
  })

  useEffect(() => {
    if (item) {
      setForm({
        min_stock_level: item.min_stock_level,
        max_stock_level: item.max_stock_level,
        reorder_point: item.reorder_point,
        reorder_qty: item.reorder_qty,
        expiry_alert_days: null,
      })
    }
  }, [item])

  const handleSave = () => {
    if (!item?.threshold_id) return
    onSave(item.threshold_id, form)
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 focus:outline-none">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
                <Settings2 size={18} className="text-blue-600" />
              </div>
              <div>
                <Dialog.Title className="font-semibold text-slate-800">
                  Edit Thresholds
                </Dialog.Title>
                {item && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {item.product_name} · {item.variant_name}
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

          {/* Form */}
          <div className="grid grid-cols-2 gap-4">
            <NumericInput
              label="Min Stock Level"
              value={form.min_stock_level}
              onChange={(v) => setForm((f) => ({ ...f, min_stock_level: v ?? 0 }))}
              required
            />
            <NumericInput
              label="Max Stock Level"
              value={form.max_stock_level}
              onChange={(v) => setForm((f) => ({ ...f, max_stock_level: v }))}
              placeholder="No limit"
            />
            <NumericInput
              label="Reorder Point"
              value={form.reorder_point}
              onChange={(v) => setForm((f) => ({ ...f, reorder_point: v }))}
            />
            <NumericInput
              label="Reorder Qty"
              value={form.reorder_qty}
              onChange={(v) => setForm((f) => ({ ...f, reorder_qty: v }))}
            />
            <div className="col-span-2">
              <NumericInput
                label="Expiry Alert (days before)"
                value={form.expiry_alert_days}
                onChange={(v) => setForm((f) => ({ ...f, expiry_alert_days: v }))}
                placeholder="e.g. 3"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !item?.threshold_id}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors shadow-sm"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

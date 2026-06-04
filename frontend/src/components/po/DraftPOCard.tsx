import { Calendar, Clock, Edit3, Package } from 'lucide-react'
import StatusBadge from '@/components/shared/StatusBadge'
import CountdownTimer from './CountdownTimer'
import { formatTs } from '@/lib/utils'

export interface DraftPO {
  draft_id: string
  po_type: string
  slot_label: string
  status: 'draft' | 'sent' | 'overridden'
  grace_starts_at: string
  scheduled_fire_at: string
  line_items: Array<{ product: string; qty: number; unit: string }>
  notes: string | null
  created_at: string
}

interface DraftPOCardProps {
  draft: DraftPO
  onEdit: (draft: DraftPO) => void
}

const poTypeColor: Record<string, string> = {
  dairy: 'bg-blue-100 text-blue-700 border-blue-200',
  meat: 'bg-rose-100 text-rose-700 border-rose-200',
  produce: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  flowers: 'bg-purple-100 text-purple-700 border-purple-200',
}

export default function DraftPOCard({ draft, onEdit }: DraftPOCardProps) {
  const typeStyle = poTypeColor[draft.po_type.toLowerCase()] ?? 'bg-slate-100 text-slate-600 border-slate-200'

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-md border uppercase tracking-wide ${typeStyle}`}>
            {draft.po_type}
          </span>
          <span className="text-sm font-medium text-slate-700">{draft.slot_label}</span>
        </div>
        <StatusBadge status={draft.status} />
      </div>

      {/* Times */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-start gap-2">
          <Calendar size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs text-slate-400">Grace starts</p>
            <p className="text-xs font-medium text-slate-600 mt-0.5">{formatTs(draft.grace_starts_at)}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Clock size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs text-slate-400">Scheduled fire</p>
            <p className="text-xs font-medium text-slate-600 mt-0.5">{formatTs(draft.scheduled_fire_at)}</p>
          </div>
        </div>
      </div>

      {/* Countdown */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Fires in:</span>
        <CountdownTimer targetTime={draft.scheduled_fire_at} />
      </div>

      {/* Line items summary */}
      {draft.line_items.length > 0 && (
        <div className="border-t border-slate-50 pt-3">
          <div className="flex items-center gap-2 mb-2">
            <Package size={13} className="text-slate-400" />
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              {draft.line_items.length} Item{draft.line_items.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-1">
            {draft.line_items.slice(0, 3).map((li, i) => (
              <div key={i} className="flex justify-between text-xs text-slate-600">
                <span className="truncate">{li.product}</span>
                <span className="ml-2 flex-shrink-0 text-slate-400">
                  {li.qty} {li.unit}
                </span>
              </div>
            ))}
            {draft.line_items.length > 3 && (
              <p className="text-xs text-slate-400">+{draft.line_items.length - 3} more…</p>
            )}
          </div>
        </div>
      )}

      {/* Notes */}
      {draft.notes && (
        <p className="text-xs text-slate-500 italic border-t border-slate-50 pt-3">
          {draft.notes}
        </p>
      )}

      {/* Edit button */}
      {draft.status === 'draft' && (
        <button
          onClick={() => onEdit(draft)}
          className="flex items-center justify-center gap-2 w-full py-2.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors mt-auto"
        >
          <Edit3 size={14} />
          Edit Quantities
        </button>
      )}
    </div>
  )
}

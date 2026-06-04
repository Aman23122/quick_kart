import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Clock, ClipboardList, Plus, Send, Package, ArrowRight, Edit3 } from 'lucide-react'
import { getSchedule, getOpenPOs, markPOSent, getTemplate, type OpenPO, type POTemplate } from '@/services/poApi'
import ManualPOForm from '@/components/po/ManualPOForm'
import SchedulerLog from '@/components/po/SchedulerLog'
import CountdownTimer from '@/components/po/CountdownTimer'
import ScheduledTemplateModal from '@/components/po/ScheduledTemplateModal'
import { useNavigate } from 'react-router-dom'
import { formatCurrency } from '@/lib/utils'

const SCHEDULE_SLOTS = [
  { slotId: 'dairy_evening', slotLabel: 'Dairy Evening', description: 'Dairy products evening replenishment' },
]

// ── Scheduled Replenishment Card ──────────────────────────────────────────────

interface ScheduleCardProps {
  slotId: string
  slotLabel: string
  description: string
  nextRun: string | undefined
  template: POTemplate | undefined
  onEdit: () => void
}

function ScheduleCard({ slotId, slotLabel, description, nextRun, template, onEdit }: ScheduleCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-slate-800 text-sm">{slotLabel}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
          {template?.vendor_name && (
            <p className="text-xs text-slate-400 mt-0.5 font-medium">{template.vendor_name}</p>
          )}
        </div>
        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase">
          {slotId.split('_')[0]}
        </span>
      </div>

      {/* Next run */}
      <div className="flex items-center gap-2">
        <Clock size={13} className="text-slate-400" />
        <span className="text-xs text-slate-500">Next auto-fire:</span>
        {nextRun
          ? <CountdownTimer targetTime={nextRun} />
          : <span className="text-xs text-slate-400">Not scheduled</span>
        }
      </div>

      {/* Template preview */}
      {template && template.items.length > 0 && (
        <div className="border border-slate-100 rounded-lg bg-slate-50 divide-y divide-slate-100 text-xs">
          {template.items.map((it, i) => (
            <div key={i} className="flex justify-between px-3 py-2 text-slate-600">
              <span className="truncate">{it.product_name} — {it.variant_name}</span>
              <span className="ml-2 shrink-0 text-slate-400">{it.ordered_qty} × ₹{it.unit_cost}</span>
            </div>
          ))}
        </div>
      )}

      {/* Edit button — always visible */}
      <button
        onClick={onEdit}
        className="flex items-center gap-2 w-full justify-center py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
      >
        <Edit3 size={14} /> Edit Template
      </button>
    </div>
  )
}

// ── Manual POs Section ────────────────────────────────────────────────────────

function ManualPOSection() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['po-open-monitor'],
    queryFn: () => getOpenPOs().then((r) => r.data),
    refetchInterval: 30_000,
  })

  const sendMutation = useMutation({
    mutationFn: markPOSent,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['po-open-monitor'] }),
  })

  const pos: OpenPO[] = data?.data ?? []

  const statusColor: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-600',
    sent: 'bg-blue-100 text-blue-700',
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Manual POs</h2>
          {pos.length > 0 && (
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{pos.length}</span>
          )}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          <Plus size={14} /> Create PO
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-100 p-5 space-y-3">
              <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4" />
              <div className="h-3 bg-slate-100 rounded animate-pulse w-1/2" />
            </div>
          ))}
        </div>
      ) : pos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-slate-400 bg-white rounded-xl border border-slate-100">
          <ClipboardList size={28} className="opacity-30" />
          <p className="text-sm">No open POs. Click "Create PO" to start.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pos.map((po) => (
            <div key={po.procurement_id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-xs font-semibold text-slate-700">{po.po_number}</p>
                  <p className="text-sm font-medium text-slate-800 mt-0.5">{po.vendor_name}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full uppercase ${statusColor[po.status] ?? 'bg-slate-100 text-slate-500'}`}>
                  {po.status}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Package size={12} />
                <span>{po.items.length} item{po.items.length !== 1 ? 's' : ''}</span>
                <span className="text-slate-300">·</span>
                <span>{formatCurrency(po.total_amount)}</span>
              </div>

              {po.expected_receive_date && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Clock size={12} />
                  <span>Expected: {po.expected_receive_date}{po.expected_receive_time ? ` at ${po.expected_receive_time}` : ''}</span>
                </div>
              )}

              <div className="border-t border-slate-50 pt-2 space-y-1">
                {po.items.slice(0, 3).map((item) => (
                  <div key={item.procurement_item_id} className="flex justify-between text-xs text-slate-600">
                    <span className="truncate">{item.product_name} — {item.variant_name}</span>
                    <span className="ml-2 shrink-0 text-slate-400">{item.ordered_qty}</span>
                  </div>
                ))}
                {po.items.length > 3 && <p className="text-xs text-slate-400">+{po.items.length - 3} more…</p>}
              </div>

              <div className="flex gap-2 mt-auto">
                {po.status === 'draft' && (
                  <button
                    onClick={() => sendMutation.mutate(po.procurement_id)}
                    disabled={sendMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                  >
                    <Send size={12} /> Mark Sent
                  </button>
                )}
                <button
                  onClick={() => navigate(`/stock-entry?po=${po.procurement_id}`)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                  <ArrowRight size={12} /> Receive Stock
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ManualPOForm open={showCreate} onClose={() => setShowCreate(false)} />
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function POMonitor() {
  const [editingSlot, setEditingSlot] = useState<typeof SCHEDULE_SLOTS[0] | null>(null)

  const { data: scheduleData } = useQuery({
    queryKey: ['po-schedule'],
    queryFn: () => getSchedule().then((r) => r.data),
    refetchInterval: 30_000,
  })

  const templateQueries = SCHEDULE_SLOTS.map((slot) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useQuery({
      queryKey: ['po-template', slot.slotId],
      queryFn: () => getTemplate(slot.slotId).then((r) => r.data),
    })
  )

  const getNextRun = (slotId: string): string | undefined => {
    const jobs = scheduleData?.jobs ?? []
    return jobs.find((j) => j.job_id === slotId)?.next_run
  }

  return (
    <div className="space-y-8">
      {/* Manual POs */}
      <div>
        <ManualPOSection />
      </div>

      {/* Scheduled Replenishment */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
          Scheduled Replenishment
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SCHEDULE_SLOTS.map((slot, i) => (
            <ScheduleCard
              key={slot.slotId}
              slotId={slot.slotId}
              slotLabel={slot.slotLabel}
              description={slot.description}
              nextRun={getNextRun(slot.slotId)}
              template={templateQueries[i].data}
              onEdit={() => setEditingSlot(slot)}
            />
          ))}
        </div>
      </div>

      {/* Scheduler Jobs */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
          Scheduler Jobs
        </h2>
        <SchedulerLog jobs={scheduleData?.jobs ?? []} />
      </div>

      {/* Template edit modal */}
      {editingSlot && (
        <ScheduledTemplateModal
          slotId={editingSlot.slotId}
          slotLabel={editingSlot.slotLabel}
          open={!!editingSlot}
          onClose={() => setEditingSlot(null)}
        />
      )}
    </div>
  )
}

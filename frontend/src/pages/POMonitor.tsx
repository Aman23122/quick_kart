import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Play, Clock, RefreshCw, ClipboardList } from 'lucide-react'
import { listDrafts, updateDraft, triggerPO, getSchedule } from '@/services/poApi'
import DraftPOCard, { type DraftPO } from '@/components/po/DraftPOCard'
import DraftPOModal from '@/components/po/DraftPOModal'
import SchedulerLog from '@/components/po/SchedulerLog'
import CountdownTimer from '@/components/po/CountdownTimer'

const SCHEDULE_SLOTS = [
  { po_type: 'dairy', slot_label: 'Dairy Evening', description: 'Dairy products evening replenishment' },
  { po_type: 'meat', slot_label: 'Meat Morning', description: 'Meat products morning replenishment' },
  { po_type: 'meat', slot_label: 'Meat/Flowers Evening', description: 'Meat and flowers evening replenishment' },
]

interface ScheduleCardProps {
  slot: typeof SCHEDULE_SLOTS[0]
  nextRun: string | undefined
  onTrigger: () => void
  triggering: boolean
}

function ScheduleCard({ slot, nextRun, onTrigger, triggering }: ScheduleCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-slate-800 text-sm">{slot.slot_label}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{slot.description}</p>
        </div>
        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase">
          {slot.po_type}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Clock size={13} className="text-slate-400" />
        <span className="text-xs text-slate-500">Next run:</span>
        {nextRun ? (
          <CountdownTimer targetTime={nextRun} />
        ) : (
          <span className="text-xs text-slate-400">Not scheduled</span>
        )}
      </div>
      <button
        onClick={onTrigger}
        disabled={triggering}
        className="flex items-center gap-2 w-full justify-center py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors"
      >
        {triggering ? (
          <RefreshCw size={14} className="animate-spin" />
        ) : (
          <Play size={14} />
        )}
        Trigger Demo PO
      </button>
    </div>
  )
}

export default function POMonitor() {
  const queryClient = useQueryClient()
  const [editDraft, setEditDraft] = useState<DraftPO | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [triggeringSlot, setTriggeringSlot] = useState<string | null>(null)

  const { data: draftsData, isLoading: draftsLoading } = useQuery({
    queryKey: ['po-drafts'],
    queryFn: () => listDrafts({ status: 'draft' }).then((r) => r.data),
    refetchInterval: 30_000,
  })

  const { data: scheduleData } = useQuery({
    queryKey: ['po-schedule'],
    queryFn: () => getSchedule().then((r) => r.data),
    refetchInterval: 30_000,
  })

  const saveMutation = useMutation({
    mutationFn: ({ id, items, notes }: { id: string; items: DraftPO['line_items']; notes: string }) =>
      updateDraft(id, { line_items: items, notes, status: 'overridden' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['po-drafts'] })
      setModalOpen(false)
      setEditDraft(null)
    },
  })

  const triggerMutation = useMutation({
    mutationFn: ({ po_type, slot_label }: { po_type: string; slot_label: string }) =>
      triggerPO(po_type, slot_label),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['po-drafts'] })
      setTriggeringSlot(null)
    },
    onError: () => {
      setTriggeringSlot(null)
    },
  })

  const handleTrigger = (slot: typeof SCHEDULE_SLOTS[0]) => {
    setTriggeringSlot(slot.slot_label)
    triggerMutation.mutate({ po_type: slot.po_type, slot_label: slot.slot_label })
  }

  const getNextRunForSlot = (slotLabel: string): string | undefined => {
    const jobs = scheduleData?.jobs ?? []
    const job = jobs.find(
      (j) =>
        j.job_id.toLowerCase().includes(slotLabel.toLowerCase().replace(/\s+/g, '_')) ||
        j.job_id.toLowerCase().includes(slotLabel.toLowerCase().split(' ')[0])
    )
    return job?.next_run
  }

  const handleSave = (draftId: string, lineItems: DraftPO['line_items'], notes: string) => {
    saveMutation.mutate({ id: draftId, items: lineItems, notes })
  }

  return (
    <div className="space-y-8">
      {/* Scheduler countdown cards */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
          Scheduled Replenishment
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {SCHEDULE_SLOTS.map((slot) => (
            <ScheduleCard
              key={slot.slot_label}
              slot={slot}
              nextRun={getNextRunForSlot(slot.slot_label)}
              onTrigger={() => handleTrigger(slot)}
              triggering={triggeringSlot === slot.slot_label}
            />
          ))}
        </div>
      </div>

      {/* Active Draft POs */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
            Active Draft POs
          </h2>
          {draftsData?.data && (
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {draftsData.data.length}
            </span>
          )}
        </div>

        {draftsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-3">
                <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4" />
                <div className="h-3 bg-slate-100 rounded animate-pulse w-1/2" />
                <div className="h-8 bg-slate-100 rounded animate-pulse w-full" />
              </div>
            ))}
          </div>
        ) : !draftsData?.data?.length ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400 bg-white rounded-xl border border-slate-100">
            <ClipboardList size={32} className="opacity-30" />
            <p className="text-sm">No active draft POs. Trigger a demo PO above to create one.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {draftsData.data.map((draft) => (
              <DraftPOCard
                key={draft.draft_id}
                draft={draft}
                onEdit={(d) => {
                  setEditDraft(d)
                  setModalOpen(true)
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Scheduler Log */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
          Scheduler Jobs
        </h2>
        <SchedulerLog jobs={scheduleData?.jobs ?? []} />
      </div>

      {/* Draft PO Modal */}
      <DraftPOModal
        draft={editDraft}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditDraft(null)
        }}
        onSave={handleSave}
        saving={saveMutation.isPending}
      />
    </div>
  )
}

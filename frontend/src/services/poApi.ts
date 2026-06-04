import api from '@/lib/axios'
import { type DraftPO } from '@/components/po/DraftPOCard'

export interface DraftListParams {
  status?: string
}

export interface DraftUpdateData {
  line_items: Array<{ product: string; qty: number; unit: string }>
  notes: string
  status?: string
}

export interface ScheduleJob {
  job_id: string
  next_run: string
}

export const listDrafts = (params: DraftListParams) =>
  api.get<{ total: number; data: DraftPO[] }>('/api/po/drafts', { params })

export const updateDraft = (draftId: string, data: DraftUpdateData) =>
  api.patch<DraftPO>(`/api/po/draft/${draftId}`, data)

export const triggerPO = (po_type: string, slot_label: string) =>
  api.post('/api/po/trigger', null, { params: { po_type, slot_label } })

export const getSchedule = () =>
  api.get<{ jobs: ScheduleJob[] }>('/api/po/schedule')

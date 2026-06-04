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

// ─── Manual PO ───────────────────────────────────────────────────────────────

export interface ManualPOItem {
  variant_id: string
  ordered_qty: number
  unit_cost: number
}

export interface ManualPOPayload {
  vendor_id: string
  expected_receive_date?: string
  expected_receive_time?: string
  notes?: string
  items: ManualPOItem[]
}

export interface OpenPOItem {
  procurement_item_id: string
  variant_id: string
  variant_name: string
  product_name: string
  brand_name: string
  ordered_qty: number
  unit_cost: number
  sell_before_days: number
  temperature_required: number
}

export interface OpenPO {
  procurement_id: string
  po_number: string
  vendor_id: string
  vendor_name: string
  status: string
  expected_receive_date: string | null
  expected_receive_time: string | null
  notes: string | null
  total_amount: number
  items: OpenPOItem[]
  created_at: string
}

export const createManualPO = (payload: ManualPOPayload) =>
  api.post<{ procurement_id: string; po_number: string; status: string }>('/api/po/manual', payload)

export const getOpenPOs = () =>
  api.get<{ total: number; data: OpenPO[] }>('/api/po/open')

export const markPOSent = (procurementId: string) =>
  api.patch<{ status: string; po_number: string }>(`/api/po/${procurementId}/send`)

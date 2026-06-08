import api from '@/lib/axios'

export interface ScheduleJob {
  job_id: string
  next_run: string
}

export const getSchedule = () =>
  api.get<{ jobs: ScheduleJob[] }>('/api/po/schedule')

// ─── Scheduled PO Template ────────────────────────────────────────────────────

export interface TemplateItem {
  variant_id: string
  product_name: string
  variant_name: string
  ordered_qty: number
  unit_cost: number
}

export interface POTemplate {
  slot_id: string
  label: string
  vendor_id: string
  vendor_name: string
  notes: string
  cron_time: string
  expected_receive_time: string
  items: TemplateItem[]
}

export interface TemplateUpdatePayload {
  vendor_id?: string
  notes?: string
  items?: Array<{ variant_id: string; ordered_qty: number; unit_cost: number }>
  cron_time?: string
  expected_receive_time?: string
}

export interface CreateTemplatePayload {
  label: string
  vendor_id: string
  cron_time: string
  expected_receive_time: string
  notes?: string
  items: Array<{ variant_id: string; ordered_qty: number; unit_cost: number }>
}

export const getTemplates = () =>
  api.get<{ templates: POTemplate[] }>('/api/po/templates')

export const getTemplate = (slotId: string) =>
  api.get<POTemplate>(`/api/po/template/${slotId}`)

export const updateTemplate = (slotId: string, data: TemplateUpdatePayload) =>
  api.put<{ status: string }>(`/api/po/template/${slotId}`, data)

export const createDailyPO = (data: CreateTemplatePayload) =>
  api.post<{ slot_id: string; label: string; status: string }>('/api/po/template', data)

export const deleteTemplate = (slotId: string) =>
  api.delete<{ status: string }>(`/api/po/template/${slotId}`)

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

export const deletePO = (procurementId: string) =>
  api.delete<{ status: string }>(`/api/po/${procurementId}`)

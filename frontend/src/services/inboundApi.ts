import api from '@/lib/axios'

export interface InboundRow {
  procurement_id?: string
  po_number?: string
  vendor_name?: string
  vendor_id?: string
  variant_id?: string
  variant_name?: string
  ordered_qty?: number
  received_qty?: number
  temperature_measured?: number
  unit_cost?: number
  total_cost?: number
  batch_no?: string
  expiry_date?: string | null
  sell_before_date?: string | null
  expected_receive_date?: string | null
  expected_receive_time?: string | null
  on_time?: boolean | null
  status?: string
  created_at?: string
  [key: string]: unknown
}

export interface PendingItem {
  procurement_id: string
  procurement_item_id: string
  po_number: string
  vendor_name: string
  vendor_id: string
  variant_id: string
  variant_name: string
  product_name: string
  brand_name: string
  ordered_qty: number
  received_qty: number
  temperature_measured: number
  temp_threshold: number
  temp_ok: boolean
  unit_cost: number
  total_cost: number
  batch_no: string | null
  expiry_date: string | null
  sell_before_date: string
  created_at: string
}

export interface InboundLedgerParams {
  date_from?: string
  date_to?: string
  status?: string
  skip?: number
  limit?: number
}

export interface UploadResult {
  processed: number
  pending_approval: number
  rejected: number
  rows: { variant_id: string; status: string; reason: string }[]
}

export const uploadInboundCSV = async (file: File): Promise<UploadResult> => {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await api.post('/api/inbound/upload-csv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export const getPendingApprovals = () =>
  api.get<{ total: number; data: PendingItem[] }>('/api/inbound/pending')

export const approveInbound = (procurementId: string) =>
  api.post(`/api/inbound/${procurementId}/approve`)

export const rejectInbound = (procurementId: string) =>
  api.post(`/api/inbound/${procurementId}/reject`)

export const getInboundLedger = (params: InboundLedgerParams) =>
  api.get<{ total: number; data: InboundRow[] }>('/api/inbound/ledger', { params })

export interface ManualInboundItem {
  variant_id: string
  ordered_qty: number
  received_qty: number
  temperature_measured: number
  unit_cost: number
  expiry_date?: string
  sell_before_date: string
  batch_no?: string
}

export interface ManualInboundPayload {
  vendor_id: string
  vendor_invoice_number: number
  expected_receive_date?: string
  expected_receive_time?: string
  notes?: string
  items: ManualInboundItem[]
}

export const submitManualInbound = (payload: ManualInboundPayload) =>
  api.post<UploadResult>('/api/inbound/manual', payload)

export interface ReceiveItemDetail {
  procurement_item_id: string
  received_qty: number
  temperature_measured: number
  expiry_date?: string
  sell_before_date: string
  batch_no?: string
}

export interface ReceivePOPayload {
  vendor_invoice_number: number
  items: ReceiveItemDetail[]
}

export interface ReceivePOResult {
  procurement_id: string
  po_number: string
  status: string
  passed: number
  failed: number
  rows: { procurement_item_id: string; variant_id: string; status: string; reason: string }[]
}

export const receiveAgainstPO = (procurementId: string, payload: ReceivePOPayload) =>
  api.post<ReceivePOResult>(`/api/inbound/receive/${procurementId}`, payload)

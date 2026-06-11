import api from '@/lib/axios'

export interface OutboundRow {
  order_id?: string
  user_id?: string
  product_name?: string
  variant_name?: string
  variant_id?: string
  quantity?: number
  unit_price?: number
  total_price?: number
  order_status?: string
  payment_status?: string
  created_at?: string
  [key: string]: unknown
}

export interface OutboundLedgerParams {
  date_from?: string
  date_to?: string
  status?: string
  skip?: number
  limit?: number
}

export interface OutboundUploadResult {
  order_id: string
  processed: number
  pending_approval: number
  rows: { variant_id: string; status: string; qty_requested: number }[]
}

export interface FEFOBatch {
  inventory_id: string
  batch_no: string | null
  sell_before_date: string
  expiry_date: string | null
  qty_available: number
  qty_to_dispatch: number
  days_until_expiry: number | null
  temperature_measured: number | null
  dispatch_blocked: boolean
  dispatch_cutoff: string | null
}

export interface PendingOrderLine {
  order_line_id: string
  variant_id: string
  variant_name: string
  product_name: string
  brand_name: string
  qty_requested: number
  unit_price: number
  shelf_blocked: boolean
  block_reason: string
  fefo_preview: {
    fulfilled: boolean
    qty_fulfilled: number
    shortage: number
    batches: FEFOBatch[]
  }
}

export interface PendingOrder {
  order_id: string
  user_id: string
  estimated_total: number
  created_at: string
  lines: PendingOrderLine[]
}

export const uploadOutboundCSV = async (file: File): Promise<OutboundUploadResult> => {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await api.post('/api/outbound/upload-csv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export const getPendingOutbound = () =>
  api.get<{ total: number; data: PendingOrder[] }>('/api/outbound/pending')

export const approveOutbound = (orderId: string) =>
  api.post(`/api/outbound/${orderId}/approve`)

export const rejectOutbound = (orderId: string) =>
  api.post(`/api/outbound/${orderId}/reject`)

export const getOutboundLedger = (params: OutboundLedgerParams) =>
  api.get<{ total: number; data: OutboundRow[] }>('/api/outbound/ledger', { params })

// ─── Manual Sales Order ───────────────────────────────────────────────────────

export interface ManualOrderItem {
  variant_id: string
  quantity: number
  unit_price: number
}

export interface ManualOrderPayload {
  customer_name: string
  notes?: string
  items: ManualOrderItem[]
}

export const createManualOrder = (payload: ManualOrderPayload) =>
  api.post<{ order_id: string; status: string; total: number }>('/api/outbound/manual', payload)

// ─── Logistics Supervisor ─────────────────────────────────────────────────────

export interface ConfirmedOrderLine {
  order_line_id: string
  variant_id: string
  variant_name: string
  product_name: string
  brand_name: string
  original_qty: number
  allocated_qty: number
  dispatch_qty: number | null
  unit_price: number
  total_price: number
}

export interface ConfirmedOrder {
  order_id: string
  customer_name: string
  notes: string | null
  total_price: number
  created_at: string
  confirmed_at: string
  lines: ConfirmedOrderLine[]
}

export interface DispatchItemPayload {
  order_line_id: string
  dispatch_qty: number
}

export const getConfirmedOrders = () =>
  api.get<{ total: number; data: ConfirmedOrder[] }>('/api/outbound/confirmed')

export const dispatchOrder = (orderId: string, items: DispatchItemPayload[], notes?: string) =>
  api.post(`/api/outbound/${orderId}/dispatch`, { items, notes })

import api from '@/lib/axios'

export interface OutboundRow {
  row_id?: string
  order_id?: string
  user_name?: string
  variant_name?: string
  variant_id?: string
  qty?: number
  unit_price?: number
  total?: number
  status?: string
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
  fulfilled: number
  blocked: number
  partial: number
  total: number
  errors?: string[]
}

export const uploadOutboundCSV = async (file: File): Promise<OutboundUploadResult> => {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await api.post('/api/outbound/upload-csv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export const getOutboundLedger = (params: OutboundLedgerParams) =>
  api.get<{ total: number; data: OutboundRow[] }>('/api/outbound/ledger', { params })

import api from '@/lib/axios'

export interface InboundRow {
  row_id?: string
  po_number?: string
  vendor?: string
  variant_name?: string
  variant_id?: string
  ordered_qty?: number
  received_qty?: number
  temperature_c?: number | null
  batch_code?: string
  sell_before_date?: string | null
  status?: string
  created_at?: string
  [key: string]: unknown
}

export interface InboundLedgerParams {
  date_from?: string
  date_to?: string
  status?: string
  skip?: number
  limit?: number
}

export interface UploadResult {
  accepted: number
  rejected: number
  total: number
  errors?: string[]
}

export const uploadInboundCSV = async (file: File): Promise<UploadResult> => {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await api.post('/api/inbound/upload-csv', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export const getInboundLedger = (params: InboundLedgerParams) =>
  api.get<{ total: number; data: InboundRow[] }>('/api/inbound/ledger', { params })

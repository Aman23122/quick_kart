import api from '@/lib/axios'

export interface AlertRow {
  alert_id: string
  variant_id: string
  variant_name: string
  product_name: string
  brand_name: string
  alert_type: string
  current_qty: number | null
  threshold_qty: number | null
  message: string
  is_resolved: boolean
  resolved_at: string | null
  created_at: string
  [key: string]: unknown
}

export interface AlertListParams {
  alert_type?: string
  is_resolved?: boolean
  skip?: number
  limit?: number
}

export const listAlerts = (params: AlertListParams) =>
  api.get<{ total: number; data: AlertRow[] }>('/api/alerts', { params })

export const resolveAlert = (alertId: string) =>
  api.post(`/api/alerts/${alertId}/resolve`)

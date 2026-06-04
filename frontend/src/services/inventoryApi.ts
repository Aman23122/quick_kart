import api from '@/lib/axios'
import { type InventoryItem } from '@/components/inventory/InventoryCard'

export interface InventoryGridParams {
  brand_id?: string
  cat_id?: string
  status_filter?: string
}

export interface ThresholdUpdateData {
  min_stock_level: number
  max_stock_level: number | null
  reorder_point: number | null
  reorder_qty: number | null
  expiry_alert_days?: number | null
}

export const getInventoryGrid = (params: InventoryGridParams) =>
  api.get<{ data: InventoryItem[] }>('/api/inventory/grid', { params })

export const updateThreshold = (thresholdId: string, data: ThresholdUpdateData) =>
  api.patch<InventoryItem>(`/api/inventory/threshold/${thresholdId}`, data)

export const deleteBatch = (inventoryId: string) =>
  api.delete(`/api/inventory/batch/${inventoryId}`)

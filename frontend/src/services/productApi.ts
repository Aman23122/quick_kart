import api from '@/lib/axios'

export interface VariantOption {
  variant_id: string
  variant_name: string
  product_name: string
  brand_name: string
  unit: string | null
  sell_before_days: number
  temperature_required: number
  buying_price: number | null
  base_price: number | null
}

export interface QuickAddPayload {
  product_name: string
  brand_name?: string
  type: string
  variant_name: string
  unit: string
  quantity: number
  base_mrp: number
  sell_before_days: number
  temperature_required: number
}

export const searchVariants = (q: string) =>
  api.get<VariantOption[]>('/api/products/variants/search', { params: { q } })

export const quickAddProduct = (payload: QuickAddPayload) =>
  api.post<VariantOption>('/api/products/quick-add', payload)

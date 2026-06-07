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

export interface BrandOption {
  brand_id: string
  name: string
}

export interface ProductRow {
  product_id: string
  product_name: string
  brand_id: string | null
  brand_name: string
  type: string | null
  description: string | null
  variant_count: number
  variants: VariantOption[]
}

export interface CreateProductPayload {
  product_name: string
  brand_id?: string
  brand_name?: string
  type: string
  description?: string
  unit: string
  quantity: number
  base_price: number
  base_mrp?: number
  buying_price: number
  sell_before_days: number
  temperature_required: number
  min_stock_level: number
  max_stock_level: number
  reorder_point: number
  reorder_qty: number
}

export const searchVariants = (q: string) =>
  api.get<VariantOption[]>('/api/products/variants/search', { params: { q } })

export const quickAddProduct = (payload: QuickAddPayload) =>
  api.post<VariantOption>('/api/products/quick-add', payload)

export const getBrands = () =>
  api.get<BrandOption[]>('/api/products/brands')

export const getProducts = (params?: { q?: string; brand_id?: string }) =>
  api.get<{ total: number; data: ProductRow[] }>('/api/products', { params })

export const createProduct = (payload: CreateProductPayload) =>
  api.post<{ product_id: string; variant_id: string; product_name: string }>('/api/products', payload)

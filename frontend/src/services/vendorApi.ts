import api from '@/lib/axios'

export interface VendorOption {
  vendor_id: string
  name: string
  contact_name: string | null
}

export const getVendorList = () => api.get<VendorOption[]>('/api/vendors/list')

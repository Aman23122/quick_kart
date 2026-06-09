import { create } from 'zustand'
import api from '@/lib/axios'

export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'inbound_validator'
  | 'outbound_validator'
  | 'po_executor'
  | 'inspector'

export interface AuthUser {
  id: number | null
  username: string
  role: UserRole
  email: string
}

interface AuthStore {
  user: AuthUser | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: true,

  login: async (email, password) => {
    const { data } = await api.post('/api/auth/login', { email, password })
    set({
      user: {
        id: data.id ?? null,
        username: data.username,
        role: data.role,
        email: data.email ?? '',
      },
    })
  },

  logout: async () => {
    try {
      await api.post('/api/auth/logout')
    } finally {
      set({ user: null })
    }
  },

  checkAuth: async () => {
    try {
      const { data } = await api.get('/api/auth/me')
      set({
        user: {
          id: data.id ?? null,
          username: data.username,
          role: data.role,
          email: data.email ?? '',
        },
        isLoading: false,
      })
    } catch {
      set({ user: null, isLoading: false })
    }
  },
}))

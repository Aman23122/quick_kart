import { useEffect, useRef } from 'react'
import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'

import AppShell from '@/components/layout/AppShell'
import SuperAdminLayout from '@/components/layout/SuperAdminLayout'
import AdminLayout from '@/components/layout/AdminLayout'

import LoginPage from '@/pages/LoginPage'
import SuperAdminDashboard from '@/pages/SuperAdminDashboard'
import CreateUserPage from '@/pages/CreateUserPage'
import ManageUsersPage from '@/pages/ManageUsersPage'
import PendingApprovalsPage from '@/pages/PendingApprovalsPage'

import Dashboard from '@/pages/Dashboard'
import InboundLedger from '@/pages/InboundLedger'
import InboundEntryPage from '@/pages/InboundEntryPage'
import OutboundLedger from '@/pages/OutboundLedger'
import SalesOrderPage from '@/pages/SalesOrderPage'
import InventoryGrid from '@/pages/InventoryGrid'
import POMonitor from '@/pages/POMonitor'
import AlertLog from '@/pages/AlertLog'
import Settings from '@/pages/Settings'
import ProductsPage from '@/pages/ProductsPage'
import ApprovalPage from '@/pages/ApprovalPage'

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function SuperAdminGuard() {
  const { user, isLoading } = useAuthStore()
  if (isLoading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'super_admin') return <Navigate to="/" replace />
  return <Outlet />
}

function AdminGuard() {
  const { user, isLoading } = useAuthStore()
  if (isLoading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/" replace />
  return <Outlet />
}

function RegularUserGuard() {
  const { user, isLoading } = useAuthStore()
  if (isLoading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  return <AppShell />
}

export default function App() {
  const checkAuth = useAuthStore((s) => s.checkAuth)
  const didCheck = useRef(false)

  useEffect(() => {
    if (didCheck.current) return
    didCheck.current = true
    checkAuth()
  }, [checkAuth])

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />

      {/* Super admin area */}
      <Route element={<SuperAdminGuard />}>
        <Route element={<SuperAdminLayout />}>
          <Route path="/super-admin" element={<SuperAdminDashboard />} />
          <Route path="/super-admin/create-user" element={<CreateUserPage />} />
          <Route path="/super-admin/pending" element={<PendingApprovalsPage />} />
          <Route path="/super-admin/manage-users" element={<ManageUsersPage />} />
        </Route>
      </Route>

      {/* Admin area */}
      <Route element={<AdminGuard />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<SuperAdminDashboard />} />
          <Route path="/admin/create-user" element={<CreateUserPage />} />
        </Route>
      </Route>

      {/* Regular user area — AppShell is the layout route */}
      <Route element={<RegularUserGuard />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/stock-entry" element={<InboundEntryPage />} />
        <Route path="/inbound" element={<InboundLedger />} />
        <Route path="/sales-order" element={<SalesOrderPage />} />
        <Route path="/outbound" element={<OutboundLedger />} />
        <Route path="/inventory" element={<InventoryGrid />} />
        <Route path="/po" element={<POMonitor />} />
        <Route path="/alerts" element={<AlertLog />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/approval" element={<ApprovalPage />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

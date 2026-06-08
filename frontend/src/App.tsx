import { Routes, Route, Navigate } from 'react-router-dom'
import AppShell from '@/components/layout/AppShell'
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

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/stock-entry" element={<InboundEntryPage />} />
        <Route path="/inbound" element={<InboundLedger />} />
        <Route path="/sales-order" element={<SalesOrderPage />} />
        <Route path="/outbound" element={<OutboundLedger />} />
        <Route path="/inventory" element={<InventoryGrid />} />
        <Route path="/po" element={<POMonitor />} />
        <Route path="/alerts" element={<AlertLog />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}

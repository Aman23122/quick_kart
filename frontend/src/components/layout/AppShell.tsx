import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { useNotificationStore } from '@/store/useNotificationStore'

export default function AppShell() {
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const fetchNotifications = useNotificationStore((s) => s.fetch)

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 4_000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: 'var(--brand-50)' }}>
      <div
        className="flex-shrink-0 h-full z-20"
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
      >
        <Sidebar expanded={sidebarExpanded} />
      </div>

      <div className="flex flex-col flex-1 min-w-0 h-full">
        <Topbar />
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

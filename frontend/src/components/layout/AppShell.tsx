import { useState, useEffect } from 'react'
import { type ReactNode } from 'react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { useNotificationStore } from '@/store/useNotificationStore'

interface AppShellProps {
  children: ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const fetchNotifications = useNotificationStore((s) => s.fetch)

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 4_000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <div
        className="flex-shrink-0 h-full z-20"
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
      >
        <Sidebar expanded={sidebarExpanded} />
      </div>

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 h-full">
        <Topbar />
        <main className="flex-1 overflow-y-auto px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  )
}

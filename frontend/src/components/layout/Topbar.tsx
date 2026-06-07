import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useNotificationStore } from '@/store/useNotificationStore'
import NotificationPanel from '@/components/notifications/NotificationPanel'

const routeTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/inbound': 'Inbound Ledger',
  '/outbound': 'Outbound Ledger',
  '/inventory': 'Inventory Grid',
  '/po': 'PO Monitor',
  '/alerts': 'Alert Log',
  '/products': 'Products',
  '/settings': 'Settings',
}

export default function Topbar() {
  const location = useLocation()
  const [notifOpen, setNotifOpen] = useState(false)
  const unreadCount = useNotificationStore((s) => s.unreadCount)

  const title = routeTitles[location.pathname] ?? 'QuickKart'

  return (
    <>
      <header className="h-14 flex items-center justify-between px-6 bg-white border-b border-slate-100 z-10 flex-shrink-0">
        <h1 className="text-lg font-semibold text-slate-800">{title}</h1>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setNotifOpen(true)}
            className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-label="Open notifications"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
    </>
  )
}

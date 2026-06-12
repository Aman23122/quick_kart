import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useNotificationStore } from '@/store/useNotificationStore'
import { useAuthStore } from '@/store/useAuthStore'
import NotificationPanel from '@/components/notifications/NotificationPanel'

const routeTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/stock-entry': 'Stock Entry',
  '/inbound': 'Inbound Ledger',
  '/outbound': 'Outbound Ledger',
  '/inventory': 'Inventory Grid',
  '/po': 'PO Monitor',
  '/alerts': 'Alert Log',
  '/products': 'Products',
  '/settings': 'Settings',
  '/create-user': 'Create User',
}

const ROLE_DISPLAY: Record<string, string> = {
  admin: 'Admin',
  inbound_validator: 'Inbound Validator',
  outbound_validator: 'Outbound Validator',
  po_executor: 'PO Executor',
  inspector: 'Inspector',
}

export default function Topbar() {
  const location = useLocation()
  const [notifOpen, setNotifOpen] = useState(false)
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const user = useAuthStore((s) => s.user)

  const title = routeTitles[location.pathname] ?? 'QuickKart'

  return (
    <>
      <header
        className="h-14 flex items-center justify-between px-6 z-10 flex-shrink-0 shadow-md"
        style={{ background: "var(--brand-dot-bg)" }}
      >
        <h1 className="text-lg font-semibold text-white">{title}</h1>

        <div className="flex items-center gap-3">
          {user && (
            <div className="text-right mr-1">
              <p className="text-xs font-medium text-white leading-none">{user.username}</p>
              <p className="text-[10px] mt-0.5 capitalize" style={{ color: 'var(--brand-200)' }}>
                {ROLE_DISPLAY[user.role] ?? user.role}
              </p>
            </div>
          )}

          <button
            onClick={() => setNotifOpen(true)}
            className="relative p-2 rounded-lg text-white transition-colors"
            style={{}}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
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

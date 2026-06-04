import { useEffect, useRef } from 'react'
import { X, Bell, CheckCheck, AlertTriangle, PackageOpen, Thermometer, ShieldAlert } from 'lucide-react'
import { useNotificationStore, type Notification } from '@/store/useNotificationStore'
import { cn } from '@/lib/utils'
import { formatTs } from '@/lib/utils'

interface NotificationPanelProps {
  open: boolean
  onClose: () => void
}

const typeConfig: Record<string, { color: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  low_stock: { color: 'border-amber-400', icon: PackageOpen },
  wastage_risk: { color: 'border-rose-400', icon: AlertTriangle },
  temp_rejection: { color: 'border-red-400', icon: Thermometer },
  dispatch_blocked: { color: 'border-rose-500', icon: ShieldAlert },
  default: { color: 'border-blue-400', icon: Bell },
}

function NotificationItem({ notif, onMark }: { notif: Notification; onMark: (id: string) => void }) {
  const cfg = typeConfig[notif.type] ?? typeConfig.default
  const Icon = cfg.icon

  return (
    <div
      className={cn(
        'flex gap-3 p-4 border-l-4 rounded-r-lg transition-colors',
        cfg.color,
        notif.read ? 'bg-slate-50/50' : 'bg-white hover:bg-slate-50'
      )}
    >
      <div className="flex-shrink-0 mt-0.5">
        <Icon size={16} className="text-slate-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm leading-snug', notif.read ? 'text-slate-400' : 'text-slate-700')}>
          {notif.message}
        </p>
        <p className="text-xs text-slate-400 mt-1">{formatTs(notif.created_at)}</p>
      </div>
      {!notif.read && (
        <button
          onClick={() => onMark(notif.id)}
          className="flex-shrink-0 p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          title="Mark as read"
        >
          <CheckCheck size={14} />
        </button>
      )}
    </div>
  )
}

export default function NotificationPanel({ open, onClose }: NotificationPanelProps) {
  const { notifications, markRead, fetch } = useNotificationStore()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) fetch()
  }, [open, fetch])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick)
    }
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, onClose])

  const markAllRead = () => {
    notifications.filter((n) => !n.read).forEach((n) => markRead(n.id))
  }

  const unread = notifications.filter((n) => !n.read)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" onClick={onClose} />

      {/* Panel */}
      <div
        ref={panelRef}
        className="absolute top-0 right-0 h-full w-[380px] bg-white shadow-2xl flex flex-col animate-fade-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-slate-600" />
            <h2 className="font-semibold text-slate-800">Notifications</h2>
            {unread.length > 0 && (
              <span className="px-2 py-0.5 text-xs font-bold bg-rose-100 text-rose-600 rounded-full">
                {unread.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unread.length > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-400">
              <Bell size={32} className="opacity-30" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {notifications.map((notif) => (
                <NotificationItem key={notif.id} notif={notif} onMark={markRead} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

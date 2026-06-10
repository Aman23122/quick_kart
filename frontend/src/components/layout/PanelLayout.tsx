import { type LucideIcon } from 'lucide-react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Zap, LogOut } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'

type Props = {
  portalLabel: string
  PortalIcon: LucideIcon
}

export default function PanelLayout({ portalLabel, PortalIcon }: Props) {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-brand-page">
      <header
        className="h-14 flex items-center justify-between px-6 shadow-md"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px) 0 0 / 18px 18px, var(--brand-800)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--brand-600)' }}
          >
            <Zap size={14} className="text-white" />
          </div>
          <span className="font-bold text-white text-sm tracking-tight">QuickKart</span>
          <span className="mx-1" style={{ color: 'var(--brand-600)' }}>·</span>
          <div className="flex items-center gap-1.5">
            <PortalIcon size={13} style={{ color: 'var(--brand-300)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--brand-300)' }}>
              {portalLabel}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm" style={{ color: 'var(--brand-300)' }}>
            Logged in as{' '}
            <span className="text-white font-medium">{user?.username}</span>
          </span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-all"
            style={{ color: 'var(--brand-300)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(218,236,223,0.1)'
              e.currentTarget.style.color = '#fff'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--brand-300)'
            }}
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </header>

      <main className="p-6 max-w-5xl mx-auto">
        <Outlet />
      </main>
    </div>
  )
}

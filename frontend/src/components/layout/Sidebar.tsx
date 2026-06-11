import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  PackageCheck,
  PackagePlus,
  PackageOpen,
  ShoppingCart,
  Warehouse,
  ClipboardList,
  ClipboardCheck,
  Bell,
  Settings,
  Zap,
  Box,
  UserPlus,
  LogOut,
  Shield,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/useAuthStore'
import { getPendingApprovals } from '@/services/inboundApi'

const baseNavItems = [
  { to: '/super-admin', label: 'Super Admin Panel', icon: Shield, exact: true, roles: ['super_admin'] as string[] | null },
  { to: '/admin', label: 'Admin Panel', icon: Shield, exact: true, roles: ['admin'] },
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true, roles: null },
  { to: '/stock-entry', label: 'Stock Entry', icon: PackagePlus, exact: false, roles: null },
  { to: '/inbound', label: 'Inbound', icon: PackageCheck, exact: false, roles: null },
  { to: '/approval', label: 'Approval', icon: ClipboardCheck, exact: false, roles: null },
  { to: '/sales-order', label: 'Sales Order', icon: ShoppingCart, exact: false, roles: null },
  { to: '/outbound', label: 'Outbound', icon: PackageOpen, exact: false, roles: null },
  { to: '/inventory', label: 'Inventory', icon: Warehouse, exact: false, roles: null },
  { to: '/products', label: 'Products', icon: Box, exact: false, roles: null },
  { to: '/po', label: 'PO Monitor', icon: ClipboardList, exact: false, roles: null },
  { to: '/alerts', label: 'Alert Log', icon: Bell, exact: false, roles: null },
  { to: '/settings', label: 'Settings', icon: Settings, exact: false, roles: null },
  { to: '/create-user', label: 'Create User', icon: UserPlus, exact: false, roles: ['admin'] },
]

export default function Sidebar({ expanded }: { expanded: boolean }) {
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const { data: pendingData } = useQuery({
    queryKey: ['pending-approvals'],
    queryFn: () => getPendingApprovals().then((r) => r.data),
    refetchInterval: 15000,
    staleTime: 10000,
  })
  const pendingCount = pendingData?.total ?? 0

  const navItems = baseNavItems.filter(
    (item) => item.roles === null || (user?.role && item.roles.includes(user.role))
  )

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <aside
      className={cn(
        'flex flex-col h-full transition-all duration-300 overflow-hidden',
        expanded ? 'w-[220px]' : 'w-[64px]'
      )}
      style={{ background: 'var(--brand-800)' }}
    >
      {/* Brand */}
      <div
        className="flex items-center gap-3 px-4 py-5 border-b"
        style={{ borderColor: 'rgba(218,236,223,0.12)' }}
      >
        <div
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center shadow-lg"
          style={{ background: 'var(--brand-600)' }}
        >
          <Zap size={16} className="text-white" />
        </div>
        {expanded && (
          <span className="font-bold text-white text-base tracking-tight whitespace-nowrap">
            QuickKart
          </span>
        )}
      </div>

      {/* Nav Items */}
      <nav className="flex-1 py-4 px-2">
        {navItems.map(({ to, label, icon: Icon, exact }) => {
          const isAdminPanel = to === '/super-admin'
          const isActive = exact
            ? location.pathname === to
            : location.pathname.startsWith(to)
          return (
            <div key={to}>
              {isAdminPanel && <div className="mb-1" />}
              <NavLink
                to={to}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group mb-1',
                  isActive
                    ? 'text-white shadow-md'
                    : isAdminPanel
                    ? 'border'
                    : ''
                )}
                style={
                  isActive
                    ? { background: 'var(--brand-600)' }
                    : isAdminPanel
                    ? { color: 'var(--brand-300)', borderColor: 'rgba(218,236,223,0.2)' }
                    : { color: 'rgba(218,236,223,0.55)' }
                }
              >
                <div className="relative flex-shrink-0">
                  <Icon size={18} className="transition-colors" />
                  {to === '/approval' && pendingCount > 0 && !expanded && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400" />
                  )}
                </div>
                {expanded && (
                  <span className="text-sm font-medium whitespace-nowrap flex-1">{label}</span>
                )}
                {expanded && to === '/approval' && pendingCount > 0 && (
                  <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-400 text-white leading-none">
                    {pendingCount}
                  </span>
                )}
              </NavLink>
              {isAdminPanel && (
                <div
                  className="border-t mb-1"
                  style={{ borderColor: 'rgba(218,236,223,0.12)' }}
                />
              )}
            </div>
          )
        })}
      </nav>

      {/* Footer — user info + logout */}
      <div
        className="px-2 pb-4 border-t pt-3 space-y-1"
        style={{ borderColor: 'rgba(218,236,223,0.12)' }}
      >
        {expanded ? (
          <>
            <div className="px-3 py-1.5">
              <p className="text-xs truncate" style={{ color: 'var(--brand-200)' }}>
                {user?.username}
              </p>
              <p className="text-[10px] capitalize mt-0.5" style={{ color: 'var(--brand-400)' }}>
                {user?.role?.replace(/_/g, ' ')}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg transition-all duration-150"
              style={{ color: 'rgba(218,236,223,0.55)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(218,236,223,0.08)'
                e.currentTarget.style.color = '#fff'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'rgba(218,236,223,0.55)'
              }}
            >
              <LogOut size={18} className="flex-shrink-0" />
              <span className="text-sm font-medium whitespace-nowrap">Logout</span>
            </button>
          </>
        ) : (
          <button
            onClick={handleLogout}
            className="flex items-center justify-center w-full p-2.5 rounded-lg transition-all duration-150"
            style={{ color: 'rgba(218,236,223,0.55)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(218,236,223,0.08)'
              e.currentTarget.style.color = '#fff'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'rgba(218,236,223,0.55)'
            }}
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        )}
      </div>
    </aside>
  )
}

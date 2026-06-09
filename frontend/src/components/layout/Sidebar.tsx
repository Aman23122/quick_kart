import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  PackageCheck,
  PackagePlus,
  PackageOpen,
  ShoppingCart,
  Warehouse,
  ClipboardList,
  Bell,
  Settings,
  Zap,
  Box,
  UserPlus,
  LogOut,
  Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/useAuthStore'

const baseNavItems = [
  { to: '/super-admin', label: 'Super Admin Panel', icon: Shield, exact: true, roles: ['super_admin'] as string[] | null },
  { to: '/admin', label: 'Admin Panel', icon: Shield, exact: true, roles: ['admin'] },
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true, roles: null },
  { to: '/stock-entry', label: 'Stock Entry', icon: PackagePlus, exact: false, roles: null },
  { to: '/inbound', label: 'Inbound', icon: PackageCheck, exact: false, roles: null },
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
        'flex flex-col h-full bg-slate-900 transition-all duration-300 overflow-hidden',
        expanded ? 'w-[220px]' : 'w-[64px]'
      )}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700/50">
        <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shadow-lg">
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
                    ? 'bg-blue-600 text-white shadow-md'
                    : isAdminPanel
                    ? 'text-blue-400 hover:bg-blue-900/40 hover:text-blue-300 border border-blue-800/50'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                )}
              >
                <Icon
                  size={18}
                  className={cn(
                    'flex-shrink-0 transition-colors',
                    isActive ? 'text-white' : isAdminPanel ? 'text-blue-400 group-hover:text-blue-300' : 'text-slate-400 group-hover:text-slate-100'
                  )}
                />
                {expanded && (
                  <span className="text-sm font-medium whitespace-nowrap">{label}</span>
                )}
              </NavLink>
              {isAdminPanel && (
                <div className="border-t border-slate-700/50 mb-1" />
              )}
            </div>
          )
        })}
      </nav>

      {/* Footer — user info + logout */}
      <div className="px-2 pb-4 border-t border-slate-700/50 pt-3 space-y-1">
        {expanded ? (
          <>
            <div className="px-3 py-1.5">
              <p className="text-xs text-slate-400 truncate">{user?.username}</p>
              <p className="text-[10px] text-slate-600 capitalize mt-0.5">
                {user?.role?.replace(/_/g, ' ')}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-all duration-150 group"
            >
              <LogOut size={18} className="flex-shrink-0 text-slate-400 group-hover:text-slate-100 transition-colors" />
              <span className="text-sm font-medium whitespace-nowrap">Logout</span>
            </button>
          </>
        ) : (
          <button
            onClick={handleLogout}
            className="flex items-center justify-center w-full p-2.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-all duration-150"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        )}
      </div>
    </aside>
  )
}

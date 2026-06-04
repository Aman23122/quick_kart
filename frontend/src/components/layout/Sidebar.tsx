import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  PackageCheck,
  PackagePlus,
  PackageOpen,
  Warehouse,
  ClipboardList,
  Bell,
  Settings,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/stock-entry', label: 'Stock Entry', icon: PackagePlus },
  { to: '/inbound', label: 'Inbound', icon: PackageCheck },
  { to: '/outbound', label: 'Outbound', icon: PackageOpen },
  { to: '/inventory', label: 'Inventory', icon: Warehouse },
  { to: '/po', label: 'PO Monitor', icon: ClipboardList },
  { to: '/alerts', label: 'Alert Log', icon: Bell },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar({ expanded }: { expanded: boolean }) {
  const location = useLocation()

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
      <nav className="flex-1 py-4 space-y-1 px-2">
        {navItems.map(({ to, label, icon: Icon, exact }) => {
          const isActive = exact
            ? location.pathname === to
            : location.pathname.startsWith(to)
          return (
            <NavLink
              key={to}
              to={to}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group',
                isActive
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              )}
            >
              <Icon
                size={18}
                className={cn(
                  'flex-shrink-0 transition-colors',
                  isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-100'
                )}
              />
              {expanded && (
                <span className="text-sm font-medium whitespace-nowrap">{label}</span>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-slate-700/50">
        {expanded ? (
          <span className="text-xs text-slate-500 font-mono">v1.0 POC</span>
        ) : (
          <span className="text-xs text-slate-600 font-mono block text-center">v1</span>
        )}
      </div>
    </aside>
  )
}

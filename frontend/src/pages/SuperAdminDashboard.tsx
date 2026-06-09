import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, Clock, Users, Warehouse } from 'lucide-react'
import api from '@/lib/axios'
import { useAuthStore } from '@/store/useAuthStore'
import { cn } from '@/lib/utils'

interface CardDef {
  title: string
  subtitle: string
  icon: React.ElementType
  colorClass: string
  iconBg: string
  to: string
  badge: number | null
  roles: string[]
}

export default function SuperAdminDashboard() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [pendingCount, setPendingCount] = useState(0)

  const isSuperAdmin = user?.role === 'super_admin'

  useEffect(() => {
    if (isSuperAdmin) {
      api
        .get('/api/users/pending')
        .then(({ data }) => setPendingCount(data.length))
        .catch(() => {})
    }
  }, [isSuperAdmin])

  const allCards: CardDef[] = [
    {
      title: 'Create New User',
      subtitle: isSuperAdmin
        ? 'Add a new team member with a designated role'
        : 'Submit a user request for super admin approval',
      icon: UserPlus,
      colorClass: 'bg-blue-600 hover:bg-blue-700',
      iconBg: 'bg-blue-500',
      to: isSuperAdmin ? '/super-admin/create-user' : '/admin/create-user',
      badge: null,
      roles: ['super_admin', 'admin'],
    },
    {
      title: 'Pending Approvals',
      subtitle: 'Review user requests submitted by admins',
      icon: Clock,
      colorClass: 'bg-amber-500 hover:bg-amber-600',
      iconBg: 'bg-amber-400',
      to: '/super-admin/pending',
      badge: pendingCount > 0 ? pendingCount : null,
      roles: ['super_admin'],
    },
    {
      title: 'Manage Users',
      subtitle: 'Edit roles, deactivate or delete users',
      icon: Users,
      colorClass: 'bg-slate-700 hover:bg-slate-800',
      iconBg: 'bg-slate-600',
      to: '/super-admin/manage-users',
      badge: null,
      roles: ['super_admin'],
    },
    {
      title: 'See Inventory',
      subtitle: 'View and monitor the full inventory grid',
      icon: Warehouse,
      colorClass: 'bg-emerald-600 hover:bg-emerald-700',
      iconBg: 'bg-emerald-500',
      to: '/inventory',
      badge: null,
      roles: ['super_admin', 'admin'],
    },
  ]

  const cards = allCards.filter((c) => user?.role && c.roles.includes(user.role))

  return (
    <div className="pt-6">
      <h1 className="text-2xl font-bold text-slate-800 mb-1">
        Welcome back, {user?.username}
      </h1>
      <p className="text-slate-500 mb-8">Manage your QuickKart system from here.</p>

      <div className="grid grid-cols-2 gap-5">
        {cards.map(({ title, subtitle, icon: Icon, colorClass, iconBg, to, badge }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className={cn(
              'relative p-7 rounded-2xl text-white text-left transition-all shadow-md hover:shadow-xl cursor-pointer',
              colorClass
            )}
          >
            {badge !== null && (
              <span className="absolute top-5 right-5 min-w-[28px] h-7 bg-white/20 border border-white/30 text-white text-sm font-bold rounded-full flex items-center justify-center px-2">
                {badge}
              </span>
            )}
            <div
              className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center mb-5 shadow',
                iconBg
              )}
            >
              <Icon size={22} className="text-white" />
            </div>
            <h3 className="font-semibold text-base mb-1.5">{title}</h3>
            <p className="text-sm opacity-70 leading-snug">{subtitle}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

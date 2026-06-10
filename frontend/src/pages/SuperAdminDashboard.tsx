import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, Clock, Users, Warehouse } from 'lucide-react'
import api from '@/lib/axios'
import { useAuthStore } from '@/store/useAuthStore'

interface CardDef {
  title: string
  subtitle: string
  icon: React.ElementType
  accent: string
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
      accent: 'radial-gradient(circle, rgba(255,255,255,0.13) 1px, transparent 1px) 0 0 / 18px 18px, linear-gradient(135deg, var(--brand-500), var(--brand-600))',
      to: isSuperAdmin ? '/super-admin/create-user' : '/admin/create-user',
      badge: null,
      roles: ['super_admin', 'admin'],
    },
    {
      title: 'Pending Approvals',
      subtitle: 'Review user requests submitted by admins',
      icon: Clock,
      accent: 'radial-gradient(circle, rgba(255,255,255,0.13) 1px, transparent 1px) 0 0 / 18px 18px, linear-gradient(135deg, var(--brand-500), var(--brand-600))',
      to: '/super-admin/pending',
      badge: pendingCount > 0 ? pendingCount : null,
      roles: ['super_admin'],
    },
    {
      title: 'Manage Users',
      subtitle: 'Edit roles, deactivate or delete users',
      icon: Users,
      accent: 'radial-gradient(circle, rgba(255,255,255,0.13) 1px, transparent 1px) 0 0 / 18px 18px, linear-gradient(135deg, var(--brand-500), var(--brand-600))',
      to: '/super-admin/manage-users',
      badge: null,
      roles: ['super_admin'],
    },
    {
      title: 'See Inventory',
      subtitle: 'View and monitor the full inventory grid',
      icon: Warehouse,
      accent: 'radial-gradient(circle, rgba(255,255,255,0.13) 1px, transparent 1px) 0 0 / 18px 18px, linear-gradient(135deg, var(--brand-500), var(--brand-600))',
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
        {cards.map(({ title, subtitle, icon: Icon, accent, to, badge }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className="relative p-10 rounded-2xl text-white text-left transition-all shadow-md hover:shadow-xl cursor-pointer hover:-translate-y-0.5 duration-200"
            style={{ background: accent }}
          >
            {badge !== null && (
              <span className="absolute top-6 right-6 min-w-[28px] h-7 bg-white/20 border border-white/30 text-white text-sm font-bold rounded-full flex items-center justify-center px-2">
                {badge}
              </span>
            )}
            <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-6 shadow" style={{ background: 'rgba(255,255,255,0.2)' }}>
              <Icon size={26} className="text-white" />
            </div>
            <h3 className="font-semibold text-lg mb-2">{title}</h3>
            <p className="text-sm opacity-75 leading-snug">{subtitle}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

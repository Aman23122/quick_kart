import { Outlet, useNavigate } from 'react-router-dom'
import { Zap, LogOut, UserCog } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'

export default function AdminLayout() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="h-14 bg-slate-900 flex items-center justify-between px-6 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center">
            <Zap size={14} className="text-white" />
          </div>
          <span className="font-bold text-white text-sm tracking-tight">QuickKart</span>
          <span className="text-slate-600 mx-1">·</span>
          <div className="flex items-center gap-1.5">
            <UserCog size={13} className="text-emerald-400" />
            <span className="text-emerald-400 text-sm font-medium">Admin Portal</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-slate-400 text-sm">
            Logged in as <span className="text-white font-medium">{user?.username}</span>
          </span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
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

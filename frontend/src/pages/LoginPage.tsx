import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { login, user, isLoading } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoading && user) {
      if (user.role === 'super_admin') navigate('/super-admin', { replace: true })
      else if (user.role === 'admin') navigate('/admin', { replace: true })
      else navigate('/', { replace: true })
    }
  }, [user, isLoading, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      const { user: u } = useAuthStore.getState()
      if (u?.role === 'super_admin') navigate('/super-admin', { replace: true })
      else if (u?.role === 'admin') navigate('/admin', { replace: true })
      else navigate('/', { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-brand-page min-h-screen flex items-center justify-center p-4 relative overflow-hidden">

      {/* Decorative blobs */}
      <div
        className="absolute top-[-120px] right-[-120px] w-96 h-96 rounded-full pointer-events-none"
        style={{ background: 'var(--brand-300)', opacity: 0.35, filter: 'blur(60px)' }}
      />
      <div
        className="absolute bottom-[-100px] left-[-80px] w-80 h-80 rounded-full pointer-events-none"
        style={{ background: 'var(--brand-400)', opacity: 0.25, filter: 'blur(50px)' }}
      />
      <div
        className="absolute top-1/2 left-1/4 w-48 h-48 rounded-full pointer-events-none"
        style={{ background: 'var(--brand-200)', opacity: 0.3, filter: 'blur(40px)' }}
      />

      {/* Card */}
      <div
        className="relative w-full max-w-[420px] rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(24px)', border: '1px solid rgba(218,236,223,0.7)' }}
      >
        {/* Top accent bar */}
        <div
          className="h-1.5 w-full"
          style={{ background: 'linear-gradient(90deg, var(--brand-400), var(--brand-600), var(--brand-700))' }}
        />

        <div className="px-8 pt-8 pb-10">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
              style={{ background: 'linear-gradient(135deg, var(--brand-600), var(--brand-800))' }}
            >
              <Zap size={26} className="text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--brand-800)' }}>
              QuickKart
            </h1>
            <span
              className="badge-brand mt-2"
              style={{ fontSize: '0.7rem' }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: 'var(--brand-600)' }}
              />
              Smart Inventory
            </span>
          </div>

          {/* Heading */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-800 mb-1">Welcome back</h2>
            <p className="text-sm text-slate-500">Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="email"
                placeholder="you@example.com"
                className="input-brand"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="input-brand"
                  style={{ paddingRight: '2.75rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: '#94a3b8' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--brand-600)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 rounded-xl px-3.5 py-3 text-sm bg-rose-50 border border-rose-200 text-rose-700">
                <span className="flex-shrink-0 mt-0.5">⚠</span>
                {error}
              </div>
            )}

            {/* Submit */}
            <div className="pt-1">
              <button type="submit" disabled={loading} className="btn-brand">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Signing in…
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>
            </div>
          </form>

          {/* Footer */}
          <p className="text-center text-xs text-slate-400 mt-6">
            © 2025 QuickKart · Secure &amp; Role-based Access
          </p>
        </div>
      </div>
    </div>
  )
}

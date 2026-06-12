import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, Info, CheckCircle, UserPlus } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import api from '@/lib/axios'
import SelectBrand from '@/components/shared/SelectBrand'

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'inbound_validator', label: 'Inbound Validator' },
  { value: 'outbound_validator', label: 'Outbound Validator' },
  { value: 'po_executor', label: 'PO Executor' },
  { value: 'inspector', label: 'Inspector' },
]

export default function CreateUserPage() {
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'admin'
  const navigate = useNavigate()

  const [form, setForm] = useState({
    username: '',
    email: '',
    phone: '',
    password: '',
    role: 'inbound_validator',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const goBack = () => navigate(isAdmin ? '/admin' : '/super-admin')

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/api/users/', form)
      setSuccess(true)
      setForm({ username: '', email: '', phone: '', password: '', role: 'inbound_validator' })
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create user. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center" style={{ minHeight: 'calc(100vh - 7rem)' }}>

      {/* Card */}
      <div className="w-full max-w-lg card-brand">

        {/* Header strip */}
        <div
          className="px-6 py-4 flex items-center gap-3 rounded-t-[1rem] overflow-hidden"
          style={{
            background: 'var(--brand-card-bg)',
          }}
        >
          <button
            onClick={goBack}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.15)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
            title="Back"
          >
            <ArrowLeft size={15} className="text-white" />
          </button>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.2)' }}
          >
            <UserPlus size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">Create New User</h1>
            <p className="text-xs text-white/70 mt-0.5">
              {isAdmin
                ? 'Request will be sent for super admin approval'
                : 'Add a team member with a designated role'}
            </p>
          </div>
        </div>

        <div className="px-6 py-5">

          {/* Banners */}
          {isAdmin && !success && (
            <div
              className="flex items-start gap-2 rounded-lg p-3 text-xs mb-4"
              style={{ background: 'var(--brand-50)', border: '1px solid var(--brand-200)', color: 'var(--brand-700)' }}
            >
              <Info size={13} className="mt-0.5 flex-shrink-0" />
              This request will be sent to the super admin for approval before the user can log in.
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2 rounded-lg p-3 text-xs mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700">
              <CheckCircle size={13} className="mt-0.5 flex-shrink-0" />
              {isAdmin
                ? 'Request submitted. Awaiting super admin approval.'
                : 'User created successfully. They can now log in.'}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Username</label>
                <input type="text" value={form.username} onChange={set('username')} required placeholder="e.g. john_doe" className="input-brand" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                <input type="email" value={form.email} onChange={set('email')} required placeholder="e.g. john@example.com" className="input-brand" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                <input type="tel" value={form.phone} onChange={set('phone')} required placeholder="e.g. 9876543210" className="input-brand" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={set('password')}
                    required
                    minLength={6}
                    placeholder="Min 6 characters"
                    className="input-brand"
                    style={{ paddingRight: '2.5rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: '#94a3b8' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--brand-600)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
                <SelectBrand
                  value={form.role}
                  onChange={(val) => setForm((prev) => ({ ...prev, role: val }))}
                  options={ROLES}
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs mb-3 bg-rose-50 border border-rose-200 text-rose-700">
                <span className="flex-shrink-0">⚠</span>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-brand">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  {isAdmin ? 'Submitting...' : 'Creating...'}
                </span>
              ) : isAdmin ? 'Submit for Approval' : 'Create User'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

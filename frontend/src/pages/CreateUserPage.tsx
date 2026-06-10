import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, Info, CheckCircle } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import api from '@/lib/axios'

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'inbound_validator', label: 'Inbound Validator' },
  { value: 'outbound_validator', label: 'Outbound Validator' },
  { value: 'po_executor', label: 'PO Executor' },
  { value: 'inspector', label: 'Inspector' },
]

const INPUT_CLASS =
  'w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm'

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
    <div className="max-w-lg">
      <button
        onClick={goBack}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-6 text-sm transition-colors"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <h1 className="text-xl font-bold text-slate-800 mb-1">Create New User</h1>
      <p className="text-sm text-slate-500 mb-6">
        Add a new team member with a designated role
      </p>

      {isAdmin && (
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 text-sm text-amber-700">
          <Info size={15} className="mt-0.5 flex-shrink-0" />
          <span>
            This user request will be sent to the super admin for approval before they can login.
          </span>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-5 text-sm text-emerald-700">
          <CheckCircle size={15} className="mt-0.5 flex-shrink-0" />
          <span>
            {isAdmin
              ? 'User request submitted successfully. Awaiting super admin approval.'
              : 'User created successfully. They can now log in.'}
          </span>
        </div>
      )}

      <div className="card-brand p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Username</label>
            <input
              type="text"
              value={form.username}
              onChange={set('username')}
              required
              className={INPUT_CLASS}
              placeholder="e.g. john_doe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={set('email')}
              required
              className={INPUT_CLASS}
              placeholder="e.g. john@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone Number</label>
            <input
              type="tel"
              value={form.phone}
              onChange={set('phone')}
              required
              className={INPUT_CLASS}
              placeholder="e.g. 9876543210"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={set('password')}
                required
                minLength={6}
                className={INPUT_CLASS + ' pr-10'}
                placeholder="Minimum 6 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Role</label>
            <select
              value={form.role}
              onChange={set('role')}
              required
              className={INPUT_CLASS + ' cursor-pointer'}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg px-3.5 py-2.5 text-sm text-rose-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
          >
            {loading
              ? 'Creating...'
              : isAdmin
              ? 'Submit for Approval'
              : 'Create User'}
          </button>
        </form>
      </div>
    </div>
  )
}

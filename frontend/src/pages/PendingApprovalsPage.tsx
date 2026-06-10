import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle, XCircle, Clock } from 'lucide-react'
import api from '@/lib/axios'

interface PendingUser {
  id: number
  username: string
  email: string
  phone: string
  role: string
  created_by: string | null
  created_at: string
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  inbound_validator: 'Inbound Validator',
  outbound_validator: 'Outbound Validator',
  po_executor: 'PO Executor',
  inspector: 'Inspector',
}

export default function PendingApprovalsPage() {
  const navigate = useNavigate()
  const [users, setUsers] = useState<PendingUser[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<number | null>(null)

  const fetchPending = () => {
    setLoading(true)
    api.get('/api/users/pending')
      .then(({ data }) => setUsers(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchPending() }, [])

  const handleApprove = async (id: number) => {
    setActionId(id)
    try {
      await api.patch(`/api/users/${id}/approve`)
      setUsers((prev) => prev.filter((u) => u.id !== id))
    } catch {}
    setActionId(null)
  }

  const handleReject = async (id: number) => {
    setActionId(id)
    try {
      await api.patch(`/api/users/${id}/reject`)
      setUsers((prev) => prev.filter((u) => u.id !== id))
    } catch {}
    setActionId(null)
  }

  return (
    <div>
      {/* Back */}
      <button
        onClick={() => navigate('/super-admin')}
        className="flex items-center gap-2 text-sm mb-5 transition-colors"
        style={{ color: 'var(--brand-700)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--brand-800)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--brand-700)')}
      >
        <ArrowLeft size={15} /> Back to Dashboard
      </button>

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <h1 className="text-xl font-bold text-slate-800">Pending Approvals</h1>
        {users.length > 0 && (
          <span className="badge-brand">{users.length}</span>
        )}
      </div>

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--brand-500)' }}>Loading...</div>
      ) : users.length === 0 ? (
        <div className="card-brand p-12 text-center">
          <CheckCircle size={40} className="mx-auto mb-3" style={{ color: 'var(--brand-400)' }} />
          <p className="font-medium text-slate-700">No pending approvals</p>
          <p className="text-slate-400 text-sm mt-1">All user requests have been reviewed.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <div key={u.id} className="card-brand p-5 flex items-center justify-between">

              {/* User info */}
              <div className="flex items-center gap-4">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--brand-100)' }}
                >
                  <Clock size={18} style={{ color: 'var(--brand-600)' }} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">{u.username}</span>
                    <span
                      className="px-2 py-0.5 text-xs rounded-md font-medium"
                      style={{ background: 'var(--brand-50)', color: 'var(--brand-700)', border: '1px solid var(--brand-200)' }}
                    >
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {u.email} · {u.phone}
                    {u.created_by && (
                      <span className="ml-2 text-slate-400">· Requested by {u.created_by}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                <button
                  onClick={() => handleApprove(u.id)}
                  disabled={actionId === u.id}
                  className="flex items-center gap-1.5 px-4 py-2 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-all"
                  style={{ background: 'linear-gradient(135deg, var(--brand-500), var(--brand-600))' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'linear-gradient(135deg, var(--brand-600), var(--brand-700))')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'linear-gradient(135deg, var(--brand-500), var(--brand-600))')}
                >
                  <CheckCircle size={15} />
                  Approve
                </button>
                <button
                  onClick={() => handleReject(u.id)}
                  disabled={actionId === u.id}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50 transition-all"
                  style={{ background: 'var(--brand-50)', color: 'var(--brand-700)', border: '1.5px solid var(--brand-300)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--brand-100)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--brand-50)')}
                >
                  <XCircle size={15} />
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

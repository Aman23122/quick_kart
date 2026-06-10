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
    api
      .get('/api/users/pending')
      .then(({ data }) => setUsers(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchPending()
  }, [])

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
      <button
        onClick={() => navigate('/super-admin')}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-6 text-sm transition-colors"
      >
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-bold text-slate-800">Pending Approvals</h1>
        {users.length > 0 && (
          <span className="px-2.5 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
            {users.length}
          </span>
        )}
      </div>

      {loading ? (
        <div className="text-slate-400 text-sm">Loading...</div>
      ) : users.length === 0 ? (
        <div className="card-brand p-12 text-center">
          <CheckCircle size={40} className="text-emerald-400 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">No pending approvals</p>
          <p className="text-slate-400 text-sm mt-1">All user requests have been reviewed.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <div
              key={u.id}
              className="card-brand p-5 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <Clock size={18} className="text-amber-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">{u.username}</span>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-md">
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </div>
                  <div className="text-sm text-slate-500 mt-0.5">
                    {u.email} · {u.phone}
                    {u.created_by && (
                      <span className="ml-2 text-slate-400">· Requested by {u.created_by}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={() => handleApprove(u.id)}
                  disabled={actionId === u.id}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  <CheckCircle size={15} />
                  Approve
                </button>
                <button
                  onClick={() => handleReject(u.id)}
                  disabled={actionId === u.id}
                  className="flex items-center gap-1.5 px-4 py-2 bg-rose-50 text-rose-600 border border-rose-200 text-sm font-medium rounded-lg hover:bg-rose-100 disabled:opacity-50 transition-colors"
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

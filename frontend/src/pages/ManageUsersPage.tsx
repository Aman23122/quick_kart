import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Trash2, Check, X } from 'lucide-react'
import api from '@/lib/axios'

interface UserRow {
  id: number
  username: string
  email: string
  phone: string
  role: string
  is_active: boolean
  approval_status: string
  created_by: string | null
  created_at: string
}

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'inbound_validator', label: 'Inbound Validator' },
  { value: 'outbound_validator', label: 'Outbound Validator' },
  { value: 'po_executor', label: 'PO Executor' },
  { value: 'inspector', label: 'Inspector' },
]

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  inbound_validator: 'Inbound Validator',
  outbound_validator: 'Outbound Validator',
  po_executor: 'PO Executor',
  inspector: 'Inspector',
}

const STATUS_STYLES: Record<string, string> = {
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
}

export default function ManageUsersPage() {
  const navigate = useNavigate()
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editRole, setEditRole] = useState('')
  const [savingId, setSavingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    api
      .get('/api/users/')
      .then(({ data }) => setUsers(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const startEdit = (u: UserRow) => {
    setEditingId(u.id)
    setEditRole(u.role)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditRole('')
  }

  const saveRole = async (id: number) => {
    setSavingId(id)
    try {
      const { data } = await api.patch(`/api/users/${id}`, { role: editRole })
      setUsers((prev) => prev.map((u) => (u.id === id ? data : u)))
      setEditingId(null)
    } catch {}
    setSavingId(null)
  }

  const deleteUser = async (id: number) => {
    if (!confirm('Are you sure you want to delete this user? This cannot be undone.')) return
    setDeletingId(id)
    try {
      await api.delete(`/api/users/${id}`)
      setUsers((prev) => prev.filter((u) => u.id !== id))
    } catch {}
    setDeletingId(null)
  }

  return (
    <div>
      <button
        onClick={() => navigate('/super-admin')}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-6 text-sm transition-colors"
      >
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Manage Users</h1>
          <p className="text-sm text-slate-500 mt-0.5">Edit roles or remove users from the system</p>
        </div>
        <span className="text-sm text-slate-400">{users.length} user{users.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="text-slate-400 text-sm">Loading...</div>
      ) : users.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400 text-sm">
          No users found. Create one from the dashboard.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-5 py-3.5 font-semibold text-slate-600">User</th>
                <th className="text-left px-5 py-3.5 font-semibold text-slate-600">Role</th>
                <th className="text-left px-5 py-3.5 font-semibold text-slate-600">Status</th>
                <th className="text-left px-5 py-3.5 font-semibold text-slate-600">Created By</th>
                <th className="text-right px-5 py-3.5 font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="font-medium text-slate-800">{u.username}</div>
                    <div className="text-slate-400 text-xs mt-0.5">{u.email}</div>
                  </td>

                  <td className="px-5 py-4">
                    {editingId === u.id ? (
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                        className="px-2.5 py-1.5 rounded-lg border border-blue-300 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <button
                        onClick={() => startEdit(u)}
                        className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-medium hover:bg-slate-200 transition-colors"
                      >
                        {ROLE_LABELS[u.role] ?? u.role}
                      </button>
                    )}
                  </td>

                  <td className="px-5 py-4">
                    <span
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
                        STATUS_STYLES[u.approval_status] ?? 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {u.is_active ? u.approval_status : 'deactivated'}
                    </span>
                  </td>

                  <td className="px-5 py-4 text-slate-500 text-xs">
                    {u.created_by ?? '—'}
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1.5">
                      {editingId === u.id ? (
                        <>
                          <button
                            onClick={() => saveRole(u.id)}
                            disabled={savingId === u.id}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Save"
                          >
                            <Check size={15} />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Cancel"
                          >
                            <X size={15} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => deleteUser(u.id)}
                          disabled={deletingId === u.id}
                          className="p-1.5 text-rose-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete user"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

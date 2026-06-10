import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Trash2, Check, X } from 'lucide-react'
import api from '@/lib/axios'
import SelectBrand from '@/components/shared/SelectBrand'

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

const STATUS_STYLES: Record<string, React.CSSProperties> = {
  approved: { background: 'var(--brand-50)', color: 'var(--brand-700)', borderColor: 'var(--brand-300)' },
  pending:  { background: '#fffbeb', color: '#92400e', borderColor: '#fcd34d' },
  rejected: { background: 'var(--brand-50)', color: 'var(--brand-600)', borderColor: 'var(--brand-200)' },
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
    api.get('/api/users/')
      .then(({ data }) => setUsers(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const startEdit = (u: UserRow) => { setEditingId(u.id); setEditRole(u.role) }
  const cancelEdit = () => { setEditingId(null); setEditRole('') }

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
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Manage Users</h1>
          <p className="text-sm text-slate-500 mt-0.5">Edit roles or remove users from the system</p>
        </div>
        <span className="badge-brand">{users.length} user{users.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--brand-500)' }}>Loading...</div>
      ) : users.length === 0 ? (
        <div className="card-brand p-12 text-center text-slate-400 text-sm">
          No users found. Create one from the dashboard.
        </div>
      ) : (
        <div className="card-brand overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--brand-200)', background: 'var(--brand-50)' }}>
                {['User', 'Role', 'Status', 'Created By', 'Actions'].map((h, i) => (
                  <th
                    key={h}
                    className={`px-5 py-3.5 font-semibold text-xs ${i === 4 ? 'text-right' : 'text-left'}`}
                    style={{ color: 'var(--brand-700)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="border-b transition-colors"
                  style={{ borderColor: 'var(--brand-100)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--brand-50)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* User */}
                  <td className="px-5 py-4">
                    <div className="font-medium text-slate-800">{u.username}</div>
                    <div className="text-slate-400 text-xs mt-0.5">{u.email}</div>
                  </td>

                  {/* Role */}
                  <td className="px-5 py-4">
                    {editingId === u.id ? (
                      <div className="w-44">
                        <SelectBrand
                          value={editRole}
                          onChange={setEditRole}
                          options={ROLES}
                        />
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(u)}
                        className="px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
                        style={{ background: 'var(--brand-50)', color: 'var(--brand-700)', border: '1px solid var(--brand-200)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--brand-100)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--brand-50)')}
                      >
                        {ROLE_LABELS[u.role] ?? u.role}
                      </button>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-5 py-4">
                    <span
                      className="px-2.5 py-1 rounded-md text-xs font-medium border"
                      style={
                        !u.is_active
                          ? { background: 'var(--brand-200)', color: 'var(--brand-800)', borderColor: 'var(--brand-400)' }
                          : STATUS_STYLES[u.approval_status] ?? { background: 'var(--brand-50)', color: 'var(--brand-600)', borderColor: 'var(--brand-200)' }
                      }
                    >
                      {u.is_active ? u.approval_status : 'deactivated'}
                    </span>
                  </td>

                  {/* Created By */}
                  <td className="px-5 py-4 text-slate-500 text-xs">{u.created_by ?? '—'}</td>

                  {/* Actions */}
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1.5">
                      {editingId === u.id ? (
                        <>
                          <button
                            onClick={() => saveRole(u.id)}
                            disabled={savingId === u.id}
                            className="p-1.5 rounded-lg transition-colors disabled:opacity-50"
                            style={{ color: 'var(--brand-600)' }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--brand-100)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            title="Save"
                          >
                            <Check size={15} />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: 'var(--brand-400)' }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--brand-50)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            title="Cancel"
                          >
                            <X size={15} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => deleteUser(u.id)}
                          disabled={deletingId === u.id}
                          className="p-1.5 rounded-lg transition-colors disabled:opacity-50"
                          style={{ color: 'var(--brand-400)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--brand-100)'
                            e.currentTarget.style.color = 'var(--brand-700)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent'
                            e.currentTarget.style.color = 'var(--brand-400)'
                          }}
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

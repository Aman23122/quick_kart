import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, ShieldCheck } from 'lucide-react'
import { listAlerts, resolveAlert, type AlertRow } from '@/services/alertApi'
import DataTable, { type ColumnDef } from '@/components/shared/DataTable'
import StatusBadge from '@/components/shared/StatusBadge'
import ExportButton from '@/components/shared/ExportButton'
import { useNotificationStore } from '@/store/useNotificationStore'

const PAGE_SIZE = 20

const ALERT_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'low_stock', label: 'Low Stock' },
  { value: 'wastage_risk', label: 'Wastage Risk' },
  { value: 'temp_rejection', label: 'Temp Rejection' },
  { value: 'dispatch_blocked', label: 'Dispatch Blocked' },
  { value: 'stock_shortage', label: 'Stock Shortage' },
]

export default function AlertLog() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [alertType, setAlertType] = useState('')
  const [showResolved, setShowResolved] = useState(false)
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  const notifications = useNotificationStore((s) => s.notifications)

  const { data, isLoading } = useQuery({
    queryKey: ['alerts', page, alertType, showResolved],
    queryFn: () =>
      listAlerts({
        alert_type: alertType || undefined,
        is_resolved: showResolved ? undefined : false,
        skip: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      }).then((r) => r.data),
  })

  useEffect(() => {
    const relevant = notifications.some(
      (n) => !n.read && (n.type === 'low_stock' || n.type === 'stock_restocked')
    )
    if (relevant) {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
    }
  }, [notifications, queryClient])

  const resolveMutation = useMutation({
    mutationFn: (alertId: string) => resolveAlert(alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      setResolvingId(null)
    },
    onError: () => {
      setResolvingId(null)
    },
  })

  const handleResolve = (alertId: string) => {
    setResolvingId(alertId)
    resolveMutation.mutate(alertId)
  }

  const columns: ColumnDef<AlertRow>[] = [
    {
      key: 'alert_type',
      header: 'Type',
      render: (r) => <StatusBadge status={String(r.alert_type)} />,
    },
    {
      key: 'variant_name',
      header: 'Product',
      render: (r) => (
        <div className="min-w-0">
          <p className="font-medium text-slate-800 text-sm leading-tight">{String(r.product_name || r.variant_name)}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {r.brand_name ? <span className="text-blue-500">{String(r.brand_name)}</span> : null}
            {r.brand_name && r.variant_name ? ' · ' : ''}
            {String(r.variant_name)}
          </p>
        </div>
      ),
    },
    {
      key: 'message',
      header: 'Message',
      render: (r) => (
        <span className="text-slate-600 text-xs max-w-[280px] block truncate" title={String(r.message)}>
          {String(r.message)}
        </span>
      ),
    },
    {
      key: 'current_qty',
      header: 'Qty',
      render: (r) => String(r.current_qty ?? '—'),
    },
    {
      key: 'threshold_qty',
      header: 'Threshold',
      render: (r) => String(r.threshold_qty ?? '—'),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (r) => <span className="text-xs text-slate-400">{String(r.created_at)}</span>,
    },
    {
      key: 'is_resolved',
      header: 'Status',
      render: (r) =>
        r.is_resolved ? (
          <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
            <CheckCircle size={13} /> Resolved
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-rose-500 font-medium">
            <XCircle size={13} /> Open
          </span>
        ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (r) =>
        !r.is_resolved ? (
          <button
            onClick={() => handleResolve(String(r.alert_id))}
            disabled={resolvingId === String(r.alert_id)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 rounded-lg transition-colors"
          >
            <ShieldCheck size={12} />
            {resolvingId === String(r.alert_id) ? 'Resolving…' : 'Resolve'}
          </button>
        ) : null,
    },
  ]

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={alertType}
          onChange={(e) => { setAlertType(e.target.value); setPage(1) }}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white"
        >
          {ALERT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <div className="relative">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => { setShowResolved(e.target.checked); setPage(1) }}
              className="sr-only"
            />
            <div
              className={`w-9 h-5 rounded-full transition-colors ${showResolved ? 'bg-blue-500' : 'bg-slate-200'}`}
              onClick={() => { setShowResolved(!showResolved); setPage(1) }}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${showResolved ? 'translate-x-4' : 'translate-x-0.5'}`}
              />
            </div>
          </div>
          <span className="text-sm text-slate-600">Show resolved</span>
        </label>

        <div className="ml-auto">
          <ExportButton
            data={(data?.data as Record<string, unknown>[]) ?? []}
            filename="alert_log"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={(data?.data as AlertRow[]) ?? []}
        loading={isLoading}
        totalCount={data?.total ?? 0}
        page={page}
        onPageChange={setPage}
        pageSize={PAGE_SIZE}
        emptyMessage="No alerts found with the current filters."
      />
    </div>
  )
}

import { useQuery } from '@tanstack/react-query'
import {
  Package,
  Trash2,
  Clock,
  TrendingDown,
  TrendingUp,
  DollarSign,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import api from '@/lib/axios'
import { listAlerts } from '@/services/alertApi'
import { formatCurrency } from '@/lib/utils'
import StatusBadge from '@/components/shared/StatusBadge'
import { cn } from '@/lib/utils'

interface DashboardSummary {
  total_skus: number
  low_stock_count: number
  wastage_alerts: number
  near_expiry_count: number
  today_inbound: number
  today_outbound: number
  total_inventory_value: number
}

interface KPICardProps {
  label: string
  value: string | number
  icon: React.ComponentType<{ size?: number; className?: string }>
  colorClass: string
  bgClass: string
  sublabel?: string
}

function KPICard({ label, value, icon: Icon, colorClass, bgClass, sublabel }: KPICardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex items-start gap-4 hover:shadow-md transition-shadow">
      <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0', bgClass)}>
        <Icon size={22} className={colorClass} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-slate-800 mt-1 leading-none">{value}</p>
        {sublabel && <p className="text-xs text-slate-400 mt-1">{sublabel}</p>}
      </div>
    </div>
  )
}

function SkeletonKPI() {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex items-start gap-4">
      <div className="w-11 h-11 rounded-xl bg-slate-100 animate-pulse flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-slate-100 rounded animate-pulse w-24" />
        <div className="h-7 bg-slate-100 rounded animate-pulse w-16" />
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => api.get<DashboardSummary>('/api/dashboard/summary').then((r) => r.data),
    refetchInterval: 60_000,
  })

  const { data: alertsData, isLoading: alertsLoading } = useQuery({
    queryKey: ['alerts-preview'],
    queryFn: () =>
      listAlerts({ is_resolved: false, limit: 5 }).then((r) => r.data),
  })

  const kpis = summary
    ? [
        {
          label: 'Total Active SKUs',
          value: summary.total_skus.toLocaleString(),
          icon: Package,
          colorClass: 'text-blue-600',
          bgClass: 'bg-blue-50',
        },
        {
          label: 'Low Stock Alerts',
          value: summary.low_stock_count,
          icon: TrendingDown,
          colorClass: summary.low_stock_count > 0 ? 'text-amber-600' : 'text-slate-400',
          bgClass: summary.low_stock_count > 0 ? 'bg-amber-50' : 'bg-slate-50',
        },
        {
          label: 'Wastage Risk',
          value: summary.wastage_alerts,
          icon: Trash2,
          colorClass: summary.wastage_alerts > 0 ? 'text-rose-600' : 'text-slate-400',
          bgClass: summary.wastage_alerts > 0 ? 'bg-rose-50' : 'bg-slate-50',
        },
        {
          label: 'Near Expiry',
          value: summary.near_expiry_count,
          icon: Clock,
          colorClass: summary.near_expiry_count > 0 ? 'text-amber-600' : 'text-slate-400',
          bgClass: summary.near_expiry_count > 0 ? 'bg-amber-50' : 'bg-slate-50',
        },
        {
          label: "Today's Inbound",
          value: summary.today_inbound.toLocaleString(),
          icon: TrendingUp,
          colorClass: 'text-emerald-600',
          bgClass: 'bg-emerald-50',
        },
        {
          label: "Today's Outbound",
          value: summary.today_outbound.toLocaleString(),
          icon: TrendingDown,
          colorClass: 'text-blue-600',
          bgClass: 'bg-blue-50',
        },
        {
          label: 'Total Inventory Value',
          value: formatCurrency(summary.total_inventory_value),
          icon: DollarSign,
          colorClass: 'text-emerald-600',
          bgClass: 'bg-emerald-50',
          sublabel: 'Estimated current value',
        },
      ]
    : []

  return (
    <div className="space-y-8">
      {/* KPI Grid */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
          Overview
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {summaryLoading
            ? Array.from({ length: 7 }).map((_, i) => <SkeletonKPI key={i} />)
            : kpis.map((kpi) => <KPICard key={kpi.label} {...kpi} />)}
        </div>
      </div>

      {/* Recent Alerts */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
          Recent Unresolved Alerts
        </h2>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          {alertsLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-4 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : !alertsData?.data?.length ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
              <CheckCircle size={32} className="opacity-40" />
              <p className="text-sm">No unresolved alerts — all clear!</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Variant</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Message</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {alertsData.data.map((alert) => (
                  <tr key={alert.alert_id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3">
                      <StatusBadge status={alert.alert_type} />
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-700">{alert.variant_name}</td>
                    <td className="px-5 py-3 text-slate-500 max-w-[300px] truncate">{alert.message}</td>
                    <td className="px-5 py-3">
                      {alert.is_resolved ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-600">
                          <CheckCircle size={13} /> Resolved
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-rose-500">
                          <XCircle size={13} /> Open
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-xs">{alert.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

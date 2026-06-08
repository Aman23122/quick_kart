import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Package,
  Trash2,
  Clock,
  TrendingDown,
  DollarSign,
  CheckCircle,
  XCircle,
  X,
  Download,
  ArrowDownToLine,
  ArrowUpFromLine,
  ShoppingCart,
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
  today_inbound_value: number
  today_outbound_value: number
  total_inventory_value: number
}

interface InboundDetailRow {
  procurement_id: string
  po_number: string
  vendor_name: string
  product_name: string
  brand_name: string
  variant_name: string
  batch_no: string
  received_qty: number
  unit_cost: number
  total_cost: number
  received_at: string
}

interface OutboundDetailRow {
  order_id: string
  customer_name: string
  product_name: string
  brand_name: string
  variant_name: string
  quantity: number
  unit_price: number
  total_price: number
  dispatched_at: string
}

function downloadCsv(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(','),
    ...rows.map((r) =>
      headers.map((h) => JSON.stringify(r[h] ?? '')).join(',')
    ),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function DetailModal({
  title,
  totalValue,
  onClose,
  children,
  onDownload,
}: {
  title: string
  totalValue: number
  onClose: () => void
  children: React.ReactNode
  onDownload: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-800">{title}</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Total: <span className="font-semibold text-slate-700">{formatCurrency(totalValue)}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
            >
              <Download size={13} /> Download CSV
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        {/* Body */}
        <div className="overflow-auto flex-1 px-6 py-4">
          {children}
        </div>
      </div>
    </div>
  )
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
  const [showInbound, setShowInbound] = useState(false)
  const [showOutbound, setShowOutbound] = useState(false)

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => api.get<DashboardSummary>('/api/dashboard/summary').then((r) => r.data),
    refetchInterval: 60_000,
  })

  const { data: alertsData, isLoading: alertsLoading } = useQuery({
    queryKey: ['alerts-preview'],
    queryFn: () => listAlerts({ is_resolved: false, limit: 5 }).then((r) => r.data),
  })

  const { data: salesAlertsData } = useQuery({
    queryKey: ['sales-alerts'],
    queryFn: () => listAlerts({ alert_type: 'approaching_dispatch_cutoff', is_resolved: false, limit: 10 }).then((r) => r.data),
    refetchInterval: 60_000,
  })

  const { data: inboundDetail } = useQuery({
    queryKey: ['dashboard-today-inbound'],
    queryFn: () => api.get<{ total_value: number; data: InboundDetailRow[] }>('/api/dashboard/today-inbound').then((r) => r.data),
    enabled: showInbound,
  })

  const { data: outboundDetail } = useQuery({
    queryKey: ['dashboard-today-outbound'],
    queryFn: () => api.get<{ total_value: number; data: OutboundDetailRow[] }>('/api/dashboard/today-outbound').then((r) => r.data),
    enabled: showOutbound,
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
          label: 'Total Inventory Value',
          value: formatCurrency(summary.total_inventory_value),
          icon: DollarSign,
          colorClass: 'text-emerald-600',
          bgClass: 'bg-emerald-50',
          sublabel: 'Current stock at cost price',
        },
      ]
    : []

  return (
    <div className="space-y-8">
      {/* KPI Grid */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {summaryLoading
            ? Array.from({ length: 7 }).map((_, i) => <SkeletonKPI key={i} />)
            : kpis.map((kpi) => <KPICard key={kpi.label} {...kpi} />)}
        </div>
      </div>

      {/* Today's Flow — clickable value cards */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Today's Stock Flow</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Inbound card */}
          <button
            onClick={() => setShowInbound(true)}
            className="text-left bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex items-start gap-4 hover:shadow-md hover:border-emerald-200 transition-all group"
          >
            <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-100 transition-colors">
              <ArrowDownToLine size={22} className="text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Today's Inbound</p>
              {summaryLoading ? (
                <div className="h-7 bg-slate-100 rounded animate-pulse w-28 mt-1" />
              ) : (
                <p className="text-2xl font-bold text-slate-800 mt-1 leading-none">
                  {formatCurrency(summary?.today_inbound_value ?? 0)}
                </p>
              )}
              <p className="text-xs text-slate-400 mt-1">
                {summary?.today_inbound ?? 0} shipment(s) approved · click to view details
              </p>
            </div>
          </button>

          {/* Outbound card */}
          <button
            onClick={() => setShowOutbound(true)}
            className="text-left bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex items-start gap-4 hover:shadow-md hover:border-blue-200 transition-all group"
          >
            <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
              <ArrowUpFromLine size={22} className="text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Today's Outbound</p>
              {summaryLoading ? (
                <div className="h-7 bg-slate-100 rounded animate-pulse w-28 mt-1" />
              ) : (
                <p className="text-2xl font-bold text-slate-800 mt-1 leading-none">
                  {formatCurrency(summary?.today_outbound_value ?? 0)}
                </p>
              )}
              <p className="text-xs text-slate-400 mt-1">
                {summary?.today_outbound ?? 0} order(s) dispatched · click to view details
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Sales Action Required */}
      {salesAlertsData?.data && salesAlertsData.data.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
            Sales Action Required
          </h2>
          <div className="bg-orange-50 border border-orange-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3 border-b border-orange-200 bg-orange-100/60">
              <ShoppingCart size={16} className="text-orange-600 flex-shrink-0" />
              <p className="text-sm font-semibold text-orange-800">
                {salesAlertsData.data.length} product{salesAlertsData.data.length > 1 ? 's' : ''} approaching dispatch block — add an offer and move them fast!
              </p>
            </div>
            <div className="divide-y divide-orange-100">
              {salesAlertsData.data.map((alert) => (
                <div key={alert.alert_id} className="flex items-start gap-4 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 leading-tight">
                      {String(alert.product_name || alert.variant_name)}
                      {alert.brand_name ? (
                        <span className="ml-1.5 text-xs font-normal text-blue-500">{String(alert.brand_name)}</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-orange-700 mt-0.5 leading-snug">{alert.message}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span className="text-xs font-semibold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full border border-orange-200">
                      {alert.current_qty} units
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Product</th>
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
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-800 text-sm leading-tight">{String(alert.product_name || alert.variant_name)}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {alert.brand_name ? <span className="text-blue-500">{String(alert.brand_name)}</span> : null}
                        {alert.brand_name && alert.variant_name ? ' · ' : ''}
                        {String(alert.variant_name)}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-slate-500 max-w-[300px] truncate text-xs">{alert.message}</td>
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

      {/* Inbound Detail Modal */}
      {showInbound && (
        <DetailModal
          title="Today's Inbound — Stock Received"
          totalValue={inboundDetail?.total_value ?? 0}
          onClose={() => setShowInbound(false)}
          onDownload={() => downloadCsv(inboundDetail?.data as unknown as Record<string, unknown>[] ?? [], `inbound_${new Date().toISOString().slice(0, 10)}`)}
        >
          {!inboundDetail ? (
            <div className="py-8 text-center text-slate-400 text-sm">Loading…</div>
          ) : inboundDetail.data.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">No approved inbound shipments today.</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 uppercase tracking-wide border-b border-slate-100">
                  <th className="pb-2 text-left">PO #</th>
                  <th className="pb-2 text-left">Vendor</th>
                  <th className="pb-2 text-left">Product</th>
                  <th className="pb-2 text-left">Brand</th>
                  <th className="pb-2 text-left">Variant</th>
                  <th className="pb-2 text-left">Batch</th>
                  <th className="pb-2 text-right">Qty</th>
                  <th className="pb-2 text-right">Unit Cost</th>
                  <th className="pb-2 text-right font-bold text-slate-600">Total</th>
                  <th className="pb-2 text-left">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {inboundDetail.data.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="py-2 font-mono text-slate-600">{r.po_number}</td>
                    <td className="py-2 text-slate-700">{r.vendor_name}</td>
                    <td className="py-2 font-medium text-slate-800">{r.product_name}</td>
                    <td className="py-2 text-blue-600">{r.brand_name}</td>
                    <td className="py-2 text-slate-500">{r.variant_name}</td>
                    <td className="py-2 font-mono text-slate-500">{r.batch_no}</td>
                    <td className="py-2 text-right font-semibold">{r.received_qty.toLocaleString()}</td>
                    <td className="py-2 text-right text-slate-600">{formatCurrency(r.unit_cost)}</td>
                    <td className="py-2 text-right font-bold text-emerald-700">{formatCurrency(r.total_cost)}</td>
                    <td className="py-2 text-slate-400">{r.received_at}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200">
                  <td colSpan={8} className="pt-3 text-right font-semibold text-slate-600 text-xs uppercase tracking-wide">Grand Total</td>
                  <td className="pt-3 text-right font-bold text-emerald-700">{formatCurrency(inboundDetail.total_value)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </DetailModal>
      )}

      {/* Outbound Detail Modal */}
      {showOutbound && (
        <DetailModal
          title="Today's Outbound — Orders Dispatched"
          totalValue={outboundDetail?.total_value ?? 0}
          onClose={() => setShowOutbound(false)}
          onDownload={() => downloadCsv(outboundDetail?.data as unknown as Record<string, unknown>[] ?? [], `outbound_${new Date().toISOString().slice(0, 10)}`)}
        >
          {!outboundDetail ? (
            <div className="py-8 text-center text-slate-400 text-sm">Loading…</div>
          ) : outboundDetail.data.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">No confirmed orders dispatched today.</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 uppercase tracking-wide border-b border-slate-100">
                  <th className="pb-2 text-left">Order ID</th>
                  <th className="pb-2 text-left">Customer</th>
                  <th className="pb-2 text-left">Product</th>
                  <th className="pb-2 text-left">Brand</th>
                  <th className="pb-2 text-left">Variant</th>
                  <th className="pb-2 text-right">Qty</th>
                  <th className="pb-2 text-right">Unit Price</th>
                  <th className="pb-2 text-right font-bold text-slate-600">Total</th>
                  <th className="pb-2 text-left">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {outboundDetail.data.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="py-2 font-mono text-slate-500">{r.order_id.slice(0, 12)}…</td>
                    <td className="py-2 font-medium text-slate-800">{r.customer_name}</td>
                    <td className="py-2 text-slate-700">{r.product_name}</td>
                    <td className="py-2 text-blue-600">{r.brand_name}</td>
                    <td className="py-2 text-slate-500">{r.variant_name}</td>
                    <td className="py-2 text-right font-semibold">{r.quantity.toLocaleString()}</td>
                    <td className="py-2 text-right text-slate-600">{formatCurrency(r.unit_price)}</td>
                    <td className="py-2 text-right font-bold text-blue-700">{formatCurrency(r.total_price)}</td>
                    <td className="py-2 text-slate-400">{r.dispatched_at}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200">
                  <td colSpan={7} className="pt-3 text-right font-semibold text-slate-600 text-xs uppercase tracking-wide">Grand Total</td>
                  <td className="pt-3 text-right font-bold text-blue-700">{formatCurrency(outboundDetail.total_value)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </DetailModal>
      )}
    </div>
  )
}

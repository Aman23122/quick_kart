import { cn } from '@/lib/utils'

type StatusKey =
  | 'accepted'
  | 'rejected'
  | 'blocked'
  | 'fulfilled'
  | 'partial'
  | 'draft'
  | 'sent'
  | 'overridden'
  | 'low_stock'
  | 'wastage_risk'
  | 'placed'
  | 'temp_rejection'
  | 'dispatch_blocked'
  | 'green'
  | 'orange'
  | 'red'
  | string

const statusStyles: Record<string, string> = {
  accepted: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  confirmed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  fulfilled: 'bg-blue-100 text-blue-700 border-blue-200',
  placed: 'bg-blue-100 text-blue-700 border-blue-200',
  sent: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  green: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-100 text-rose-700 border-rose-200',
  blocked: 'bg-rose-100 text-rose-700 border-rose-200',
  dispatch_blocked: 'bg-rose-100 text-rose-700 border-rose-200',
  approaching_dispatch_cutoff: 'bg-orange-100 text-orange-700 border-orange-200',
  wastage_risk: 'bg-rose-100 text-rose-700 border-rose-200',
  temp_rejection: 'bg-rose-100 text-rose-700 border-rose-200',
  red: 'bg-rose-100 text-rose-700 border-rose-200',
  partial: 'bg-amber-100 text-amber-700 border-amber-200',
  low_stock: 'bg-amber-100 text-amber-700 border-amber-200',
  orange: 'bg-amber-100 text-amber-700 border-amber-200',
  draft: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  overridden: 'bg-slate-100 text-slate-600 border-slate-200',
  pending_approval: 'bg-amber-100 text-amber-700 border-amber-200',
  admin_approved: 'bg-blue-100 text-blue-700 border-blue-200',
  approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  dispatched: 'bg-violet-100 text-violet-700 border-violet-200',
  cancelled: 'bg-rose-100 text-rose-700 border-rose-200',
}

const statusLabels: Record<string, string> = {
  accepted: 'Accepted',
  confirmed: 'Confirmed',
  rejected: 'Rejected',
  blocked: 'Blocked',
  fulfilled: 'Fulfilled',
  partial: 'Partial',
  draft: 'Draft',
  sent: 'Sent',
  overridden: 'Overridden',
  low_stock: 'Low Stock',
  wastage_risk: 'Wastage Risk',
  placed: 'Placed',
  temp_rejection: 'Temp Rejection',
  dispatch_blocked: 'Dispatch Blocked',
  approaching_dispatch_cutoff: 'Sales Alert',
  pending_approval: 'Pending Approval',
  admin_approved: 'Admin Approved',
  approved: 'Warehouse Confirmed',
  dispatched: 'Dispatched',
  cancelled: 'Cancelled',
  green: 'Healthy',
  orange: 'Warning',
  red: 'Critical',
}

interface StatusBadgeProps {
  status: StatusKey
  className?: string
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = statusStyles[status] ?? 'bg-slate-100 text-slate-600 border-slate-200'
  const label = statusLabels[status] ?? status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
        style,
        className
      )}
    >
      {label}
    </span>
  )
}

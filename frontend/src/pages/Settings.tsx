import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Thermometer,
  Clock,
  Trash2,
  TrendingDown,
  Check,
  Edit2,
  X,
  Settings as SettingsIcon,
  Bell,
} from 'lucide-react'
import { getConfig, updateConfig, type ConfigRow } from '@/services/configApi'
import { cn } from '@/lib/utils'

const CONFIG_GROUPS: {
  title: string
  description: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  keys: string[]
  color: string
}[] = [
  {
    title: 'Temperature & Time Windows',
    description: 'Temperature rejection thresholds and inbound time windows',
    icon: Thermometer,
    keys: [
      'temp_rejection_threshold',
      'dairy_inbound_window_start',
      'dairy_inbound_window_end',
      'fresh_inbound_cutoff',
    ],
    color: 'text-blue-600 bg-blue-50',
  },
  {
    title: 'Dispatch Windows — Per Product',
    description: 'Minutes after inbound approval within which each product type can be dispatched. First matching rule wins; generic dairy is the fallback.',
    icon: Clock,
    keys: [
      'dispatch_window_milk_min',
      'dispatch_window_paneer_curd_min',
      'dispatch_window_bread_batter_min',
      'dispatch_window_butter_min',
      'dispatch_window_meat_min',
      'dairy_dispatch_window_minutes',
    ],
    color: 'text-amber-600 bg-amber-50',
  },
  {
    title: 'Wastage & Stock Alerts',
    description: 'Alert thresholds for wastage risk and low stock detection',
    icon: TrendingDown,
    keys: ['fruits_veg_wastage_alert_days', 'low_stock_pct_threshold'],
    color: 'text-rose-600 bg-rose-50',
  },
  {
    title: 'Sales Alert Timing — Before Dispatch Block',
    description: 'Minutes before dispatch block to alert sales team to run offers and clear stock',
    icon: Bell,
    keys: [
      'pre_dispatch_alert_milk_min',
      'pre_dispatch_alert_paneer_min',
      'pre_dispatch_alert_bread_min',
      'pre_dispatch_alert_butter_min',
      'pre_dispatch_alert_meat_min',
      'pre_dispatch_alert_default_min',
    ],
    color: 'text-orange-600 bg-orange-50',
  },
]

interface ConfigRowItemProps {
  row: ConfigRow
  onSave: (key: string, value: string) => Promise<void>
  saving: boolean
}

function ConfigRowItem({ row, onSave, saving }: ConfigRowItemProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(row.config_value)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setValue(row.config_value)
  }, [row.config_value])

  const handleSave = async () => {
    await onSave(row.config_key, value)
    setEditing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleCancel = () => {
    setValue(row.config_value)
    setEditing(false)
  }

  return (
    <div className="flex items-start gap-4 py-4 border-b border-slate-50 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700">{row.description || row.config_key}</p>
        <p className="text-xs text-slate-400 font-mono mt-0.5">{row.config_key}</p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {editing ? (
          <>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave()
                if (e.key === 'Escape') handleCancel()
              }}
              autoFocus
              className="w-28 px-2.5 py-1.5 text-sm border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white"
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors"
            >
              <Check size={12} />
              Save
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <>
            <span className={cn(
              'font-mono text-sm px-3 py-1 rounded-lg',
              'bg-slate-100 text-slate-700'
            )}>
              {row.config_value}
            </span>
            {saved && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium animate-fade-in">
                <Check size={12} />
                Updated
              </span>
            )}
            <button
              onClick={() => setEditing(true)}
              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Edit"
            >
              <Edit2 size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function DeleteIcon({ size, className }: { size?: number; className?: string }) {
  return <Trash2 size={size} className={className} />
}

export default function Settings() {
  const queryClient = useQueryClient()
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['config'],
    queryFn: () => getConfig().then((r) => r.data),
  })

  const saveMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      updateConfig(key, value),
    onSuccess: (_, { key }) => {
      queryClient.invalidateQueries({ queryKey: ['config'] })
      if (key.startsWith('po_')) {
        queryClient.invalidateQueries({ queryKey: ['po-schedule'] })
      }
      setSavingKey(null)
    },
    onError: () => {
      setSavingKey(null)
    },
  })

  const handleSave = async (key: string, value: string) => {
    setSavingKey(key)
    saveMutation.mutate({ key, value })
  }

  const configByKey = (data?.data ?? []).reduce<Record<string, ConfigRow>>(
    (acc, row) => ({ ...acc, [row.config_key]: row }),
    {}
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 space-y-3">
            <div className="h-5 bg-slate-100 rounded animate-pulse w-48" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="h-10 bg-slate-50 rounded animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-2">
        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
          <SettingsIcon size={20} className="text-slate-600" />
        </div>
        <div>
          <h2 className="font-semibold text-slate-800">System Configuration</h2>
          <p className="text-sm text-slate-500">
            Manage operational thresholds and dispatch rules
          </p>
        </div>
      </div>

      {CONFIG_GROUPS.map((group) => {
        const Icon = group.icon
        const groupRows = group.keys
          .map((k) => configByKey[k])
          .filter(Boolean) as ConfigRow[]

        // Show placeholder rows if config keys aren't in response yet
        const displayRows: ConfigRow[] =
          groupRows.length > 0
            ? groupRows
            : group.keys.map((k) => ({
                config_key: k,
                config_value: '—',
                description: k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
                updated_at: '',
              }))

        return (
          <div
            key={group.title}
            className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden"
          >
            {/* Group header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-50">
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', group.color)}>
                <Icon size={16} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 text-sm">{group.title}</h3>
                <p className="text-xs text-slate-500">{group.description}</p>
              </div>
            </div>

            {/* Rows */}
            <div className="px-6">
              {displayRows.map((row) => (
                <ConfigRowItem
                  key={row.config_key}
                  row={row}
                  onSave={handleSave}
                  saving={savingKey === row.config_key}
                />
              ))}
            </div>
          </div>
        )
      })}

      {/* Remaining configs not in groups */}
      {data?.data && (() => {
        const groupedKeys = CONFIG_GROUPS.flatMap((g) => g.keys)
        const ungrouped = data.data.filter((r) => !groupedKeys.includes(r.config_key))
        if (ungrouped.length === 0) return null
        return (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-50">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 text-slate-600">
                <DeleteIcon size={16} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 text-sm">Other Settings</h3>
                <p className="text-xs text-slate-500">Additional configuration keys</p>
              </div>
            </div>
            <div className="px-6">
              {ungrouped.map((row) => (
                <ConfigRowItem
                  key={row.config_key}
                  row={row}
                  onSave={handleSave}
                  saving={savingKey === row.config_key}
                />
              ))}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

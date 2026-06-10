import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export type SelectOption = { value: string; label: string }

type Props = {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  required?: boolean
}

export default function SelectBrand({ value, onChange, options, placeholder = 'Select...' }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 text-sm transition-all duration-200 outline-none"
        style={{
          padding: '0.6rem 1rem',
          borderRadius: '0.75rem',
          background: open ? '#fff' : 'var(--brand-50)',
          border: `2px solid ${open ? 'var(--brand-600)' : 'var(--brand-200)'}`,
          boxShadow: open ? '0 0 0 4px rgba(61, 139, 94, 0.12)' : 'none',
          color: selected ? '#1e293b' : '#94a3b8',
        }}
      >
        <span>{selected ? selected.label : placeholder}</span>
        <ChevronDown
          size={15}
          style={{
            color: 'var(--brand-600)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
            flexShrink: 0,
          }}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute z-50 w-full mt-1.5 rounded-xl shadow-xl overflow-y-auto"
          style={{ background: '#fff', border: '2px solid var(--brand-200)', maxHeight: '180px' }}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false) }}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors text-left"
                style={{
                  background: isSelected ? 'var(--brand-50)' : 'transparent',
                  color: isSelected ? 'var(--brand-700)' : '#334155',
                  fontWeight: isSelected ? 600 : 400,
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'var(--brand-50)'
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent'
                }}
              >
                {opt.label}
                {isSelected && <Check size={13} style={{ color: 'var(--brand-600)', flexShrink: 0 }} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

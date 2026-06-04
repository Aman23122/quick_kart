import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface CountdownTimerProps {
  targetTime: string
  className?: string
}

function calcDiff(target: string): number {
  const targetDate = new Date(target.replace(' ', 'T'))
  return Math.floor((targetDate.getTime() - Date.now()) / 1000)
}

function formatSeconds(totalSecs: number): string {
  if (totalSecs <= 0) return '00:00:00'
  const h = Math.floor(totalSecs / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  const s = totalSecs % 60
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
}

export default function CountdownTimer({ targetTime, className }: CountdownTimerProps) {
  const [secsLeft, setSecsLeft] = useState(() => calcDiff(targetTime))

  useEffect(() => {
    setSecsLeft(calcDiff(targetTime))
    const id = setInterval(() => {
      setSecsLeft(calcDiff(targetTime))
    }, 1000)
    return () => clearInterval(id)
  }, [targetTime])

  if (secsLeft <= 0) {
    return (
      <span
        className={cn(
          'font-mono text-sm font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded',
          className
        )}
      >
        FIRED
      </span>
    )
  }

  const urgent = secsLeft < 3600 // < 1 hour
  const warning = secsLeft < 21600 // < 6 hours

  return (
    <span
      className={cn(
        'font-mono text-sm font-bold px-2 py-1 rounded',
        urgent
          ? 'text-rose-600 bg-rose-50'
          : warning
          ? 'text-amber-600 bg-amber-50'
          : 'text-emerald-600 bg-emerald-50',
        className
      )}
    >
      {formatSeconds(secsLeft)}
    </span>
  )
}

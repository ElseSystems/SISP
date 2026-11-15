import { useEffect, useMemo, useState } from 'react'
import { useStore } from './store'
import { isoDay } from './crew'
import { nowMinutesGmt } from './schedule'
import type { TaskKind } from './schedule'

export const KIND_STYLE: Record<TaskKind, { icon: string; color: string }> = {
  measure: { icon: '🩺', color: 'var(--sisp-accent)' },
  test: { icon: '⚡', color: 'var(--sisp-accent)' },
  exercise: { icon: '🏋️', color: 'var(--sisp-xp)' },
  ops: { icon: '🛰️', color: 'var(--sisp-text-3)' },
  sleep: { icon: '🌙', color: '#818CF8' },
  report: { icon: '📡', color: 'var(--sisp-accent)' },
  meal: { icon: '🍽️', color: 'var(--sisp-text-3)' },
}

/** today's date (YYYY-MM-DD), refreshed every minute */
export function useToday() {
  const [d, setD] = useState(() => isoDay(new Date()))
  useEffect(() => { const id = setInterval(() => setD(isoDay(new Date())), 60000); return () => clearInterval(id) }, [])
  return d
}

export function useGmtNow(ms = 15000) {
  const [now, setNow] = useState(() => nowMinutesGmt())
  useEffect(() => { const id = setInterval(() => setNow(nowMinutesGmt()), ms); return () => clearInterval(id) }, [ms])
  return now
}

/** Done ids for today, including tasks auto-completed by data. */
export function useDoneToday() {
  const tasks = useStore((s) => s.tasks)
  const crew = useStore((s) => s.crew)
  const selectedId = useStore((s) => s.selectedId)
  const today = useToday()
  const c = crew.find((x) => x.id === selectedId)
  return useMemo(() => {
    const ids = new Set(tasks[today] ?? [])
    if (c?.readings.some((r) => r.date === today && r.source === 'manual')) { ids.add('checkin'); ids.add('wake') }
    if (c?.pvt?.some((p) => p.date === today && p.source === 'manual')) ids.add('pvt')
    if (c?.pulse?.some((p) => p.date === today)) ids.add('pulse')
    return [...ids]
  }, [tasks, today, c])
}


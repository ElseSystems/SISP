import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../lib/store'
import { MISSION_DAY, fmtHm, nextTask, taskState } from '../lib/schedule'
import type { MissionTask } from '../lib/schedule'
import { useDoneToday, useGmtNow, useToday, KIND_STYLE } from '../lib/mission'
import { t, tr } from '../lib/i18n'

/** In-app (offline) reminder toasts when a timeline measurement becomes due; optional system notification. */
export function ReminderToaster() {
  const now = useGmtNow(10000)
  const done = useDoneToday()
  const notify = useStore((s) => s.notify)
  const demo = useStore((s) => s.demo)
  const solar = useStore((s) => s.solar)
  const setTab = useStore((s) => s.setTab)
  const shown = useRef(new Set<string>(JSON.parse(sessionStorage.getItem('sisp-reminded') ?? '[]') as string[]))
  const [queue, setQueue] = useState<MissionTask[]>([])
  const today = useToday()

  useEffect(() => {
    if (demo || solar) return
    const due = MISSION_DAY.filter((x) => x.remind && taskState(x, now, done.includes(x.id)) === 'due' && !shown.current.has(`${today}:${x.id}`))
    if (!due.length) return
    due.forEach((x) => {
      shown.current.add(`${today}:${x.id}`)
      if (notify && 'Notification' in window && Notification.permission === 'granted') {
        try { new Notification(`SISP · ${fmtHm(x.start)} GMT`, { body: tr(x.title), tag: x.id }) } catch { /* ignore */ }
      }
    })
    sessionStorage.setItem('sisp-reminded', JSON.stringify([...shown.current]))
    setQueue((q) => [...q, ...due])
  }, [now, done, notify, demo, solar, today])

  const close = (id: string) => setQueue((q) => q.filter((x) => x.id !== id))
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-30 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
      <AnimatePresence>
        {queue.slice(-3).map((x) => (
          <motion.div key={x.id} layout initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
            className="glass pointer-events-auto rounded-xl border-l-4 p-3" style={{ borderLeftColor: KIND_STYLE[x.kind].color }}>
            <div className="flex items-start gap-2">
              <span className="text-xl" aria-hidden>{KIND_STYLE[x.kind].icon}</span>
              <div className="mr-auto min-w-0">
                <p className="font-mono text-meta text-accent">⏰ {fmtHm(x.start)} GMT · {t('agora', 'due now')}</p>
                <p className="text-body-sm font-semibold text-fg-1">{tr(x.title)}</p>
              </div>
              <button onClick={() => close(x.id)} className="text-fg-3 hover:text-fg-1" aria-label={t('Fechar', 'Close')}>✕</button>
            </div>
            {x.tab && <button onClick={() => { setTab(x.tab!); close(x.id) }} className="mt-2 w-full rounded-lg bg-accent py-1.5 text-body-sm font-bold text-accent-ink hover:bg-accent-strong">{t('Fazer agora', 'Do it now')} →</button>}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

/** Compact "next up" strip for the dashboard. */
export function NextUp() {
  const now = useGmtNow()
  const done = useDoneToday()
  const setTab = useStore((s) => s.setTab)
  const nxt = nextTask(now, done)
  const due = MISSION_DAY.filter((x) => (x.remind || x.auto) && taskState(x, now, done.includes(x.id)) === 'due')
  const items = [...due, ...(nxt && !due.includes(nxt) ? [nxt] : [])].slice(0, 3)
  return (
    <button onClick={() => setTab('today')} className="glass flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl px-4 py-2.5 text-left hover:border-line-strong">
      <span className="font-display text-body-sm font-semibold text-sky-200">🗓️ {t('Hoje', 'Today')} · <span className="font-mono">{fmtHm(now)} GMT</span></span>
      {items.length === 0 && <span className="text-body-sm text-fg-2">{t('Tudo feito por hoje ✓', 'All done for today ✓')}</span>}
      {items.map((x) => {
        const st = taskState(x, now, false)
        const mins = Math.round(x.start - now)
        return (
          <span key={x.id} className={`flex items-center gap-1.5 text-body-sm ${st === 'due' ? 'text-fg-1' : 'text-fg-2'}`}>
            <span className={`h-2 w-2 rounded-full ${st === 'due' ? 'animate-pulse bg-accent' : 'bg-fg-3'}`} />
            {KIND_STYLE[x.kind].icon} {tr(x.title).split(':')[0]}
            <span className="font-mono text-meta text-fg-3">{st === 'due' ? t('agora', 'now') : mins < 60 ? `${t('em', 'in')} ${mins} min` : fmtHm(x.start)}</span>
          </span>
        )
      })}
      <span className="ml-auto text-meta text-accent">{t('Ver dia →', 'Open day →')}</span>
    </button>
  )
}

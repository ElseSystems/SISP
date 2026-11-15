import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { DEMO_STEPS } from '../lib/story'
import { useStore } from '../lib/store'
import type { Tab } from '../lib/store'
import type { EnvironmentId } from '../lib/knowledge'
import { t, tr } from '../lib/i18n'
import { loadDonki, pickScenario } from '../lib/spaceWeather'

/**
 * One-click scripted demo: drives tab / environment / crew / body focus from DEMO_STEPS and
 * shows a caption bar. Restores the user's previous view on exit. ←/→ step, space pause, Esc exit.
 */
export default function DemoDirector() {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const saved = useRef<{ tab: Tab; env: EnvironmentId; selectedId: string; solarLogLen: number } | null>(null)
  const step = DEMO_STEPS[i]

  useEffect(() => {
    const s = useStore.getState()
    saved.current = { tab: s.tab, env: s.env, selectedId: s.selectedId, solarLogLen: s.solarLog.length }
    return () => {
      const sv = saved.current
      if (!sv) return
      // the demo leaves no trace: drop the drill's solar event and its dose log entry
      useStore.setState((st) => ({ tab: sv.tab, env: sv.env, selectedId: sv.selectedId, hazard: null, solar: null, solarLog: st.solarLog.slice(0, sv.solarLogLen) }))
    }
  }, [])

  useEffect(() => {
    const patch: Record<string, unknown> = { tab: step.tab }
    if (step.env) patch.env = step.env
    if (step.crew) patch.selectedId = step.crew
    if (step.region !== undefined) patch.region = step.region
    if (step.hazard !== undefined) patch.hazard = step.hazard
    useStore.setState(patch)
    const st = useStore.getState()
    if (step.solar === 'start' && !st.solar) loadDonki().then((d) => { const sc = pickScenario(d); if (sc) useStore.getState().triggerSolar(sc, 40) }).catch(() => {})
    if (step.solar === 'shelter' && st.solar && !st.solar.shelteredAt) useStore.setState({ solar: { ...st.solar, shelteredAt: Date.now() } })
    if (step.solar === 'clear' && st.solar) useStore.setState({ solar: null })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step])

  const exit = () => useStore.getState().setDemo(false)
  useEffect(() => {
    if (paused) return
    const id = setTimeout(() => (i < DEMO_STEPS.length - 1 ? setI(i + 1) : exit()), step.ms)
    return () => clearTimeout(id)
  }, [i, paused, step.ms])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exit()
      else if (e.key === 'ArrowRight') setI((x) => Math.min(DEMO_STEPS.length - 1, x + 1))
      else if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1))
      else if (e.key === ' ') { e.preventDefault(); setPaused((p) => !p) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="fixed inset-x-0 bottom-0 z-40 p-3" role="status" aria-live="polite">
      <div className="glass mx-auto max-w-3xl overflow-hidden rounded-2xl shadow-[0_0_40px_rgba(56,189,248,0.3)]">
        <div className="flex gap-0.5 px-3 pt-2">
          {DEMO_STEPS.map((s, k) => (
            <div key={k} className="h-1 flex-1 overflow-hidden rounded-full bg-slate-700">
              {k < i && <div className="h-full w-full bg-sky-400" />}
              {k === i && <motion.div key={`${i}-${paused}`} className="h-full bg-sky-400" initial={{ width: paused ? '50%' : 0 }} animate={{ width: paused ? '50%' : '100%' }} transition={{ duration: paused ? 0 : s.ms / 1000, ease: 'linear' }} />}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 p-3">
          <span className="rounded-md bg-red-500 px-1.5 py-0.5 text-meta font-black tracking-widest text-white">● DEMO</span>
          <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mr-auto min-w-0">
            <p className="text-sm font-bold text-slate-50">{tr(step.title)}</p>
            <p className="text-xs leading-snug text-slate-300">{tr(step.caption)}</p>
          </motion.div>
          <div className="flex shrink-0 gap-1 text-sm">
            <button onClick={() => setI(Math.max(0, i - 1))} className="rounded-lg border border-slate-600 px-2 py-1 hover:border-slate-400" aria-label="previous">◀</button>
            <button onClick={() => setPaused(!paused)} className="rounded-lg border border-slate-600 px-2 py-1 hover:border-slate-400" aria-label="pause">{paused ? '▶' : '❚❚'}</button>
            <button onClick={() => setI(Math.min(DEMO_STEPS.length - 1, i + 1))} className="rounded-lg border border-slate-600 px-2 py-1 hover:border-slate-400" aria-label="next">▶▶</button>
            <button onClick={exit} className="rounded-lg bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600">{t('Sair', 'Exit')}</button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

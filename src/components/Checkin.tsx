import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, Badge } from './ui'
import { INDICATORS } from '../lib/knowledge'
import { useStore, BADGES } from '../lib/store'
import { isoDay } from '../lib/crew'
import { assessReading } from '../lib/assessment'
import type { Reading } from '../lib/types'
import { t, tr } from '../lib/i18n'

const field = 'w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-lg font-semibold outline-none focus:border-sky-400'

export default function Checkin() {
  const crew = useStore((s) => s.crew)
  const selectedId = useStore((s) => s.selectedId)
  const addReading = useStore((s) => s.addReading)
  const setTab = useStore((s) => s.setTab)
  const c = crew.find((x) => x.id === selectedId)!
  const last = c.readings[c.readings.length - 1]
  const [v, setV] = useState({
    sys: String(last?.sys ?? 115), dia: String(last?.dia ?? 75), hr: String(last?.hr ?? 65), glucose: String(last?.glucose ?? 88),
    temp: String(last?.temp ?? 37.2), sleep: String(last?.sleep ?? 7), mood: last?.mood ?? 4, q1: 0, q2: 0, doPhq: false, selfHarm: false,
    exerciseMin: String(last?.exerciseMin ?? 90),
  })
  const [toast, setToast] = useState<string | null>(null)
  const [today] = useState(() => isoDay(new Date()))
  const done = c.readings.some((r) => r.date === today && r.source === 'manual')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const r: Reading = {
      date: today, sys: +v.sys, dia: +v.dia, hr: +v.hr, glucose: +v.glucose, temp: +v.temp, sleep: +v.sleep, mood: v.mood,
      phq2: v.doPhq ? v.q1 + v.q2 : undefined, selfHarm: v.selfHarm || undefined, exerciseMin: +v.exerciseMin, source: 'manual',
    }
    const { xpGained, newBadges } = addReading(r)
    const readings = [...c.readings.filter((x) => x.date !== today), r]
    const worst = Math.max(...assessReading(readings, readings.length - 1).map((f) => f.severity))
    setToast(`+${xpGained} XP${newBadges.length ? ' · ' + newBadges.map((b) => tr(BADGES[b])).join(' · ') : ''}`)
    setTimeout(() => { setToast(null); setTab(worst >= 2 ? 'ground' : 'dashboard') }, 1600)
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value })
  const num = (k: keyof typeof v, label: string, help: string, step = '1', min?: number, max?: number, title?: string) => (
    <label className="block" title={title}>
      <span className="text-xs text-slate-400">{label}</span>
      <input className={field} type="number" inputMode="decimal" step={step} min={min} max={max} required value={v[k] as string} onChange={set(k)} />
      <span className="text-meta text-fg-3">{help}</span>
    </label>
  )
  const PHQ = [t('Nenhuma vez', 'Not at all'), t('Vários dias', 'Several days'), t('Mais da metade dos dias', 'More than half the days'), t('Quase todos os dias', 'Nearly every day')]

  return (
    <form onSubmit={submit} className="grid gap-4 lg:grid-cols-2">
      <Card title={`${t('Check-in diário', 'Daily check-in')} · ${c.avatar} ${tr(c.name)}`} right={done ? <Badge s={0} /> : <span className="text-xs text-amber-300">{t('pendente hoje', 'due today')}</span>}>
        <p className="mb-3 text-xs text-slate-400">{t('Faça ao acordar, em jejum, após 5 min sentado/fixado.', 'Do it on waking, fasting, after 5 min seated/restrained.')}</p>
        <div className="grid grid-cols-2 gap-3">
          {num('sys', t('🫀 Sistólica (mmHg)', '🫀 Systolic (mmHg)'), t('AHA normal <120/80', 'AHA normal <120/80'), '1', 60, 260, tr(INDICATORS.bp.howToMeasure))}
          {num('dia', t('🫀 Diastólica (mmHg)', '🫀 Diastolic (mmHg)'), t('Crise >180/120', 'Crisis >180/120'), '1', 30, 160, tr(INDICATORS.bp.howToMeasure))}
          {num('hr', t('💓 FC repouso (bpm)', '💓 Resting HR (bpm)'), 'AHA 60–100', '1', 25, 220, tr(INDICATORS.hr.howToMeasure))}
          {num('glucose', t('🩸 Glicemia jejum (mg/dL)', '🩸 Fasting glucose (mg/dL)'), t('ADA <100; hipo <70', 'ADA <100; hypo <70'), '1', 20, 600, tr(INDICATORS.glucose.howToMeasure))}
          {num('temp', t('🌡️ Temperatura (°C)', '🌡️ Temperature (°C)'), t('Comparada à SUA base de voo', 'Compared with YOUR in-flight baseline'), '0.1', 33, 43, tr(INDICATORS.temp.howToMeasure))}
          {num('sleep', t('😴 Sono última noite (h)', '😴 Sleep last night (h)'), t('Meta AASM ≥7 h', 'AASM target ≥7 h'), '0.1', 0, 16, tr(INDICATORS.sleep.howToMeasure))}
          {num('exerciseMin', t('🏋️ Exercício ontem (min)', '🏋️ Exercise yesterday (min)'), t('Protege ossos/músculos', 'Protects bones/muscles'), '5', 0, 400)}
        </div>
      </Card>

      <Card title={t('🧠 Humor', '🧠 Mood')}>
        <span className="text-xs text-slate-400">{t('Como você se sente hoje?', 'How do you feel today?')}</span>
        <div className="mt-1 flex gap-2">
          {['😣', '🙁', '😐', '🙂', '😄'].map((emo, i) => (
            <button type="button" key={i} onClick={() => setV({ ...v, mood: i + 1 })}
              className={`flex-1 rounded-xl border py-2 text-2xl transition ${v.mood === i + 1 ? 'scale-105 border-sky-400 bg-sky-500/20' : 'border-slate-700'}`}>{emo}</button>
          ))}
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={v.doPhq} onChange={(e) => setV({ ...v, doPhq: e.target.checked })} />
          {t('Responder PHQ-2 (semanal, +5 XP)', 'Answer PHQ-2 (weekly, +5 XP)')}
        </label>
        {v.doPhq && (
          <div className="mt-2 space-y-3 text-sm">
            {[['q1', t('Nas últimas 2 semanas, pouco interesse ou prazer em fazer as coisas?', 'Over the last 2 weeks, little interest or pleasure in doing things?')],
              ['q2', t('Nas últimas 2 semanas, sentiu-se para baixo, deprimido(a) ou sem esperança?', 'Over the last 2 weeks, feeling down, depressed or hopeless?')]].map(([k, q]) => (
              <div key={k}>
                <p className="text-slate-300">{q}</p>
                <div className="mt-1 grid grid-cols-2 gap-1 sm:grid-cols-4">
                  {PHQ.map((txt, i) => (
                    <button type="button" key={txt} onClick={() => setV({ ...v, [k]: i })}
                      className={`rounded-lg border px-2 py-1 text-xs ${(v as never)[k] === i ? 'border-sky-400 bg-sky-500/20' : 'border-slate-700'}`}>{txt} ({i})</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <label className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-200">
          <input type="checkbox" checked={v.selfHarm} onChange={(e) => setV({ ...v, selfHarm: e.target.checked })} className="mt-0.5" />
          {t('Tive pensamentos de me machucar (isso aciona contato imediato com o CMO e o solo — e está tudo bem pedir ajuda).', 'I have had thoughts of hurting myself (this triggers immediate contact with the CMO and the ground — it is okay to ask for help).')}
        </label>
        <button className="mt-5 w-full rounded-xl bg-sky-500 py-3 text-lg font-bold text-slate-950 transition hover:bg-sky-400">{t('Registrar check-in ✓', 'Submit check-in ✓')}</button>
        <AnimatePresence>
          {toast && (
            <motion.div initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
              className="mt-3 rounded-xl bg-emerald-500/20 p-3 text-center font-semibold text-emerald-200">🚀 {toast}</motion.div>
          )}
        </AnimatePresence>
      </Card>
    </form>
  )
}

import { Component, lazy, Suspense, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import BodyMap from './BodyMap'
import HazardStrip from './HazardStrip'
import { HAZARD_STORY } from '../lib/story'
import type { ModelId } from './Body3D'
import { Badge, Card, SourceLinks, Sparkline } from './ui'
import { NextUp } from './Reminders'
import { SOURCES, BODY_REGIONS, BONE, ENVIRONMENTS, HAZARDS, INDICATORS, RADIATION, SEVERITY_COLOR } from '../lib/knowledge'
import type { BodyRegionId } from '../lib/knowledge'
import type { CrewAssessment } from '../lib/assessment'
import { useStore } from '../lib/store'
import type { CrewMember, Reading } from '../lib/types'
import { t, tr } from '../lib/i18n'

const Body3D = lazy(() => import('./Body3D'))

function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch { return false }
}

/** If 3D fails (no WebGL, .glb load error) fall back to the 2D body. */
class Fallback3D extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

const SPARK_KEY = { bp: 'sys', hr: 'hr', glucose: 'glucose', temp: 'temp', sleep: 'sleep', mood: 'mood' } as const satisfies Record<string, keyof Reading>
const NOMINAL: Record<keyof typeof SPARK_KEY, [number, number]> = { bp: [90, 120], hr: [60, 100], glucose: [70, 100], temp: [36, 37.8], sleep: [7, 9], mood: [3, 5] }
const splitValue = (v: string) => { const i = v.indexOf(' '); return i < 0 ? [v, ''] : [v.slice(0, i), v.slice(i + 1)] }

export default function Dashboard({ a, c }: { a: CrewAssessment; c: CrewMember }) {
  const region = useStore((s) => s.region)
  const setRegion = useStore((s) => s.setRegion)
  const hazard = useStore((s) => s.hazard)
  const highlight = hazard ? HAZARD_STORY[hazard].regions : null
  const [view, setView] = useState<'3d' | '2d'>(() => (hasWebGL() ? '3d' : '2d'))
  const [model, setModel] = useState<ModelId>('muscular')
  const env = useStore((s) => s.env)
  const setTab = useStore((s) => s.setTab)
  const info = region ? BODY_REGIONS[region] : null
  const map2d = <BodyMap regions={a.regions} selected={region} onSelect={setRegion} highlight={highlight} />

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <Card className="lg:col-span-5" title={t('Mapa corporal', 'Body map')} right={
        <div className="flex gap-1 text-meta">
          {(['3d', '2d'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`rounded-md border px-2 py-0.5 ${view === v ? 'border-sky-400 text-sky-200' : 'border-slate-600 text-slate-400'}`}>{v.toUpperCase()}</button>
          ))}
        </div>}>
        {view === '3d' ? (
          <>
            <div className="mb-2 flex justify-center gap-1 text-meta">
              {([['muscular', t('💪 Músculos', '💪 Muscles')], ['skeleton', t('🦴 Esqueleto', '🦴 Skeleton')]] as [ModelId, string][]).map(([m, lbl]) => (
                <button key={m} onClick={() => setModel(m)} className={`rounded-full border px-2 py-0.5 ${model === m ? 'border-sky-400 bg-sky-500/10 text-sky-200' : 'border-slate-600 text-slate-400'}`}>{lbl}</button>
              ))}
            </div>
            <Fallback3D fallback={map2d}>
              <Suspense fallback={map2d}>
                <Body3D regions={a.regions} selected={region} onSelect={setRegion} model={model} highlight={highlight} />
              </Suspense>
            </Fallback3D>
          </>
        ) : map2d}
        <div className="mt-2 flex flex-wrap justify-center gap-1">
          {(Object.keys(BODY_REGIONS) as BodyRegionId[]).map((r) => (
            <button key={r} onClick={() => setRegion(r)}
              className={`rounded-full border px-2 py-0.5 text-meta ${region === r ? 'border-sky-400 text-sky-200' : 'border-slate-600 text-slate-400'}`}>
              <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: SEVERITY_COLOR[a.regions[r]] }} />
              {tr(BODY_REGIONS[r].short)}
            </button>
          ))}
        </div>
      </Card>

      <div className="space-y-4 lg:col-span-7">
        <NextUp />
        <HazardStrip regions={a.regions} />
        <AnimatePresence mode="wait">
          {info && region && (
            <motion.div key={region} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <Card title={tr(info.name)} right={<Badge s={a.regions[region]} />}>
                <p className="text-sm text-slate-300">{tr(info.fn)}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {info.hazards.map((h) => (
                    <span key={h} title={tr(HAZARDS[h].summary)} className="rounded-md bg-slate-800 px-2 py-0.5 text-meta text-slate-300">{HAZARDS[h].icon} {tr(HAZARDS[h].name)}</span>
                  ))}
                </div>
                {info.extra && <p className="mt-2 text-xs text-slate-400">{tr(info.extra)}</p>}
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {info.indicators.map((id) => {
                    const f = a.findings.find((x) => x.indicator === id)!
                    const ind = INDICATORS[id]
                    return (
                      <div key={id} className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
                        <div className="flex items-center justify-between"><span className="text-xs text-slate-400">{tr(ind.name)}</span><Badge s={f.severity} /></div>
                        <div className="mt-1 font-mono text-title font-semibold">{f.value}</div>
                        {f.delta && <div className="text-meta text-slate-400">{tr(f.delta)}</div>}
                        <p className="mt-1 text-meta text-slate-400">🌌 {tr(ind.spaceEffect)}</p>
                        {f.reasons.length > 0 && <ul className="mt-1 list-disc pl-4 text-meta text-slate-300">{f.reasons.map((r) => <li key={r.en}>{tr(r)}</li>)}</ul>}
                        <p className="mt-2 border-l-2 border-accent bg-accent/5 px-2 py-1 text-body-sm text-sky-100">👉 {tr(ind.actions[f.severity])}</p>
                      </div>
                    )
                  })}
                  {region === 'musculoskeletal' && (
                    <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3 sm:col-span-2">
                      <div className="flex items-center justify-between"><span className="text-xs text-slate-400">{t('Perda óssea estimada', 'Estimated bone loss')}</span><Badge s={a.bone.severity} /></div>
                      <div className="mt-1 text-xl font-bold">{a.bone.low.toFixed(1)}–{a.bone.high.toFixed(1)}%</div>
                      <div className="text-meta text-slate-400">{t(`${a.bone.days} dias em gravidade reduzida · adesão ao exercício ${(a.bone.adherence * 100).toFixed(0)}% (meta 120 min/dia)`, `${a.bone.days} days in reduced gravity · exercise adherence ${(a.bone.adherence * 100).toFixed(0)}% (target 120 min/day)`)}</div>
                      <p className="mt-1 text-meta text-slate-400">{tr(BONE.note)}</p>
                      <p className="mt-2 border-l-2 border-accent bg-accent/5 px-2 py-1 text-body-sm text-sky-100">👉 {t('Exercício resistido (ARED) + aeróbico diário, cálcio e vitamina D conforme plano.', 'Resistive (ARED) + daily aerobic exercise, calcium and vitamin D per plan.')}</p>
                      <SourceLinks sources={[BONE.source, SOURCES.gravity]} />
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {a.findings.map((f) => {
            const ind = INDICATORS[f.indicator as keyof typeof INDICATORS]
            const key = SPARK_KEY[f.indicator as keyof typeof SPARK_KEY]
            const [val, unit] = splitValue(f.value)
            const pulse = f.indicator === 'hr' ? c.pulse?.at(-1) : undefined
            return (
              <button key={f.indicator} onClick={() => setTab('trends')}
                className="rounded-xl border border-line bg-surface-1/80 p-3 text-left transition hover:-translate-y-0.5 hover:border-line-strong"
                style={{ borderLeft: `3px solid ${SEVERITY_COLOR[f.severity]}` }}>
                <div className="flex items-center justify-between gap-1"><span className="text-meta text-fg-3">{tr(ind.name)}</span><Badge s={f.severity} /></div>
                <div className="mt-1 whitespace-nowrap"><span className="font-mono text-metric font-bold text-fg-1">{val}</span> <span className="text-body-sm text-fg-3">{unit}</span></div>
                <Sparkline values={c.readings.slice(-14).map((r) => Number(r[key]))} color={SEVERITY_COLOR[f.severity]} band={NOMINAL[f.indicator as keyof typeof NOMINAL]} />
                <div className="mt-0.5 truncate text-meta text-fg-3">{f.delta ? tr(f.delta) : t('14 dias', '14 days')}{pulse ? ` · 📷 ${pulse.bpm}` : ''}</div>
              </button>
            )
          })}
        </div>

        <Card title={t('⚡ Vigilância / fadiga (PVT)', '⚡ Vigilance / fatigue (PVT)')} right={<Badge s={a.fatigue.severity} />}>
          {a.fatigue.latest ? (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div><span className="font-mono text-metric font-bold text-fg-1">{a.fatigue.latest.medianMs}</span> <span className="text-body-sm text-fg-3">ms {t('mediana', 'median')}</span></div>
              <div className="text-body-sm text-fg-2">{t('base', 'baseline')} <b className="font-mono text-fg-1">{Number.isNaN(a.fatigue.baselineMs) ? '—' : Math.round(a.fatigue.baselineMs)}</b> ms · <span style={{ color: a.fatigue.slowingPct >= 10 ? 'var(--sisp-warning)' : 'var(--sisp-nominal)' }}>{a.fatigue.slowingPct >= 0 ? '+' : ''}{a.fatigue.slowingPct.toFixed(0)}%</span> · {a.fatigue.latest.lapses} {t('lapsos', 'lapses')} · {t('sono 3 noites', '3-night sleep')} {a.fatigue.sleepAvg3.toFixed(1)} h</div>
              <div className="min-w-[120px] flex-1"><Sparkline values={(c.pvt ?? []).map((p) => p.medianMs)} color={SEVERITY_COLOR[a.fatigue.severity]} /></div>
              <button onClick={() => setTab('tests')} className="rounded-lg border border-accent/60 px-3 py-1.5 text-body-sm font-semibold text-accent hover:bg-accent/10">{t('Fazer PVT', 'Take PVT')} →</button>
            </div>
          ) : <button onClick={() => setTab('tests')} className="text-body-sm text-accent underline">{t('Faça seu primeiro PVT', 'Take your first PVT')}</button>}
          {a.fatigue.reasons.length > 0 && <p className="mt-2 text-meta text-fg-1">{a.fatigue.reasons.map(tr).join(' · ')}</p>}
        </Card>

        <Card title={t('☢️ Radiação acumulada (carreira)', '☢️ Cumulative radiation (career)')} right={<Badge s={a.radiation.severity} />}
          className={a.radiation.solarActive ? 'ring-2 ring-critical/70' : ''}>
          <div className="relative h-5 w-full rounded-full bg-surface-3">
            <div className="absolute inset-y-0 left-0 overflow-hidden rounded-full" style={{ width: `${Math.min(100, a.radiation.pct)}%` }}>
              <motion.div className="h-full" initial={{ width: 0 }} animate={{ width: '100%' }} style={{ background: SEVERITY_COLOR[a.radiation.severity] }} />
            </div>
            {a.radiation.eventDose > 0 && (
              <div className={`absolute inset-y-0 rounded-r-full bg-critical ${a.radiation.solarActive ? 'animate-pulse' : ''}`} title={t('Dose de eventos solares', 'Solar event dose')}
                style={{ left: `${Math.min(100, ((a.radiation.total - a.radiation.eventDose) / RADIATION.careerLimitMSv) * 100)}%`, width: `${Math.max(0.6, Math.min(100, (a.radiation.eventDose / RADIATION.careerLimitMSv) * 100))}%` }} />
            )}
            {[50, 80, 100].map((m) => (
              <span key={m} className="absolute -top-1 bottom-[-4px] w-px bg-fg-2/70" style={{ left: `calc(${m}% - 1px)` }}>
                <span className="absolute top-6 -translate-x-1/2 font-mono text-[0.7rem] text-fg-3">{m}%</span>
              </span>
            ))}
          </div>
          <div className="mt-6 grid gap-1 text-body-sm text-fg-1 sm:grid-cols-3">
            <span><b className="font-mono">{a.radiation.total.toFixed(1)}</b> / {RADIATION.careerLimitMSv} mSv (<span className="font-mono">{a.radiation.pct.toFixed(1)}%</span>)</span>
            <span>{t('Missão', 'Mission')}: <span className="font-mono">{a.radiation.mission.toFixed(0)}</span> mSv · {a.radiation.days} d · {a.radiation.rate} mSv/{t('dia', 'day')}</span>
            <span>{t('Margem', 'Margin')}: ~<span className="font-mono">{Math.round(a.radiation.daysLeft)}</span> {t('dias em', 'days in')} {tr(ENVIRONMENTS[env].name)}</span>
          </div>
          {a.radiation.eventDose > 0 && <p className="mt-1 text-body-sm text-critical">☢️ {t('Eventos solares', 'Solar events')}: +<span className="font-mono">{a.radiation.eventDose.toFixed(2)}</span> mSv{a.radiation.solarActive ? ` · ${t('subindo agora', 'rising now')}` : ''}</p>}
          <p className="mt-1 text-meta text-fg-2">{tr(ENVIRONMENTS[env].radiationNote)} {t('Marcadores 50/80/100% = heurística do protótipo.', '50/80/100% markers = prototype heuristic.')}</p>
          <SourceLinks sources={[RADIATION.source, SOURCES.donki]} />
        </Card>
      </div>
    </div>
  )
}

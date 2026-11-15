import { Component, lazy, Suspense, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import BodyMap from './BodyMap'
import type { ModelId } from './Body3D'
import { Badge, Card, SourceLinks } from './ui'
import { SOURCES, BODY_REGIONS, BONE, ENVIRONMENTS, HAZARDS, INDICATORS, RADIATION, SEVERITY_COLOR } from '../lib/knowledge'
import type { BodyRegionId } from '../lib/knowledge'
import type { CrewAssessment } from '../lib/assessment'
import { useStore } from '../lib/store'
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

export default function Dashboard({ a }: { a: CrewAssessment }) {
  const [region, setRegion] = useState<BodyRegionId | null>('heart')
  const [view, setView] = useState<'3d' | '2d'>(() => (hasWebGL() ? '3d' : '2d'))
  const [model, setModel] = useState<ModelId>('muscular')
  const env = useStore((s) => s.env)
  const setTab = useStore((s) => s.setTab)
  const info = region ? BODY_REGIONS[region] : null
  const map2d = <BodyMap regions={a.regions} selected={region} onSelect={setRegion} />

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(300px,400px)_1fr]">
      <Card title={t('Mapa corporal', 'Body map')} right={
        <div className="flex gap-1 text-[11px]">
          {(['3d', '2d'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`rounded-md border px-2 py-0.5 ${view === v ? 'border-sky-400 text-sky-200' : 'border-slate-600 text-slate-400'}`}>{v.toUpperCase()}</button>
          ))}
        </div>}>
        {view === '3d' ? (
          <>
            <div className="mb-2 flex justify-center gap-1 text-[11px]">
              {([['muscular', t('💪 Músculos', '💪 Muscles')], ['skeleton', t('🦴 Esqueleto', '🦴 Skeleton')]] as [ModelId, string][]).map(([m, lbl]) => (
                <button key={m} onClick={() => setModel(m)} className={`rounded-full border px-2 py-0.5 ${model === m ? 'border-sky-400 bg-sky-500/10 text-sky-200' : 'border-slate-600 text-slate-400'}`}>{lbl}</button>
              ))}
            </div>
            <Fallback3D fallback={map2d}>
              <Suspense fallback={map2d}>
                <Body3D regions={a.regions} selected={region} onSelect={setRegion} model={model} />
              </Suspense>
            </Fallback3D>
          </>
        ) : map2d}
        <div className="mt-2 flex flex-wrap justify-center gap-1">
          {(Object.keys(BODY_REGIONS) as BodyRegionId[]).map((r) => (
            <button key={r} onClick={() => setRegion(r)}
              className={`rounded-full border px-2 py-0.5 text-[11px] ${region === r ? 'border-sky-400 text-sky-200' : 'border-slate-600 text-slate-400'}`}>
              <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: SEVERITY_COLOR[a.regions[r]] }} />
              {tr(BODY_REGIONS[r].short)}
            </button>
          ))}
        </div>
      </Card>

      <div className="space-y-4">
        <AnimatePresence mode="wait">
          {info && region && (
            <motion.div key={region} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <Card title={tr(info.name)} right={<Badge s={a.regions[region]} />}>
                <p className="text-sm text-slate-300">{tr(info.fn)}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {info.hazards.map((h) => (
                    <span key={h} title={tr(HAZARDS[h].summary)} className="rounded-md bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">{HAZARDS[h].icon} {tr(HAZARDS[h].name)}</span>
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
                        <div className="mt-1 text-xl font-bold">{f.value}</div>
                        {f.delta && <div className="text-[11px] text-slate-400">{tr(f.delta)}</div>}
                        <p className="mt-1 text-[11px] text-slate-400">🌌 {tr(ind.spaceEffect)}</p>
                        {f.reasons.length > 0 && <ul className="mt-1 list-disc pl-4 text-[11px] text-slate-300">{f.reasons.map((r) => <li key={r.en}>{tr(r)}</li>)}</ul>}
                        <p className="mt-2 text-xs text-sky-200">👉 {tr(ind.actions[f.severity])}</p>
                      </div>
                    )
                  })}
                  {region === 'musculoskeletal' && (
                    <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3 sm:col-span-2">
                      <div className="flex items-center justify-between"><span className="text-xs text-slate-400">{t('Perda óssea estimada', 'Estimated bone loss')}</span><Badge s={a.bone.severity} /></div>
                      <div className="mt-1 text-xl font-bold">{a.bone.low.toFixed(1)}–{a.bone.high.toFixed(1)}%</div>
                      <div className="text-[11px] text-slate-400">{t(`${a.bone.days} dias em gravidade reduzida · adesão ao exercício ${(a.bone.adherence * 100).toFixed(0)}% (meta 120 min/dia)`, `${a.bone.days} days in reduced gravity · exercise adherence ${(a.bone.adherence * 100).toFixed(0)}% (target 120 min/day)`)}</div>
                      <p className="mt-1 text-[11px] text-slate-400">{tr(BONE.note)}</p>
                      <p className="mt-2 text-xs text-sky-200">👉 {t('Exercício resistido (ARED) + aeróbico diário, cálcio e vitamina D conforme plano.', 'Resistive (ARED) + daily aerobic exercise, calcium and vitamin D per plan.')}</p>
                      <SourceLinks sources={[BONE.source, SOURCES.gravity]} />
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {a.findings.map((f) => {
            const ind = INDICATORS[f.indicator as keyof typeof INDICATORS]
            return (
              <button key={f.indicator} onClick={() => setTab('trends')}
                className="rounded-xl border bg-slate-900/70 p-3 text-left transition hover:scale-[1.02]"
                style={{ borderColor: SEVERITY_COLOR[f.severity] + '88' }}>
                <div className="text-[11px] text-slate-400">{tr(ind.name)}</div>
                <div className="text-lg font-bold">{f.value}</div>
                <Badge s={f.severity} />
              </button>
            )
          })}
        </div>

        <Card title={t('☢️ Radiação acumulada (carreira)', '☢️ Cumulative radiation (career)')} right={<Badge s={a.radiation.severity} />}>
          <div className="h-4 w-full overflow-hidden rounded-full bg-slate-800">
            <motion.div className="h-full" initial={{ width: 0 }} animate={{ width: `${Math.min(100, a.radiation.pct)}%` }}
              style={{ background: SEVERITY_COLOR[a.radiation.severity] }} />
          </div>
          <div className="mt-2 grid gap-1 text-xs text-slate-300 sm:grid-cols-3">
            <span><b>{a.radiation.total.toFixed(0)}</b> / {RADIATION.careerLimitMSv} mSv ({a.radiation.pct.toFixed(0)}%)</span>
            <span>{t('Missão', 'Mission')}: {a.radiation.mission.toFixed(0)} mSv · {a.radiation.days} d · {a.radiation.rate} mSv/{t('dia', 'day')} ({tr(ENVIRONMENTS[env].name)})</span>
            <span>{t('Margem', 'Margin')}: ~{Math.round(a.radiation.daysLeft)} {t('dias neste ambiente', 'days in this environment')}</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">{tr(ENVIRONMENTS[env].radiationNote)} {t('Faixas de % do limite (50/80/100%) são heurística do protótipo.', '% of limit bands (50/80/100%) are a prototype heuristic.')}</p>
          <SourceLinks sources={[RADIATION.source]} />
        </Card>
      </div>
    </div>
  )
}

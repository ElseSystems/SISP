import { useState } from 'react'
import { motion } from 'framer-motion'
import { Badge, Card, SourceLinks } from './ui'
import CommLink from './CommLink'
import FlightSurgeonReport from './FlightSurgeonReport'
import { SOURCES, ENVIRONMENTS, INDICATORS, SEVERITY_COLOR } from '../lib/knowledge'
import type { Severity } from '../lib/knowledge'
import type { CrewAssessment } from '../lib/assessment'
import { escalationPlan } from '../lib/escalation'
import { useStore } from '../lib/store'
import type { CrewMember } from '../lib/types'
import { statusChange } from '../lib/motion'
import { t, tr } from '../lib/i18n'

export default function Ground({ c, a, met }: { c: CrewMember; a: CrewAssessment; met: string }) {
  const env = useStore((s) => s.env)
  const setEnv = useStore((s) => s.setEnv)
  const setTab = useStore((s) => s.setTab)
  const [sending, setSending] = useState(0)
  const plan = escalationPlan(a.overall, env)
  const e = ENVIRONMENTS[env]
  const color = SEVERITY_COLOR[a.overall]
  const issues = [
    ...a.findings.filter((f) => f.severity > 0).map((f) => ({ key: f.indicator, name: tr(INDICATORS[f.indicator as keyof typeof INDICATORS].name), value: f.value, s: f.severity, reasons: f.reasons.map(tr), action: tr(INDICATORS[f.indicator as keyof typeof INDICATORS].actions[f.severity]) })),
    ...(a.radiation.severity > 0 ? [{ key: 'rad', name: t('Radiação', 'Radiation'), value: `${a.radiation.total.toFixed(0)} mSv`, s: a.radiation.severity, reasons: a.radiation.reasons.map(tr), action: a.radiation.solarActive ? t('Abrigo até a liberação; registre a dose do dosímetro.', 'Shelter until all-clear; log the dosimeter reading.') : t('Planeje EVA/atividades para reduzir exposição.', 'Plan EVA/activities to reduce exposure.') }] : []),
    ...(a.fatigue.severity > 0 ? [{ key: 'pvt', name: t('Fadiga (PVT)', 'Fatigue (PVT)'), value: `${a.fatigue.latest?.medianMs} ms`, s: a.fatigue.severity, reasons: a.fatigue.reasons.map(tr), action: t('Evite tarefas críticas; sono/cochilo e refaça o PVT.', 'Avoid critical tasks; sleep/nap and repeat the PVT.') }] : []),
  ].sort((x, y) => y.s - x.s)

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <div className="space-y-4 lg:col-span-7">
        <Card title={t('O que fazer agora', 'What to do now')}>
          <motion.div key={a.overall + env} initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={statusChange}
            className="rounded-2xl p-5" style={{ background: `color-mix(in oklab, ${color} 10%, transparent)`, border: `1px solid color-mix(in oklab, ${color} 50%, transparent)` }}>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="mr-auto font-display text-display-sm font-bold" style={{ color }}>{plan.headline}</h2>
              <Badge s={a.overall} size="lg" showLevel />
            </div>
            <p className="mt-1 text-body text-fg-1">📞 {plan.contact}</p>
            <ol className="mt-3 space-y-2">
              {plan.steps.map((s, i) => (
                <li key={s} className="flex gap-3 text-body text-fg-1">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-body-sm font-bold" style={{ background: color, color: '#01030B' }}>{i + 1}</span>{s}
                </li>
              ))}
            </ol>
            {a.overall === 3 && <button onClick={() => setTab('emergency')} className="mt-4 rounded-lg bg-critical px-4 py-2 font-bold text-[#01030B] shadow-glow-critical">🚨 {t('Abrir protocolo de emergência', 'Open emergency protocol')} →</button>}
          </motion.div>
          <div className="mt-4 space-y-2">
            {issues.length === 0 && <p className="text-body-sm text-fg-2">{t('Nenhum indicador fora do padrão hoje. 🎉', 'No indicator out of range today. 🎉')}</p>}
            {issues.map((f) => (
              <div key={f.key} className="rounded-lg border border-line bg-surface-1 p-3" style={{ borderLeft: `3px solid ${SEVERITY_COLOR[f.s]}` }}>
                <div className="flex items-center justify-between gap-2 text-body-sm font-semibold text-fg-1">{f.name}: <span className="mr-auto font-mono">{f.value}</span><Badge s={f.s} /></div>
                <p className="text-meta text-fg-2">{f.reasons.join(' · ')}</p>
                <p className="mt-1 border-l-2 border-accent bg-accent/5 px-2 py-1 text-body-sm text-sky-100">👉 {f.action}</p>
              </div>
            ))}
          </div>
        </Card>
        <FlightSurgeonReport c={c} a={a} met={met} onSend={() => setSending((n) => n + 1)} />
      </div>

      <div className="space-y-4 lg:col-span-5">
        <Card title={t('📡 Atraso de comunicação e autonomia', '📡 Communication delay and autonomy')}>
          <CommLink env={env} onSelect={setEnv} sending={sending} />
          <p className="mt-3 text-body-sm text-fg-1">
            {plan.autonomous
              ? t(`Em ${tr(e.name)} a tripulação age primeiro: o solo só responde depois de ≥ ${plan.roundTrip}. O SISP prioriza passos autônomos e gera um relatório assíncrono.`, `In ${tr(e.name)} the crew acts first: the ground can only reply after ≥ ${plan.roundTrip}. SISP prioritizes autonomous steps and builds an asynchronous report.`)
              : t(`Em ${tr(e.name)} o contato com o solo é praticamente em tempo real: priorize a conferência médica com o flight surgeon.`, `In ${tr(e.name)} ground contact is near real time: prioritize the medical conference with the flight surgeon.`)}
          </p>
          <p className="mt-1 text-meta text-fg-3">{t('Clique num destino para mudar o ambiente.', 'Click a destination to switch environment.')} {tr(e.evacuation)}.</p>
          <SourceLinks sources={[SOURCES.distance]} />
        </Card>
        <Card title={t('🪜 Escada de escalonamento', '🪜 Escalation ladder')}>
          <ol className="flex flex-col-reverse gap-1.5">
            {([0, 1, 2, 3] as Severity[]).map((s) => {
              const on = s === a.overall
              return (
                <li key={s} className={`flex items-center gap-3 rounded-xl border p-2.5 transition ${on ? 'bg-surface-2' : 'border-line-subtle opacity-60'}`}
                  style={on ? { borderColor: SEVERITY_COLOR[s], boxShadow: `0 0 18px color-mix(in oklab, ${SEVERITY_COLOR[s]} 35%, transparent)` } : undefined}>
                  <Badge s={s} showLevel />
                  <span className="text-body-sm text-fg-1">{escalationPlan(s, env).contact}</span>
                  {on && <span className="ml-auto font-mono text-meta text-fg-2">◀ {t('agora', 'now')}</span>}
                </li>
              )
            })}
          </ol>
        </Card>
      </div>
    </div>
  )
}

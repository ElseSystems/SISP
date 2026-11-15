import { motion } from 'framer-motion'
import { Badge, Card, SourceLinks } from './ui'
import { SOURCES, ENVIRONMENTS, INDICATORS, SEVERITY_COLOR, SEVERITY_LABEL } from '../lib/knowledge'
import type { EnvironmentId, Severity } from '../lib/knowledge'
import type { CrewAssessment } from '../lib/assessment'
import { escalationPlan, fmtDelay } from '../lib/escalation'
import { useStore } from '../lib/store'
import type { CrewMember } from '../lib/types'
import { t, tr } from '../lib/i18n'

export default function Ground({ c, a }: { c: CrewMember; a: CrewAssessment }) {
  const env = useStore((s) => s.env)
  const plan = escalationPlan(a.overall, env)
  const e = ENVIRONMENTS[env]
  const issues = a.findings.filter((f) => f.severity > 0).sort((x, y) => y.severity - x.severity)
  const report = [
    `${t('RELATÓRIO MÉDICO', 'MEDICAL REPORT')} · ${tr(c.name)} (${tr(c.role)}) · ${c.readings.at(-1)?.date} · ${tr(e.name)}`,
    `${t('Status geral', 'Overall status')}: ${tr(SEVERITY_LABEL[a.overall])}`,
    ...a.findings.map((f) => `- ${tr(INDICATORS[f.indicator as keyof typeof INDICATORS].name)}: ${f.value} [${tr(SEVERITY_LABEL[f.severity])}] ${f.reasons.map(tr).join('; ')}`),
    `- ${t('Radiação', 'Radiation')}: ${a.radiation.total.toFixed(0)} mSv (${a.radiation.pct.toFixed(0)}% ${t('do limite de carreira', 'of career limit')})`,
    `- ${t('Perda óssea estimada', 'Estimated bone loss')}: ${a.bone.low.toFixed(1)}–${a.bone.high.toFixed(1)}%`,
    `${t('Ações já tomadas a bordo', 'Actions already taken on board')}: ________`,
  ].join('\n')

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title={t('O que fazer agora', 'What to do now')} right={<Badge s={a.overall} />}>
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="rounded-xl p-4" style={{ background: SEVERITY_COLOR[a.overall] + '1f', border: `1px solid ${SEVERITY_COLOR[a.overall]}77` }}>
          <div className="text-2xl font-black" style={{ color: SEVERITY_COLOR[a.overall] }}>{plan.headline}</div>
          <div className="mt-1 text-sm text-slate-200">📞 {plan.contact}</div>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-200">{plan.steps.map((s) => <li key={s}>{s}</li>)}</ol>
        </motion.div>
        <div className="mt-4 space-y-2">
          {issues.length === 0 && <p className="text-sm text-slate-400">{t('Nenhum indicador fora do padrão hoje. 🎉', 'No indicator out of range today. 🎉')}</p>}
          {issues.map((f) => {
            const ind = INDICATORS[f.indicator as keyof typeof INDICATORS]
            return (
              <div key={f.indicator} className="rounded-lg border border-slate-700 p-3">
                <div className="flex items-center justify-between text-sm font-semibold">{tr(ind.name)}: {f.value}<Badge s={f.severity} /></div>
                <p className="text-[11px] text-slate-400">{f.reasons.map(tr).join(' · ')}</p>
                <p className="mt-1 text-xs text-sky-200">👉 {tr(ind.actions[f.severity])}</p>
              </div>
            )
          })}
        </div>
      </Card>

      <div className="space-y-4">
        <Card title={t('📡 Atraso de comunicação e autonomia', '📡 Communication delay and autonomy')}>
          <div className="grid grid-cols-2 gap-2 text-center">
            {(Object.keys(ENVIRONMENTS) as EnvironmentId[]).map((id) => {
              const x = ENVIRONMENTS[id]
              return (
                <div key={id} className={`rounded-xl border p-2 ${id === env ? 'border-sky-400 bg-sky-500/10' : 'border-slate-700 opacity-70'}`}>
                  <div className="text-2xl">{x.emoji}</div>
                  <div className="text-xs font-semibold">{tr(x.name)}</div>
                  <div className="text-[11px] text-slate-400">{t('ida e volta', 'round trip')} {fmtDelay(x.delaySecOneWay * 2)}</div>
                  <div className="text-[11px] text-slate-400">{tr(x.evacuation)}</div>
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-xs text-slate-300">
            {plan.autonomous
              ? t(`Em ${tr(e.name)} a tripulação age primeiro: o solo só responde depois de ≥ ${plan.roundTrip}. O app prioriza passos autônomos e gera um relatório assíncrono.`, `In ${tr(e.name)} the crew acts first: the ground can only reply after ≥ ${plan.roundTrip}. The app prioritizes autonomous steps and builds an asynchronous report.`)
              : t(`Em ${tr(e.name)} o contato com o solo é praticamente em tempo real: priorize a conferência médica com o flight surgeon.`, `In ${tr(e.name)} ground contact is near real time: prioritize the medical conference with the flight surgeon.`)}
          </p>
          <SourceLinks sources={[SOURCES.distance]} />
          <div className="mt-3 space-y-1 text-[11px] text-slate-400">
            {([0, 1, 2, 3] as Severity[]).map((s) => <div key={s}><Badge s={s} /> {escalationPlan(s, env).contact}</div>)}
          </div>
        </Card>
        <Card title={t('📝 Relatório para o solo (copiar e enviar)', '📝 Report to ground (copy and send)')}>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-[11px] text-slate-300">{report}</pre>
          <button onClick={() => navigator.clipboard?.writeText(report)} className="mt-2 rounded-lg bg-slate-700 px-3 py-1.5 text-xs hover:bg-slate-600">{t('Copiar relatório', 'Copy report')}</button>
        </Card>
      </div>
    </div>
  )
}

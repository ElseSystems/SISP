import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, SourceLinks } from './ui'
import { INDICATORS, SEVERITY_COLOR } from '../lib/knowledge'
import type { IndicatorId } from '../lib/knowledge'
import { baselineOf } from '../lib/assessment'
import type { CrewMember, Reading } from '../lib/types'
import { t, tr } from '../lib/i18n'

const cfg_ = (): { id: IndicatorId; keys: (keyof Reading)[]; domain: [number, number]; names: string[] }[] => [
  { id: 'bp', keys: ['sys', 'dia'], domain: [50, 190], names: [t('Sistólica', 'Systolic'), t('Diastólica', 'Diastolic')] },
  { id: 'hr', keys: ['hr'], domain: [40, 120], names: [t('FC', 'HR')] },
  { id: 'glucose', keys: ['glucose'], domain: [40, 160], names: [t('Glicemia', 'Glucose')] },
  { id: 'temp', keys: ['temp'], domain: [35.5, 39], names: [t('Temperatura', 'Temperature')] },
  { id: 'sleep', keys: ['sleep'], domain: [2, 10], names: [t('Sono', 'Sleep')] },
  { id: 'mood', keys: ['mood'], domain: [1, 5], names: [t('Humor', 'Mood')] },
]
const LINE = ['#38bdf8', '#a78bfa']

export default function Trends({ c }: { c: CrewMember }) {
  const data = c.readings.map((r) => ({ ...r, label: r.date.slice(5) }))
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {cfg_().map((cfg) => {
        const ind = INDICATORS[cfg.id]
        const base = baselineOf(c.readings, cfg.keys[0], Math.max(0, c.readings.length - 1))
        return (
          <Card key={cfg.id} title={`${tr(ind.name)} (${ind.unit})`}>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: -15 }}>
                  {ind.bands.map((b) => (
                    <ReferenceArea key={b.label.en} y1={Math.max(b.from, cfg.domain[0])} y2={Math.min(b.to, cfg.domain[1])}
                      fill={SEVERITY_COLOR[b.severity]} fillOpacity={0.09} ifOverflow="hidden" />
                  ))}
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={4} />
                  <YAxis domain={cfg.domain} tick={{ fill: '#94a3b8', fontSize: 10 }} allowDataOverflow />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                  {!Number.isNaN(base.mean) && (
                    <ReferenceLine y={+base.mean.toFixed(1)} stroke="#e2e8f0" strokeDasharray="5 4"
                      label={{ value: `${t('base', 'baseline')} ${base.mean.toFixed(1)}`, fill: '#cbd5e1', fontSize: 10, position: 'insideTopLeft' }} />
                  )}
                  {cfg.id === 'temp' && <ReferenceLine y={38} stroke="#f97316" label={{ value: '38 °C CDC', fill: '#fdba74', fontSize: 10, position: 'insideBottomRight' }} />}
                  {cfg.id === 'sleep' && <ReferenceLine y={6.09} stroke="#a78bfa" strokeDasharray="2 3" label={{ value: t('média ISS 6,09 h', 'ISS avg 6.09 h'), fill: '#c4b5fd', fontSize: 10, position: 'insideBottomRight' }} />}
                  {cfg.keys.map((k, i) => (
                    <Line isAnimationActive={false} key={k as string} type="monotone" dataKey={k as string} name={cfg.names[i]} stroke={LINE[i]} strokeWidth={2}
                      dot={(p: { cx?: number; cy?: number; payload?: Reading; index?: number }) => (
                        <circle key={p.index} cx={p.cx} cy={p.cy} r={p.payload?.source === 'manual' ? 4 : 1.5} fill={p.payload?.source === 'manual' ? '#facc15' : LINE[i]} />
                      )} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-slate-400">
              {ind.bands.map((b) => <span key={b.label.en}><span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: SEVERITY_COLOR[b.severity] }} />{tr(b.label)}</span>)}
              <span>{t('· tracejado = sua linha de base (14 d) · ● amarelo = check-in manual', '· dashed = your 14-day baseline · ● yellow = manual check-in')}</span>
            </div>
            <SourceLinks sources={ind.sources} />
          </Card>
        )
      })}
    </div>
  )
}

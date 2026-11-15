import { useReducedMotion } from 'framer-motion'
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge, Card, SourceLinks } from './ui'
import { INDICATORS, SEVERITY_COLOR, SEVERITY_LABEL } from '../lib/knowledge'
import type { IndicatorId } from '../lib/knowledge'
import { assessReading, baselineOf } from '../lib/assessment'
import type { CrewMember, Reading } from '../lib/types'
import { t, tr } from '../lib/i18n'

interface Cfg { id: IndicatorId; keys: (keyof Reading)[]; domain: [number, number]; names: string[]; unit: string; fmt: (r: Reading) => string; wide?: boolean }
const cfg_ = (): Cfg[] => [
  { id: 'bp', keys: ['sys', 'dia'], domain: [50, 190], names: [t('Sistólica', 'Systolic'), t('Diastólica', 'Diastolic')], unit: 'mmHg', fmt: (r) => `${r.sys}/${r.dia}`, wide: true },
  { id: 'glucose', keys: ['glucose'], domain: [40, 160], names: [t('Glicemia', 'Glucose')], unit: 'mg/dL', fmt: (r) => `${r.glucose}`, wide: true },
  { id: 'hr', keys: ['hr'], domain: [40, 120], names: [t('FC', 'HR')], unit: 'bpm', fmt: (r) => `${r.hr}` },
  { id: 'temp', keys: ['temp'], domain: [35.5, 39], names: [t('Temperatura', 'Temperature')], unit: '°C', fmt: (r) => r.temp.toFixed(1) },
  { id: 'sleep', keys: ['sleep'], domain: [2, 10], names: [t('Sono', 'Sleep')], unit: 'h', fmt: (r) => r.sleep.toFixed(1) },
  { id: 'mood', keys: ['mood'], domain: [1, 5], names: [t('Humor', 'Mood')], unit: '/5', fmt: (r) => `${r.mood}` },
]
const LINE = ['#5CC8FF', '#A78BFA']
const TICK = { fill: '#7F8BA3', fontSize: 12 }

export default function Trends({ c }: { c: CrewMember }) {
  const reduce = useReducedMotion()
  const data = c.readings.map((r) => ({ ...r, label: r.date.slice(5) }))
  const findings = c.readings.length ? assessReading(c.readings, c.readings.length - 1) : []
  const last = c.readings.at(-1)
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {cfg_().map((cfg) => {
        const ind = INDICATORS[cfg.id]
        const base = baselineOf(c.readings, cfg.keys[0], Math.max(0, c.readings.length - 1))
        const f = findings.find((x) => x.indicator === cfg.id)
        const sev = f?.severity ?? 0
        const nominal = ind.bands.filter((b) => b.severity === 0)
        const limits = ind.bands.filter((b) => b.severity > 0).flatMap((b) => [b.from, b.to].filter((v) => v > cfg.domain[0] && v < cfg.domain[1]).map((v) => ({ v, s: b.severity })))
        const uniq = [...new Map(limits.map((x) => [x.v, x])).values()]
        const delta = last && !Number.isNaN(base.mean) ? Number(last[cfg.keys[0]]) - base.mean : NaN
        return (
          <Card key={cfg.id} className={cfg.wide ? 'md:col-span-2' : ''}
            title={<span>{tr(ind.name)} <span className="font-mono font-normal text-fg-3">({cfg.unit})</span></span>}
            right={<div className="flex items-center gap-3">
              {last && <span className="font-mono text-metric font-bold text-fg-1">{cfg.fmt(last)}<span className="ml-1 text-body-sm font-normal text-fg-3">{cfg.unit}</span></span>}
              {!Number.isNaN(delta) && <span className="font-mono text-body-sm" style={{ color: SEVERITY_COLOR[sev] }}>{delta >= 0 ? '▲' : '▼'} {delta >= 0 ? '+' : ''}{Math.abs(delta) < 10 ? delta.toFixed(1) : delta.toFixed(0)} {t('vs base', 'vs base')}</span>}
              <Badge s={sev} />
            </div>}>
            <div className={cfg.wide ? 'h-64' : 'h-56'}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} syncId="sisp" margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                  {nominal.map((b) => (
                    <ReferenceArea key={b.label.en} y1={Math.max(b.from, cfg.domain[0])} y2={Math.min(b.to, cfg.domain[1])} fill="#34D399" fillOpacity={0.06} ifOverflow="hidden" />
                  ))}
                  {uniq.map((x) => <ReferenceLine key={x.v} y={x.v} stroke={SEVERITY_COLOR[x.s]} strokeOpacity={0.55} strokeDasharray="4 4" />)}
                  <CartesianGrid stroke="rgba(148,163,184,.08)" />
                  <XAxis dataKey="label" tick={TICK} interval={4} stroke="rgba(148,163,184,.2)" />
                  <YAxis domain={cfg.domain} tick={TICK} allowDataOverflow stroke="rgba(148,163,184,.2)" />
                  <Tooltip content={<Tip cfg={cfg} c={c} />} cursor={{ stroke: 'rgba(234,240,250,0.35)' }} />
                  {!Number.isNaN(base.mean) && (
                    <ReferenceLine y={+base.mean.toFixed(1)} stroke="#EAF0FA" strokeOpacity={0.7} strokeDasharray="6 4"
                      label={{ value: `${t('base', 'baseline')} ${base.mean.toFixed(1)}`, fill: '#AAB6CB', fontSize: 12, position: 'insideTopLeft' }} />
                  )}
                  {cfg.id === 'temp' && <ReferenceLine y={38} stroke="#FB923C" label={{ value: '38 °C CDC', fill: '#FDBA74', fontSize: 12, position: 'insideBottomRight' }} />}
                  {cfg.id === 'sleep' && <ReferenceLine y={6.09} stroke="#A78BFA" strokeDasharray="2 3" label={{ value: t('média ISS 6,09 h', 'ISS avg 6.09 h'), fill: '#C4B5FD', fontSize: 12, position: 'insideBottomRight' }} />}
                  {cfg.keys.map((k, i) => (
                    <Line isAnimationActive={!reduce} animationDuration={600} key={k as string} type="monotone" dataKey={k as string} name={cfg.names[i]} stroke={LINE[i]} strokeWidth={2.25}
                      activeDot={{ r: 5, stroke: '#01030B', strokeWidth: 2 }}
                      dot={(p: { cx?: number; cy?: number; payload?: Reading; index?: number }) => (
                        p.payload?.source === 'manual'
                          ? <circle key={p.index} cx={p.cx} cy={p.cy} r={4.5} fill={LINE[i]} stroke="#EAF0FA" strokeWidth={2} />
                          : <circle key={p.index} cx={p.cx} cy={p.cy} r={1.5} fill={LINE[i]} />
                      )} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-meta text-fg-2">
              {ind.bands.map((b) => <span key={b.label.en}><span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: SEVERITY_COLOR[b.severity] }} />{tr(b.label)}</span>)}
              <span className="text-fg-3">{t('· tracejado branco = sua base (14 d) · ◉ = check-in manual', '· white dashed = your 14-day baseline · ◉ = manual check-in')}</span>
            </div>
            {f && f.reasons.length > 0 && <p className="mt-1 text-meta text-fg-1">{f.reasons.map(tr).join(' · ')}</p>}
            <SourceLinks sources={ind.sources} />
          </Card>
        )
      })}
    </div>
  )
}

function Tip({ active, payload, label, cfg, c }: { active?: boolean; payload?: { payload: Reading }[]; label?: string; cfg: Cfg; c: CrewMember }) {
  if (!active || !payload?.length) return null
  const r = payload[0].payload
  const idx = c.readings.findIndex((x) => x.date === r.date)
  const f = idx >= 0 ? assessReading(c.readings, idx).find((x) => x.indicator === cfg.id) : undefined
  const s = f?.severity ?? 0
  return (
    <div className="rounded-lg border border-line-strong bg-surface-1 px-3 py-2 text-body-sm shadow-xl">
      <div className="font-mono text-meta text-fg-3">{label} · {r.source === 'manual' ? t('check-in manual', 'manual check-in') : t('simulado', 'simulated')}</div>
      <div className="font-mono text-title font-bold text-fg-1">{cfg.fmt(r)} <span className="text-body-sm font-normal text-fg-3">{cfg.unit}</span></div>
      <div className="text-meta" style={{ color: SEVERITY_COLOR[s] }}>{tr(SEVERITY_LABEL[s])}</div>
    </div>
  )
}

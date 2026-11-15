import { motion, useReducedMotion } from 'framer-motion'
import { ENVIRONMENTS } from '../lib/knowledge'
import type { EnvironmentId } from '../lib/knowledge'
import { fmtDelay } from '../lib/escalation'
import { t, tr } from '../lib/i18n'

/** Earth ⟷ destination diagram; signal pulse speed is the real delay compressed on a log scale. */
export default function CommLink({ env, onSelect, sending }: { env: EnvironmentId; onSelect?: (e: EnvironmentId) => void; sending?: number }) {
  const reduce = useReducedMotion()
  const ids = Object.keys(ENVIRONMENTS) as EnvironmentId[]
  const OFFSET: Record<EnvironmentId, number> = { iss: 0, moonBase: 30, marsTransit: -50, marsBase: 0 }
  const BELOW: Record<EnvironmentId, boolean> = { iss: false, moonBase: true, marsTransit: false, marsBase: true }
  const x = (id: EnvironmentId) => 140 + Math.log10(1 + ENVIRONMENTS[id].delaySecOneWay * 4) / Math.log10(1 + 1200 * 4) * 540 + OFFSET[id]
  // animated one-way: ISS ~1 s, Moon ~2.6 s, Mars ~6 s (log-compressed)
  const animSec = (id: EnvironmentId) => 0.8 + Math.log10(1 + ENVIRONMENTS[id].delaySecOneWay) * 1.6
  const e = ENVIRONMENTS[env]
  const cur = x(env)
  return (
    <div>
      <svg viewBox="0 0 720 150" className="w-full" role="img" aria-label={t(`Atraso de comunicação: ${fmtDelay(e.delaySecOneWay)} só ida`, `Communication delay: ${fmtDelay(e.delaySecOneWay)} one-way`)}>
        <defs>
          <radialGradient id="earth" cx="40%" cy="35%"><stop offset="0%" stopColor="#7dd3fc" /><stop offset="60%" stopColor="#2563eb" /><stop offset="100%" stopColor="#0b1a3a" /></radialGradient>
          <linearGradient id="beam" x1="0" x2="1"><stop offset="0%" stopColor="#5CC8FF" stopOpacity="0.6" /><stop offset="100%" stopColor="#5CC8FF" stopOpacity="0.05" /></linearGradient>
        </defs>
        <line x1="60" y1="70" x2="700" y2="70" stroke="rgba(148,163,184,0.18)" strokeDasharray="3 6" />
        <line x1="60" y1="70" x2={cur} y2="70" stroke="url(#beam)" strokeWidth="3" />
        <circle cx="50" cy="70" r="30" fill="url(#earth)" />
        <text x="50" y="118" textAnchor="middle" fontSize="12" fill="#AAB6CB">{t('Terra · solo', 'Earth · ground')}</text>
        {ids.map((id) => {
          const on = id === env
          return (
            <g key={id} onClick={() => onSelect?.(id)} style={{ cursor: onSelect ? 'pointer' : undefined }} opacity={on ? 1 : 0.55}>
              <circle cx={x(id)} cy="70" r={on ? 22 : 16} fill={on ? 'rgba(92,200,255,0.15)' : 'rgba(15,22,40,0.9)'} stroke={on ? '#5CC8FF' : 'rgba(148,163,184,0.35)'} strokeWidth={on ? 2 : 1} />
              <text x={x(id)} y="77" textAnchor="middle" fontSize={on ? 20 : 15}>{ENVIRONMENTS[id].emoji}</text>
              <text x={x(id)} y={BELOW[id] ? 112 : 26} textAnchor="middle" fontSize="11.5" fill={on ? '#EAF0FA' : '#7F8BA3'} fontWeight={on ? 700 : 400}>{tr(ENVIRONMENTS[id].name)}</text>
              <text x={x(id)} y={BELOW[id] ? 127 : 41} textAnchor="middle" fontSize="11" fill={on ? '#5CC8FF' : '#7F8BA3'} fontFamily="JetBrains Mono, monospace">{fmtDelay(ENVIRONMENTS[id].delaySecOneWay)}</text>
            </g>
          )
        })}
        {!reduce && (
          <>
            <motion.circle key={`${env}-up-${sending ?? 0}`} r="5" cy="70" fill="#8BD9FF" style={{ filter: 'drop-shadow(0 0 6px #5CC8FF)' }}
              initial={{ cx: cur }} animate={{ cx: 60 }} transition={{ duration: animSec(env), repeat: sending ? 0 : Infinity, repeatDelay: 1.2, ease: 'linear' }} />
            <motion.circle key={`${env}-down-${sending ?? 0}`} r="4" cy="70" fill="#34D399" opacity={0.85}
              initial={{ cx: 60 }} animate={{ cx: cur }} transition={{ duration: animSec(env), delay: animSec(env) + 0.6, repeat: sending ? 0 : Infinity, repeatDelay: 1.2 + animSec(env), ease: 'linear' }} />
          </>
        )}
      </svg>
      <div className="mt-1 flex flex-wrap justify-between gap-2 text-meta text-fg-3">
        <span>● <span className="text-accent-strong">{t('relatório → solo', 'report → ground')}</span> · ● <span className="text-nominal">{t('resposta → tripulação', 'reply → crew')}</span></span>
        <span>{t('escala logarítmica · ida e volta', 'log scale · round trip')} <b className="font-mono text-fg-1">{fmtDelay(e.delaySecOneWay * 2)}</b></span>
      </div>
    </div>
  )
}

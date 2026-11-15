import { useState } from 'react'
import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { StatusBadge } from './StatusBadge'
import type { Severity } from '../lib/knowledge'
import { card } from '../lib/motion'
import { t } from '../lib/i18n'
import { Icon, IconText } from './Icon'

/** Back-compat wrapper: every status badge is now the shape + label StatusBadge. */
export function Badge(p: { s: Severity; className?: string; size?: 'sm' | 'md' | 'lg'; showLevel?: boolean; solid?: boolean }) {
  return <StatusBadge {...p} />
}

export function Card({ title, children, right, className = '', id }: { title?: ReactNode; children: ReactNode; right?: ReactNode; className?: string; id?: string }) {
  return (
    <motion.section id={id} variants={card} className={`glass rounded-2xl p-4 ${className}`}>
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="font-display text-body font-semibold tracking-wide text-sky-200">{typeof title === 'string' ? <IconText text={title} iconClassName="mr-0.5 text-sky-300" /> : title}</h2>}
          {right}
        </div>
      )}
      {children}
    </motion.section>
  )
}

export function SourceLinks({ sources }: { sources: { label: string; url: string }[] }) {
  return (
    <ul className="mt-2 space-y-0.5 text-meta text-fg-2">
      {sources.map((s) => (
        <li key={s.url}><Icon e="📎" className="mr-1 text-fg-3" /><a className="underline decoration-dotted hover:text-sky-300" href={s.url} target="_blank" rel="noreferrer">{s.label}</a></li>
      ))}
    </ul>
  )
}

/** Tiny axis-less trend line (SVG, no chart lib): last N values, latest point emphasised. */
export function Sparkline({ values, color, w = 120, h = 32, band }: { values: number[]; color: string; w?: number; h?: number; band?: [number, number] }) {
  const v = values.filter((x) => Number.isFinite(x))
  if (v.length < 2) return <svg width={w} height={h} aria-hidden />
  const lo = Math.min(...v, band?.[0] ?? Infinity), hi = Math.max(...v, band?.[1] ?? -Infinity)
  const span = hi - lo || 1
  const x = (i: number) => (i / (v.length - 1)) * (w - 4) + 2
  const y = (n: number) => h - 3 - ((n - lo) / span) * (h - 6)
  const d = v.map((n, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(n).toFixed(1)}`).join(' ')
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} height={h} preserveAspectRatio="none" aria-hidden className="overflow-visible">
      {band && <rect x={0} width={w} y={y(Math.min(band[1], hi))} height={Math.max(0, y(Math.max(band[0], lo)) - y(Math.min(band[1], hi)))} fill="var(--sisp-nominal)" opacity={0.08} />}
      <path d={d} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(v.length - 1)} cy={y(v[v.length - 1])} r={2.6} fill={color} />
    </svg>
  )
}

/** Copy-to-clipboard button with a short "Copied ✓" confirmation. */
export function CopyButton({ text, label, primary = false }: { text: string; label: string; primary?: boolean }) {
  const [ok, setOk] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(text) } catch {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove()
    }
    setOk(true); setTimeout(() => setOk(false), 1400)
  }
  return (
    <button type="button" onClick={copy}
      className={`rounded-lg px-3 py-1.5 text-body-sm font-semibold transition active:scale-95 ${primary ? 'bg-accent text-accent-ink hover:bg-accent-strong' : 'border border-line-strong text-fg-1 hover:bg-surface-3'}`}>
      {ok ? t('Copiado ✓', 'Copied ✓') : label}
    </button>
  )
}

export function Disclaimer() {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-meta text-amber-100">
      <Icon e="⚠️" className="mr-1 text-amber-300" />{t('SISP – protótipo educacional do NASA Space Apps. ', 'SISP – NASA Space Apps educational prototype. ')}
      <b>{t('Não é dispositivo médico', 'Not a medical device')}</b>
      {t(' nem protocolo da NASA.', ' nor a NASA protocol.')}{' '}
      <button onClick={() => setOpen(!open)} className="underline decoration-dotted" aria-expanded={open} aria-label={open ? t('Mostrar menos', 'Show less') : t('Mais informações', 'More information')}>{open ? t('menos', 'less') : 'ⓘ'}</button>
      {open && <span> {t('Faixas de diretrizes clínicas terrestres + heurísticas do protótipo; dados da tripulação são simulados; pulso pela câmera e PVT são estimativas. Em emergência real, siga o CMO e o flight surgeon.',
        'Terrestrial clinical guideline ranges + prototype heuristics; crew data is simulated; camera pulse and PVT are estimates. In a real emergency, follow the CMO and the flight surgeon.')}</span>}
    </div>
  )
}

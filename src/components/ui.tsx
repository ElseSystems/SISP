import type { ReactNode } from 'react'
import { StatusBadge } from './StatusBadge'
import type { Severity } from '../lib/knowledge'
import { t } from '../lib/i18n'

/** Back-compat wrapper: every status badge is now the shape + label StatusBadge. */
export function Badge(p: { s: Severity; className?: string; size?: 'sm' | 'md' | 'lg'; showLevel?: boolean; solid?: boolean }) {
  return <StatusBadge {...p} />
}

export function Card({ title, children, right, className = '' }: { title?: ReactNode; children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <section className={`glass rounded-2xl p-4 ${className}`}>
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300/90">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  )
}

export function SourceLinks({ sources }: { sources: { label: string; url: string }[] }) {
  return (
    <ul className="mt-2 space-y-0.5 text-[11px] text-slate-400">
      {sources.map((s) => (
        <li key={s.url}>📎 <a className="underline decoration-dotted hover:text-sky-300" href={s.url} target="_blank" rel="noreferrer">{s.label}</a></li>
      ))}
    </ul>
  )
}

export const Disclaimer = () => (
  <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
    ⚠️ {t('SISP – protótipo educacional do NASA Space Apps. ', 'SISP – NASA Space Apps educational prototype. ')}
    <b>{t('Não é dispositivo médico', 'Not a medical device')}</b>
    {t(' nem protocolo da NASA. Faixas de diretrizes clínicas terrestres + heurísticas do protótipo; dados da tripulação são simulados.',
      ' nor a NASA protocol. Terrestrial clinical guideline ranges + prototype heuristics; crew data is simulated.')}
  </p>
)

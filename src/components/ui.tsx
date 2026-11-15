import type { ReactNode } from 'react'
import { SEVERITY_COLOR, SEVERITY_LABEL } from '../lib/knowledge'
import type { Severity } from '../lib/knowledge'
import { t, tr } from '../lib/i18n'

export function Badge({ s, className = '' }: { s: Severity; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}
      style={{ background: SEVERITY_COLOR[s] + '26', color: SEVERITY_COLOR[s], border: `1px solid ${SEVERITY_COLOR[s]}66` }}>
      <span className="h-2 w-2 rounded-full" style={{ background: SEVERITY_COLOR[s] }} />
      {tr(SEVERITY_LABEL[s])}
    </span>
  )
}

export function Card({ title, children, right, className = '' }: { title?: ReactNode; children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4 shadow-lg backdrop-blur ${className}`}>
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">{title}</h2>}
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

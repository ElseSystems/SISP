import { useId } from 'react'
import type { CrewMember } from '../lib/types'
import { t, tr } from '../lib/i18n'
import { crewSex } from './crewSex'

/**
 * Head-and-shoulders bust in the mission palette: outline strokes in the accent
 * colour over a dark suit, with a small mission patch. Optional ring = status colour.
 */
export function CrewAvatar({ c, size = 32, ring, decorative = false, className = '' }:
  { c: Pick<CrewMember, 'id' | 'sex' | 'name'>; size?: number; ring?: string; decorative?: boolean; className?: string }) {
  const female = crewSex(c) === 'female'
  const clip = `bust-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const label = `${tr(c.name)} · ${female ? t('avatar feminino', 'female avatar') : t('avatar masculino', 'male avatar')}`
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={`shrink-0 ${className}`}
      {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label })}>
      {!decorative && <title>{label}</title>}
      <circle cx="24" cy="24" r="22.5" fill="var(--sisp-surface-2, #0f172a)" stroke={ring ?? 'var(--sisp-accent, #38bdf8)'} strokeOpacity={ring ? 1 : 0.45} strokeWidth={ring ? 2.5 : 1.5} />
      <defs><clipPath id={clip}><circle cx="24" cy="24" r="21.5" /></clipPath></defs>
      <g clipPath={`url(#${clip})`} fill="none" stroke="var(--sisp-accent, #38bdf8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {female ? (
          <>
            {/* long hair behind the head, falling to the shoulders */}
            <path d="M14.5 30c-1.4-4.6-1.6-9.6.2-13.4C16.6 12.4 20 10 24 10s7.4 2.4 9.3 6.6c1.8 3.8 1.6 8.8.2 13.4" fill="color-mix(in oklab, var(--sisp-accent, #38bdf8) 22%, transparent)" />
            <path d="M8 48c0-8.2 6.6-13.6 16-13.6S40 39.8 40 48" fill="color-mix(in oklab, var(--sisp-accent, #38bdf8) 14%, transparent)" />
            <ellipse cx="24" cy="20.5" rx="6.6" ry="7.6" fill="var(--sisp-surface-2, #0f172a)" />
            <path d="M17.6 18.6c2.6-.4 5.2-2 6.6-4.4 1.2 2.2 3.6 3.8 6.2 4.2" />
          </>
        ) : (
          <>
            <path d="M6 48c0-9 8-14.6 18-14.6S42 39 42 48" fill="color-mix(in oklab, var(--sisp-accent, #38bdf8) 14%, transparent)" />
            <ellipse cx="24" cy="20.5" rx="7" ry="8" fill="var(--sisp-surface-2, #0f172a)" />
            {/* short cropped hair line */}
            <path d="M17.1 18.4c.2-4.6 3.2-7.4 6.9-7.4s6.7 2.8 6.9 7.4c-2.4-1.6-4.8-2.4-6.9-2.4s-4.5.8-6.9 2.4z" fill="color-mix(in oklab, var(--sisp-accent, #38bdf8) 30%, transparent)" />
          </>
        )}
        {/* suit collar + mission patch */}
        <path d="M19.5 34.6 24 39l4.5-4.4" />
        <circle cx="32.5" cy="41" r="1.8" fill="var(--sisp-accent, #38bdf8)" stroke="none" />
      </g>
    </svg>
  )
}

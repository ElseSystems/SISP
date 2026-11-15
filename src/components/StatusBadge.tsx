/**
 * Status badge: shape-coded icon + label + optional level (N0–N3), so status never relies on colour
 * alone (protanopia confuses Warning/Critical). Critical pulses (1.6 s ≈ 0.6 Hz) unless reduced motion.
 */
import { motion, useReducedMotion } from 'framer-motion'
import type { Severity } from '../lib/knowledge'
import { SEVERITY_LABEL } from '../lib/knowledge'
import { tr } from '../lib/i18n'
import { STATUS } from '../lib/status'

export function StatusIcon({ s, size }: { s: Severity; size: number }) {
  const p = { width: size, height: size, viewBox: '0 0 16 16', 'aria-hidden': true, fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (s === 0) return <svg {...p}><circle cx="8" cy="8" r="6.5" /><path d="M5.2 8.2l1.9 1.9 3.7-4" /></svg>
  if (s === 1) return <svg {...p}><circle cx="8" cy="8" r="6.5" /><path d="M8 7.2v4M8 4.8v.01" /></svg>
  if (s === 2) return <svg {...p}><path d="M8 1.8l6.5 11.4H1.5z" /><path d="M8 6.3v3.2M8 11.4v.01" /></svg>
  return <svg {...p}><path d="M5.3 1.5h5.4l3.8 3.8v5.4l-3.8 3.8H5.3l-3.8-3.8V5.3z" /><path d="M6 6l4 4M10 6l-4 4" /></svg>
}

type Size = 'sm' | 'md' | 'lg'
const SZ: Record<Size, { pad: string; text: string; icon: number }> = {
  sm: { pad: 'px-2 py-0.5 gap-1', text: 'text-meta', icon: 12 },
  md: { pad: 'px-2.5 py-1 gap-1.5', text: 'text-body-sm', icon: 14 },
  lg: { pad: 'px-4 py-2 gap-2', text: 'text-title font-display', icon: 20 },
}

export function StatusBadge({ s, size = 'sm', showLevel = false, solid = false, className = '' }:
  { s: Severity; size?: Size; showLevel?: boolean; solid?: boolean; className?: string }) {
  const { color } = STATUS[s]
  const reduce = useReducedMotion()
  const z = SZ[size]
  const critical = s === 3
  return (
    <motion.span
      role={critical ? 'alert' : 'status'}
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full font-semibold ${s === 2 ? 'border-[1.5px]' : 'border'} ${z.pad} ${z.text} ${className}`}
      style={solid
        ? { background: color, color: 'var(--sisp-bg)', borderColor: color } // ink on solid ≥ 7.4:1
        : { background: `color-mix(in oklab, ${color} 14%, transparent)`, color, borderColor: `color-mix(in oklab, ${color} 45%, transparent)`, boxShadow: critical && reduce ? 'var(--sisp-glow-critical)' : undefined }}
      animate={critical && !reduce ? { boxShadow: ['0 0 0 0 rgba(255,107,107,0.55)', '0 0 0 8px rgba(255,107,107,0)'] } : undefined}
      transition={critical ? { duration: 1.6, repeat: Infinity, ease: 'easeOut' } : undefined}
    >
      <StatusIcon s={s} size={z.icon} />
      <span>{tr(SEVERITY_LABEL[s])}</span>
      {showLevel && <span className="font-mono opacity-70">N{s}</span>}
    </motion.span>
  )
}

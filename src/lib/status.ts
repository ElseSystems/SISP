/** Status scale tokens (CSS variables defined in index.css). Index = Severity 0–3. */
export const STATUS = [
  { key: 'nominal', color: 'var(--sisp-nominal)' },
  { key: 'caution', color: 'var(--sisp-caution)' },
  { key: 'warning', color: 'var(--sisp-warning)' },
  { key: 'critical', color: 'var(--sisp-critical)' },
] as const

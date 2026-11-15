/** Renders the emoji tokens mapped in ./iconMap as lucide outline SVG icons (see iconMap.ts). */
import { Fragment, type ReactNode } from 'react'
import { MAP, TOKEN, norm } from './iconMap'

/** One icon for one emoji token. Decorative (aria-hidden) — the adjacent text carries the meaning. */
export function Icon({ e, className = '', size = '1.15em', strokeWidth = 2 }: { e: string; className?: string; size?: number | string; strokeWidth?: number }) {
  const C = MAP[norm(e)]
  if (!C) return <span aria-hidden>{e}</span>
  return <C aria-hidden focusable="false" width={size} height={size} strokeWidth={strokeWidth}
    className={`inline-block shrink-0 align-[-0.2em] ${className}`} />
}

/** Icon positioned inside an SVG drawing (nested <svg>), centred on (cx, cy). */
export function SvgIcon({ e, cx, cy, size, color = 'currentColor', strokeWidth = 2 }: { e: string; cx: number; cy: number; size: number; color?: string; strokeWidth?: number }) {
  const C = MAP[norm(e)]
  if (!C) return null
  return <C x={cx - size / 2} y={cy - size / 2} width={size} height={size} color={color} strokeWidth={strokeWidth} aria-hidden focusable="false" />
}

/** Text with icon-tokens swapped for SVG icons; unmapped characters (mood emojis) are left as-is. */
export function IconText({ text, iconClassName }: { text: string; iconClassName?: string }): ReactNode {
  if (!text) return text
  const parts = text.split(TOKEN)
  if (parts.length === 1) return text
  return parts.map((p, i) => i % 2 === 1
    ? <Icon key={i} e={p} className={iconClassName} />
    : p && <Fragment key={i}>{p}</Fragment>)
}


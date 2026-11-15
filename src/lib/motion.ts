/** Shared motion tokens (docs/ui-polish-spec.md §d). Root uses <MotionConfig reducedMotion="user">. */
import type { Transition, Variants } from 'framer-motion'

export const EASE_OUT = [0.22, 1, 0.36, 1] as const
export const EASE_IN = [0.4, 0, 1, 1] as const
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const

export const DUR = { instant: 0.12, fast: 0.2, base: 0.32, exit: 0.16 } as const

export const screen: Variants = {
  initial: { opacity: 0, y: 12, filter: 'blur(4px)' },
  enter: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: DUR.base, ease: EASE_OUT, when: 'beforeChildren', staggerChildren: 0.045, delayChildren: 0.06 } },
  exit: { opacity: 0, y: -6, transition: { duration: DUR.exit, ease: EASE_IN } },
}

export const card: Variants = {
  initial: { opacity: 0, y: 14, scale: 0.985 },
  enter: { opacity: 1, y: 0, scale: 1, transition: { duration: DUR.base, ease: EASE_OUT } },
}

export const list: Variants = {
  initial: {},
  enter: { transition: { staggerChildren: 0.045, delayChildren: 0.04 } },
}

export const item: Variants = {
  initial: { opacity: 0, y: 8 },
  enter: { opacity: 1, y: 0, transition: { duration: DUR.fast, ease: EASE_OUT } },
}

export const statusChange: Transition = { type: 'spring', stiffness: 260, damping: 26 }

export const criticalPulse: Variants = {
  idle: { boxShadow: '0 0 0 0 rgba(255,107,107,0)' },
  pulse: { boxShadow: ['0 0 0 0 rgba(255,107,107,0.55)', '0 0 0 14px rgba(255,107,107,0)'], transition: { duration: 1.6, repeat: Infinity, ease: 'easeOut' } },
}

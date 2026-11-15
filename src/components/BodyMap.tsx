import { motion } from 'framer-motion'
import { SEVERITY_COLOR } from '../lib/knowledge'
import type { BodyRegionId, Severity } from '../lib/knowledge'

interface Props { regions: Record<BodyRegionId, Severity>; selected: BodyRegionId | null; onSelect: (r: BodyRegionId) => void }

export default function BodyMap({ regions, selected, onSelect }: Props) {
  const fill = (r: BodyRegionId) => SEVERITY_COLOR[regions[r]]
  const common = (r: BodyRegionId) => ({
    onClick: () => onSelect(r),
    style: { cursor: 'pointer' },
    role: 'button',
    tabIndex: 0,
    'aria-label': r,
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') onSelect(r) },
  })
  const op = (r: BodyRegionId) => (selected === null || selected === r ? 0.85 : 0.35)
  const pulse = (r: BodyRegionId) => (regions[r] >= 2 ? { scale: [1, 1.06, 1] } : { scale: 1 })
  const tr = { duration: 1.4, repeat: Infinity }

  return (
    <svg viewBox="0 0 200 420" className="mx-auto h-[420px] w-auto drop-shadow-[0_0_25px_rgba(56,189,248,0.25)]">
      <defs>
        <linearGradient id="suit" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#1e293b" />
          <stop offset="1" stopColor="#0f172a" />
        </linearGradient>
      </defs>
      {/* silhueta */}
      <g fill="url(#suit)" stroke="#334155" strokeWidth="2">
        <circle cx="100" cy="45" r="32" />
        <rect x="88" y="74" width="24" height="16" rx="4" />
        <path d="M55 92 Q100 82 145 92 L150 230 Q100 245 50 230 Z" />
      </g>

      {/* ossos/músculos: braços e pernas */}
      <motion.g {...common('musculoskeletal')} animate={pulse('musculoskeletal')} transition={tr} style={{ cursor: 'pointer', transformOrigin: '100px 300px' }}>
        <g fill={fill('musculoskeletal')} opacity={op('musculoskeletal')} stroke="#0f172a" strokeWidth="2">
          <path d="M55 95 L30 110 L18 215 L34 218 L48 130 Z" />
          <path d="M145 95 L170 110 L182 215 L166 218 L152 130 Z" />
          <path d="M58 232 L96 240 L92 405 L66 405 Z" />
          <path d="M142 232 L104 240 L108 405 L134 405 Z" />
        </g>
      </motion.g>

      {/* cérebro */}
      <motion.g {...common('brain')} animate={pulse('brain')} transition={tr} style={{ cursor: 'pointer', transformOrigin: '100px 40px' }}>
        <path d="M76 42 Q74 18 100 16 Q126 18 124 42 Q124 58 100 58 Q76 58 76 42 Z" fill={fill('brain')} opacity={op('brain')} stroke="#0f172a" strokeWidth="2" />
        <path d="M100 18 L100 56 M84 30 Q92 36 86 46 M116 30 Q108 36 114 46" stroke="#0f172a" strokeWidth="1.5" fill="none" opacity="0.6" />
      </motion.g>

      {/* pulmões */}
      <motion.g {...common('lungs')} animate={pulse('lungs')} transition={tr} style={{ cursor: 'pointer', transformOrigin: '100px 140px' }}>
        <g fill={fill('lungs')} opacity={op('lungs')} stroke="#0f172a" strokeWidth="2">
          <path d="M94 104 Q70 100 66 130 Q64 165 90 170 Q96 150 94 104 Z" />
          <path d="M106 104 Q130 100 134 130 Q136 165 110 170 Q104 150 106 104 Z" />
        </g>
      </motion.g>

      {/* coração */}
      <motion.g {...common('heart')} animate={regions.heart >= 2 ? { scale: [1, 1.12, 1] } : { scale: [1, 1.04, 1] }} transition={{ duration: 0.9, repeat: Infinity }} style={{ cursor: 'pointer', transformOrigin: '104px 140px' }}>
        <path d="M104 156 C82 140 88 120 100 126 C104 128 104 132 104 132 C104 132 106 126 112 125 C124 124 124 144 104 156 Z" fill={fill('heart')} opacity={Math.min(1, op('heart') + 0.1)} stroke="#0f172a" strokeWidth="2" />
      </motion.g>

      {/* metabolismo (abdome) */}
      <motion.g {...common('metabolism')} animate={pulse('metabolism')} transition={tr} style={{ cursor: 'pointer', transformOrigin: '100px 200px' }}>
        <ellipse cx="100" cy="200" rx="34" ry="22" fill={fill('metabolism')} opacity={op('metabolism')} stroke="#0f172a" strokeWidth="2" />
        <path d="M80 196 Q100 186 120 196 M82 206 Q100 214 118 206" stroke="#0f172a" strokeWidth="1.5" fill="none" opacity="0.5" />
      </motion.g>

      {/* imune: linfonodos (pescoço, axilas, virilha) + baço */}
      <motion.g {...common('immune')} animate={pulse('immune')} transition={tr} style={{ cursor: 'pointer', transformOrigin: '100px 150px' }}>
        <g fill={fill('immune')} opacity={op('immune')} stroke="#0f172a" strokeWidth="1.5">
          {[[86, 82], [114, 82], [60, 108], [140, 108], [78, 236], [122, 236]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="6" />)}
          <ellipse cx="128" cy="178" rx="7" ry="10" />
        </g>
      </motion.g>
    </svg>
  )
}

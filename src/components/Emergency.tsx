import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Card, SourceLinks } from './ui'
import { MANUALS } from '../lib/emergency'
import type { EmManual } from '../lib/emergency'
import { t, tr } from '../lib/i18n'

function Illustration({ id, color }: { id: EmManual['id']; color: string }) {
  const stroke = { stroke: '#e2e8f0', strokeWidth: 3, strokeLinecap: 'round' as const, fill: 'none' }
  if (id === 'cardiac') return (
    <svg viewBox="0 0 220 120" className="h-28 w-full" aria-hidden>
      <rect x="10" y="4" width="200" height="6" rx="2" fill="#334155" />
      <rect x="30" y="92" width="160" height="10" rx="3" fill="#475569" />
      <text x="110" y="116" textAnchor="middle" fontSize="8" fill="#94a3b8">CMRS</text>
      {/* patient */}
      <circle cx="50" cy="82" r="8" {...stroke} />
      <path d="M58 84 L150 84 M150 84 L175 80 M150 84 L175 88" {...stroke} />
      {[60, 90, 120].map((x) => <path key={x} d={`M${x} 90 v4`} stroke="#94a3b8" strokeWidth="2" />)}
      {/* rescuer in handstand: feet braced on the ceiling, arms locked on the patient's sternum */}
      <path d="M94 10 L102 34 M110 10 L102 34 M102 34 L102 56 M102 56 L98 80 M102 56 L106 80" {...stroke} />
      <circle cx="114" cy="62" r="6" {...stroke} />
      <motion.circle cx="100" cy="80" r="7" fill={color} animate={{ opacity: [0.2, 0.9, 0.2], scale: [1, 1.4, 1] }} transition={{ duration: 0.55, repeat: Infinity }} />
      <text x="150" y="30" fontSize="9" fill="#cbd5e1">handstand</text>
    </svg>
  )
  if (id === 'muscle') return (
    <svg viewBox="0 0 220 120" className="h-28 w-full" aria-hidden>
      <path d="M70 10 C80 40 78 60 82 80 L84 104 L120 108 L118 96 L100 92 C98 70 100 40 104 10" {...stroke} />
      {[70, 78, 86].map((y, i) => <path key={y} d={`M80 ${y} L106 ${y + 8} M106 ${y} L80 ${y + 8}`} stroke={color} strokeWidth="3" opacity={0.9 - i * 0.15} />)}
      <text x="150" y="40" fontSize="26">🧊</text>
      <text x="150" y="90" fontSize="26">🩹</text>
      <text x="80" y="118" fontSize="8" fill="#94a3b8">{t('bandagem em oito', 'figure-eight wrap')}</text>
    </svg>
  )
  return (
    <svg viewBox="0 0 220 120" className="h-28 w-full" aria-hidden>
      <rect x="30" y="46" width="160" height="28" rx="6" fill="#64748b" opacity="0.5" />
      <path d="M40 60 h60 l6 -8 l6 16 l6 -8 h62" stroke="#f1f5f9" strokeWidth="9" strokeLinecap="round" fill="none" />
      <circle cx="36" cy="54" r="7" fill="#f1f5f9" /><circle cx="36" cy="66" r="7" fill="#f1f5f9" />
      <circle cx="184" cy="54" r="7" fill="#f1f5f9" /><circle cx="184" cy="66" r="7" fill="#f1f5f9" />
      <path d="M106 50 l6 10 l-6 10" stroke={color} strokeWidth="3" fill="none" />
      <text x="110" y="100" textAnchor="middle" fontSize="9" fill="#cbd5e1">SAM splint</text>
    </svg>
  )
}

/** Metrônomo de RCP: 110/min (dentro de 100–120/min da AHA). */
function CprMetronome() {
  const [on, setOn] = useState(false)
  const [count, setCount] = useState(0)
  const ctx = useRef<AudioContext | null>(null)
  useEffect(() => {
    if (!on) return
    const id = setInterval(() => {
      setCount((c) => (c % 30) + 1)
      try {
        ctx.current ??= new AudioContext()
        const o = ctx.current.createOscillator(); const g = ctx.current.createGain()
        o.frequency.value = 880; g.gain.value = 0.08; o.connect(g); g.connect(ctx.current.destination)
        o.start(); o.stop(ctx.current.currentTime + 0.05)
      } catch { /* sem áudio */ }
    }, 60000 / 110)
    return () => clearInterval(id)
  }, [on])
  return (
    <div className="flex items-center gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-3">
      <button onClick={() => { setOn(!on); setCount(0) }} className="rounded-lg bg-red-500 px-3 py-2 text-sm font-bold text-white hover:bg-red-400">
        {on ? t('■ Parar', '■ Stop') : t('▶ Metrônomo RCP 110/min', '▶ CPR metronome 110/min')}
      </button>
      <motion.div key={count} initial={{ scale: 1.4, opacity: 1 }} animate={{ scale: 1, opacity: 0.6 }} className="text-2xl font-black text-red-300">{on ? count : '—'}</motion.div>
      <span className="text-[11px] text-slate-300">{t('Contagem 1–30 (30:2 sem via aérea avançada). Faixa AHA: 100–120/min.', 'Count 1–30 (30:2 without advanced airway). AHA range: 100–120/min.')}</span>
    </div>
  )
}

export default function Emergency() {
  const [sel, setSel] = useState<EmManual['id']>('cardiac')
  const [done, setDone] = useState<Record<string, boolean>>({})
  const m = MANUALS.find((x) => x.id === sel)!

  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-xs text-red-100">
        🚨 {t('Manuais educativos baseados em material PÚBLICO da NASA (checklist médico histórico da ISS, Human Research Roadmap) e na revisão ILCOR sobre RCP em microgravidade. Não substituem treinamento, o checklist médico atual da ISS (não público) nem o flight surgeon. O SISP não indica medicamentos nem doses.',
          'Educational manuals based on PUBLIC NASA material (historical ISS Medical Checklist, Human Research Roadmap) and the ILCOR review of CPR in microgravity. They do not replace training, the current (non-public) ISS Medical Checklist or the flight surgeon. SISP does not list drugs or doses.')}
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        {MANUALS.map((x) => (
          <button key={x.id} onClick={() => { setSel(x.id); setDone({}) }}
            className={`rounded-xl border p-3 text-left transition ${sel === x.id ? 'scale-[1.02] bg-slate-900' : 'bg-slate-900/50 opacity-80 hover:opacity-100'}`}
            style={{ borderColor: sel === x.id ? x.color : '#334155' }}>
            <div className="text-sm font-bold" style={{ color: x.color }}>{tr(x.title)}</div>
            <div className="text-[11px] text-slate-400">{tr(x.subtitle)}</div>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card title={tr(m.title)} right={<span className="text-[11px] text-slate-400">{Object.values(done).filter(Boolean).length}/{m.steps.length} ✓</span>}>
          <Illustration id={m.id} color={m.color} />
          {m.id === 'cardiac' && <div className="mt-2"><CprMetronome /></div>}
          <ol className="mt-3 space-y-2">
            {m.steps.map((s, i) => (
              <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                className={`flex gap-3 rounded-xl border p-3 ${done[i] ? 'border-emerald-600/50 bg-emerald-500/5 opacity-70' : s.warning ? 'border-amber-500/60 bg-amber-500/5' : 'border-slate-700 bg-slate-950/50'}`}>
                <button onClick={() => setDone({ ...done, [i]: !done[i] })} aria-label="done"
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${done[i] ? 'border-emerald-500 bg-emerald-500 text-slate-950' : 'border-slate-500 text-slate-300'}`}>
                  {done[i] ? '✓' : i + 1}
                </button>
                <div className="text-sm">
                  <span className="mr-1">{s.icon}</span>{tr(s.text)}
                  {s.src.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {s.src.map((x) => <a key={x.url} href={x.url} target="_blank" rel="noreferrer" title={x.label} className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-sky-300 hover:bg-slate-700">📎 {x.label.split(' – ')[0].slice(0, 38)}</a>)}
                    </div>
                  )}
                </div>
              </motion.li>
            ))}
          </ol>
        </Card>

        <div className="space-y-4">
          <Card title={t('Reconhecer', 'Recognize')}>
            <ul className="list-disc space-y-1 pl-4 text-sm text-slate-200">{m.recognize.map((r, i) => <li key={i}>{tr(r)}</li>)}</ul>
          </Card>
          <Card title={t('📡 Quando chamar o solo', '📡 When to call the ground')}>
            <p className="text-sm text-slate-200">{tr(m.callGround)}</p>
          </Card>
          <Card title={t('🌌 O que muda no espaço', '🌌 What changes in space')}>
            <ul className="space-y-2 text-xs text-slate-300">
              {m.spaceNotes.map((n, i) => <li key={i}>• {tr(n.text)} <SourceLinks sources={n.src} /></li>)}
            </ul>
          </Card>
          <Card title={t('Fontes', 'Sources')}><SourceLinks sources={m.sources} /></Card>
        </div>
      </div>
    </div>
  )
}

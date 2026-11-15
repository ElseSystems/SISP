import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { SourceLinks } from './ui'
import { useStore } from '../lib/store'
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

/** CPR metronome: 110/min (inside AHA's 100–120/min). Big counter + ring on every beat; reduced motion → number only. */
function CprMetronome() {
  const [on, setOn] = useState(false)
  const [count, setCount] = useState(0)
  const ctx = useRef<AudioContext | null>(null)
  const reduce = useReducedMotion()
  useEffect(() => {
    if (!on) return
    const id = setInterval(() => {
      setCount((c) => (c % 30) + 1)
      try {
        ctx.current ??= new AudioContext()
        const o = ctx.current.createOscillator(); const g = ctx.current.createGain()
        o.frequency.value = 880; g.gain.value = 0.08; o.connect(g); g.connect(ctx.current.destination)
        o.start(); o.stop(ctx.current.currentTime + 0.05)
      } catch { /* no audio */ }
    }, 60000 / 110)
    return () => clearInterval(id)
  }, [on])
  return (
    <div className="flex flex-wrap items-center gap-6 rounded-2xl border border-critical/40 bg-critical/10 p-5">
      <div className="relative flex h-32 w-32 shrink-0 items-center justify-center rounded-full border-2 border-critical/60">
        {on && !reduce && (
          <motion.span key={`ring-${count}`} className="absolute inset-0 rounded-full border-2 border-critical"
            initial={{ scale: 1, opacity: 0.8 }} animate={{ scale: 1.35, opacity: 0 }} transition={{ duration: 0.5, ease: 'easeOut' }} aria-hidden />
        )}
        <motion.span key={count} initial={reduce ? false : { scale: 1.15 }} animate={{ scale: 1 }} transition={{ duration: 0.12 }}
          className="font-mono text-display-xl font-bold text-critical tnum" aria-live="off">{on ? count : '—'}</motion.span>
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <button onClick={() => { setOn(!on); setCount(0) }}
          className="rounded-xl bg-critical px-6 py-4 font-display text-title font-bold text-[#01030B] hover:brightness-110">
          {on ? t('■ Parar metrônomo', '■ Stop metronome') : t('▶ Metrônomo RCP 110/min', '▶ CPR metronome 110/min')}
        </button>
        <p className="text-body-sm text-fg-2">{t('Contagem 1–30 (30:2 sem via aérea avançada). Faixa AHA: 100–120/min.', 'Count 1–30 (30:2 without advanced airway). AHA range: 100–120/min.')}</p>
      </div>
    </div>
  )
}

const mmss = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

const EASE_OUT = [0.22, 1, 0.36, 1] as const
const EASE_IN = [0.4, 0, 1, 1] as const
const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const

/** Emergency takeover: full screen, one step at a time, protocol timer and a big CPR metronome. */
export default function Emergency() {
  const [sel, setSel] = useState<EmManual['id']>('cardiac')
  const [done, setDone] = useState<Record<number, boolean>>({})
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState<1 | -1>(1)
  const [startedAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const [showInfo, setShowInfo] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const lang = useStore((s) => s.lang)
  const setLang = useStore((s) => s.setLang)
  const setTab = useStore((s) => s.setTab)
  const demo = useStore((s) => s.demo)
  const m = MANUALS.find((x) => x.id === sel)!
  const cur = m.steps[step]
  const doneCount = Object.values(done).filter(Boolean).length

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, [])

  const go = (to: number) => {
    const n = Math.max(0, Math.min(m.steps.length - 1, to))
    setDir(n >= step ? 1 : -1); setStep(n)
  }
  const markDone = () => {
    setDone((d) => ({ ...d, [step]: !d[step] }))
    if (!done[step] && step < m.steps.length - 1) go(step + 1)
  }
  const pick = (id: EmManual['id']) => { setSel(id); setDone({}); setStep(0); setDir(1) }

  // ←/→ navigate, Space marks the step done, Esc asks to end the protocol (the guided demo owns the keys while it runs).
  useEffect(() => {
    if (demo) return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input,textarea,select')) return
      if (e.key === 'ArrowRight') go(step + 1)
      else if (e.key === 'ArrowLeft') go(step - 1)
      else if (e.key === ' ' && !el.closest('button,a')) { e.preventDefault(); markDone() }
      else if (e.key === 'Escape') setConfirmEnd((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Portal to <body>: the tab transition wrapper is transformed, which would trap `position: fixed`.
  return createPortal(
    <motion.div role="dialog" aria-modal="true" aria-label={t('Protocolo de emergência', 'Emergency protocol')}
      className="fixed inset-0 z-30 overflow-y-auto bg-[#1A0609] text-fg-1"
      initial={{ opacity: 0, scale: 1.04, clipPath: 'inset(8% 8% 8% 8% round 24px)' }}
      animate={{ opacity: 1, scale: 1, clipPath: 'inset(0% 0% 0% 0% round 0px)', transition: { duration: 0.42, ease: EASE_IN_OUT } }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.24, ease: EASE_IN } }}>
      {/* red vignette: flashes once, then stays subtle */}
      <motion.div aria-hidden className="pointer-events-none fixed inset-0 shadow-[inset_0_0_180px_rgba(255,107,107,0.55)]"
        initial={{ opacity: 0 }} animate={{ opacity: [0, 0.55, 0.18] }} transition={{ duration: 0.9, times: [0, 0.25, 1] }} />

      <header className="sticky top-0 z-10 border-b border-critical/30 bg-[#1A0609]/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-4 px-6 py-3">
          <h1 className="font-display text-title font-bold text-critical">🚨 {t('Protocolo de emergência', 'Emergency protocol')}</h1>
          <div role="tablist" aria-label={t('Manuais', 'Manuals')} className="flex flex-wrap gap-1">
            {MANUALS.map((x) => (
              <button key={x.id} role="tab" aria-selected={sel === x.id} onClick={() => pick(x.id)}
                className={`rounded-lg border px-3 py-1.5 text-body-sm font-semibold transition ${sel === x.id ? 'border-accent bg-accent/15 text-accent' : 'border-line text-fg-2 hover:text-fg-1'}`}>
                {tr(x.title).split(' – ')[0]}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2 rounded-xl border border-line px-3 py-1" title={t('Tempo desde o início do protocolo', 'Time since protocol start')}>
            <span className="text-meta uppercase tracking-widest text-fg-3">⏱</span>
            <span className="font-mono text-metric font-bold text-fg-1 tnum">{mmss(now - startedAt)}</span>
          </div>
          <div className="flex overflow-hidden rounded-lg border border-line text-meta font-semibold" role="group" aria-label="Language / Idioma">
            {(['en', 'pt'] as const).map((lg) => (
              <button key={lg} onClick={() => setLang(lg)} aria-pressed={lang === lg}
                className={`px-2.5 py-1 ${lang === lg ? 'bg-accent text-accent-ink' : 'text-fg-2 hover:text-fg-1'}`}>{lg.toUpperCase()}</button>
            ))}
          </div>
          <button onClick={() => setConfirmEnd(true)} className="rounded-lg border border-line-strong px-3 py-1.5 text-body-sm font-semibold text-fg-1 hover:bg-white/5">
            {t('Encerrar protocolo', 'End protocol')}
          </button>
        </div>
        <div className="mx-auto max-w-[1440px] px-6 pb-2 text-meta text-fg-2">
          <button onClick={() => setShowInfo((v) => !v)} aria-expanded={showInfo} className="hover:text-fg-1">
            {t('Educacional · não substitui o flight surgeon', 'Educational · does not replace the flight surgeon')} · ⓘ
          </button>
          {showInfo && (
            <p className="mt-1 max-w-4xl text-fg-2">
              {t('Manuais educativos baseados em material PÚBLICO da NASA (checklist médico histórico da ISS, Human Research Roadmap) e na revisão ILCOR sobre RCP em microgravidade. Não substituem treinamento, o checklist médico atual da ISS (não público) nem o flight surgeon. O SISP não indica medicamentos nem doses.',
                'Educational manuals based on PUBLIC NASA material (historical ISS Medical Checklist, Human Research Roadmap) and the ILCOR review of CPR in microgravity. They do not replace training, the current (non-public) ISS Medical Checklist or the flight surgeon. SISP does not list drugs or doses.')}
            </p>
          )}
        </div>
      </header>

      <AnimatePresence>
        {confirmEnd && (
          <motion.div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div role="alertdialog" aria-modal="true" className="w-full max-w-md rounded-2xl border border-line-strong bg-surface-2 p-6">
              <p className="font-display text-title font-bold">{t('Encerrar o protocolo de emergência?', 'End the emergency protocol?')}</p>
              <p className="mt-1 text-body-sm text-fg-2">{t('Tempo de protocolo', 'Protocol time')}: <span className="font-mono">{mmss(now - startedAt)}</span> · {doneCount}/{m.steps.length} ✓</p>
              <div className="mt-4 flex justify-end gap-2">
                <button autoFocus onClick={() => setConfirmEnd(false)} className="rounded-lg bg-accent px-4 py-2 text-body-sm font-bold text-accent-ink">{t('Continuar protocolo', 'Keep going')}</button>
                <button onClick={() => setTab('dashboard')} className="rounded-lg border border-line-strong px-4 py-2 text-body-sm font-semibold text-fg-1">{t('Encerrar', 'End')}</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="relative mx-auto grid max-w-[1440px] gap-6 px-6 py-6 lg:grid-cols-12">
        <section className="space-y-5 lg:col-span-8">
          <div className="flex items-center justify-between gap-3 text-body-sm text-fg-2">
            <span className="font-semibold">{tr(m.title)}</span>
            <span className="font-mono">{t('Passo', 'Step')} {step + 1}/{m.steps.length} · {doneCount} ✓</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-critical transition-[width]" style={{ width: `${((step + 1) / m.steps.length) * 100}%` }} />
          </div>
          <div className="relative min-h-[14rem] overflow-hidden">
            <AnimatePresence mode="wait" custom={dir}>
              <motion.div key={`${sel}-${step}`} custom={dir}
                initial={{ opacity: 0, x: 40 * dir }} animate={{ opacity: 1, x: 0, transition: { duration: 0.28, ease: EASE_OUT } }}
                exit={{ opacity: 0, x: -40 * dir, transition: { duration: 0.18, ease: EASE_IN } }}>
                <p className={`font-display text-display-sm font-bold lg:text-display ${done[step] ? 'text-fg-2 line-through decoration-nominal/70' : 'text-fg-1'}`}>
                  <span className="mr-3">{cur.icon}</span>{tr(cur.text)}
                </p>
                {cur.warning && <p className="mt-3 inline-block rounded-lg border border-caution/60 px-3 py-1 text-body-sm font-semibold text-caution">⚠ {t('Só com o flight surgeon / CMO treinado', 'Only with the flight surgeon / trained CMO')}</p>}
                {cur.src.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {cur.src.map((x) => <a key={x.url} href={x.url} target="_blank" rel="noreferrer" title={x.label} className="rounded-md bg-white/5 px-2 py-0.5 text-meta text-accent hover:bg-white/10">📎 {x.label.split(' – ')[0].slice(0, 48)}</a>)}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => go(step - 1)} disabled={step === 0}
              className="rounded-xl border border-line-strong px-6 py-4 font-display text-title font-semibold text-fg-1 hover:bg-white/5 disabled:opacity-40">← {t('Anterior', 'Previous')}</button>
            <button onClick={markDone} aria-pressed={!!done[step]}
              className={`flex-1 rounded-xl px-6 py-4 font-display text-title font-bold text-[#01030B] ${done[step] ? 'bg-nominal' : 'bg-accent hover:bg-accent-strong'}`}>
              {done[step] ? t('Feito ✓ (desfazer)', 'Done ✓ (undo)') : t('Feito ✓', 'Done ✓')}
            </button>
            <button onClick={() => go(step + 1)} disabled={step === m.steps.length - 1}
              className="rounded-xl border border-line-strong px-6 py-4 font-display text-title font-semibold text-fg-1 hover:bg-white/5 disabled:opacity-40">{t('Próximo', 'Next')} →</button>
          </div>
          <p className="text-meta text-fg-3">{t('Teclado: ←/→ navega · Espaço marca feito · Esc encerra', 'Keyboard: ←/→ navigate · Space marks done · Esc ends')}</p>
          {m.id === 'cardiac' && <CprMetronome />}
          <div className="rounded-2xl border border-line-subtle bg-white/[0.03] p-3"><Illustration id={m.id} color="#5CC8FF" /></div>
        </section>

        <aside className="space-y-4 lg:col-span-4">
          <div className="rounded-2xl border border-line bg-black/20 p-4">
            <h2 className="mb-2 text-meta font-semibold uppercase tracking-[0.18em] text-fg-3">{t('Trilha', 'Steps')}</h2>
            <ol className="space-y-1">
              {m.steps.map((s, i) => (
                <li key={i}>
                  <button onClick={() => go(i)} aria-current={i === step ? 'step' : undefined}
                    className={`flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-body-sm ${i === step ? 'bg-accent/15 text-fg-1' : 'text-fg-2 hover:bg-white/5'}`}>
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-meta font-bold ${done[i] ? 'border-nominal bg-nominal text-[#01030B]' : i === step ? 'border-accent text-accent' : 'border-line-strong'}`}>{done[i] ? '✓' : i + 1}</span>
                    <span className="line-clamp-2">{tr(s.text)}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-2xl border border-line bg-black/20 p-4">
            <h2 className="mb-2 text-meta font-semibold uppercase tracking-[0.18em] text-fg-3">{t('Reconhecer', 'Recognize')}</h2>
            <ul className="list-disc space-y-1 pl-4 text-body-sm text-fg-2">{m.recognize.map((r, i) => <li key={i}>{tr(r)}</li>)}</ul>
          </div>
          <div className="rounded-2xl border border-critical/40 bg-critical/10 p-4">
            <h2 className="mb-2 text-meta font-semibold uppercase tracking-[0.18em] text-critical">{t('Quando chamar o solo', 'When to call the ground')}</h2>
            <p className="text-body-sm text-fg-1">{tr(m.callGround)}</p>
          </div>
          <details className="rounded-2xl border border-line bg-black/20 p-4">
            <summary className="cursor-pointer text-meta font-semibold uppercase tracking-[0.18em] text-fg-3">{t('O que muda no espaço · fontes', 'What changes in space · sources')}</summary>
            <ul className="mt-2 space-y-2 text-body-sm text-fg-2">
              {m.spaceNotes.map((n, i) => <li key={i}>• {tr(n.text)} <SourceLinks sources={n.src} /></li>)}
            </ul>
            <SourceLinks sources={m.sources} />
          </details>
        </aside>
      </main>
    </motion.div>,
    document.body,
  )
}

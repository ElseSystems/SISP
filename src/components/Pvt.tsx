import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Card, SourceLinks, Badge } from './ui'
import { useStore } from '../lib/store'
import { isoDay } from '../lib/crew'
import { fatigueStatus } from '../lib/assessment'
import { SOURCES } from '../lib/knowledge'
import type { PvtResult } from '../lib/types'
import { t } from '../lib/i18n'

type Phase = 'idle' | 'countdown' | 'wait' | 'stimulus' | 'feedback' | 'done'
const LAPSE_MS = 355 // PVT-B lapse threshold (Basner et al. 2011)
const ISI: [number, number] = [1000, 4000] // PVT-B inter-stimulus interval
const TIMEOUT_MS = 3000
const DURATIONS = [30, 60, 120, 180] as const

/** PVT-B style vigilance test: react as fast as possible to a millisecond counter. */
export default function Pvt() {
  const c = useStore((s) => s.crew.find((x) => x.id === s.selectedId)!)
  const addPvt = useStore((s) => s.addPvt)
  const [dur, setDur] = useState<(typeof DURATIONS)[number]>(180)
  const [phase, setPhase] = useState<Phase>('idle')
  const [count, setCount] = useState(3)
  const [ms, setMs] = useState(0)
  const [flash, setFlash] = useState<{ kind: 'rt' | 'false' | 'lapse'; v?: number } | null>(null)
  const [left, setLeft] = useState(0)
  const [res, setRes] = useState<PvtResult | null>(null)
  const rts = useRef<number[]>([])
  const falseStarts = useRef(0)
  const onset = useRef(0)
  const end = useRef(0)
  const timer = useRef<number>(0)
  const raf = useRef(0)
  const phaseRef = useRef<Phase>('idle')
  const scheduleRef = useRef<() => void>(() => {})
  const [nResp, setNResp] = useState(0)
  const go = (p: Phase) => { phaseRef.current = p; setPhase(p) }

  const clear = () => { clearTimeout(timer.current); cancelAnimationFrame(raf.current) }
  useEffect(() => clear, [])

  const finish = useCallback(() => {
    clear()
    const v = [...rts.current].sort((a, b) => a - b)
    const valid = v.filter((x) => x >= 100)
    const median = valid.length ? valid[Math.floor(valid.length / 2)] : 0
    const mean = valid.length ? valid.reduce((a, x) => a + x, 0) / valid.length : 0
    const speed = valid.length ? valid.reduce((a, x) => a + 1000 / x, 0) / valid.length : 0
    const r: PvtResult = { date: isoDay(new Date()), at: Date.now(), durationSec: dur, n: valid.length, meanMs: Math.round(mean), medianMs: Math.round(median), lapses: valid.filter((x) => x >= LAPSE_MS).length, falseStarts: falseStarts.current, speed: Math.round(speed * 10) / 10, source: 'manual' }
    setRes(r); go('done')
  }, [dur])

  const schedule = useCallback(() => {
    if (performance.now() >= end.current) { finish(); return }
    go('wait')
    const isi = ISI[0] + Math.random() * (ISI[1] - ISI[0])
    timer.current = window.setTimeout(() => {
      onset.current = performance.now()
      go('stimulus')
      const tick = () => {
        const e = performance.now() - onset.current
        setMs(Math.round(e))
        if (e >= TIMEOUT_MS) { rts.current.push(TIMEOUT_MS); setNResp(rts.current.length); setFlash({ kind: 'lapse' }); go('feedback'); timer.current = window.setTimeout(() => scheduleRef.current(), 700); return }
        raf.current = requestAnimationFrame(tick)
      }
      raf.current = requestAnimationFrame(tick)
    }, isi)
  }, [finish])
  useEffect(() => { scheduleRef.current = schedule }, [schedule])

  const begin = () => {
    rts.current = []; falseStarts.current = 0; setNResp(0); setRes(null); setFlash(null)
    go('countdown'); setCount(3)
    let n = 3
    const step = () => {
      n -= 1
      if (n > 0) { setCount(n); timer.current = window.setTimeout(step, 700) }
      else { end.current = performance.now() + dur * 1000; schedule() }
    }
    timer.current = window.setTimeout(step, 700)
  }

  const respond = useCallback(() => {
    const p = phaseRef.current
    if (p === 'stimulus') {
      const rt = performance.now() - onset.current
      cancelAnimationFrame(raf.current)
      if (rt < 100) { falseStarts.current += 1; setFlash({ kind: 'false' }) }
      else { rts.current.push(rt); setNResp(rts.current.length); setFlash({ kind: rt >= LAPSE_MS ? 'lapse' : 'rt', v: Math.round(rt) }) }
      go('feedback')
      timer.current = window.setTimeout(schedule, 600)
    } else if (p === 'wait') {
      falseStarts.current += 1; setFlash({ kind: 'false' })
      clearTimeout(timer.current); go('feedback')
      timer.current = window.setTimeout(schedule, 800)
    }
  }, [schedule])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Space' && ['wait', 'stimulus', 'feedback'].includes(phaseRef.current)) { e.preventDefault(); respond() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [respond])

  // remaining time indicator
  useEffect(() => {
    if (!['wait', 'stimulus', 'feedback'].includes(phase)) return
    const id = setInterval(() => setLeft(Math.max(0, Math.ceil((end.current - performance.now()) / 1000))), 250)
    return () => clearInterval(id)
  }, [phase])

  const running = ['countdown', 'wait', 'stimulus', 'feedback'].includes(phase)
  const preview = res ? fatigueStatus({ ...c, pvt: [...(c.pvt ?? []), res] }) : fatigueStatus(c)
  const hist = c.pvt ?? []

  return (
    <Card title={t('⚡ PVT – teste de vigilância psicomotora', '⚡ PVT – psychomotor vigilance test')} right={<Badge s={preview.severity} />}>
      {!running && phase !== 'done' && (
        <>
          <p className="text-body-sm text-fg-2">{t('Toque/aperte ESPAÇO assim que o contador aparecer. O PVT é o teste mais sensível à privação de sono e faz parte da bateria Cognition usada na ISS.',
            'Tap / press SPACE as soon as the counter appears. The PVT is the test most sensitive to sleep loss and is part of the Cognition battery used on the ISS.')}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2" role="radiogroup" aria-label={t('Duração', 'Duration')}>
            {DURATIONS.map((d) => (
              <button key={d} role="radio" aria-checked={dur === d} onClick={() => setDur(d)}
                className={`rounded-full border px-3 py-1 text-body-sm ${dur === d ? 'border-accent bg-accent/15 text-fg-1' : 'border-line-strong text-fg-2 hover:text-fg-1'}`}>
                {d < 60 ? `${d} s demo` : `${d / 60} min`}{d === 180 && ' · PVT-B'}
              </button>
            ))}
          </div>
          <button onClick={begin} className="mt-3 w-full rounded-xl bg-accent py-3 font-display text-title font-bold text-accent-ink hover:bg-accent-strong">▶ {t('Iniciar teste', 'Start test')}</button>
          <FatigueSummary f={preview} hist={hist} />
        </>
      )}

      {running && (
        <div>
          <button onPointerDown={(e) => { e.preventDefault(); respond() }}
            className={`relative flex h-72 w-full select-none items-center justify-center rounded-2xl border-2 transition-colors ${phase === 'stimulus' ? 'border-caution bg-[#1a1503]' : 'border-line bg-surface-2'}`}
            aria-label={t('Área de resposta', 'Response area')}>
            {phase === 'countdown' && <motion.span key={count} initial={{ scale: 1.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="font-mono text-display-xl text-fg-1">{count}</motion.span>}
            {phase === 'wait' && <span className="text-body text-fg-3">{t('aguarde…', 'wait…')}</span>}
            {phase === 'stimulus' && <span className="font-mono text-display-xl font-bold text-caution tnum">{ms}</span>}
            <AnimatePresence>
              {phase === 'feedback' && flash && (
                <motion.span initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  className={`font-mono text-display font-bold ${flash.kind === 'rt' ? 'text-nominal' : flash.kind === 'lapse' ? 'text-warning' : 'text-critical'}`}>
                  {flash.kind === 'false' ? t('ANTECIPOU', 'FALSE START') : flash.kind === 'lapse' ? (flash.v ? `${flash.v} ms · ${t('lapso', 'lapse')}` : t('LAPSO', 'LAPSE')) : `${flash.v} ms`}
                </motion.span>
              )}
            </AnimatePresence>
            <span className="absolute right-3 top-3 font-mono text-meta text-fg-3">{phase === 'countdown' ? '' : `${left}s · ${nResp} ${t('respostas', 'responses')}`}</span>
          </button>
          <button onClick={() => { clear(); go('idle') }} className="mt-2 text-body-sm text-fg-3 underline">{t('Cancelar', 'Cancel')}</button>
        </div>
      )}

      {phase === 'done' && res && (
        <div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat k={t('Mediana', 'Median')} v={`${res.medianMs} ms`} />
            <Stat k={t('Lapsos ≥355 ms', 'Lapses ≥355 ms')} v={String(res.lapses)} warn={res.lapses >= 3} />
            <Stat k={t('Antecipações', 'False starts')} v={String(res.falseStarts)} warn={res.falseStarts >= 3} />
            <Stat k={t('Velocidade', 'Speed')} v={`${res.speed} /s`} />
          </div>
          <FatigueSummary f={preview} hist={[...hist, res]} />
          {res.n < 5 && <p className="mt-2 text-body-sm text-warning">{t('Poucas respostas válidas — repita o teste.', 'Too few valid responses — repeat the test.')}</p>}
          {res.durationSec < 180 && <p className="mt-2 text-meta text-fg-3">{t('Sessões curtas são menos sensíveis que o PVT-B de 3 min.', 'Short sessions are less sensitive than the 3-min PVT-B.')}</p>}
          <div className="mt-3 flex gap-2">
            <button onClick={() => { addPvt(res); setRes(null); go('idle') }} disabled={res.n < 5} className="rounded-lg bg-accent px-4 py-2 font-bold text-accent-ink hover:bg-accent-strong disabled:opacity-40">{t('Salvar sessão', 'Save session')} <span className="text-meta">+15 XP</span></button>
            <button onClick={begin} className="rounded-lg border border-line-strong px-3 py-2 text-body-sm text-fg-1 hover:bg-surface-3">↻ {t('Repetir', 'Repeat')}</button>
          </div>
        </div>
      )}
      <SourceLinks sources={[SOURCES.pvtb, SOURCES.cognition]} />
    </Card>
  )
}

function Stat({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return <div className="rounded-xl bg-surface-2 p-3"><div className="text-meta text-fg-3">{k}</div><div className={`font-mono text-metric font-bold ${warn ? 'text-warning' : 'text-fg-1'}`}>{v}</div></div>
}

function FatigueSummary({ f, hist }: { f: ReturnType<typeof fatigueStatus>; hist: PvtResult[] }) {
  const max = Math.max(400, ...hist.map((h) => h.medianMs))
  return (
    <div className="mt-4 rounded-xl border border-line bg-surface-1 p-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-body-sm">
        <span className="text-fg-2">{t('Sua base', 'Your baseline')}: <b className="font-mono text-fg-1">{Number.isNaN(f.baselineMs) ? '—' : `${Math.round(f.baselineMs)} ms`}</b></span>
        {f.latest && <span className="text-fg-2">{t('Última', 'Latest')}: <b className="font-mono text-fg-1">{f.latest.medianMs} ms</b> <span style={{ color: f.slowingPct >= 10 ? 'var(--sisp-warning)' : 'var(--sisp-nominal)' }}>({f.slowingPct >= 0 ? '▲ +' : '▼ '}{f.slowingPct.toFixed(0)}%)</span></span>}
        <span className="text-fg-2">{t('Sono 3 noites', '3-night sleep')}: <b className="font-mono text-fg-1">{Number.isNaN(f.sleepAvg3) ? '—' : `${f.sleepAvg3.toFixed(1)} h`}</b></span>
      </div>
      <div className="mt-3 flex h-20 items-end gap-1.5" aria-label={t('Histórico de PVT', 'PVT history')}>
        {hist.slice(-10).map((h, i, arr) => (
          <div key={h.at + '-' + i} className="flex flex-1 flex-col items-center gap-1">
            <motion.div initial={{ height: 0 }} animate={{ height: `${(h.medianMs / max) * 64}px` }} transition={{ delay: i * 0.03 }}
              className="w-full rounded-t" style={{ background: i === arr.length - 1 ? (h.medianMs > (f.baselineMs || 0) * 1.1 ? 'var(--sisp-warning)' : 'var(--sisp-accent)') : 'var(--sisp-surface-3)' }} title={`${h.date} · ${h.medianMs} ms · ${h.lapses} lapses`} />
            <span className="font-mono text-[0.65rem] text-fg-3">{h.date.slice(5)}</span>
          </div>
        ))}
      </div>
      {f.reasons.length > 0 ? (
        <ul className="mt-2 list-disc pl-5 text-body-sm text-fg-1">{f.reasons.map((r) => <li key={r.en}>{t(r.pt, r.en)}</li>)}</ul>
      ) : <p className="mt-2 text-body-sm text-nominal">{t('Vigilância dentro do seu padrão.', 'Vigilance within your usual pattern.')}</p>}
      <p className="mt-2 text-body-sm text-sky-200">👉 {f.severity >= 2
        ? t('Fadiga provável: evite EVA/operações críticas hoje, cochilo de 20–30 min se o plano permitir, avise o CMO e priorize 7+ h de sono.', 'Likely fatigue: avoid EVA/critical ops today, 20–30 min nap if the plan allows, inform the CMO and prioritize 7+ h of sleep.')
        : f.severity === 1 ? t('Leve queda de vigilância: dupla checagem em tarefas críticas, luz azulada de dia, refaça amanhã.', 'Slight drop in vigilance: double-check critical tasks, blue-enriched light by day, repeat tomorrow.')
          : t('Repita a cada 1–2 dias para manter sua base atualizada.', 'Repeat every 1–2 days to keep your baseline current.')}</p>
    </div>
  )
}

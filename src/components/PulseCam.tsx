import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Card, SourceLinks } from './ui'
import { useStore } from '../lib/store'
import { isoDay } from '../lib/crew'
import { SOURCES } from '../lib/knowledge'
import { demoSample, estimateBpm, filter, fingerOn, resample, FS } from '../lib/ppg'
import type { Sample } from '../lib/ppg'
import { t } from '../lib/i18n'

type Phase = 'idle' | 'starting' | 'measuring' | 'result' | 'error'
const MEASURE_SEC = 20
const nowMs = () => performance.now()

/**
 * Fingertip PPG on the camera (rear camera + torch on phones; webcam with a lamp behind the
 * finger on laptops). Shows the live waveform, signal quality and a BPM *estimate*.
 */
export default function PulseCam() {
  const addPulse = useStore((s) => s.addPulse)
  const c = useStore((s) => s.crew.find((x) => x.id === s.selectedId)!)
  const [phase, setPhase] = useState<Phase>('idle')
  const [demo, setDemo] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [live, setLive] = useState<{ bpm?: number; q: number; finger: boolean; elapsed: number }>({ q: 0, finger: false, elapsed: 0 })
  const [result, setResult] = useState<{ bpm: number; quality: number } | null>(null)
  const [torch, setTorch] = useState(false)
  const video = useRef<HTMLVideoElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const wave = useRef<HTMLCanvasElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const samples = useRef<Sample[]>([])
  const raf = useRef(0)
  const t0 = useRef(0)
  const onFingerSince = useRef(0)

  const stop = () => {
    cancelAnimationFrame(raf.current)
    stream.current?.getTracks().forEach((tr) => tr.stop())
    stream.current = null
  }
  useEffect(() => stop, [])

  const start = async (useDemo: boolean) => {
    setErr(null); setResult(null); samples.current = []; setDemo(useDemo); setTorch(false)
    setPhase('starting')
    if (!useDemo) {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error(t('Câmera indisponível (use https ou localhost).', 'Camera unavailable (use https or localhost).'))
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 30 } }, audio: false })
        stream.current = s
        const track = s.getVideoTracks()[0]
        const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean }
        if (caps.torch) {
          try { await track.applyConstraints({ advanced: [{ torch: true } as MediaTrackConstraintSet] }); setTorch(true) } catch { /* torch optional */ }
        }
        if (video.current) { video.current.srcObject = s; await video.current.play() }
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e)); setPhase('error'); return
      }
    }
    t0.current = nowMs(); onFingerSince.current = useDemo ? t0.current : 0
    setPhase('measuring')
    loop(useDemo)
  }

  const loop = (useDemo: boolean) => {
    const ctx = canvas.current?.getContext('2d', { willReadFrequently: true })
    const tick = () => {
      const now = nowMs()
      let r = 0, g = 0, b = 0
      if (useDemo) { r = demoSample(now - t0.current); g = 40; b = 30 }
      else if (ctx && video.current && video.current.readyState >= 2) {
        ctx.drawImage(video.current, 0, 0, 32, 24)
        const px = ctx.getImageData(0, 0, 32, 24).data
        for (let i = 0; i < px.length; i += 4) { r += px[i]; g += px[i + 1]; b += px[i + 2] }
        const n = px.length / 4; r /= n; g /= n; b /= n
      }
      const finger = useDemo || fingerOn(r, g, b)
      if (!finger) { onFingerSince.current = 0; samples.current = [] }
      else {
        if (!onFingerSince.current) onFingerSince.current = now
        samples.current.push({ t: now, v: -r }) // more blood → less light: invert so systole points up
        if (samples.current.length > FS * 40) samples.current.shift()
      }
      const elapsed = onFingerSince.current ? (now - onFingerSince.current) / 1000 : 0
      const sig = filter(resample(samples.current))
      drawWave(sig.slice(-FS * 6))
      const est = sig.length > FS * 6 ? estimateBpm(sig.slice(-FS * 10)) : null
      setLive({ bpm: est && est.quality > 0.3 ? est.bpm : undefined, q: est?.quality ?? 0, finger, elapsed })
      if (elapsed >= MEASURE_SEC) {
        const fin = estimateBpm(sig.slice(-FS * 15))
        stop()
        setResult(fin); setPhase('result')
        return
      }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }

  const drawWave = (sig: number[]) => {
    const cv = wave.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return
    const w = cv.width, h = cv.height
    ctx.clearRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(148,163,184,0.12)'; ctx.lineWidth = 1
    for (let x = 0; x < w; x += w / 6) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
    if (sig.length < 2) return
    const lo = Math.min(...sig), hi = Math.max(...sig), span = hi - lo || 1
    ctx.strokeStyle = '#FF6B6B'; ctx.lineWidth = 2.5; ctx.shadowColor = '#FF6B6B'; ctx.shadowBlur = 8
    ctx.beginPath()
    sig.forEach((v, i) => { const x = (i / (sig.length - 1)) * w, y = h - 6 - ((v - lo) / span) * (h - 12); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y) })
    ctx.stroke(); ctx.shadowBlur = 0
  }

  const save = () => {
    if (!result) return
    addPulse({ at: Date.now(), date: isoDay(new Date()), bpm: result.bpm, quality: result.quality, source: demo ? 'demo' : 'camera' })
    setPhase('idle')
  }

  const qLabel = (q: number) => (q >= 0.6 ? [t('boa', 'good'), 'var(--sisp-nominal)'] : q >= 0.35 ? [t('razoável', 'fair'), 'var(--sisp-caution)'] : [t('fraca', 'poor'), 'var(--sisp-warning)'])
  const [ql, qc] = qLabel(phase === 'result' ? result?.quality ?? 0 : live.q)
  const progress = Math.min(1, live.elapsed / MEASURE_SEC)
  const lastSaved = c.pulse?.at(-1)
  const rest = c.readings.at(-1)?.hr

  return (
    <Card title={t('📷 Pulso pela câmera (PPG) · estimativa', '📷 Camera pulse (PPG) · estimate')}
      right={<span className="rounded-full border border-warning/50 px-2 py-0.5 text-meta text-warning">{t('não diagnóstico', 'not diagnostic')}</span>}>
      <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
        <div className="relative mx-auto h-44 w-44">
          <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
            <circle cx="50" cy="50" r="46" fill="none" stroke="var(--sisp-surface-3)" strokeWidth="5" />
            <circle cx="50" cy="50" r="46" fill="none" stroke="#FF6B6B" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 46}`} strokeDashoffset={`${2 * Math.PI * 46 * (1 - (phase === 'result' ? 1 : progress))}`} style={{ transition: 'stroke-dashoffset 0.3s' }} />
          </svg>
          <div className="absolute inset-3 overflow-hidden rounded-full bg-[#2a0508]">
            <video ref={video} playsInline muted className={`h-full w-full object-cover ${demo || phase !== 'measuring' ? 'opacity-0' : 'opacity-60'}`} />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              {phase === 'measuring' && live.bpm ? (
                <motion.div key={live.bpm} initial={{ scale: 1.15 }} animate={{ scale: 1 }} transition={{ duration: 0.12 }}>
                  <div className="font-mono text-display font-bold text-fg-1 tnum">{live.bpm}</div><div className="text-meta text-fg-2">bpm</div>
                </motion.div>
              ) : phase === 'result' && result ? (
                <div><div className="font-mono text-display font-bold text-fg-1">{result.bpm}</div><div className="text-meta text-fg-2">bpm · {t('estimado', 'estimated')}</div></div>
              ) : phase === 'measuring' ? (
                <div className="px-4 text-body-sm text-fg-1">{live.finger ? t('Calibrando…', 'Calibrating…') : t('☝️ Cubra a lente com a ponta do dedo', '☝️ Cover the lens with your fingertip')}</div>
              ) : <div className="text-5xl" aria-hidden>☝️</div>}
            </div>
          </div>
          <canvas ref={canvas} width={32} height={24} className="hidden" />
        </div>

        <div className="min-w-0">
          <canvas ref={wave} width={520} height={96} className="h-24 w-full rounded-xl bg-surface-2" aria-label={t('Onda de pulso ao vivo', 'Live pulse waveform')} />
          <div className="mt-2 flex flex-wrap items-center gap-3 text-body-sm">
            <span className="text-fg-2">{t('Qualidade do sinal', 'Signal quality')}: <b style={{ color: qc }}>{ql}</b></span>
            {phase === 'measuring' && <span className="font-mono text-fg-2">{Math.floor(live.elapsed)} / {MEASURE_SEC} s</span>}
            {demo && <span className="rounded bg-surface-3 px-2 text-meta text-fg-2">{t('sinal de demonstração (sem câmera)', 'demo signal (no camera)')}</span>}
            {torch && <span className="text-meta text-caution">🔦 {t('lanterna ligada', 'torch on')}</span>}
          </div>
          {phase === 'idle' || phase === 'error' ? (
            <>
              <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-body-sm text-fg-2">
                <li>{t('Celular: dedo indicador cobrindo a câmera traseira e a lanterna. Notebook: dedo na webcam com uma luz atrás.', 'Phone: index finger covering the rear camera and torch. Laptop: finger on the webcam with a light behind it.')}</li>
                <li>{t('Pressão leve, mão apoiada e imóvel por 20 s (fixe-se no apoio de pés em microgravidade).', 'Light pressure, hand rested and still for 20 s (anchor in a foot restraint in microgravity).')}</li>
                <li>{t('Compare com sua FC de repouso do check-in.', 'Compare with your resting HR from the check-in.')}</li>
              </ol>
              {err && <p className="mt-2 rounded-lg border border-warning/50 bg-warning/10 p-2 text-body-sm text-warning">⚠️ {err} {t('Use o sinal de demonstração para ver o fluxo.', 'Use the demo signal to see the flow.')}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => start(false)} className="rounded-lg bg-accent px-4 py-2 font-bold text-accent-ink hover:bg-accent-strong">▶ {t('Medir com a câmera', 'Measure with camera')}</button>
                <button onClick={() => start(true)} className="rounded-lg border border-line-strong px-3 py-2 text-body-sm text-fg-1 hover:bg-surface-3">{t('Sinal de demonstração', 'Demo signal')}</button>
              </div>
            </>
          ) : phase === 'measuring' || phase === 'starting' ? (
            <button onClick={() => { stop(); setPhase('idle') }} className="mt-3 rounded-lg border border-line-strong px-3 py-2 text-body-sm text-fg-1 hover:bg-surface-3">■ {t('Cancelar', 'Cancel')}</button>
          ) : result ? (
            <div className="mt-2">
              <p className="text-body-sm text-fg-1">
                {t('Estimativa', 'Estimate')}: <b className="font-mono">{result.bpm} bpm</b>
                {rest !== undefined && <> · {t('check-in', 'check-in')} {rest} bpm ({result.bpm - rest >= 0 ? '+' : ''}{result.bpm - rest})</>}
                {result.quality < 0.35 && <span className="text-warning"> · {t('sinal fraco: repita parado', 'weak signal: repeat holding still')}</span>}
                {Math.abs(result.bpm - (rest ?? result.bpm)) > 20 && result.quality >= 0.35 && <span className="text-caution"> · {t('diferença > 20 bpm: confirme com o Bio-Monitor/oxímetro', 'difference > 20 bpm: confirm with Bio-Monitor/oximeter')}</span>}
              </p>
              <div className="mt-2 flex gap-2">
                <button onClick={save} className="rounded-lg bg-accent px-4 py-2 font-bold text-accent-ink hover:bg-accent-strong">{t('Salvar estimativa', 'Save estimate')} <span className="text-meta">+10 XP</span></button>
                <button onClick={() => start(demo)} className="rounded-lg border border-line-strong px-3 py-2 text-body-sm text-fg-1 hover:bg-surface-3">↻ {t('Repetir', 'Repeat')}</button>
              </div>
            </div>
          ) : <p className="mt-2 text-body-sm text-warning">{t('Não foi possível estimar. Repita com o dedo imóvel.', 'Could not estimate. Repeat with the finger still.')}</p>}
          {lastSaved && phase === 'idle' && <p className="mt-2 text-meta text-fg-3">{t('Última estimativa salva', 'Last saved estimate')}: {lastSaved.bpm} bpm · {new Date(lastSaved.at).toISOString().slice(11, 16)} GMT{lastSaved.source === 'demo' ? ` · ${t('demo', 'demo')}` : ''}</p>}
        </div>
      </div>
      <p className="mt-3 text-meta text-fg-3">{t('Como funciona: a cada batimento o volume de sangue na ponta do dedo muda e a luz vermelha captada pela câmera pulsa. O SISP filtra o sinal e mede o período por autocorrelação. A imagem não sai do aparelho. É uma estimativa — precisão varia com aparelho, luz e movimento.',
        'How it works: with every heartbeat the blood volume in the fingertip changes and the red light reaching the camera pulses. SISP filters the signal and measures the period by autocorrelation. The image never leaves the device. It is an estimate — accuracy varies with device, light and motion.')}</p>
      <SourceLinks sources={[SOURCES.ppg]} />
    </Card>
  )
}

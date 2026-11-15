/**
 * Fingertip photoplethysmography (PPG) from the camera: the red channel brightness pulses with
 * every heartbeat as blood volume in the fingertip changes. We resample to 30 Hz, remove the
 * slow drift, smooth, and estimate the period by autocorrelation (40–180 bpm).
 * ⚠️ Estimate only — accuracy varies by device, light and motion (Coppetti et al. 2017).
 */
export interface Sample { t: number; v: number }

export const FS = 30

/** linear resampling of irregular camera frames to a uniform grid */
export function resample(samples: Sample[], fs = FS): number[] {
  if (samples.length < 2) return []
  const t0 = samples[0].t, t1 = samples[samples.length - 1].t
  const n = Math.floor(((t1 - t0) / 1000) * fs)
  const out: number[] = []
  let j = 0
  for (let i = 0; i < n; i++) {
    const t = t0 + (i * 1000) / fs
    while (j < samples.length - 2 && samples[j + 1].t < t) j++
    const a = samples[j], b = samples[j + 1]
    const k = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t)
    out.push(a.v + (b.v - a.v) * k)
  }
  return out
}

const movingAvg = (x: number[], w: number) => {
  const out = new Array(x.length).fill(0)
  let s = 0
  for (let i = 0; i < x.length; i++) {
    s += x[i]
    if (i >= w) s -= x[i - w]
    out[i] = s / Math.min(i + 1, w)
  }
  return out
}

/** band-limit: subtract ~1.5 s trend (high-pass) then 5-sample smoothing (low-pass ~6 Hz) */
export function filter(x: number[], fs = FS): number[] {
  if (!x.length) return []
  const trend = movingAvg(x, Math.round(fs * 1.5))
  const hp = x.map((v, i) => v - trend[i])
  return movingAvg(hp, 5)
}

/** BPM by normalized autocorrelation; quality = peak correlation (0–1). */
export function estimateBpm(x: number[], fs = FS): { bpm: number; quality: number } | null {
  if (x.length < fs * 5) return null
  const mean = x.reduce((a, v) => a + v, 0) / x.length
  const y = x.map((v) => v - mean)
  const e = y.reduce((a, v) => a + v * v, 0)
  if (e === 0) return null
  const minLag = Math.round((fs * 60) / 180), maxLag = Math.round((fs * 60) / 40)
  let best = -1, bestLag = 0
  const ac: number[] = []
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0
    for (let i = 0; i + lag < y.length; i++) s += y[i] * y[i + lag]
    const r = s / e * (y.length / (y.length - lag))
    ac[lag] = r
    if (r > best) { best = r; bestLag = lag }
  }
  // prefer the fundamental: if half the lag is also strongly periodic, take it
  const half = Math.round(bestLag / 2)
  if (half >= minLag && (ac[half] ?? 0) > 0.8 * best) bestLag = half
  // parabolic interpolation for sub-sample precision
  const a = ac[bestLag - 1] ?? ac[bestLag], b = ac[bestLag], c = ac[bestLag + 1] ?? ac[bestLag]
  const den = a - 2 * b + c
  const shift = den !== 0 ? (0.5 * (a - c)) / den : 0
  const lag = bestLag + Math.max(-0.5, Math.min(0.5, shift))
  return { bpm: Math.round((60 * fs) / lag), quality: Math.max(0, Math.min(1, best)) }
}

/** is a fingertip covering the lens? (red-dominant, bright enough) */
export const fingerOn = (r: number, g: number, b: number) => r > 60 && r > 1.6 * g && r > 1.6 * b

/** synthetic PPG for the no-camera demo: systolic upstroke + dicrotic notch + noise */
export function demoSample(tMs: number, bpm = 68) {
  const ph = ((tMs / 1000) * bpm / 60) % 1
  const wave = Math.exp(-((ph - 0.15) ** 2) / 0.006) + 0.35 * Math.exp(-((ph - 0.45) ** 2) / 0.01)
  const drift = 3 * Math.sin(tMs / 4000)
  return 180 - 6 * wave + drift + (Math.random() - 0.5) * 1.2
}

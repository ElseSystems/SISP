/**
 * TypeScript reference of libsisp (core/src/sisp.c) — same algorithm, same operation order,
 * so the WASM build and this fallback return identical numbers. Used when WebAssembly is
 * unavailable and to generate core/tests/fixtures/parity.txt.
 * ⚠️ Prototype heuristics — not a medical device.
 */
import { BANDS, BASELINE_DAYS, BASELINE_MIN_N, BONE_LOSS_PER_MONTH_PCT, CAREER_LIMIT_MSV, FAT, INDICATOR_ORDER, PPG_MAX_LAG, PVT_LAPSE_MS, PVT_MIN_VALID_MS, R, SD_FLOOR, SOLAR, TEMP_DELTA_ALERT, TEMP_DELTA_ATTENTION, Z_ALERT, Z_ATTENTION } from './constants.ts'
import type { IndicatorId, Severity } from './constants.ts'

export interface CoreReading { sys: number; dia: number; hr: number; glucose: number; temp: number; sleep: number; mood: number; exerciseMin?: number; phq2?: number; selfHarm?: boolean }
export interface CoreBaseline { mean: number; sd: number; n: number }
export interface CoreFinding { severity: Severity; reasons: number; z: number; baselineMean: number; baselineN: number; delta: number; avg3: number }
export interface RadiationInput { missionDays: number; doseRate: number; priorCareerMSv: number; loggedEventMSv: number; liveEventMSv: number; solarActive: boolean; sheltered: boolean; deepSpace: boolean }
export interface RadiationOut { missionMSv: number; totalMSv: number; pct: number; daysLeft: number; eventMSv: number; severity: Severity; solarReason: number }
export interface SepDoseOut { dose: number; progress: number; avoided: number; projectedUnsheltered: number; done: boolean }
export interface PvtScore { n: number; meanMs: number; medianMs: number; lapses: number; falseStarts: number; speed: number }
export interface PvtSession { medianMs: number; lapses: number }
export interface FatigueOut { baselineMs: number; slowingPct: number; sleepAvg3: number; severity: Severity; reasons: number; latestLapses: number; hasLatest: boolean }
export interface BoneOut { months: number; adherence: number; low: number; high: number; severity: Severity }
export interface AggregateOut { overall: Severity; regions: Severity[] }
export interface PpgEstimate { bpm: number; quality: number }

/** JavaScript Math.round (C side: floor(x + 0.5)) */
const jsRound = (x: number) => Math.floor(x + 0.5)
const maxS = (a: Severity, b: Severity): Severity => (a > b ? a : b)
const asSev = (v: number): Severity => (v >= 3 ? 3 : v >= 2 ? 2 : v >= 1 ? 1 : 0)

export function bandSeverity(ind: IndicatorId, value: number): Severity {
  const b = BANDS[ind]
  if (!b.length || Number.isNaN(value)) return 0
  if (value < b[0].from) return b[0].severity
  for (const x of b) if (value >= x.from && value < x.to) return x.severity
  return b[b.length - 1].severity
}

type Field = keyof typeof SD_FLOOR

export function baselineOf(readings: readonly CoreReading[], idx: number, field: Field): CoreBaseline {
  const upto = Math.min(idx, readings.length)
  const from = upto > BASELINE_DAYS ? upto - BASELINE_DAYS : 0
  let sum = 0, n = 0
  for (let i = from; i < upto; i++) { const v = readings[i][field]; if (!Number.isNaN(v)) { sum += v; n++ } }
  if (!n) return { mean: NaN, sd: SD_FLOOR[field], n: 0 }
  const mean = sum / n
  let ss = 0
  for (let i = from; i < upto; i++) { const v = readings[i][field]; if (!Number.isNaN(v)) ss += (v - mean) * (v - mean) }
  const sd = Math.sqrt(ss / (n - 1 > 1 ? n - 1 : 1))
  return { mean, sd: Math.max(sd, SD_FLOOR[field]), n }
}

const newFinding = (): CoreFinding => ({ severity: 0, reasons: 0, z: NaN, baselineMean: NaN, baselineN: 0, delta: 0, avg3: NaN })

function zSeverity(value: number, b: CoreBaseline, f: CoreFinding): Severity {
  if (b.n < BASELINE_MIN_N) return 0
  const z = (value - b.mean) / b.sd
  f.z = z
  if (Math.abs(z) >= Z_ALERT) { f.reasons |= R.Z_STRONG; return 2 }
  if (Math.abs(z) >= Z_ATTENTION) { f.reasons |= R.Z_OUTSIDE; return 1 }
  return 0
}

function setBaseline(f: CoreFinding, b: CoreBaseline, value: number) {
  f.baselineMean = b.mean
  f.baselineN = b.n
  f.delta = b.n ? value - b.mean : 0
}

/** Assess readings[idx]: absolute limits (published guidelines) + personal-baseline deviation. */
export function assess(readings: readonly CoreReading[], idx: number): Record<IndicatorId, CoreFinding> {
  const r = readings[idx]
  const from3 = idx >= 2 ? idx - 2 : 0
  const out = Object.fromEntries(INDICATOR_ORDER.map((k) => [k, newFinding()])) as Record<IndicatorId, CoreFinding>
  { // blood pressure (AHA / NHLBI)
    const f = out.bp
    if (r.sys > 180 || r.dia > 120) { f.severity = 3; f.reasons |= R.BP_CRISIS }
    else if (r.sys >= 140 || r.dia >= 90) { f.severity = 2; f.reasons |= R.BP_STAGE2 }
    else if (r.sys >= 120) { f.severity = 1; f.reasons |= r.sys >= 130 || r.dia >= 80 ? R.BP_STAGE1 : R.BP_ELEVATED }
    else if (r.dia >= 80) { f.severity = 1; f.reasons |= R.BP_DIA80 }
    if (r.sys < 90 || r.dia < 60) { f.severity = maxS(f.severity, 1); f.reasons |= R.BP_LOW }
    const b = baselineOf(readings, idx, 'sys')
    f.severity = maxS(f.severity, zSeverity(r.sys, b, f))
    setBaseline(f, b, r.sys)
  }
  { // heart rate (AHA 60–100)
    const f = out.hr
    if (r.hr > 100) { f.severity = 1; f.reasons |= R.HR_TACHY }
    if (r.hr < 60) { f.severity = 1; f.reasons |= R.HR_BRADY }
    const b = baselineOf(readings, idx, 'hr')
    f.severity = maxS(f.severity, zSeverity(r.hr, b, f))
    setBaseline(f, b, r.hr)
  }
  { // fasting glucose (ADA)
    const f = out.glucose
    if (r.glucose < 54) { f.severity = 3; f.reasons |= R.GLU_SEVERE_HYPO }
    else if (r.glucose < 70) { f.severity = 2; f.reasons |= R.GLU_HYPO }
    else if (r.glucose >= 126) { f.severity = 2; f.reasons |= R.GLU_DIABETES }
    else if (r.glucose >= 100) { f.severity = 1; f.reasons |= R.GLU_IMPAIRED }
    const b = baselineOf(readings, idx, 'glucose')
    f.severity = maxS(f.severity, zSeverity(r.glucose, b, f))
    setBaseline(f, b, r.glucose)
  }
  { // temperature: absolute (CDC ≥38) + relative to the in-flight baseline (Stahn 2017)
    const f = out.temp
    const b = baselineOf(readings, idx, 'temp')
    const delta = b.n ? r.temp - b.mean : 0
    if (r.temp >= 38) { f.severity = 2; f.reasons |= R.TEMP_FEVER }
    if (b.n >= BASELINE_MIN_N && delta >= TEMP_DELTA_ALERT) { f.severity = maxS(f.severity, 2); f.reasons |= R.TEMP_DELTA_ALERT }
    else if (b.n >= BASELINE_MIN_N && delta >= TEMP_DELTA_ATTENTION) { f.severity = maxS(f.severity, 1); f.reasons |= R.TEMP_DELTA_ATTN }
    if (r.temp < 36) { f.severity = maxS(f.severity, 1); f.reasons |= R.TEMP_LOW }
    setBaseline(f, b, r.temp)
  }
  { // sleep (AASM ≥7 h) + 3-night average
    const f = out.sleep
    let sum = 0
    const n3 = idx + 1 - from3
    for (let i = from3; i <= idx; i++) sum += readings[i].sleep
    f.avg3 = sum / n3
    if (r.sleep < 5) { f.severity = 2; f.reasons |= R.SLEEP_LT5 }
    else if (r.sleep < 7) { f.severity = 1; f.reasons |= R.SLEEP_LT7 }
    if (n3 === 3 && f.avg3 < 5.5) { f.severity = maxS(f.severity, 2); f.reasons |= R.SLEEP_DEBT3 }
    const b = baselineOf(readings, idx, 'sleep')
    f.severity = maxS(f.severity, zSeverity(r.sleep, b, f))
    setBaseline(f, b, r.sleep)
  }
  { // mood (1–5) + PHQ-2 (Kroenke 2003)
    const f = out.mood
    if (r.mood <= 2) { f.severity = 1; f.reasons |= R.MOOD_LOW }
    let low = 0
    for (let i = from3; i <= idx; i++) if (readings[i].mood <= 2) low++
    if (low >= 3) { f.severity = maxS(f.severity, 2); f.reasons |= R.MOOD_LOW3 }
    if ((r.phq2 ?? -1) >= 3) { f.severity = maxS(f.severity, 2); f.reasons |= R.MOOD_PHQ2 }
    if (r.selfHarm) { f.severity = 3; f.reasons |= R.MOOD_SELF_HARM }
  }
  return out
}

export function radiation(i: RadiationInput): RadiationOut {
  const days = Math.max(0, i.missionDays)
  const eventMSv = i.loggedEventMSv + i.liveEventMSv
  const missionMSv = days * i.doseRate + eventMSv
  const totalMSv = i.priorCareerMSv + missionMSv
  const pct = (totalMSv / CAREER_LIMIT_MSV) * 100
  let severity: Severity = pct >= 100 ? 3 : pct >= 80 ? 2 : pct >= 50 ? 1 : 0
  let solarReason: number = SOLAR.NONE
  if (i.solarActive) {
    const ev: Severity = i.sheltered ? (i.deepSpace ? 2 : 1) : (i.deepSpace ? 3 : 2)
    severity = maxS(severity, ev)
    solarReason = i.sheltered ? SOLAR.IN_SHELTER : SOLAR.GO_TO_SHELTER
  }
  const daysLeft = Math.max(0, (CAREER_LIMIT_MSV - totalMSv) / i.doseRate)
  return { missionMSv, totalMSv, pct, daysLeft, eventMSv, severity, solarReason }
}

/** sheltered_at <= 0 → not sheltered */
export function sepDose(full: number, startedAt: number, shelteredAt: number, durationSec: number, now: number, factor: number): SepDoseOut {
  const dur = durationSec * 1000
  const end = Math.min(now, startedAt + dur)
  const shelterAt = shelteredAt > 0 ? Math.min(shelteredAt, end) : end
  const unsheltered = Math.max(0, shelterAt - startedAt)
  const sheltered = Math.max(0, end - shelterAt)
  const dose = full * (unsheltered / dur) + full * factor * (sheltered / dur)
  const progress = Math.min(1, (now - startedAt) / dur)
  const avoided = full * (sheltered / dur) * (1 - factor)
  return { dose, progress, avoided, projectedUnsheltered: full, done: progress >= 1 }
}

export function pvtScore(rts: readonly number[], falseStarts: number): PvtScore {
  const v = [...rts].sort((a, b) => a - b)
  let first = 0
  while (first < v.length && !(v[first] >= PVT_MIN_VALID_MS)) first++
  const nv = v.length - first
  if (!nv) return { n: 0, meanMs: 0, medianMs: 0, lapses: 0, falseStarts, speed: 0 }
  let sum = 0, lapses = 0, speed = 0
  for (let i = first; i < v.length; i++) { sum += v[i]; if (v[i] >= PVT_LAPSE_MS) lapses++ }
  for (let i = first; i < v.length; i++) speed += 1000 / v[i]
  return { n: nv, meanMs: jsRound(sum / nv), medianMs: jsRound(v[first + Math.floor(nv / 2)]), lapses, falseStarts, speed: jsRound((speed / nv) * 10) / 10 }
}

export function fatigue(hist: readonly PvtSession[], sleep: readonly number[]): FatigueOut {
  const nPrior = hist.length ? hist.length - 1 : 0
  const pFrom = nPrior > 6 ? nPrior - 6 : 0
  let baselineMs = NaN, sleepAvg3 = NaN, slowingPct = 0, severity: Severity = 0, reasons = 0
  if (nPrior - pFrom >= 3) { let s = 0; for (let i = pFrom; i < nPrior; i++) s += hist[i].medianMs; baselineMs = s / (nPrior - pFrom) }
  if (sleep.length) { const sFrom = sleep.length > 3 ? sleep.length - 3 : 0; let s = 0; for (let i = sFrom; i < sleep.length; i++) s += sleep[i]; sleepAvg3 = s / (sleep.length - sFrom) }
  if (!hist.length) return { baselineMs, slowingPct, sleepAvg3, severity, reasons, latestLapses: 0, hasLatest: false }
  const latest = hist[hist.length - 1]
  if (!Number.isNaN(baselineMs)) slowingPct = ((latest.medianMs - baselineMs) / baselineMs) * 100
  if (latest.lapses >= 5) { severity = 2; reasons |= FAT.LAPSES5 }
  else if (latest.lapses >= 3) { severity = 1; reasons |= FAT.LAPSES3 }
  if (slowingPct >= 20) { severity = maxS(severity, 2); reasons |= FAT.SLOW20 }
  else if (slowingPct >= 10) { severity = maxS(severity, 1); reasons |= FAT.SLOW10 }
  if (severity >= 1 && sleepAvg3 < 6) { severity = maxS(severity, 2); reasons |= FAT.SHORT_SLEEP }
  return { baselineMs, slowingPct, sleepAvg3, severity, reasons, latestLapses: latest.lapses, hasLatest: true }
}

export function bone(missionDays: number, ex: readonly number[]): BoneOut {
  const from = ex.length > 14 ? ex.length - 14 : 0
  let sum = 0
  for (let i = from; i < ex.length; i++) sum += ex[i]
  const months = Math.max(0, missionDays) / 30.44
  const adherence = Math.min(1, (sum / Math.max(1, ex.length - from)) / 120)
  const factor = 1 - 0.6 * adherence
  const low = months * BONE_LOSS_PER_MONTH_PCT[0] * factor
  const high = months * BONE_LOSS_PER_MONTH_PCT[1] * factor
  return { months, adherence, low, high, severity: high >= 5 ? 2 : high >= 3 ? 1 : 0 }
}

/** sev: indicator severities in INDICATOR_ORDER */
export function aggregate(sev: readonly number[], rad: number, boneSev: number, fat: number): AggregateOut {
  const [bp, hr, glu, temp, sleep, mood] = sev.map(asSev)
  const r = asSev(rad), b = asSev(boneSev), f = asSev(fat)
  const rad2: Severity = r < 2 ? r : 2
  const regions: Severity[] = [maxS(maxS(maxS(sleep, mood), maxS(temp, rad2)), f), maxS(bp, hr), hr, glu, b, maxS(temp, rad2)]
  let overall = maxS(maxS(r, b), f)
  for (const s of [bp, hr, glu, temp, sleep, mood]) overall = maxS(overall, s)
  return { overall, regions }
}

export function ppgResample(t: readonly number[], v: readonly number[], fs: number): number[] {
  const n = t.length
  if (n < 2 || !(fs > 0)) return []
  const t0 = t[0], t1 = t[n - 1]
  const m = Math.floor(((t1 - t0) / 1000) * fs)
  if (!(m > 0)) return []
  const out = new Array<number>(m)
  let j = 0
  for (let i = 0; i < m; i++) {
    const ti = t0 + (i * 1000) / fs
    while (j < n - 2 && t[j + 1] < ti) j++
    const k = t[j + 1] === t[j] ? 0 : (ti - t[j]) / (t[j + 1] - t[j])
    out[i] = v[j] + (v[j + 1] - v[j]) * k
  }
  return out
}

export function ppgFilter(x: readonly number[], fs: number): number[] {
  const n = x.length
  if (!n) return []
  const w = Math.max(1, jsRound(fs * 1.5))
  const out = new Array<number>(n)
  let s = 0
  for (let i = 0; i < n; i++) { s += x[i]; if (i >= w) s -= x[i - w]; out[i] = x[i] - s / (i + 1 < w ? i + 1 : w) }
  const ring = [0, 0, 0, 0, 0]
  let s2 = 0
  for (let i = 0; i < n; i++) { const hp = out[i]; s2 += hp; if (i >= 5) s2 -= ring[i % 5]; ring[i % 5] = hp; out[i] = s2 / (i + 1 < 5 ? i + 1 : 5) }
  return out
}

export function ppgEstimate(x: readonly number[], fs: number): PpgEstimate | null {
  const n = x.length
  if (!(fs > 0) || n < fs * 5) return null
  const minLag = jsRound((fs * 60) / 180), maxLag = jsRound((fs * 60) / 40)
  if (maxLag > PPG_MAX_LAG || minLag < 1 || maxLag >= n) return null
  let mean = 0
  for (let i = 0; i < n; i++) mean += x[i]
  mean /= n
  let e = 0
  for (let i = 0; i < n; i++) e += (x[i] - mean) * (x[i] - mean)
  if (e === 0) return null
  const ac = new Array<number>(maxLag + 2).fill(0)
  let best = -1, bestLag = 0
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0
    for (let i = 0; i + lag < n; i++) s += (x[i] - mean) * (x[i + lag] - mean)
    const r = s / e * (n / (n - lag))
    ac[lag] = r
    if (r > best) { best = r; bestLag = lag }
  }
  if (!bestLag) return null
  const half = jsRound(bestLag / 2)
  if (half >= minLag && ac[half] > 0.8 * best) bestLag = half
  const b = ac[bestLag]
  const a = bestLag - 1 >= minLag ? ac[bestLag - 1] : b
  const c = bestLag + 1 <= maxLag ? ac[bestLag + 1] : b
  const den = a - 2 * b + c
  const shift = den !== 0 ? (0.5 * (a - c)) / den : 0
  const lag = bestLag + Math.max(-0.5, Math.min(0.5, shift))
  return { bpm: jsRound((60 * fs) / lag), quality: Math.max(0, Math.min(1, best)) }
}

export const fingerOn = (r: number, g: number, b: number) => r > 60 && r > 1.6 * g && r > 1.6 * b

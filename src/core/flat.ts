/**
 * Flat ABI shared by libsisp (core/include/sisp_flat.h), its WASM build and the TS reference:
 * every op takes and returns packed doubles. `makeCore` turns any flat backend into the typed API.
 */
import { BASELINE_DAYS, INDICATOR_ORDER, OP } from './constants.ts'
import type { IndicatorId, Severity } from './constants.ts'
import * as ref from './reference.ts'
import type { AggregateOut, BoneOut, CoreFinding, CoreReading, FatigueOut, PpgEstimate, PvtScore, PvtSession, RadiationInput, RadiationOut, SepDoseOut } from './reference.ts'

export type FlatCall = (op: number, input: readonly number[]) => number[]
export type Backend = 'wasm' | 'ts'

export interface Core {
  readonly backend: Backend
  assess(readings: readonly CoreReading[], idx: number): Record<IndicatorId, CoreFinding>
  radiation(i: RadiationInput): RadiationOut
  sepDose(full: number, startedAt: number, shelteredAt: number, durationSec: number, now: number, factor: number): SepDoseOut
  pvtScore(rts: readonly number[], falseStarts: number): PvtScore
  fatigue(hist: readonly PvtSession[], sleep: readonly number[]): FatigueOut
  bone(missionDays: number, exerciseMin: readonly number[]): BoneOut
  aggregate(sev: readonly number[], radiation: number, bone: number, fatigue: number): AggregateOut
  ppgResample(t: readonly number[], v: readonly number[], fs: number): number[]
  ppgFilter(x: readonly number[], fs: number): number[]
  ppgEstimate(x: readonly number[], fs: number): PpgEstimate | null
}

const sev = (v: number) => v as Severity
const b = (v: boolean | undefined) => (v ? 1 : 0)

// ── encoders (inputs) ──────────────────────────────────────────────────────
export const enc = {
  assess: (rs: readonly CoreReading[], idx: number) => [rs.length, idx, ...rs.flatMap((r) => [r.sys, r.dia, r.hr, r.glucose, r.temp, r.sleep, r.mood, r.exerciseMin ?? 0, r.phq2 ?? NaN, b(r.selfHarm)])],
  radiation: (i: RadiationInput) => [i.missionDays, i.doseRate, i.priorCareerMSv, i.loggedEventMSv, i.liveEventMSv, b(i.solarActive), b(i.sheltered), b(i.deepSpace)],
  sepDose: (...a: number[]) => a,
  pvtScore: (rts: readonly number[], falseStarts: number) => [falseStarts, rts.length, ...rts],
  fatigue: (h: readonly PvtSession[], s: readonly number[]) => [h.length, ...h.flatMap((x) => [x.medianMs, x.lapses]), s.length, ...s],
  bone: (days: number, ex: readonly number[]) => [days, ex.length, ...ex],
  aggregate: (s: readonly number[], r: number, bo: number, f: number) => [...s, r, bo, f],
  ppgResample: (t: readonly number[], v: readonly number[], fs: number) => [fs, t.length, ...t, ...v],
  ppgSignal: (x: readonly number[], fs: number) => [fs, x.length, ...x],
}

// ── decoders (outputs) ─────────────────────────────────────────────────────
export const dec = {
  assess: (o: readonly number[]) => Object.fromEntries(INDICATOR_ORDER.map((k, i) => {
    const p = i * 7
    return [k, { severity: sev(o[p]), reasons: o[p + 1], z: o[p + 2], baselineMean: o[p + 3], baselineN: o[p + 4], delta: o[p + 5], avg3: o[p + 6] }]
  })) as Record<IndicatorId, CoreFinding>,
  radiation: (o: readonly number[]): RadiationOut => ({ missionMSv: o[0], totalMSv: o[1], pct: o[2], daysLeft: o[3], eventMSv: o[4], severity: sev(o[5]), solarReason: o[6] }),
  sepDose: (o: readonly number[]): SepDoseOut => ({ dose: o[0], progress: o[1], avoided: o[2], projectedUnsheltered: o[3], done: o[4] !== 0 }),
  pvtScore: (o: readonly number[]): PvtScore => ({ n: o[0], meanMs: o[1], medianMs: o[2], lapses: o[3], falseStarts: o[4], speed: o[5] }),
  fatigue: (o: readonly number[]): FatigueOut => ({ baselineMs: o[0], slowingPct: o[1], sleepAvg3: o[2], severity: sev(o[3]), reasons: o[4], latestLapses: o[5], hasLatest: o[6] !== 0 }),
  bone: (o: readonly number[]): BoneOut => ({ months: o[0], adherence: o[1], low: o[2], high: o[3], severity: sev(o[4]) }),
  aggregate: (o: readonly number[]): AggregateOut => ({ overall: sev(o[0]), regions: o.slice(1, 7).map(sev) }),
  ppgEstimate: (o: readonly number[]): PpgEstimate | null => (o[0] ? { bpm: o[1], quality: o[2] } : null),
}

// ── TS reference behind the same flat ABI (fixtures + parity tests) ────────
const flatFinding = (f: CoreFinding) => [f.severity, f.reasons, f.z, f.baselineMean, f.baselineN, f.delta, f.avg3]

export const referenceFlatCall: FlatCall = (op, x) => {
  switch (op) {
    case OP.ASSESS: {
      const count = x[0], idx = x[1]
      const rs: CoreReading[] = []
      for (let i = 0; i < count; i++) {
        const p = 2 + i * 10
        rs.push({ sys: x[p], dia: x[p + 1], hr: x[p + 2], glucose: x[p + 3], temp: x[p + 4], sleep: x[p + 5], mood: x[p + 6], exerciseMin: x[p + 7], phq2: Number.isNaN(x[p + 8]) ? undefined : Math.trunc(x[p + 8]), selfHarm: x[p + 9] !== 0 })
      }
      const a = ref.assess(rs, idx)
      return INDICATOR_ORDER.flatMap((k) => flatFinding(a[k]))
    }
    case OP.RADIATION: {
      const o = ref.radiation({ missionDays: x[0], doseRate: x[1], priorCareerMSv: x[2], loggedEventMSv: x[3], liveEventMSv: x[4], solarActive: x[5] !== 0, sheltered: x[6] !== 0, deepSpace: x[7] !== 0 })
      return [o.missionMSv, o.totalMSv, o.pct, o.daysLeft, o.eventMSv, o.severity, o.solarReason]
    }
    case OP.SEP_DOSE: { const o = ref.sepDose(x[0], x[1], x[2], x[3], x[4], x[5]); return [o.dose, o.progress, o.avoided, o.projectedUnsheltered, b(o.done)] }
    case OP.PVT_SCORE: { const o = ref.pvtScore(x.slice(2, 2 + x[1]), Math.trunc(x[0])); return [o.n, o.meanMs, o.medianMs, o.lapses, o.falseStarts, o.speed] }
    case OP.FATIGUE: {
      const nh = x[0]
      const hist: PvtSession[] = []
      for (let i = 0; i < nh; i++) hist.push({ medianMs: x[1 + i * 2], lapses: Math.trunc(x[2 + i * 2]) })
      const ns = x[1 + nh * 2]
      const o = ref.fatigue(hist, x.slice(2 + nh * 2, 2 + nh * 2 + ns))
      return [o.baselineMs, o.slowingPct, o.sleepAvg3, o.severity, o.reasons, o.latestLapses, b(o.hasLatest)]
    }
    case OP.BONE: { const o = ref.bone(x[0], x.slice(2, 2 + x[1])); return [o.months, o.adherence, o.low, o.high, o.severity] }
    case OP.AGGREGATE: { const o = ref.aggregate(x.slice(0, 6), x[6], x[7], x[8]); return [o.overall, ...o.regions] }
    case OP.PPG_RESAMPLE: { const n = x[1]; return ref.ppgResample(x.slice(2, 2 + n), x.slice(2 + n, 2 + 2 * n), x[0]) }
    case OP.PPG_FILTER: return ref.ppgFilter(x.slice(2, 2 + x[1]), x[0])
    case OP.PPG_ESTIMATE: { const e = ref.ppgEstimate(x.slice(2, 2 + x[1]), x[0]); return e ? [1, e.bpm, e.quality] : [0, 0, 0] }
    default: throw new Error(`unknown op ${op}`)
  }
}

/** Typed core over a flat backend. */
export function makeCore(call: FlatCall, backend: Backend): Core {
  return {
    backend,
    assess: (rs, idx) => {
      const from = Math.max(0, idx - BASELINE_DAYS) // the assessment never looks further back
      return dec.assess(call(OP.ASSESS, enc.assess(rs.slice(from, idx + 1), idx - from)))
    },
    radiation: (i) => dec.radiation(call(OP.RADIATION, enc.radiation(i))),
    sepDose: (...a) => dec.sepDose(call(OP.SEP_DOSE, enc.sepDose(...a))),
    pvtScore: (rts, fs) => dec.pvtScore(call(OP.PVT_SCORE, enc.pvtScore(rts, fs))),
    fatigue: (h, s) => dec.fatigue(call(OP.FATIGUE, enc.fatigue(h.slice(-7), s.slice(-3)))),
    bone: (d, ex) => dec.bone(call(OP.BONE, enc.bone(d, ex.slice(-14)))),
    aggregate: (s, r, bo, f) => dec.aggregate(call(OP.AGGREGATE, enc.aggregate(s, r, bo, f))),
    ppgResample: (t, v, fs) => call(OP.PPG_RESAMPLE, enc.ppgResample(t, v, fs)),
    ppgFilter: (x, fs) => call(OP.PPG_FILTER, enc.ppgSignal(x, fs)),
    ppgEstimate: (x, fs) => dec.ppgEstimate(call(OP.PPG_ESTIMATE, enc.ppgSignal(x, fs))),
  }
}

/** Pure TypeScript core (fallback). Calls the reference directly — no encode/decode. */
export const tsCore: Core = {
  backend: 'ts',
  assess: ref.assess,
  radiation: ref.radiation,
  sepDose: ref.sepDose,
  pvtScore: ref.pvtScore,
  fatigue: ref.fatigue,
  bone: ref.bone,
  aggregate: ref.aggregate,
  ppgResample: ref.ppgResample,
  ppgFilter: ref.ppgFilter,
  ppgEstimate: ref.ppgEstimate,
}

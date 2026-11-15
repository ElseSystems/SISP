/**
 * Assessment: absolute limits (published guidelines) + deviation from the PERSONAL baseline.
 * The numbers come from the SISP core — libsisp (C11 → WebAssembly) with the TypeScript
 * reference as fallback (src/core). This module only turns reason flags into bilingual text.
 * ⚠️ Prototype heuristics — not a medical device.
 */
import { core, ENV_NUMBERS, FAT, INDICATOR_ORDER, R, REGION_ORDER, SOLAR } from '../core'
import type { CoreFinding, CoreReading } from '../core'
import { baselineOf as refBaselineOf } from '../core/reference'
import type { BodyRegionId, EnvironmentId, IndicatorId, Severity } from './knowledge'
import type { CrewMember, Reading } from './types'
import { l } from './i18n'
import type { L } from './i18n'

/** signed integer delta, e.g. +11 / -2 / 0 */
const signed = (d: number) => { const n = Math.round(d); return n > 0 ? `+${n}` : `${n}` }

export interface Finding { indicator: IndicatorId | 'radiation' | 'bone'; severity: Severity; reasons: L[]; value: string; delta?: L }
export interface Baseline { mean: number; sd: number; n: number }

const toCore = (r: Reading): CoreReading => ({ sys: r.sys, dia: r.dia, hr: r.hr, glucose: r.glucose, temp: r.temp, sleep: r.sleep, mood: r.mood, exerciseMin: r.exerciseMin, phq2: r.phq2, selfHarm: r.selfHarm })

type BaselineKey = 'sys' | 'dia' | 'hr' | 'glucose' | 'temp' | 'sleep' | 'mood'
export function baselineOf(readings: Reading[], key: keyof Reading, upto: number): Baseline {
  return refBaselineOf(readings.map(toCore), upto, key as BaselineKey)
}

function zReason(f: CoreFinding, label: L): L[] {
  const z = f.z.toFixed(1)
  if (f.reasons & R.Z_STRONG) return [l(`${label.pt}: desvio forte da sua base (z=${z})`, `${label.en}: strong deviation from your baseline (z=${z})`)]
  if (f.reasons & R.Z_OUTSIDE) return [l(`${label.pt}: fora do seu padrão (z=${z})`, `${label.en}: outside your usual pattern (z=${z})`)]
  return []
}

const vsBase = (f: CoreFinding) => (f.baselineN ? l(`${signed(f.delta)} vs base`, `${signed(f.delta)} vs baseline`) : undefined)

export function assessReading(readings: Reading[], idx: number): Finding[] {
  const r = readings[idx]
  const a = core().assess(readings.map(toCore), idx)
  const out: Finding[] = []
  const has = (f: CoreFinding, flag: number) => (f.reasons & flag) !== 0
  { // blood pressure (AHA / NHLBI)
    const f = a.bp, reasons: L[] = []
    if (has(f, R.BP_CRISIS)) reasons.push(l('Crise hipertensiva (>180/120, AHA)', 'Hypertensive crisis (>180/120, AHA)'))
    if (has(f, R.BP_STAGE2)) reasons.push(l('Hipertensão estágio 2 (≥140/90, AHA)', 'Stage 2 hypertension (≥140/90, AHA)'))
    if (has(f, R.BP_STAGE1)) reasons.push(l('Hipertensão estágio 1 (130–139/80–89, AHA)', 'Stage 1 hypertension (130–139/80–89, AHA)'))
    if (has(f, R.BP_ELEVATED)) reasons.push(l('PA elevada (120–129, AHA)', 'Elevated BP (120–129, AHA)'))
    if (has(f, R.BP_DIA80)) reasons.push(l('Diastólica ≥80 (estágio 1, AHA)', 'Diastolic ≥80 (stage 1, AHA)'))
    if (has(f, R.BP_LOW)) reasons.push(l('PA baixa (<90/60, NHLBI)', 'Low BP (<90/60, NHLBI)'))
    reasons.push(...zReason(f, l('Sistólica', 'Systolic')))
    out.push({ indicator: 'bp', severity: f.severity, reasons, value: `${r.sys}/${r.dia} mmHg`, delta: vsBase(f) })
  }
  { // heart rate (AHA 60–100)
    const f = a.hr, reasons: L[] = []
    if (has(f, R.HR_TACHY)) reasons.push(l('Taquicardia em repouso (>100 bpm)', 'Resting tachycardia (>100 bpm)'))
    if (has(f, R.HR_BRADY)) reasons.push(l('<60 bpm (pode ser normal em atletas; compare com sua base)', '<60 bpm (may be normal in athletes; compare with your baseline)'))
    reasons.push(...zReason(f, l('FC', 'HR')))
    out.push({ indicator: 'hr', severity: f.severity, reasons, value: `${r.hr} bpm`, delta: vsBase(f) })
  }
  { // glucose (ADA)
    const f = a.glucose, reasons: L[] = []
    if (has(f, R.GLU_SEVERE_HYPO)) reasons.push(l('Hipoglicemia grave (<54 mg/dL, ADA)', 'Severe hypoglycemia (<54 mg/dL, ADA)'))
    if (has(f, R.GLU_HYPO)) reasons.push(l('Hipoglicemia (<70 mg/dL, ADA)', 'Hypoglycemia (<70 mg/dL, ADA)'))
    if (has(f, R.GLU_DIABETES)) reasons.push(l('Jejum ≥126 mg/dL (faixa de diabetes se repetido, ADA)', 'Fasting ≥126 mg/dL (diabetes range if repeated, ADA)'))
    if (has(f, R.GLU_IMPAIRED)) reasons.push(l('Glicemia de jejum alterada (100–125, ADA)', 'Impaired fasting glucose (100–125, ADA)'))
    reasons.push(...zReason(f, l('Glicemia', 'Glucose')))
    out.push({ indicator: 'glucose', severity: f.severity, reasons, value: `${r.glucose} mg/dL`, delta: vsBase(f) })
  }
  { // temperature: absolute (CDC ≥38) + RELATIVE to the in-flight baseline (space fever, Stahn 2017)
    const f = a.temp, reasons: L[] = []
    const d = f.delta.toFixed(1), m = f.baselineMean.toFixed(1)
    if (has(f, R.TEMP_FEVER)) reasons.push(l('Febre (≥38 °C, CDC)', 'Fever (≥38 °C, CDC)'))
    if (has(f, R.TEMP_DELTA_ALERT)) reasons.push(l(`+${d} °C acima da SUA base de voo (${m} °C)`, `+${d} °C above YOUR in-flight baseline (${m} °C)`))
    if (has(f, R.TEMP_DELTA_ATTN)) reasons.push(l(`+${d} °C acima da base de voo – possível febre mesmo abaixo de 38 °C`, `+${d} °C above in-flight baseline – possible fever even below 38 °C`))
    if (has(f, R.TEMP_LOW)) reasons.push(l('Temperatura baixa (<36 °C)', 'Low temperature (<36 °C)'))
    const sign = f.delta >= 0 ? '+' : ''
    out.push({ indicator: 'temp', severity: f.severity, reasons, value: `${r.temp.toFixed(1)} °C`, delta: f.baselineN ? l(`${sign}${d} °C vs base de voo`, `${sign}${d} °C vs in-flight baseline`) : undefined })
  }
  { // sleep (AASM ≥7 h) + 3-night average
    const f = a.sleep, reasons: L[] = []
    const avg3 = f.avg3.toFixed(1)
    if (has(f, R.SLEEP_LT5)) reasons.push(l('Menos de 5 h de sono', 'Less than 5 h of sleep'))
    if (has(f, R.SLEEP_LT7)) reasons.push(l('Abaixo de 7 h (meta AASM)', 'Below 7 h (AASM target)'))
    if (has(f, R.SLEEP_DEBT3)) reasons.push(l(`Média de 3 noites ${avg3} h – débito de sono acumulado`, `3-night average ${avg3} h – accumulated sleep debt`))
    reasons.push(...zReason(f, l('Sono', 'Sleep')))
    out.push({ indicator: 'sleep', severity: f.severity, reasons, value: `${r.sleep.toFixed(1)} h`, delta: l(`média 3 noites ${avg3} h`, `3-night avg ${avg3} h`) })
  }
  { // mood (1–5 scale + PHQ-2)
    const f = a.mood, reasons: L[] = []
    if (has(f, R.MOOD_LOW)) reasons.push(l('Humor baixo hoje', 'Low mood today'))
    if (has(f, R.MOOD_LOW3)) reasons.push(l('Humor baixo por 3 dias seguidos', 'Low mood 3 days in a row'))
    if (has(f, R.MOOD_PHQ2)) reasons.push(l(`PHQ-2 = ${r.phq2} (≥3 = rastreio positivo, Kroenke 2003)`, `PHQ-2 = ${r.phq2} (≥3 = positive screen, Kroenke 2003)`))
    if (has(f, R.MOOD_SELF_HARM)) reasons.push(l('Relatou pensamentos de se machucar – contato imediato', 'Reported thoughts of self-harm – immediate contact'))
    out.push({ indicator: 'mood', severity: f.severity, reasons, value: `${r.mood}/5${r.phq2 !== undefined ? ` · PHQ-2 ${r.phq2}` : ''}` })
  }
  return out
}

export const daysBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)

export interface SolarContext { active: boolean; sheltered: boolean; liveDoseMSv: number; loggedDoseMSv: number }

export function radiationStatus(c: CrewMember, env: EnvironmentId, today: string, solar?: SolarContext) {
  const days = Math.max(0, daysBetween(c.missionStart, today))
  const e = ENV_NUMBERS[env]
  const o = core().radiation({ missionDays: days, doseRate: e.doseMSvPerDay, priorCareerMSv: c.priorCareerDoseMSv, loggedEventMSv: solar?.loggedDoseMSv ?? 0, liveEventMSv: solar?.liveDoseMSv ?? 0, solarActive: !!solar?.active, sheltered: !!solar?.sheltered, deepSpace: e.deepSpace })
  const reasons: L[] = []
  if (o.solarReason === SOLAR.IN_SHELTER) reasons.push(l('Evento de partículas solares em curso — tripulação no abrigo', 'Solar particle event in progress — crew in shelter'))
  if (o.solarReason === SOLAR.GO_TO_SHELTER) reasons.push(l('Evento de partículas solares em curso — VÁ PARA O ABRIGO', 'Solar particle event in progress — GO TO SHELTER'))
  return { days, rate: e.doseMSvPerDay, mission: o.missionMSv, total: o.totalMSv, pct: o.pct, severity: o.severity, daysLeft: o.daysLeft, eventDose: o.eventMSv, reasons, solarActive: !!solar?.active }
}

/**
 * Fatigue from the PVT: latest session vs the person's own PVT baseline, cross-checked with sleep.
 * PVT-B lapse threshold 355 ms (Basner 2011). Slowing/lapse cut-offs = prototype heuristics.
 */
export function fatigueStatus(c: CrewMember) {
  const hist = c.pvt ?? []
  const latest = hist.at(-1)
  const o = core().fatigue(hist.map((p) => ({ medianMs: p.medianMs, lapses: p.lapses })), c.readings.map((r) => r.sleep))
  const reasons: L[] = []
  const pct = o.slowingPct.toFixed(0), s3 = o.sleepAvg3.toFixed(1), lapses = o.latestLapses
  if (o.reasons & (FAT.LAPSES5 | FAT.LAPSES3)) reasons.push(l(`${lapses} lapsos (≥355 ms) no PVT`, `${lapses} lapses (≥355 ms) on the PVT`))
  if (o.reasons & (FAT.SLOW20 | FAT.SLOW10)) reasons.push(l(`Reação ${pct}% mais lenta que sua base`, `Reaction ${pct}% slower than your baseline`))
  if (o.reasons & FAT.SHORT_SLEEP) reasons.push(l(`Coincide com sono curto (média 3 noites ${s3} h) — provável fadiga`, `Coincides with short sleep (3-night avg ${s3} h) — likely fatigue`))
  return { latest, baselineMs: o.baselineMs, slowingPct: o.slowingPct, sleepAvg3: o.sleepAvg3, severity: o.severity, reasons }
}

export function boneStatus(c: CrewMember, today: string) {
  const days = Math.max(0, daysBetween(c.missionStart, today))
  // no countermeasure: 1–1.5 %/month (NASA HRP); resistive exercise reduces it (factor = prototype heuristic)
  const o = core().bone(days, c.readings.map((r) => r.exerciseMin ?? 0))
  return { days, months: o.months, adherence: o.adherence, low: o.low, high: o.high, severity: o.severity }
}

export interface CrewAssessment {
  findings: Finding[]
  overall: Severity
  regions: Record<BodyRegionId, Severity>
  radiation: ReturnType<typeof radiationStatus>
  bone: ReturnType<typeof boneStatus>
  fatigue: ReturnType<typeof fatigueStatus>
}

export function assessCrew(c: CrewMember, env: EnvironmentId, solar?: SolarContext): CrewAssessment | null {
  if (!c.readings.length) return null
  const idx = c.readings.length - 1
  const today = c.readings[idx].date
  const findings = assessReading(c.readings, idx)
  const radiation = radiationStatus(c, env, today, solar)
  const bone = boneStatus(c, today)
  const fatigue = fatigueStatus(c)
  const sev = INDICATOR_ORDER.map((id) => findings.find((f) => f.indicator === id)?.severity ?? 0)
  const agg = core().aggregate(sev, radiation.severity, bone.severity, fatigue.severity)
  const regions = Object.fromEntries(REGION_ORDER.map((rid, i) => [rid, agg.regions[i]])) as Record<BodyRegionId, Severity>
  return { findings, overall: agg.overall, regions, radiation, bone, fatigue }
}

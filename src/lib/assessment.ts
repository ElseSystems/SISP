/**
 * Avaliação: combina LIMITE ABSOLUTO (diretrizes publicadas) com DESVIO DA LINHA DE BASE PESSOAL.
 * ⚠️ Heurística de protótipo – não é dispositivo médico.
 */
import { BONE, ENVIRONMENTS, PROTOTYPE_HEURISTICS as H, RADIATION, BODY_REGIONS } from './knowledge'
import type { BodyRegionId, EnvironmentId, IndicatorId, Severity } from './knowledge'
import type { CrewMember, Reading } from './types'
import { l } from './i18n'
import type { L } from './i18n'

/** signed integer delta, e.g. +11 / -2 / 0 */
const signed = (d: number) => { const n = Math.round(d); return n > 0 ? `+${n}` : `${n}` }

export interface Finding { indicator: IndicatorId | 'radiation' | 'bone'; severity: Severity; reasons: L[]; value: string; delta?: L }
export interface Baseline { mean: number; sd: number; n: number }

const SD_FLOOR: Record<string, number> = { sys: 4, dia: 3, hr: 3, glucose: 4, temp: 0.15, sleep: 0.4, mood: 0.5 }
const max = (a: Severity, b: Severity) => (a > b ? a : b) as Severity

export function baselineOf(readings: Reading[], key: keyof Reading, upto: number): Baseline {
  const win = readings.slice(Math.max(0, upto - H.baselineDays), upto).map((r) => Number(r[key])).filter((v) => !Number.isNaN(v))
  if (!win.length) return { mean: NaN, sd: SD_FLOOR[key as string] ?? 1, n: 0 }
  const mean = win.reduce((s, v) => s + v, 0) / win.length
  const sd = Math.sqrt(win.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, win.length - 1))
  return { mean, sd: Math.max(sd, SD_FLOOR[key as string] ?? 0.1), n: win.length }
}

function zSeverity(value: number, b: Baseline, label: L, reasons: L[]): Severity {
  if (b.n < 5) return 0
  const z = (value - b.mean) / b.sd
  if (Math.abs(z) >= H.zAlert) { reasons.push(l(`${label.pt}: desvio forte da sua base (z=${z.toFixed(1)})`, `${label.en}: strong deviation from your baseline (z=${z.toFixed(1)})`)); return 2 }
  if (Math.abs(z) >= H.zAttention) { reasons.push(l(`${label.pt}: fora do seu padrão (z=${z.toFixed(1)})`, `${label.en}: outside your usual pattern (z=${z.toFixed(1)})`)); return 1 }
  return 0
}

export function assessReading(readings: Reading[], idx: number): Finding[] {
  const r = readings[idx]
  const out: Finding[] = []

  // Pressão arterial (AHA / NHLBI)
  {
    const reasons: L[] = []
    let s: Severity = 0
    if (r.sys > 180 || r.dia > 120) { s = 3; reasons.push(l('Crise hipertensiva (>180/120, AHA)', 'Hypertensive crisis (>180/120, AHA)')) }
    else if (r.sys >= 140 || r.dia >= 90) { s = 2; reasons.push(l('Hipertensão estágio 2 (≥140/90, AHA)', 'Stage 2 hypertension (≥140/90, AHA)')) }
    else if (r.sys >= 120) { s = 1; reasons.push(r.sys >= 130 || r.dia >= 80 ? l('Hipertensão estágio 1 (130–139/80–89, AHA)', 'Stage 1 hypertension (130–139/80–89, AHA)') : l('PA elevada (120–129, AHA)', 'Elevated BP (120–129, AHA)')) }
    else if (r.dia >= 80) { s = 1; reasons.push(l('Diastólica ≥80 (estágio 1, AHA)', 'Diastolic ≥80 (stage 1, AHA)')) }
    if (r.sys < 90 || r.dia < 60) { s = max(s, 1); reasons.push(l('PA baixa (<90/60, NHLBI)', 'Low BP (<90/60, NHLBI)')) }
    const b = baselineOf(readings, 'sys', idx)
    s = max(s, zSeverity(r.sys, b, l('Sistólica', 'Systolic'), reasons))
    out.push({ indicator: 'bp', severity: s, reasons, value: `${r.sys}/${r.dia} mmHg`, delta: b.n ? l(`${signed(r.sys - b.mean)} vs base`, `${signed(r.sys - b.mean)} vs baseline`) : undefined })
  }
  // FC (AHA 60–100)
  {
    const reasons: L[] = []
    let s: Severity = 0
    if (r.hr > 100) { s = 1; reasons.push(l('Taquicardia em repouso (>100 bpm)', 'Resting tachycardia (>100 bpm)')) }
    if (r.hr < 60) { s = 1; reasons.push(l('<60 bpm (pode ser normal em atletas; compare com sua base)', '<60 bpm (may be normal in athletes; compare with your baseline)')) }
    const b = baselineOf(readings, 'hr', idx)
    s = max(s, zSeverity(r.hr, b, l('FC', 'HR'), reasons))
    out.push({ indicator: 'hr', severity: s, reasons, value: `${r.hr} bpm`, delta: b.n ? l(`${signed(r.hr - b.mean)} vs base`, `${signed(r.hr - b.mean)} vs baseline`) : undefined })
  }
  // Glicemia (ADA)
  {
    const reasons: L[] = []
    let s: Severity = 0
    if (r.glucose < 54) { s = 3; reasons.push(l('Hipoglicemia grave (<54 mg/dL, ADA)', 'Severe hypoglycemia (<54 mg/dL, ADA)')) }
    else if (r.glucose < 70) { s = 2; reasons.push(l('Hipoglicemia (<70 mg/dL, ADA)', 'Hypoglycemia (<70 mg/dL, ADA)')) }
    else if (r.glucose >= 126) { s = 2; reasons.push(l('Jejum ≥126 mg/dL (faixa de diabetes se repetido, ADA)', 'Fasting ≥126 mg/dL (diabetes range if repeated, ADA)')) }
    else if (r.glucose >= 100) { s = 1; reasons.push(l('Glicemia de jejum alterada (100–125, ADA)', 'Impaired fasting glucose (100–125, ADA)')) }
    const b = baselineOf(readings, 'glucose', idx)
    s = max(s, zSeverity(r.glucose, b, l('Glicemia', 'Glucose'), reasons))
    out.push({ indicator: 'glucose', severity: s, reasons, value: `${r.glucose} mg/dL`, delta: b.n ? l(`${signed(r.glucose - b.mean)} vs base`, `${signed(r.glucose - b.mean)} vs baseline`) : undefined })
  }
  // Temperatura: absoluto (CDC ≥38) + RELATIVO à base de voo (febre espacial, Stahn 2017)
  {
    const reasons: L[] = []
    let s: Severity = 0
    const b = baselineOf(readings, 'temp', idx)
    const delta = b.n ? r.temp - b.mean : 0
    if (r.temp >= 38) { s = 2; reasons.push(l('Febre (≥38 °C, CDC)', 'Fever (≥38 °C, CDC)')) }
    if (b.n >= 5 && delta >= H.tempDeltaAlert) { s = max(s, 2); reasons.push(l(`+${delta.toFixed(1)} °C acima da SUA base de voo (${b.mean.toFixed(1)} °C)`, `+${delta.toFixed(1)} °C above YOUR in-flight baseline (${b.mean.toFixed(1)} °C)`)) }
    else if (b.n >= 5 && delta >= H.tempDeltaAttention) { s = max(s, 1); reasons.push(l(`+${delta.toFixed(1)} °C acima da base de voo – possível febre mesmo abaixo de 38 °C`, `+${delta.toFixed(1)} °C above in-flight baseline – possible fever even below 38 °C`)) }
    if (r.temp < 36) { s = max(s, 1); reasons.push(l('Temperatura baixa (<36 °C)', 'Low temperature (<36 °C)')) }
    out.push({ indicator: 'temp', severity: s, reasons, value: `${r.temp.toFixed(1)} °C`, delta: b.n ? l(`${delta >= 0 ? '+' : ''}${delta.toFixed(1)} °C vs base de voo`, `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} °C vs in-flight baseline`) : undefined })
  }
  // Sono (AASM ≥7h) + média de 3 noites
  {
    const reasons: L[] = []
    let s: Severity = 0
    const last3 = readings.slice(Math.max(0, idx - 2), idx + 1).map((x) => x.sleep)
    const avg3 = last3.reduce((a, v) => a + v, 0) / last3.length
    if (r.sleep < 5) { s = 2; reasons.push(l('Menos de 5 h de sono', 'Less than 5 h of sleep')) }
    else if (r.sleep < 7) { s = 1; reasons.push(l('Abaixo de 7 h (meta AASM)', 'Below 7 h (AASM target)')) }
    if (last3.length === 3 && avg3 < 5.5) { s = max(s, 2); reasons.push(l(`Média de 3 noites ${avg3.toFixed(1)} h – débito de sono acumulado`, `3-night average ${avg3.toFixed(1)} h – accumulated sleep debt`)) }
    const b = baselineOf(readings, 'sleep', idx)
    s = max(s, zSeverity(r.sleep, b, l('Sono', 'Sleep'), reasons))
    out.push({ indicator: 'sleep', severity: s, reasons, value: `${r.sleep.toFixed(1)} h`, delta: l(`média 3 noites ${avg3.toFixed(1)} h`, `3-night avg ${avg3.toFixed(1)} h`) })
  }
  // Humor (escala 1–5 + PHQ-2)
  {
    const reasons: L[] = []
    let s: Severity = 0
    if (r.mood <= 2) { s = 1; reasons.push(l('Humor baixo hoje', 'Low mood today')) }
    const lowStreak = readings.slice(Math.max(0, idx - 2), idx + 1).filter((x) => x.mood <= 2).length
    if (lowStreak >= 3) { s = max(s, 2); reasons.push(l('Humor baixo por 3 dias seguidos', 'Low mood 3 days in a row')) }
    if (r.phq2 !== undefined && r.phq2 >= 3) { s = max(s, 2); reasons.push(l(`PHQ-2 = ${r.phq2} (≥3 = rastreio positivo, Kroenke 2003)`, `PHQ-2 = ${r.phq2} (≥3 = positive screen, Kroenke 2003)`)) }
    if (r.selfHarm) { s = 3; reasons.push(l('Relatou pensamentos de se machucar – contato imediato', 'Reported thoughts of self-harm – immediate contact')) }
    out.push({ indicator: 'mood', severity: s, reasons, value: `${r.mood}/5${r.phq2 !== undefined ? ` · PHQ-2 ${r.phq2}` : ''}` })
  }
  return out
}

export const daysBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)

export function radiationStatus(c: CrewMember, env: EnvironmentId, today: string) {
  const days = Math.max(0, daysBetween(c.missionStart, today))
  const rate = ENVIRONMENTS[env].doseMSvPerDay
  const mission = days * rate
  const total = c.priorCareerDoseMSv + mission
  const pct = (total / RADIATION.careerLimitMSv) * 100
  // limiares de % do limite = heurística do protótipo
  const severity: Severity = pct >= 100 ? 3 : pct >= 80 ? 2 : pct >= 50 ? 1 : 0
  const daysLeft = Math.max(0, (RADIATION.careerLimitMSv - total) / rate)
  return { days, rate, mission, total, pct, severity, daysLeft }
}

export function boneStatus(c: CrewMember, today: string) {
  const days = Math.max(0, daysBetween(c.missionStart, today))
  const months = days / 30.44
  const ex = c.readings.slice(-14).map((r) => r.exerciseMin ?? 0)
  const adherence = Math.min(1, (ex.reduce((a, v) => a + v, 0) / Math.max(1, ex.length)) / 120)
  // sem contramedida: 1–1,5%/mês (NASA HRP). Exercício resistido reduz (fator = heurística do protótipo).
  const factor = 1 - 0.6 * adherence
  const low = months * BONE.lossPerMonthPct[0] * factor
  const high = months * BONE.lossPerMonthPct[1] * factor
  const severity: Severity = high >= 5 ? 2 : high >= 3 ? 1 : 0
  return { days, months, adherence, low, high, severity }
}

export interface CrewAssessment {
  findings: Finding[]
  overall: Severity
  regions: Record<BodyRegionId, Severity>
  radiation: ReturnType<typeof radiationStatus>
  bone: ReturnType<typeof boneStatus>
}

export function assessCrew(c: CrewMember, env: EnvironmentId): CrewAssessment | null {
  if (!c.readings.length) return null
  const idx = c.readings.length - 1
  const today = c.readings[idx].date
  const findings = assessReading(c.readings, idx)
  const radiation = radiationStatus(c, env, today)
  const bone = boneStatus(c, today)
  const sev = (id: string) => findings.find((f) => f.indicator === id)?.severity ?? 0
  const regions = {} as Record<BodyRegionId, Severity>
  for (const [rid, info] of Object.entries(BODY_REGIONS) as [BodyRegionId, (typeof BODY_REGIONS)[BodyRegionId]][]) {
    let s: Severity = 0
    for (const ind of info.indicators) s = max(s, sev(ind))
    if (rid === 'musculoskeletal') s = max(s, bone.severity)
    if (rid === 'immune' || rid === 'brain') s = max(s, Math.min(radiation.severity, 2) as Severity)
    regions[rid] = s
  }
  const overall = [...findings.map((f) => f.severity), radiation.severity, bone.severity].reduce(max, 0 as Severity)
  return { findings, overall, regions, radiation, bone }
}

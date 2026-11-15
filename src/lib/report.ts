/**
 * Compact flight-surgeon report (JSON + plain text). Designed for a delayed, low-bandwidth link:
 * short keys, numbers rounded, only what changes a decision.
 * ⚠️ Prototype format — not a NASA medical data standard.
 */
import { ENVIRONMENTS, INDICATORS, SEVERITY_LABEL } from './knowledge'
import type { EnvironmentId } from './knowledge'
import type { CrewAssessment } from './assessment'
import type { CrewMember } from './types'
import type { ActiveSolar } from './spaceWeather'
import { fmtDelay } from './escalation'
import { tr } from './i18n'

/** time the ground needs to read + answer, on top of the light delay (prototype assumption) */
export const GROUND_REVIEW_MIN = 30

export interface ReportInput { c: CrewMember; a: CrewAssessment; env: EnvironmentId; met: string; actions: string[]; notes: string; solar: ActiveSolar | null; now?: Date }

export function buildReport({ c, a, env, met, actions, notes, solar, now = new Date() }: ReportInput) {
  const e = ENVIRONMENTS[env]
  const r = c.readings.at(-1)!
  const rtt = e.delaySecOneWay * 2
  const reply = new Date(now.getTime() + (rtt + GROUND_REVIEW_MIN * 60) * 1000)
  const pulse = c.pulse?.at(-1)
  const f = a.fatigue
  const json = {
    v: 1,
    kind: 'SISP-MEDREP',
    utc: now.toISOString().slice(0, 16) + 'Z',
    met,
    crew: { id: c.id.toUpperCase(), role: tr(c.role), agency: c.agency },
    env: { id: env, owlt_s: e.delaySecOneWay, rtt_s: rtt, reply_earliest_utc: reply.toISOString().slice(11, 16) + 'Z', autonomous: e.delaySecOneWay > 60 },
    status: `N${a.overall}`,
    vitals: { bp: `${r.sys}/${r.dia}`, hr: r.hr, glu: r.glucose, temp: r.temp, sleep: r.sleep, mood: r.mood, ...(r.phq2 !== undefined ? { phq2: r.phq2 } : {}), src: r.source },
    flags: a.findings.filter((x) => x.severity > 0).map((x) => ({ i: x.indicator, n: x.severity, why: x.reasons.map((y) => y.en) })),
    rad: { total_mSv: +a.radiation.total.toFixed(1), pct_career: +a.radiation.pct.toFixed(1), sep_mSv: +a.radiation.eventDose.toFixed(2), ...(solar ? { sep_active: solar.sep.id, sheltered: !!solar.shelteredAt } : {}) },
    bone_loss_pct: [+a.bone.low.toFixed(1), +a.bone.high.toFixed(1)],
    ...(f.latest ? { pvt: { date: f.latest.date, median_ms: f.latest.medianMs, base_ms: Number.isNaN(f.baselineMs) ? null : Math.round(f.baselineMs), slow_pct: +f.slowingPct.toFixed(0), lapses: f.latest.lapses, n: f.latest.n } } : {}),
    ...(pulse ? { ppg: { bpm: pulse.bpm, q: +pulse.quality.toFixed(2), src: pulse.source } } : {}),
    actions,
    notes: notes.trim() || undefined,
    disclaimer: 'Prototype - not a medical device',
  }
  const L = (k: string, v: string) => `${k.padEnd(7)}${v}`
  const text = [
    `SISP MEDREP ${json.utc} ${met} ${json.crew.id} ${tr(e.name)}`,
    L('STATUS', `N${a.overall} ${tr(SEVERITY_LABEL[a.overall]).toUpperCase()}`),
    L('LINK', `OWLT ${fmtDelay(e.delaySecOneWay)} · RTT ${fmtDelay(rtt)} · reply ≥ ${json.env.reply_earliest_utc}${json.env.autonomous ? ' · CREW AUTONOMOUS' : ''}`),
    L('VITALS', `BP ${r.sys}/${r.dia} HR ${r.hr} GLU ${r.glucose} T ${r.temp.toFixed(1)} SLP ${r.sleep.toFixed(1)}h MOOD ${r.mood}/5${r.phq2 !== undefined ? ` PHQ2 ${r.phq2}` : ''}`),
    ...a.findings.filter((x) => x.severity > 0).map((x) => L(`N${x.severity}`, `${tr(INDICATORS[x.indicator as keyof typeof INDICATORS].name)} ${x.value}: ${x.reasons.map(tr).join('; ')}`)),
    L('RAD', `${a.radiation.total.toFixed(0)} mSv (${a.radiation.pct.toFixed(0)}% career)${a.radiation.eventDose > 0 ? ` · SEP +${a.radiation.eventDose.toFixed(1)} mSv` : ''}${solar ? ` · SEP ACTIVE${solar.shelteredAt ? ' · SHELTERED' : ' · NOT SHELTERED'}` : ''}`),
    L('BONE', `-${a.bone.low.toFixed(1)}…-${a.bone.high.toFixed(1)}% est.`),
    ...(f.latest ? [L('PVT', `median ${f.latest.medianMs} ms${Number.isNaN(f.baselineMs) ? '' : ` (base ${Math.round(f.baselineMs)}, ${f.slowingPct >= 0 ? '+' : ''}${f.slowingPct.toFixed(0)}%)`} · ${f.latest.lapses} lapses`)] : []),
    ...(pulse ? [L('PPG', `${pulse.bpm} bpm camera est. (q ${pulse.quality.toFixed(2)})`)] : []),
    ...(actions.length ? [L('DONE', actions.join(' | '))] : []),
    ...(notes.trim() ? [L('NOTES', notes.trim())] : []),
    'Prototype - not a medical device',
  ].join('\n')
  const jsonStr = JSON.stringify(json)
  return { json, jsonStr, text, bytes: new Blob([jsonStr]).size, textBytes: new Blob([text]).size, reply, rtt }
}

/**
 * Gerador de tripulação SIMULADA (30 dias). Dados médicos individuais de astronautas não são
 * públicos, então criamos séries plausíveis em torno de uma linha de base pessoal, com cenários
 * didáticos (privação de sono, "febre" relativa, PA subindo).
 */
import type { CrewMember, Reading } from './types'
import { l } from './i18n'
import type { L } from './i18n'

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const isoDay = (d: Date) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const r1 = (x: number) => Math.round(x * 10) / 10
const r0 = (x: number) => Math.round(x)

interface Base { sys: number; dia: number; hr: number; glucose: number; temp: number; sleep: number; mood: number }
type Drift = (dayIdx: number, days: number) => Partial<Base> & { phq2?: number }

const PROFILES: { id: string; name: L; role: L; avatar: string; agency: string; seed: number; base: Base; prior: number; startOffset: number; scenario: L; drift: Drift }[] = [
  {
    id: 't1', name: l('Tripulante 1', 'Crew Member 1'), role: l('Comandante', 'Commander'), avatar: '🧑‍🚀', agency: 'AEB/NASA', seed: 11, prior: 62, startOffset: 75,
    base: { sys: 112, dia: 72, hr: 62, glucose: 86, temp: 37.3, sleep: 7.4, mood: 4.2 },
    scenario: l('Estável – referência de tripulante saudável.', 'Stable – healthy crew member reference.'),
    drift: () => ({}),
  },
  {
    id: 't2', name: l('Tripulante 2', 'Crew Member 2'), role: l('Engenheiro de voo', 'Flight Engineer'), avatar: '🧑‍🚀', agency: 'JAXA', seed: 22, prior: 40, startOffset: 60,
    base: { sys: 118, dia: 76, hr: 66, glucose: 90, temp: 37.2, sleep: 6.6, mood: 4.0 },
    scenario: l('Sono caindo nos últimos 10 dias e humor piorando (isolamento).', 'Sleep declining over the last 10 days and mood worsening (isolation).'),
    drift: (i, n) => {
      const k = Math.max(0, i - (n - 10)) / 10
      return { sleep: -2.2 * k, mood: -2.0 * k, hr: 6 * k, phq2: i === n - 1 ? 3 : undefined }
    },
  },
  {
    id: 't3', name: l('Tripulante 3', 'Crew Member 3'), role: l('Especialista de missão (médica/CMO)', 'Mission Specialist (physician/CMO)'), avatar: '🧑‍🚀', agency: 'ESA', seed: 33, prior: 18, startOffset: 90,
    base: { sys: 108, dia: 68, hr: 64, glucose: 84, temp: 37.0, sleep: 7.2, mood: 4.3 },
    scenario: l('Temperatura ~+0,9 °C acima da base de voo nos últimos 2 dias, ainda abaixo de 38 °C (febre relativa).', 'Temperature ~+0.9 °C above in-flight baseline for 2 days, still below 38 °C (relative fever).'),
    drift: (i, n) => {
      const k = i === n - 1 ? 1 : i === n - 2 ? 0.45 : 0
      return { temp: 0.9 * k, hr: 8 * k, sleep: -0.8 * k }
    },
  },
  {
    id: 't4', name: l('Tripulante 4', 'Crew Member 4'), role: l('Piloto', 'Pilot'), avatar: '🧑‍🚀', agency: 'NASA', seed: 44, prior: 120, startOffset: 120,
    base: { sys: 122, dia: 79, hr: 70, glucose: 96, temp: 37.2, sleep: 6.2, mood: 3.9 },
    scenario: l('PA e glicemia de jejum em tendência de alta (resistência à insulina?).', 'BP and fasting glucose trending up (insulin resistance?).'),
    drift: (i, n) => {
      const k = i / (n - 1)
      return { sys: 20 * k, dia: 11 * k, glucose: 22 * k }
    },
  },
]

export function generateCrew(today = new Date(), days = 30): CrewMember[] {
  return PROFILES.map((p) => {
    const rnd = mulberry32(p.seed)
    const g = (sd: number) => { // gaussiana aproximada
      let s = 0
      for (let k = 0; k < 6; k++) s += rnd()
      return (s - 3) * sd * 1.41
    }
    const readings: Reading[] = []
    for (let i = 0; i < days; i++) {
      const d = p.drift(i, days)
      const b = p.base
      readings.push({
        date: isoDay(addDays(today, i - days + 1)),
        sys: r0(b.sys + (d.sys ?? 0) + g(4)),
        dia: r0(b.dia + (d.dia ?? 0) + g(3)),
        hr: r0(b.hr + (d.hr ?? 0) + g(3)),
        glucose: r0(b.glucose + (d.glucose ?? 0) + g(4)),
        temp: r1(b.temp + (d.temp ?? 0) + g(0.1)),
        sleep: r1(Math.max(2, b.sleep + (d.sleep ?? 0) + g(0.4))),
        mood: Math.min(5, Math.max(1, r0(b.mood + (d.mood ?? 0) + g(0.4)))),
        phq2: d.phq2 ?? (i % 7 === 6 ? (rnd() < 0.8 ? 0 : 1) : undefined),
        exerciseMin: r0(Math.max(0, 120 + g(20))),
        source: 'sim',
      })
    }
    return {
      id: p.id, name: p.name, role: p.role, avatar: p.avatar, agency: p.agency,
      missionStart: isoDay(addDays(today, -p.startOffset)),
      priorCareerDoseMSv: p.prior,
      scenario: p.scenario,
      readings,
    }
  })
}

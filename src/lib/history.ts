/** Bridges the app model and the SQLite history rows (src/storage). */
import { assessReading } from './assessment'
import type { CrewMember, Reading } from './types'
import type { SolarLogEntry } from './spaceWeather'
import type { DoseRow, Snapshot } from '../storage/ops'
import { dayTs } from '../storage/ops'

/** Worst indicator severity (0–3) of readings[idx] — stored as checkins.status. */
export function checkinStatus(readings: Reading[], idx: number): number {
  return Math.max(0, ...assessReading(readings, idx).map((f) => f.severity))
}

/** A solar event's dose lands on every crew member in the habitat. */
export function solarDoses(crew: CrewMember[], e: SolarLogEntry): DoseRow[] {
  return crew.map((c) => ({ crewId: c.id, ts: e.at, env: e.env, msv: e.doseMSv, source: 'sep', eventId: e.id }))
}

export function snapshotOf(crew: CrewMember[], solarLog: SolarLogEntry[]): Snapshot {
  return {
    crew,
    checkins: crew.flatMap((c) => c.readings.map((reading, i) => ({ crewId: c.id, ts: dayTs(reading.date), reading, status: checkinStatus(c.readings, i) }))),
    solarLog,
    doses: solarLog.flatMap((e) => solarDoses(crew, e)),
  }
}

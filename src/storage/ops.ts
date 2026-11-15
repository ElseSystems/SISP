/**
 * SISP history store — the SQL side, shared by the Web Worker (OPFS) and the Node test.
 * Schema and migrations come from core/store/schema.sql, the same file the C store
 * (core/store, sisp_store) embeds, so both sides always agree on the on-disk format.
 */
import type { Database, SqlValue } from '@sqlite.org/sqlite-wasm'
import type { CrewMember, PulseEstimate, PvtResult, Reading } from '../lib/types.ts'
import type { SolarLogEntry } from '../lib/spaceWeather.ts'
import type { EnvironmentId } from '../lib/knowledge.ts'
import type { L } from '../lib/i18n.ts'

export const SCHEMA_VERSION = 2
export const TABLES = ['crew', 'checkins', 'pvt_results', 'ppg_results', 'radiation_doses', 'solar_events', 'reports'] as const
export type Table = (typeof TABLES)[number]

/* ── rows sent from the main thread ─────────────────────────────────────── */
export interface CheckinRow { crewId: string; ts: number; reading: Reading; status: number }
export interface PvtRow { crewId: string; result: PvtResult }
export interface PpgRow { crewId: string; pulse: PulseEstimate }
export interface DoseRow { crewId: string; ts: number; env: EnvironmentId; msv: number; source: 'sep' | 'background' | 'dosimeter'; eventId?: string }
export interface ReportRow { crewId: string; ts: number; format: 'text' | 'json'; body: string; delaySec?: number }
export interface Snapshot {
  crew: CrewMember[]
  checkins: CheckinRow[]
  solarLog: SolarLogEntry[]
  doses: DoseRow[]
}
export interface History { crew: CrewMember[]; solarLog: SolarLogEntry[] }
export interface Stats { schemaVersion: number; journalMode: string; sqliteVersion: string; counts: Record<Table, number> }

/** Crew fields that have no column of their own (bilingual labels, avatar) ride in crew.meta. */
interface CrewMeta { name: L; role: L; scenario: L; avatar: string }

/** In-memory pulse history kept by the app (the database keeps every measurement). */
export const PULSE_KEEP = 20

/* ── migrations ─────────────────────────────────────────────────────────── */

/** Splits schema.sql on "-- @migration N" lines (start of line only, like the C store). */
export function parseMigrations(sql: string): { version: number; sql: string }[] {
  const out: { version: number; sql: string }[] = []
  const re = /^-- @migration (\d+)[^\n]*$/gm
  const marks = [...sql.matchAll(re)]
  marks.forEach((m, i) => {
    const start = m.index + m[0].length
    const end = i + 1 < marks.length ? marks[i + 1].index : sql.length
    out.push({ version: Number(m[1]), sql: sql.slice(start, end) })
  })
  return out
}

/** Applies pending migrations, each in its own transaction with its user_version bump. */
export function migrate(db: Database, schemaSql: string): number {
  let current = Number(db.selectValue('PRAGMA user_version'))
  const latest = Math.max(0, ...parseMigrations(schemaSql).map((m) => m.version))
  if (current > latest) throw new Error(`database schema v${current} is newer than this app (v${latest})`)
  for (const m of parseMigrations(schemaSql)) {
    if (m.version <= current) continue
    db.transaction('IMMEDIATE', (tx) => {
      tx.exec(m.sql)
      tx.exec(`PRAGMA user_version = ${m.version}`)
    })
    current = m.version
  }
  return current
}

/** Durability settings. Returns the journal mode actually in effect. */
export function configure(db: Database, wantWal: boolean): string {
  // WAL keeps its index in shared memory, which the OPFS SyncAccessHandle pool VFS lacks. With
  // EXCLUSIVE locking SQLite keeps the index on the heap instead — but only if the pragma runs
  // before the first access to the file, so it must be the very first statement on the handle.
  if (wantWal) db.exec('PRAGMA locking_mode = EXCLUSIVE')
  db.exec('PRAGMA foreign_keys = ON; PRAGMA synchronous = FULL; PRAGMA trusted_schema = OFF;')
  if (wantWal) {
    try {
      const mode = String(db.selectValue('PRAGMA journal_mode = WAL'))
      if (mode === 'wal') return mode
    } catch { /* keep the rollback journal */ }
  }
  return String(db.selectValue('PRAGMA journal_mode'))
}

/* ── meta ───────────────────────────────────────────────────────────────── */
export const getMeta = (db: Database, key: string) => db.selectValue('SELECT value FROM meta WHERE key = ?', [key]) as string | undefined
export const setMeta = (db: Database, key: string, value: string) =>
  void db.exec('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value', { bind: [key, value] })

export function counts(db: Database): Record<Table, number> {
  return Object.fromEntries(TABLES.map((t) => [t, Number(db.selectValue(`SELECT count(*) FROM ${t}`))])) as Record<Table, number>
}

/* ── writes (one prepared statement per kind, compiled once per connection) ─ */
const SQL = {
  crew: `INSERT INTO crew (id, name, role, agency, mission_start, prior_career_dose_msv, meta, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET name = excluded.name, role = excluded.role, agency = excluded.agency,
           mission_start = excluded.mission_start, prior_career_dose_msv = excluded.prior_career_dose_msv, meta = excluded.meta`,
  checkin: `INSERT INTO checkins (crew_id, ts, day, sys, dia, hr, glucose, temp, sleep, mood, phq2, self_harm, exercise_min, status, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (crew_id, day) DO UPDATE SET ts = excluded.ts, sys = excluded.sys, dia = excluded.dia, hr = excluded.hr,
              glucose = excluded.glucose, temp = excluded.temp, sleep = excluded.sleep, mood = excluded.mood, phq2 = excluded.phq2,
              self_harm = excluded.self_harm, exercise_min = excluded.exercise_min, status = excluded.status, source = excluded.source`,
  // PVT/PPG: idempotent on (crew_id, ts), so re-importing a snapshot never duplicates a session
  pvt: `INSERT INTO pvt_results (crew_id, ts, day, duration_sec, n, mean_ms, median_ms, lapses, false_starts, speed, source)
        SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11
        WHERE NOT EXISTS (SELECT 1 FROM pvt_results WHERE crew_id = ?1 AND ts = ?2)`,
  ppg: `INSERT INTO ppg_results (crew_id, ts, day, bpm, quality, source) SELECT ?1, ?2, ?3, ?4, ?5, ?6
        WHERE NOT EXISTS (SELECT 1 FROM ppg_results WHERE crew_id = ?1 AND ts = ?2)`,
  dose: 'INSERT INTO radiation_doses (crew_id, ts, env, msv, source, event_id) VALUES (?, ?, ?, ?, ?, ?)',
  solar: 'INSERT INTO solar_events (event_id, ts, env, dose_msv, sheltered, replay, flare) VALUES (?, ?, ?, ?, ?, ?, ?)',
  report: 'INSERT INTO reports (crew_id, ts, format, body, delay_sec) VALUES (?, ?, ?, ?, ?)',
} as const
type Kind = keyof typeof SQL

const cache = new WeakMap<Database, Map<Kind, ReturnType<Database['prepare']>>>()
function run(db: Database, kind: Kind, values: SqlValue[]) {
  let m = cache.get(db)
  if (!m) cache.set(db, (m = new Map()))
  let st = m.get(kind)
  if (!st) m.set(kind, (st = db.prepare(SQL[kind])))
  try {
    st.bind(values).step()
  } finally {
    st.reset(true) // also after a constraint error, so the cached statement stays usable
  }
}
/** Finalizes cached statements (before close / reset). */
export function finalize(db: Database) {
  cache.get(db)?.forEach((st) => st.finalize())
  cache.delete(db)
}

const opt = (v: number | undefined) => (v === undefined || Number.isNaN(v) ? null : v)
/** Noon UTC of a calendar day — the timestamp used for readings that only carry a date. */
export const dayTs = (day: string) => Date.parse(`${day}T12:00:00Z`)

export function upsertCrew(db: Database, c: CrewMember, now = Date.now()) {
  const meta: CrewMeta = { name: c.name, role: c.role, scenario: c.scenario, avatar: c.avatar }
  run(db, 'crew', [c.id, c.name.en, c.role.en, c.agency, c.missionStart, c.priorCareerDoseMSv, JSON.stringify(meta), now])
}
export function upsertCheckin(db: Database, { crewId, ts, reading: r, status }: CheckinRow) {
  run(db, 'checkin', [crewId, ts, r.date, r.sys, r.dia, r.hr, r.glucose, r.temp, r.sleep, r.mood, opt(r.phq2), r.selfHarm ? 1 : 0, opt(r.exerciseMin), status, r.source])
}
export function insertPvt(db: Database, { crewId, result: p }: PvtRow) {
  run(db, 'pvt', [crewId, p.at, p.date, p.durationSec, p.n, p.meanMs, p.medianMs, p.lapses, p.falseStarts, p.speed, p.source])
}
export function insertPpg(db: Database, { crewId, pulse: p }: PpgRow) {
  run(db, 'ppg', [crewId, p.at, p.date, p.bpm, p.quality, p.source])
}
export function insertDose(db: Database, d: DoseRow) {
  run(db, 'dose', [d.crewId, d.ts, d.env, d.msv, d.source, d.eventId ?? null])
}
export function insertSolar(db: Database, e: SolarLogEntry) {
  run(db, 'solar', [e.id, e.at, e.env, e.doseMSv, e.sheltered ? 1 : 0, e.replay ? 1 : 0, e.flare ?? null])
}
export function insertReport(db: Database, r: ReportRow) {
  run(db, 'report', [r.crewId, r.ts, r.format, r.body, opt(r.delaySec)])
}

/**
 * Writes a whole app snapshot in one savepoint: the first-run migration from localStorage, a reset,
 * or the daily refresh of the simulated series (check-ins upsert by day, PVT/PPG skip known sessions,
 * so merging never deletes or duplicates history).
 */
export function importSnapshot(db: Database, snap: Snapshot) {
  db.savepoint(() => { // savepoint: atomic on its own, and nests inside a caller's transaction
    const now = Date.now()
    snap.crew.forEach((c, i) => upsertCrew(db, c, now + i))
    snap.checkins.forEach((r) => upsertCheckin(db, r))
    for (const c of snap.crew) {
      c.pvt?.forEach((result) => insertPvt(db, { crewId: c.id, result }))
      c.pulse?.forEach((pulse) => insertPpg(db, { crewId: c.id, pulse }))
    }
    snap.solarLog.forEach((e) => insertSolar(db, e))
    snap.doses.forEach((d) => insertDose(db, d))
  })
}

/**
 * The demo's simulated series follows the calendar (a fresh 30-day scenario ending today). Swap the
 * previous simulated rows (source = 'sim') for the new ones; manual, camera and imported records stay.
 */
export function replaceSimulated(db: Database, snap: Snapshot) {
  db.savepoint((tx) => {
    tx.exec("DELETE FROM checkins WHERE source = 'sim'")
    tx.exec("DELETE FROM pvt_results WHERE source = 'sim'")
    importSnapshot(tx, snap)
  })
}

/** Deletes every history row (the app's "regenerate simulated crew" button). The schema stays. */
export function clearHistory(db: Database) {
  db.savepoint((tx) => {
    for (const t of ['reports', 'radiation_doses', 'solar_events', 'ppg_results', 'pvt_results', 'checkins', 'crew']) tx.exec(`DELETE FROM ${t}`)
  })
}

/* ── reads ──────────────────────────────────────────────────────────────── */
type Row = Record<string, SqlValue>
const num = (v: SqlValue) => Number(v)
const str = (v: SqlValue) => String(v)

/** Rebuilds the app's in-memory model (crew with readings/PVT/pulse, solar log) from the database. */
export function loadHistory(db: Database): History {
  const crew: CrewMember[] = db.selectObjects('SELECT * FROM crew ORDER BY created_at, rowid').map((c: Row) => {
    const meta = JSON.parse(str(c.meta ?? '{}')) as Partial<CrewMeta>
    const id = str(c.id)
    const readings = db.selectObjects('SELECT * FROM checkins WHERE crew_id = ? ORDER BY day', [id]).map((r: Row): Reading => {
      const x: Reading = {
        date: str(r.day), sys: num(r.sys), dia: num(r.dia), hr: num(r.hr), glucose: num(r.glucose),
        temp: num(r.temp), sleep: num(r.sleep), mood: num(r.mood), source: str(r.source) as Reading['source'],
      }
      if (r.phq2 !== null) x.phq2 = num(r.phq2)
      if (num(r.self_harm)) x.selfHarm = true
      if (r.exercise_min !== null) x.exerciseMin = num(r.exercise_min)
      return x
    })
    const pvt = db.selectObjects('SELECT * FROM pvt_results WHERE crew_id = ? ORDER BY ts, id', [id]).map((p: Row): PvtResult => ({
      date: str(p.day), at: num(p.ts), durationSec: num(p.duration_sec), n: num(p.n), meanMs: num(p.mean_ms),
      medianMs: num(p.median_ms), lapses: num(p.lapses), falseStarts: num(p.false_starts), speed: num(p.speed),
      source: str(p.source) as PvtResult['source'],
    }))
    const pulse = db.selectObjects(
      'SELECT * FROM (SELECT * FROM ppg_results WHERE crew_id = ? ORDER BY ts DESC, id DESC LIMIT ?) ORDER BY ts, id', [id, PULSE_KEEP],
    ).map((p: Row): PulseEstimate => ({ at: num(p.ts), date: str(p.day), bpm: num(p.bpm), quality: num(p.quality), source: str(p.source) as PulseEstimate['source'] }))
    const label = (v: L | undefined, fallback: SqlValue): L => v ?? { pt: str(fallback ?? ''), en: str(fallback ?? '') }
    const m: CrewMember = {
      id, name: label(meta.name, c.name), role: label(meta.role, c.role), avatar: meta.avatar ?? '🧑‍🚀', agency: str(c.agency ?? ''),
      missionStart: str(c.mission_start ?? ''), priorCareerDoseMSv: num(c.prior_career_dose_msv), scenario: label(meta.scenario, ''), readings,
    }
    if (pvt.length) m.pvt = pvt
    if (pulse.length) m.pulse = pulse
    return m
  })
  const solarLog = db.selectObjects('SELECT * FROM solar_events ORDER BY ts, id').map((e: Row): SolarLogEntry => {
    const x: SolarLogEntry = { id: str(e.event_id), at: num(e.ts), env: str(e.env) as EnvironmentId, doseMSv: num(e.dose_msv), sheltered: !!num(e.sheltered), replay: !!num(e.replay) }
    if (e.flare !== null) x.flare = str(e.flare)
    return x
  })
  return { crew, solarLog }
}

/** The history as one JSON document — core/store/export.sql, the same query the C store runs. */
export function exportJson(db: Database, exportSql: string, crewId: string | null = null, from = -8.64e15, to = 8.64e15): string {
  return String(db.selectValue(exportSql, { ':crew': crewId, ':from': from, ':to': to }))
}

export function integrityCheck(db: Database): string {
  return String(db.selectValue('PRAGMA integrity_check'))
}

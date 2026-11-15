/**
 * SQLite history store — web side (src/storage/ops.ts) on the official @sqlite.org/sqlite-wasm,
 * in Node with an in-memory database (OPFS is browser-only; the SQL is identical).
 *   node scripts/storage-test.ts                     migrations, round trip, merge, export, constraints
 *   node scripts/storage-test.ts --in c.db --out web.db
 *        also open a database written by the C store (core/store) and write one for it to read back
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { deepStrictEqual, equal, ok, throws } from 'node:assert/strict'
import sqlite3InitModule from '@sqlite.org/sqlite-wasm'
import type { Database } from '@sqlite.org/sqlite-wasm'
import {
  configure, counts, exportJson, importSnapshot, insertReport, integrityCheck, loadHistory, migrate, parseMigrations,
  PULSE_KEEP, replaceSimulated, SCHEMA_VERSION, upsertCheckin,
} from '../src/storage/ops.ts'
import type { Snapshot } from '../src/storage/ops.ts'
import type { CrewMember, Reading } from '../src/lib/types.ts'

const schemaSql = readFileSync(new URL('../core/store/schema.sql', import.meta.url), 'utf8')
const exportSql = readFileSync(new URL('../core/store/export.sql', import.meta.url), 'utf8')
const arg = (name: string) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined }

const sqlite3 = await sqlite3InitModule()
const open = (): Database => { const db = new sqlite3.oo1.DB(':memory:', 'c'); configure(db, false); return db }

let checks = 0
const check = (name: string, fn: () => void) => { fn(); checks++; console.log(`  ✓ ${name}`) }

// deterministic fake crew (no app imports: keeps this runnable under plain Node)
const day = (i: number) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10)
function crewOf(n: number): CrewMember[] {
  return Array.from({ length: n }, (_, k) => {
    const readings: Reading[] = Array.from({ length: 20 }, (_, i) => {
      const r: Reading = { date: day(i), sys: 110 + k + (i % 5), dia: 70 + (i % 3), hr: 60 + k, glucose: 90 + i * 0.5, temp: 36.5 + i * 0.01, sleep: 7 - (i % 4) * 0.25, mood: 1 + ((i + k) % 5), source: 'sim' }
      if (i % 7 === 0) r.phq2 = i % 3
      if (i % 2 === 0) r.exerciseMin = 90 + i
      if (k === 1 && i === 19) { r.selfHarm = true; r.source = 'manual' }
      return r
    })
    const m: CrewMember = {
      id: `t${k + 1}`, name: { pt: `Tripulante ${k + 1}`, en: `Crew Member ${k + 1}` }, role: { pt: 'Comandante', en: 'Commander' },
      avatar: '🧑‍🚀', agency: 'NASA', missionStart: '2025-11-01', priorCareerDoseMSv: 40 * k, scenario: { pt: 'Estável', en: 'Stable' }, readings,
      pvt: [0, 1, 2].map((i) => ({ date: day(i), at: Date.parse(`${day(i)}T07:00:00Z`), durationSec: 180, n: 60, meanMs: 280 + i, medianMs: 270 + i, lapses: i, falseStarts: 0, speed: 3.6, source: 'sim' as const })),
    }
    if (k === 0) m.pulse = Array.from({ length: 25 }, (_, i) => ({ at: Date.parse(`${day(Math.floor(i / 2))}T08:00:00Z`) + (i % 2) * 3600000, date: day(Math.floor(i / 2)), bpm: 60 + i, quality: 0.8, source: 'camera' as const }))
    return m
  })
}
function snapshotOf(crew: CrewMember[], withSolar = true): Snapshot {
  const solarLog = withSolar ? [{ id: '2026-01-05T10:00:00-SEP-001', at: Date.parse('2026-01-05T12:00:00Z'), env: 'marsTransit' as const, doseMSv: 12.5, sheltered: true, replay: true, flare: 'X5.8' }] : []
  return {
    crew,
    checkins: crew.flatMap((c) => c.readings.map((reading, i) => ({ crewId: c.id, ts: Date.parse(`${reading.date}T12:00:00Z`), reading, status: i % 4 }))),
    solarLog,
    doses: solarLog.flatMap((e) => crew.map((c) => ({ crewId: c.id, ts: e.at, env: e.env, msv: e.doseMSv, source: 'sep' as const, eventId: e.id }))),
  }
}
const expected = (crew: CrewMember[]) => crew.map((c) => (c.pulse ? { ...c, pulse: c.pulse.slice(-PULSE_KEEP) } : c))

console.log(`SQLite ${sqlite3.version.libVersion} (wasm, Node) — schema.sql shared with core/store`)

check('schema.sql: migrations parsed from line-start tags only', () => {
  deepStrictEqual(parseMigrations(schemaSql).map((m) => m.version), [1, 2])
  equal(SCHEMA_VERSION, 2)
})

const db = open()
check('migrate: fresh database reaches v2, re-running is a no-op', () => {
  equal(migrate(db, schemaSql), SCHEMA_VERSION)
  equal(migrate(db, schemaSql), SCHEMA_VERSION)
  equal(Number(db.selectValue('PRAGMA user_version')), SCHEMA_VERSION)
  equal(db.selectValue('PRAGMA foreign_keys'), 1)
  equal(db.selectValue('PRAGMA synchronous'), 2) // FULL
})

const crew = crewOf(3)
check('import snapshot → load history round-trips the app model', () => {
  importSnapshot(db, snapshotOf(crew))
  const h = loadHistory(db)
  deepStrictEqual(h.crew, expected(crew))
  equal(h.solarLog.length, 1)
  deepStrictEqual(counts(db), { crew: 3, checkins: 60, pvt_results: 9, ppg_results: 25, radiation_doses: 3, solar_events: 1, reports: 0 })
})

check('merge is idempotent: check-ins upsert by day, PVT/PPG skip known sessions', () => {
  const again = crewOf(3)
  again[0].readings[19] = { ...again[0].readings[19], sys: 150, source: 'manual' }
  importSnapshot(db, snapshotOf(again, false))
  const c = counts(db)
  equal(c.checkins, 60); equal(c.pvt_results, 9); equal(c.ppg_results, 25); equal(c.solar_events, 1)
  equal(loadHistory(db).crew[0].readings[19].sys, 150)
})

check('daily refresh swaps simulated rows only (manual records stay)', () => {
  const tmp = open(); migrate(tmp, schemaSql)
  const day0 = crewOf(2)
  importSnapshot(tmp, snapshotOf(day0, false))
  const manualPvt = { date: day(5), at: Date.parse(`${day(5)}T10:00:00Z`), durationSec: 180, n: 55, meanMs: 300, medianMs: 290, lapses: 2, falseStarts: 1, speed: 3.3, source: 'manual' as const }
  importSnapshot(tmp, { crew: [{ ...day0[0], pvt: [manualPvt] }], checkins: [], solarLog: [], doses: [] })
  const day1 = crewOf(2).map((c) => ({ ...c, readings: c.readings.map((r) => ({ ...r, date: r.date === day(0) ? day(20) : r.date })), pvt: c.pvt?.map((p) => ({ ...p, at: p.at + 86400000 })) }))
  replaceSimulated(tmp, snapshotOf(day1, false))
  const c = counts(tmp)
  equal(c.checkins, 40)      // 2 × 20: old simulated days replaced, t2's manual reading kept by upsert
  equal(c.pvt_results, 2 * 3 + 1) // new simulated sessions + the manual one
  ok(loadHistory(tmp).crew[0].pvt?.some((p) => p.source === 'manual'))
  equal(integrityCheck(tmp), 'ok')
  tmp.close()
})

check('single writes: check-in upsert, report', () => {
  upsertCheckin(db, { crewId: 't2', ts: Date.parse('2026-01-21T09:00:00Z'), reading: { date: day(20), sys: 118, dia: 76, hr: 61, glucose: 92, temp: 36.7, sleep: 7, mood: 4, source: 'manual' }, status: 0 })
  insertReport(db, { crewId: 't2', ts: Date.now(), format: 'json', body: '{"v":1}', delaySec: 754 })
  equal(counts(db).checkins, 61)
  equal(counts(db).reports, 1)
})

check('constraints: unknown crew (FK) and status outside 0–3 are rejected', () => {
  throws(() => upsertCheckin(db, { crewId: 'ghost', ts: 0, reading: crew[0].readings[0], status: 0 }), /FOREIGN KEY/)
  throws(() => upsertCheckin(db, { crewId: 't1', ts: 0, reading: { ...crew[0].readings[0], date: '2027-01-01' }, status: 9 }), /CHECK/)
})

check('export.sql: one JSON document, filtered like the C export', () => {
  const j = JSON.parse(exportJson(db, exportSql))
  equal(j.format, 'sisp-history'); equal(j.schema_version, 2)
  equal(j.crew.length, 3); equal(j.checkins.length, 61); equal(j.radiation_doses.length, 3)
  deepStrictEqual(j.crew[0].meta.name, { pt: 'Tripulante 1', en: 'Crew Member 1' })
  const only = JSON.parse(exportJson(db, exportSql, 't2'))
  ok(only.checkins.every((c: { crew_id: string }) => c.crew_id === 't2'))
  equal(only.solar_events.length, 1)
})

check('integrity_check: ok', () => equal(integrityCheck(db), 'ok'))

check('a database from a newer schema is refused', () => {
  const future = open()
  future.exec('PRAGMA user_version = 99')
  throws(() => migrate(future, schemaSql), /newer/)
  future.close()
})

const out = arg('--out')
if (out) check(`wrote a web-made database for the C store: ${out}`, () => {
  writeFileSync(out, sqlite3.capi.sqlite3_js_db_export(db))
})

const input = arg('--in')
if (input) check(`opened a database written by the C store: ${input}`, () => {
  const bytes = new Uint8Array(readFileSync(input))
  bytes[18] = 1; bytes[19] = 1 // WAL → rollback journal flag: an in-memory copy can't use WAL
  const c = new sqlite3.oo1.DB(':memory:', 'c')
  const p = sqlite3.wasm.allocFromTypedArray(bytes)
  const rc = sqlite3.capi.sqlite3_deserialize(c, 'main', p, bytes.length, bytes.length, sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE | sqlite3.capi.SQLITE_DESERIALIZE_RESIZEABLE)
  equal(rc, 0)
  equal(migrate(c, schemaSql), SCHEMA_VERSION) // already current: no-op
  equal(integrityCheck(c), 'ok')
  const h = loadHistory(c)
  ok(h.crew.length >= 1, 'C database has crew')
  const n = h.crew.reduce((k, m) => k + m.readings.length, 0)
  ok(n > 0, 'C database has check-ins')
  console.log(`    ${h.crew.length} crew, ${n} check-ins from C`)
  c.close()
})

db.close()
console.log(`storage: ${checks} checks passed`)

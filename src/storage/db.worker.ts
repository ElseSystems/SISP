/// <reference lib="webworker" />
/**
 * SQLite history store in a Web Worker: @sqlite.org/sqlite-wasm on the "opfs-sahpool" VFS
 * (OPFS SyncAccessHandle pool). That VFS needs no SharedArrayBuffer, so it works on GitHub
 * Pages without COOP/COEP headers. Schema/migrations: core/store/schema.sql (shared with C).
 */
import sqlite3InitModule from '@sqlite.org/sqlite-wasm'
import type { Database } from '@sqlite.org/sqlite-wasm'
import schemaSql from '../../core/store/schema.sql?raw'
import exportSql from '../../core/store/export.sql?raw'
import {
  clearHistory, configure, counts, exportJson, getMeta, importSnapshot, insertDose, insertPpg, insertPvt,
  insertReport, insertSolar, integrityCheck, loadHistory, migrate, replaceSimulated, setMeta, upsertCheckin,
} from './ops.ts'
import type { Envelope, InitResult, Reply, Results } from './protocol.ts'

const DB_FILE = '/sisp-history.sqlite3'
const MIGRATED = 'migrated_from_localstorage'

let db: Database | null = null
let pool: { exportFile: (name: string) => Uint8Array } | null = null
let journalMode = ''
let sqliteVersion = ''
let ready: Promise<InitResult> | null = null

async function init(): Promise<InitResult> {
  const sqlite3 = await sqlite3InitModule()
  sqliteVersion = sqlite3.version.libVersion
  const sah = await sqlite3.installOpfsSAHPoolVfs({ name: 'opfs-sahpool', directory: '/sisp-sahpool', initialCapacity: 6 })
  pool = sah
  const stage = <T,>(name: string, fn: () => T): T => { try { return fn() } catch (e) { throw new Error(`${name}: ${e instanceof Error ? e.message : String(e)}`) } }
  db = stage('open', () => new sah.OpfsSAHPoolDb(DB_FILE))
  journalMode = stage('configure', () => configure(db!, true))
  const schemaVersion = stage('migrate', () => migrate(db!, schemaSql))
  const needsImport = getMeta(db, MIGRATED) === undefined && counts(db).crew === 0
  return { ok: true, vfs: 'opfs-sahpool', journalMode, sqliteVersion, schemaVersion, needsImport }
}

function need(): Database {
  if (!db) throw new Error('database not open')
  return db
}

async function handle(msg: Envelope): Promise<unknown> {
  if (msg.op === 'init') return (ready ??= init())
  await ready
  const d = need()
  switch (msg.op) {
    case 'import': {
      d.transaction('IMMEDIATE', () => {
        if (getMeta(d, MIGRATED) !== undefined) return // another call got here first
        importSnapshot(d, msg.snapshot)
        setMeta(d, MIGRATED, JSON.stringify({ at: new Date().toISOString(), source: msg.source }))
      })
      return { imported: counts(d) } satisfies Results['import']
    }
    case 'load': return loadHistory(d) satisfies Results['load']
    case 'checkin': upsertCheckin(d, msg.row); return null
    case 'pvt': insertPvt(d, msg.row); return null
    case 'ppg': insertPpg(d, msg.row); return null
    case 'solar':
      d.transaction('IMMEDIATE', () => { insertSolar(d, msg.entry); msg.doses.forEach((x) => insertDose(d, x)) })
      return null
    case 'report': insertReport(d, msg.row); return null
    case 'reset':
      d.transaction('IMMEDIATE', () => { clearHistory(d); importSnapshot(d, msg.snapshot) })
      return null
    case 'replaceSimulated':
      d.transaction('IMMEDIATE', () => replaceSimulated(d, msg.snapshot))
      return loadHistory(d) satisfies Results['replaceSimulated']
    case 'exportJson': return exportJson(d, exportSql)
    case 'exportDb': {
      // checkpoint so the single file holds everything, then copy it out of the pool
      if (journalMode === 'wal') d.exec('PRAGMA wal_checkpoint(TRUNCATE)')
      return pool!.exportFile(DB_FILE)
    }
    case 'stats': {
      const meta = getMeta(d, MIGRATED)
      return {
        schemaVersion: Number(d.selectValue('PRAGMA user_version')), journalMode, sqliteVersion, counts: counts(d),
        integrity: integrityCheck(d), importedFrom: meta,
      } satisfies Results['stats']
    }
  }
}

// One message at a time, in arrival order: writes can never interleave.
let queue: Promise<unknown> = Promise.resolve()
self.onmessage = (ev: MessageEvent<Envelope>) => {
  const msg = ev.data
  queue = queue.then(async () => {
    let reply: Reply
    try {
      reply = { id: msg.id, ok: true, result: await handle(msg) }
    } catch (err) {
      reply = { id: msg.id, ok: false, error: err instanceof Error ? err.message : String(err) }
      if (msg.op === 'init') ready = null
    }
    const transfer = reply.ok && reply.result instanceof Uint8Array ? [reply.result.buffer] : []
    ;(self as unknown as DedicatedWorkerGlobalScope).postMessage(reply, transfer as Transferable[])
  })
}

/**
 * SISP storage facade. History (crew, check-ins, PVT, pulse, solar events, doses, reports)
 * lives in SQLite — @sqlite.org/sqlite-wasm on OPFS (opfs-sahpool VFS) inside a Web Worker —
 * when the browser supports it. Otherwise the app keeps its previous localStorage persistence.
 * Every write is fire-and-forget into the worker's ordered queue; the UI never waits on disk.
 */
import { useSyncExternalStore } from 'react'
import type { CheckinRow, DoseRow, History, PpgRow, PvtRow, ReportRow, Snapshot } from './ops.ts'
import type { Envelope, InitResult, Reply, Request, Results } from './protocol.ts'
import type { SolarLogEntry } from '../lib/spaceWeather.ts'

export type Engine =
  | { kind: 'sqlite'; vfs: 'opfs-sahpool'; journalMode: string; sqliteVersion: string; schemaVersion: number }
  | { kind: 'localStorage'; reason: string }

let engine: Engine = { kind: 'localStorage', reason: 'starting' }
const listeners = new Set<() => void>()
const setEngine = (e: Engine) => { engine = e; listeners.forEach((fn) => fn()) }
export const storageEngine = () => engine
export const sqliteActive = () => engine.kind === 'sqlite'
/** localStorage stops holding crew history only once SQLite is active and the import checked out. */
let keepLocal = false
export const keepLocalCopy = () => { keepLocal = true }
export const sqliteOwnsHistory = () => engine.kind === 'sqlite' && !keepLocal
export const onStorageChange = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
export const useStorageEngine = () => useSyncExternalStore(onStorageChange, storageEngine, storageEngine)

/* ── worker RPC ─────────────────────────────────────────────────────────── */
let worker: Worker | null = null
let seq = 0
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()

function call<K extends Request['op']>(req: Extract<Request, { op: K }>): Promise<Results[K]> {
  if (!worker) return Promise.reject(new Error('storage worker not running'))
  const id = ++seq
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
    worker!.postMessage({ id, ...req } as Envelope)
  })
}
function fire<K extends Request['op']>(req: Extract<Request, { op: K }>) {
  if (engine.kind !== 'sqlite') return
  call(req).catch((err: unknown) => console.error(`[sisp] SQLite ${req.op} failed:`, err))
}

/** Why OPFS-backed SQLite can't run here (null = it can try). */
function unsupported(): string | null {
  if (typeof Worker === 'undefined') return 'no Web Worker'
  if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) return 'no OPFS'
  if (new URLSearchParams(location.search).get('storage') === 'local') return 'forced by ?storage=local'
  return null
}

/**
 * Starts the SQLite worker. Resolves with the engine in use; never rejects. If the database is new,
 * `snapshot()` (the state already loaded from localStorage) is imported once and `onImported` runs.
 * Returns the history to hydrate the app with when SQLite is active.
 */
export async function initStorage(snapshot: () => Snapshot, timeoutMs = 6000): Promise<{ engine: Engine; history?: History; imported?: boolean }> {
  const why = unsupported()
  if (why) { setEngine({ kind: 'localStorage', reason: why }); return { engine } }
  try {
    worker = new Worker(new URL('./db.worker.ts', import.meta.url), { type: 'module', name: 'sisp-sqlite' })
    worker.onmessage = (ev: MessageEvent<Reply>) => {
      const r = ev.data
      const p = pending.get(r.id)
      if (!p) return
      pending.delete(r.id)
      if (r.ok) p.resolve(r.result); else p.reject(new Error(r.error))
    }
    worker.onerror = (ev) => { ev.preventDefault(); pending.forEach((p) => p.reject(new Error(ev.message || 'worker error'))); pending.clear() }
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`timed out after ${timeoutMs} ms`)), timeoutMs))
    const info: InitResult = await Promise.race([call({ op: 'init' }), timeout])
    let imported = false
    if (info.needsImport) {
      await call({ op: 'import', snapshot: snapshot(), source: 'localStorage:sisp-v3' })
      imported = true
    }
    const history = await call({ op: 'load' })
    setEngine({ kind: 'sqlite', vfs: info.vfs, journalMode: info.journalMode, sqliteVersion: info.sqliteVersion, schemaVersion: info.schemaVersion })
    return { engine, history, imported }
  } catch (err) {
    console.warn('[sisp] SQLite/OPFS unavailable, keeping localStorage:', err)
    worker?.terminate()
    worker = null
    pending.clear()
    const msg = err instanceof Error ? err.message : String(err)
    // OPFS access handles are exclusive: a second tab can't open the pool while the first holds it
    const busy = /Access Handles? cannot be created|NoModificationAllowed/i.test(msg)
    setEngine({ kind: 'localStorage', reason: busy ? 'other-tab' : msg })
    return { engine }
  }
}

/* ── writes (no-ops on the localStorage engine) ─────────────────────────── */
export const history = {
  checkin: (row: CheckinRow) => fire({ op: 'checkin', row }),
  pvt: (row: PvtRow) => fire({ op: 'pvt', row }),
  ppg: (row: PpgRow) => fire({ op: 'ppg', row }),
  solar: (entry: SolarLogEntry, doses: DoseRow[]) => fire({ op: 'solar', entry, doses }),
  report: (row: ReportRow) => fire({ op: 'report', row }),
  reset: (snapshot: Snapshot) => fire({ op: 'reset', snapshot }),
  /** swaps the simulated rows for a new series and returns the full history afterwards */
  replaceSimulated: (snapshot: Snapshot) => call({ op: 'replaceSimulated', snapshot }),
  exportJson: () => call({ op: 'exportJson' }),
  exportDb: () => call({ op: 'exportDb' }),
  stats: () => call({ op: 'stats' }),
}

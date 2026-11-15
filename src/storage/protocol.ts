/** Messages between the app (main thread) and the SQLite worker. */
import type { CheckinRow, DoseRow, History, PpgRow, PvtRow, ReportRow, Snapshot, Stats } from './ops.ts'
import type { SolarLogEntry } from '../lib/spaceWeather.ts'

export interface InitResult {
  ok: true
  vfs: 'opfs-sahpool'
  journalMode: string
  sqliteVersion: string
  schemaVersion: number
  /** true when the database was empty and still needs the one-time localStorage import */
  needsImport: boolean
}

export type Request =
  | { op: 'init' }
  | { op: 'import'; snapshot: Snapshot; source: string }
  | { op: 'load' }
  | { op: 'checkin'; row: CheckinRow }
  | { op: 'pvt'; row: PvtRow }
  | { op: 'ppg'; row: PpgRow }
  | { op: 'solar'; entry: SolarLogEntry; doses: DoseRow[] }
  | { op: 'report'; row: ReportRow }
  | { op: 'reset'; snapshot: Snapshot }
  | { op: 'replaceSimulated'; snapshot: Snapshot }
  | { op: 'exportJson' }
  | { op: 'exportDb' }
  | { op: 'stats' }

export interface Results {
  init: InitResult
  import: { imported: Stats['counts'] }
  load: History
  checkin: null
  pvt: null
  ppg: null
  solar: null
  report: null
  reset: null
  replaceSimulated: History
  exportJson: string
  exportDb: Uint8Array
  stats: Stats & { integrity: string; importedFrom?: string }
}

export type Envelope = { id: number } & Request
export type Reply = { id: number; ok: true; result: unknown } | { id: number; ok: false; error: string }
